/**
 * Smart Pre-order & Dynamic Capacity v2.1
 * Firestore Transaction Layer: Atomic Slot & Reservation Management
 * 
 * Orchestrates Firestore Transactions around the pure domain logic in capacityService.js:
 * 1. Atomic Read-Modify-Write on pickup_slots/{storeId}_{slotId}
 * 2. Strict orderId = reservationId traceability
 * 3. Layered idempotency handling
 */

import { adminDb } from '../firebaseAdmin.js';
import {
  reserve,
  confirmReservation,
  releaseReservation,
  resolveCurrentSlot,
  getCapacityStatus
} from './capacityService.js';

export const SlotTransactionService = {
  /**
   * Generates reference for /stores/{storeId}/pickup_slots/{slotId}
   */
  getSlotRef(storeId, slotId) {
    return adminDb.collection('stores').doc(storeId).collection('pickup_slots').doc(slotId);
  },

  /**
   * Backward-compatible helper for compound doc ID
   */
  getSlotDocId(storeId, slotId) {
    return `${storeId}_${slotId}`;
  },

  /**
   * Atomic Reservation in Firestore Transaction.
   * Reads slot, filters expired pending, verifies capacity, appends reservation, and writes back.
   * 
   * @param {Object} params
   * @param {string} params.storeId
   * @param {string} params.slotId
   * @param {string} params.reservationId
   * @param {number} params.workload
   * @param {'NOW'|'SCHEDULED'} [params.pickupType='NOW']
   * @param {string} [params.uid]
   * @param {string} [params.schoolId]
   * @param {Object} [params.orderPayload]
   * @param {string} [params.idempotencyKey]
   * @param {number} [params.ttlMs=600000] - Default 10 minutes TTL
   * @param {number} [params.defaultCapacity=30]
   * @param {number} [params.now=Date.now()]
   * @returns {Promise<{ success: boolean, reservationId?: string, slotId?: string, workload?: number, expiresAt?: number, remainingWorkload?: number, reason?: string, details?: any }>}
   */
  async reserveSlot({
    storeId,
    slotId,
    reservationId,
    workload,
    pickupType = 'NOW',
    uid = 'anonymous',
    schoolId = 'school-default',
    orderPayload = {},
    idempotencyKey = null,
    ttlMs = 10 * 60 * 1000,
    defaultCapacity = 30,
    now = Date.now()
  }) {
    if (!storeId || !slotId || !reservationId) {
      throw new Error('storeId, slotId, and reservationId are strictly required for reserveSlot');
    }

    const slotRef = this.getSlotRef(storeId, slotId);
    const reservationRef = adminDb.collection('reservations').doc(reservationId);

    return adminDb.runTransaction(async (t) => {
      // 1. Read slot document
      const slotSnap = await t.get(slotRef);
      const slotData = slotSnap.exists ? slotSnap.data() : null;

      const capacity = slotData?.capacity ?? defaultCapacity;
      const confirmedWorkload = slotData?.confirmedWorkload ?? 0;
      const pending = Array.isArray(slotData?.pending) ? slotData.pending : [];

      // 2. Execute Pure Domain Logic
      const result = reserve({
        capacity,
        confirmedWorkload,
        pending,
        reservationId,
        newWorkload: workload,
        pickupType,
        ttlMs,
        now
      });

      // 3. Handle Capacity Exceeded
      if (!result.success) {
        // If expired reservations were purged, persist the cleaned pending array
        if (slotSnap.exists && result.details?.cleanedCount > 0) {
          t.update(slotRef, {
            pending: result.details.activePending,
            updatedAt: now
          });
        }
        return {
          success: false,
          reason: result.reason,
          code: 'CAPACITY_FULL',
          details: result.details,
          remainingWorkload: result.details?.remainingWorkload ?? 0
        };
      }

      // 4. Extract slot timing for metadata
      const [dateStr, timeRange] = slotId.includes('_') ? slotId.split('_') : ['', ''];
      const [startHour, startMin] = timeRange ? timeRange.split('-') : ['12', '00'];
      const startTime = `${startHour}:${startMin}`;
      const endMinuteTotal = Number(startHour) * 60 + Number(startMin) + 15;
      const endHour = String(Math.floor(endMinuteTotal / 60)).padStart(2, '0');
      const endMin = String(endMinuteTotal % 60).padStart(2, '0');
      const endTime = `${endHour}:${endMin}`;

      // 5. Persist updated slot (/stores/{storeId}/pickup_slots/{slotId})
      const updatedSlotData = {
        slotId,
        storeId,
        startTime,
        endTime,
        capacity,
        confirmedWorkload: result.confirmedWorkload,
        confirmedOrders: slotData?.confirmedOrders ?? 0,
        pending: result.pending,
        updatedAt: now
      };

      if (!slotSnap.exists) {
        updatedSlotData.createdAt = now;
        t.set(slotRef, updatedSlotData);
      } else {
        t.update(slotRef, updatedSlotData);
      }

      // 6. Persist reservation document (/reservations/{reservationId})
      t.set(reservationRef, {
        reservationId,
        uid,
        schoolId,
        storeId,
        slotId,
        pickupType: result.reservation.pickupType,
        workload: result.reservation.workload,
        status: 'PENDING_PAYMENT',
        expiresAt: result.reservation.expiresAt,
        orderPayload: orderPayload || {},
        idempotencyKey: idempotencyKey || null,
        paymentId: null,
        orderId: null,
        createdAt: now,
        updatedAt: now
      });

      return {
        success: true,
        slotId,
        reservationId,
        workload: result.reservation.workload,
        expiresAt: result.reservation.expiresAt,
        remainingWorkload: result.remainingWorkload
      };
    });
  },

  /**
   * Confirms a pending reservation (e.g. after payment confirmation).
   * Moves workload from pending to confirmedWorkload and marks orderId = reservationId.
   * 
   * @param {Object} params
   * @param {string} params.storeId
   * @param {string} params.slotId
   * @param {string} params.reservationId
   * @param {number} [params.now=Date.now()]
   * @returns {Promise<{ success: boolean, reservationId: string, orderId?: string, confirmedWorkload?: number, alreadyConfirmed?: boolean, reason?: string }>}
   */
  async confirmSlot({
    storeId,
    slotId,
    reservationId,
    now = Date.now()
  }) {
    if (!storeId || !slotId || !reservationId) {
      throw new Error('storeId, slotId, and reservationId are required for confirmSlot');
    }

    const slotRef = this.getSlotRef(storeId, slotId);
    const reservationRef = adminDb.collection('reservations').doc(reservationId);

    return adminDb.runTransaction(async (t) => {
      // 1. Read reservation
      const resSnap = await t.get(reservationRef);
      if (!resSnap.exists) {
        return {
          success: false,
          reason: 'RESERVATION_NOT_FOUND',
          reservationId
        };
      }

      const resData = resSnap.data();
      // Idempotency: if already confirmed, do nothing
      if (resData.status === 'CONFIRMED') {
        return {
          success: true,
          alreadyConfirmed: true,
          reservationId,
          orderId: resData.orderId || reservationId
        };
      }

      // 2. Read slot
      const slotSnap = await t.get(slotRef);
      if (!slotSnap.exists) {
        return {
          success: false,
          reason: 'SLOT_NOT_FOUND',
          reservationId
        };
      }

      const slotData = slotSnap.data();
      const confirmedWorkload = slotData.confirmedWorkload ?? 0;
      const pending = Array.isArray(slotData.pending) ? slotData.pending : [];

      // 3. Execute Pure Domain Confirmation
      const result = confirmReservation({
        confirmedWorkload,
        pending,
        reservationId,
        now
      });

      if (!result.success) {
        // Mark reservation expired if reason was expiration
        if (result.reason === 'RESERVATION_EXPIRED') {
          t.update(reservationRef, { status: 'EXPIRED', updatedAt: now });
          t.update(slotRef, { pending: result.pending, updatedAt: now });
        }
        return {
          success: false,
          reason: result.reason,
          reservationId
        };
      }

      // 4. Update slot document
      const currentOrders = Number(slotData.confirmedOrders) || 0;
      t.update(slotRef, {
        confirmedWorkload: result.confirmedWorkload,
        confirmedOrders: currentOrders + 1,
        pending: result.pending,
        updatedAt: now
      });

      // 5. Update reservation document
      t.update(reservationRef, {
        status: 'CONFIRMED',
        orderId: reservationId, // Strictly enforce orderId = reservationId
        confirmedAt: now,
        updatedAt: now
      });

      return {
        success: true,
        reservationId,
        orderId: reservationId,
        confirmedWorkload: result.confirmedWorkload
      };
    });
  },

  /**
   * Releases capacity when an order is cancelled, rejected by merchant, or checkout aborted.
   * 
   * @param {Object} params
   * @param {string} params.storeId
   * @param {string} params.slotId
   * @param {string} [params.reservationId]
   * @param {boolean} [params.isConfirmed=false]
   * @param {number} [params.workloadToRelease=0]
   * @param {number} [params.now=Date.now()]
   * @returns {Promise<{ success: boolean, releasedWorkload: number, confirmedWorkload?: number }>}
   */
  async releaseSlot({
    storeId,
    slotId,
    reservationId,
    isConfirmed = false,
    workloadToRelease = 0,
    now = Date.now()
  }) {
    if (!storeId || !slotId) {
      throw new Error('storeId and slotId are required for releaseSlot');
    }

    const slotRef = this.getSlotRef(storeId, slotId);
    const reservationRef = reservationId ? adminDb.collection('reservations').doc(reservationId) : null;

    return adminDb.runTransaction(async (t) => {
      let resolvedWorkload = workloadToRelease;
      let reservationSnap = null;

      if (reservationRef) {
        reservationSnap = await t.get(reservationRef);
        if (reservationSnap.exists) {
          const resData = reservationSnap.data();
          if (resData.status === 'CANCELLED') {
            return { success: true, alreadyCancelled: true, releasedWorkload: 0 };
          }
          if (resolvedWorkload === 0 && resData.workload) {
            resolvedWorkload = resData.workload;
          }
        }
      }

      const slotSnap = await t.get(slotRef);
      if (!slotSnap.exists) {
        return { success: true, releasedWorkload: 0 };
      }

      const slotData = slotSnap.data();
      const confirmedWorkload = slotData.confirmedWorkload ?? 0;
      const pending = Array.isArray(slotData.pending) ? slotData.pending : [];

      const result = releaseReservation({
        confirmedWorkload,
        pending,
        reservationId,
        isConfirmed,
        workloadToRelease: resolvedWorkload
      });

      // Update slot
      t.update(slotRef, {
        confirmedWorkload: result.confirmedWorkload,
        pending: result.pending,
        updatedAt: now
      });

      // Update reservation if present
      if (reservationRef && reservationSnap && reservationSnap.exists) {
        t.update(reservationRef, {
          status: 'CANCELLED',
          cancelledAt: now,
          updatedAt: now
        });
      }

      return {
        success: true,
        releasedWorkload: result.releasedWorkload,
        confirmedWorkload: result.confirmedWorkload
      };
    });
  },

  /**
   * Fetches capacity status for all 15-minute slots on a specific date.
   * Matches the exact JSON structure specified in Phase 1 Requirement #8.
   * 
   * @param {Object} params
   * @param {string} params.storeId
   * @param {string} params.dateStr - 'YYYY-MM-DD'
   * @param {number} [params.defaultCapacity=30]
   * @param {number} [params.now=Date.now()]
   * @returns {Promise<{ storeId: string, date: string, slots: Array<any> }>}
   */
  async getStoreDateSlots({
    storeId,
    dateStr,
    defaultCapacity = 30,
    now = Date.now()
  }) {
    if (!storeId || !dateStr) {
      throw new Error('storeId and dateStr are required');
    }

    // Operating hours 08:00 to 20:00 (15-min intervals = 48 slots)
    const startHour = 8;
    const endHour = 20;
    const slots = [];

    // Query existing saved slots for this store and date from subcollection /stores/{storeId}/pickup_slots
    const slotsQuery = await adminDb.collection('stores').doc(storeId).collection('pickup_slots').get();

    const dbSlotMap = new Map();
    slotsQuery.forEach(docSnap => {
      const data = docSnap.data();
      if (data.slotId && data.slotId.startsWith(dateStr)) {
        dbSlotMap.set(data.slotId, data);
      }
    });

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += 15) {
        const hStr = String(h).padStart(2, '0');
        const mStr = String(m).padStart(2, '0');
        const endMTotal = h * 60 + m + 15;
        const endHStr = String(Math.floor(endMTotal / 60)).padStart(2, '0');
        const endMStr = String(endMTotal % 60).padStart(2, '0');

        const slotId = `${dateStr}_${hStr}-${mStr}`;
        const startTime = `${hStr}:${mStr}`;
        const endTime = `${endHStr}:${endMStr}`;

        const existing = dbSlotMap.get(slotId);
        const capacity = existing?.capacity ?? defaultCapacity;
        const confirmedWorkload = existing?.confirmedWorkload ?? 0;
        const pending = Array.isArray(existing?.pending) ? existing.pending : [];

        const statusMetrics = getCapacityStatus({
          slotId,
          startTime,
          endTime,
          capacity,
          confirmedWorkload,
          pending,
          now
        });

        slots.push(statusMetrics);
      }
    }

    return {
      storeId,
      date: dateStr,
      slots
    };
  }
};
