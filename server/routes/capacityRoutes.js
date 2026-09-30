/**
 * Smart Pre-order & Dynamic Capacity v2.1
 * Express Routes for Capacity Inspection & Reservation
 * 
 * Endpoints:
 * 1. GET  /api/capacity/:storeId/:date - Inspect 15-min slot availability for a day
 * 2. POST /api/capacity/reserve        - Reserve capacity for NOW or SCHEDULED pickup (Atomic Transaction)
 * 3. POST /api/capacity/release        - Manually release pending reservation
 */

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { adminDb } from '../firebaseAdmin.js';
import { optionalAuthenticate, isStoreOperator } from '../middleware/authenticate.js';
import { SlotTransactionService } from '../services/slotTransactionService.js';
import { calculateWorkload, resolveCurrentSlot } from '../services/capacityService.js';

export const capacityRouter = Router();

/**
 * GET /api/capacity/:storeId/:date
 * Inspection endpoint required by Phase 1 Requirement #8.
 * Example response:
 * {
 *   "storeId": "store_001",
 *   "date": "2026-09-26",
 *   "slots": [
 *     {
 *       "slotId": "2026-09-26_12-00",
 *       "startTime": "12:00",
 *       "endTime": "12:15",
 *       "capacity": 30,
 *       "confirmedWorkload": 18,
 *       "pendingWorkload": 5,
 *       "usedWorkload": 23,
 *       "remainingWorkload": 7,
 *       "status": "AVAILABLE"
 *     }
 *   ]
 * }
 */
capacityRouter.get('/:storeId/:date', async (req, res) => {
  try {
    const { storeId, date } = req.params;

    if (!storeId || !date) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PARAMS',
        message: 'storeId and date (YYYY-MM-DD) are required.'
      });
    }

    // Basic date validation YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATE_FORMAT',
        message: 'Date must be formatted as YYYY-MM-DD.'
      });
    }

    const capacityData = await SlotTransactionService.getStoreDateSlots({
      storeId,
      dateStr: date
    });

    return res.status(200).json(capacityData);
  } catch (error) {
    console.error('[Capacity API] Failed to fetch capacity:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message || 'Failed to fetch capacity.'
    });
  }
});

/**
 * POST /api/capacity/reserve
 * Atomic Capacity Reservation.
 * Computes workload from cart items and claims pending slot capacity.
 * 
 * - Enforces authentication (extracts verified UID from req.user)
 * - Checks idempotency key to prevent duplicate allocations
 * - Derives workload authoritatively on server
 */
capacityRouter.post('/reserve', optionalAuthenticate, async (req, res) => {
  try {
    const {
      storeId,
      items,
      pickupType = 'NOW',
      scheduledSlotId,
      reservationId: clientReservationId,
      idempotencyKey,
      customerId,
      schoolId: clientSchoolId,
      ttlMs = 10 * 60 * 1000
    } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_STORE_ID',
        message: 'storeId is required.'
      });
    }

    // 1. Check Idempotency Key before processing
    const key = idempotencyKey || req.headers['x-idempotency-key'];
    if (key) {
      const idempotencyRef = adminDb.collection('idempotency_records').doc(key);
      const existingRecord = await idempotencyRef.get();
      if (existingRecord.exists) {
        console.log(`[Capacity API] Idempotency cache hit for key: ${key}`);
        return res.status(200).json(existingRecord.data().response);
      }
    }

    // 2. Resolve Target SlotId
    let targetSlotId = scheduledSlotId;
    if (pickupType === 'NOW' || !targetSlotId) {
      const nowSlot = resolveCurrentSlot(Date.now(), 15);
      targetSlotId = nowSlot.slotId;
    }

    // 3. Compute Workload securely on server (never trust client workload number)
    const sanitizedItems = Array.isArray(items) && items.length > 0
      ? items.map(it => ({
          menuItemId: it.menuItemId,
          quantity: Math.max(1, parseInt(it.quantity, 10) || 1),
          workload: typeof it.workload === 'number' && it.workload > 0 ? it.workload : 1
        }))
      : [{ quantity: 1, workload: 1 }];

    const workload = calculateWorkload(sanitizedItems);

    // 4. Authenticated / Guest User & School Context
    // Header- and body-supplied identity carries no authority: req.user is
    // populated only from a verified token (or the dev mock-auth path).
    const uid = req.user?.uid || 'guest-user';
    const schoolId = req.user?.schoolId || 'school-default';

    // 5. Reservation id. An unauthenticated caller does not get to name the
    // document: every guest carries the uid 'guest-user', so reserveSlot's
    // ownership check cannot tell two guests apart, and a guest who passed
    // another guest's id would take over their reservation and their hold.
    // A signed-in caller may supply one — that is what makes a retry idempotent
    // — and the uid on the existing document then protects it.
    const reservationId = (req.user?.uid && clientReservationId)
      ? clientReservationId
      : `res_${randomUUID()}`;

    // 6. Run Atomic Firestore Transaction
    const result = await SlotTransactionService.reserveSlot({
      storeId,
      slotId: targetSlotId,
      reservationId,
      workload,
      pickupType,
      uid,
      schoolId,
      orderPayload: { items: sanitizedItems, storeId },
      idempotencyKey: key || null,
      ttlMs
    });

    if (!result.success && result.reason === 'RESERVATION_ID_TAKEN') {
      return res.status(409).json({
        success: false,
        error: 'RESERVATION_ID_TAKEN',
        code: 'RESERVATION_ID_TAKEN',
        message: 'รหัสการจองนี้เป็นของลูกค้าคนอื่น กรุณาเริ่มการจองใหม่'
      });
    }

    if (!result.success && result.reason === 'RESERVATION_ALREADY_CONFIRMED') {
      return res.status(409).json({
        success: false,
        error: 'RESERVATION_ALREADY_CONFIRMED',
        code: 'RESERVATION_ALREADY_CONFIRMED',
        message: 'การจองนี้ถูกยืนยันเป็นออเดอร์แล้ว กรุณาเริ่มการจองใหม่'
      });
    }

    if (!result.success) {
      return res.status(409).json({
        success: false,
        error: 'CAPACITY_FULL',
        code: 'CAPACITY_FULL',
        message: 'ครัวไม่สามารถรับออเดอร์เพิ่มในช่วงเวลานี้ได้ (Capacity เต็ม)',
        slotId: targetSlotId,
        remainingWorkload: result.remainingWorkload ?? 0,
        details: result.details
      });
    }

    const responsePayload = {
      success: true,
      reservationId: result.reservationId,
      slotId: result.slotId,
      workload: result.workload,
      pickupType,
      expiresAt: result.expiresAt,
      remainingWorkload: result.remainingWorkload
    };

    // 7. Store idempotency cache if key was provided
    if (key) {
      await adminDb.collection('idempotency_records').doc(key).set({
        key,
        response: responsePayload,
        reservationId: result.reservationId,
        createdAt: Date.now()
      });
    }

    return res.status(200).json(responsePayload);
  } catch (error) {
    console.error('[Capacity API] Reservation failed:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message || 'Capacity reservation transaction failed.'
    });
  }
});

/**
 * POST /api/capacity/release
 * Release reservation when customer cancels checkout or flow is aborted.
 */
capacityRouter.post('/release', optionalAuthenticate, async (req, res) => {
  try {
    const { storeId, slotId, reservationId } = req.body;

    if (!storeId || !slotId || !reservationId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: 'storeId, slotId, and reservationId are required.'
      });
    }

    // Releasing someone else's hold would hand their slot to the caller. Every
    // reservation is written together with its hold in one transaction, so an id
    // with no document behind it is nobody's hold to release — skipping the check
    // when the document is missing skipped it altogether.
    const reservationSnap = await adminDb.collection('reservations').doc(reservationId).get();
    if (!reservationSnap.exists) {
      return res.status(404).json({
        success: false,
        error: 'RESERVATION_NOT_FOUND',
        message: 'ไม่พบการจองนี้'
      });
    }

    const reservation = reservationSnap.data();
    const callerUid = req.user?.uid || 'guest-user';
    const isHolder = reservation.uid === callerUid;
    const operatesStore = await isStoreOperator(req.user, storeId);

    if (!isHolder && !operatesStore) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'This reservation belongs to another customer.'
      });
    }

    const result = await SlotTransactionService.releaseSlot({
      storeId,
      slotId,
      reservationId,
      isConfirmed: false
    });

    if (!result.success) {
      return res.status(409).json({
        success: false,
        error: result.reason || 'RELEASE_REFUSED',
        code: result.reason || 'RELEASE_REFUSED',
        message: result.reason === 'RESERVATION_NOT_PENDING'
          ? 'การจองนี้ถูกยืนยันเป็นออเดอร์แล้ว การคืนโควตาต้องทำผ่านการยกเลิกออเดอร์'
          : 'ไม่สามารถคืนโควตาการจองนี้ได้'
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[Capacity API] Release failed:', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message || 'Capacity release failed.'
    });
  }
});
