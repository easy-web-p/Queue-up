import { Router } from 'express';
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebaseAdmin.js';
import {
  authenticate,
  optionalAuthenticate,
  isStoreOperator
} from '../middleware/authenticate.js';
import { requireSecret } from '../config/secrets.js';
import { recordOrderFulfilled } from '../services/ledgerService.js';
import { NotificationEngine } from '../services/notificationEngine.js';
import { SlotTransactionService } from '../services/slotTransactionService.js';
import { findMenuItem } from '../services/menuCatalog.js';

export const orderRouter = Router();

const HMAC_SECRET = requireSecret('HMAC_SECRET', 'dev-only-insecure-hmac-secret');

// State Machine Definition for Orders
const VALID_TRANSITIONS = {
  DRAFT: ['PAYMENT_PENDING', 'CANCELLED'],
  PAYMENT_PENDING: ['PAID_AWAITING_MERCHANT', 'MERCHANT_ACCEPTED', 'PREPARING', 'CANCELLED', 'EXPIRED'],
  PAID_AWAITING_MERCHANT: ['MERCHANT_ACCEPTED', 'PREPARING', 'CANCELLED', 'MERCHANT_REJECTED', 'EXPIRED'],
  MERCHANT_ACCEPTED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'READY_FOR_PICKUP', 'CANCELLED'],
  READY: ['COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  MERCHANT_REJECTED: [],
  EXPIRED: []
};

/**
 * POST /api/orders
 * Authoritative Order Creation via Atomic Firestore Transaction
 * Prices, platform fees, and merchant net are computed strictly in Satang (Integer) on the server.
 */
orderRouter.post('/', optionalAuthenticate, async (req, res) => {
  try {
    const {
      storeId,
      items,
      paymentMethod = 'promptpay',
      allergenAcknowledged = false,
      customerName,
      customerPhone,
      pickupTime = 'ทันที',
      specialNote = '',
      idempotencyKey
    } = req.body;

    // Identity is taken from the verified token only. Header-supplied ids are
    // honoured solely by the dev mock-auth path, which populates req.user.
    const customerId = req.user?.uid || 'guest-user';
    const resolvedCustomerName = req.user?.name || customerName || 'คุณลูกค้า';
    const resolvedPhone = customerPhone || '08x-xxx-xxxx';

    if (!storeId) {
      return res.status(400).json({ success: false, error: 'MISSING_STORE_ID', message: 'storeId is required.' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'EMPTY_CART', message: 'Cart items cannot be empty.' });
    }

    const key = idempotencyKey || req.headers['x-idempotency-key'] || `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const idempotencyRef = adminDb.collection('idempotency_records').doc(key);

    // 1. Check idempotency record before running transaction
    const existingIdemp = await idempotencyRef.get();
    if (existingIdemp.exists) {
      console.log(`[Order API] Idempotency cache hit for key: ${key}`);
      return res.status(200).json(existingIdemp.data().response);
    }

    const storeRef = adminDb.collection('stores').doc(storeId);
    const reservationId = req.body.reservationId;
    const orderId = reservationId || `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const orderRef = adminDb.collection('orders').doc(orderId);
    const userStatsRef = adminDb.collection('users').doc(customerId).collection('stats').doc('summary');

    // Execute atomic transaction
    const result = await adminDb.runTransaction(async (t) => {
      // 0. Strict Idempotency: if order with this reservationId already exists, return existing order
      const existingOrderSnap = await t.get(orderRef);
      if (existingOrderSnap.exists) {
        console.log(`[Order API] Idempotency: Existing order found for ID: ${orderId}`);
        const existingData = existingOrderSnap.data();
        return {
          success: true,
          orderId,
          orderNumber: existingData.orderNumber || orderId,
          order: existingData,
          exchangePin: existingData.exchangePin
        };
      }

      // 1. Load Store
      const storeSnap = await t.get(storeRef);
      if (!storeSnap.exists) {
        throw new Error(`STORE_NOT_FOUND: Store "${storeId}" does not exist.`);
      }
      const storeData = storeSnap.data();
      if (storeData.isOpen === false) {
        throw new Error(`STORE_CLOSED: ร้านค้า "${storeData.name || storeId}" ปิดทำการอยู่ในขณะนี้`);
      }

      // 1.1 Tenant Boundary Cross-Order Verification (Backend Authorization Layer)
      const customerSchoolId = req.user?.schoolId || null;
      if (customerSchoolId && storeData.schoolId && customerSchoolId !== storeData.schoolId) {
        throw new Error(`TENANT_MISMATCH: บัญชีของคุณสังกัดสถานศึกษา ${customerSchoolId} ไม่สามารถสั่งซื้ออาหารจากร้านของ ${storeData.schoolId} ได้`);
      }

      // 2. Load and validate authoritative menu items & pricing (in Satang)
      const itemSnapshots = [];
      let calculatedSubtotalSatang = 0;

      for (const item of items) {
        const found = await findMenuItem(adminDb, item.menuItemId, t);

        // Falling back to a request-supplied price would make the whole
        // "authoritative pricing" tier decorative: the payer would choose what
        // they pay. An unknown item is refused instead.
        if (!found) {
          throw new Error(
            `MENU_ITEM_NOT_FOUND: ไม่พบรายการอาหารรหัส "${item.menuItemId}" ในระบบ กรุณารีเฟรชเมนูแล้วลองใหม่`
          );
        }

        const itemData = found.data;

        // A menu item belongs to exactly one store; ordering it from another
        // store's cart would price one kitchen's food against another's.
        if (itemData.storeId && itemData.storeId !== storeId) {
          throw new Error(
            `MENU_ITEM_STORE_MISMATCH: รายการ "${itemData.name || item.menuItemId}" ไม่ได้อยู่ในเมนูของร้านนี้`
          );
        }

        const itemName = itemData.name || 'อาหาร';
        const basePriceBaht = Number(itemData.price || 0);
        const isAvailable = itemData.isAvailable !== false;

        if (!Number.isFinite(basePriceBaht) || basePriceBaht <= 0) {
          throw new Error(`MENU_ITEM_PRICE_INVALID: รายการ "${itemName}" ยังไม่ได้ตั้งราคา`);
        }

        if (!isAvailable) {
          throw new Error(`ITEM_UNAVAILABLE: รายการ "${itemName}" หมดชั่วคราว`);
        }

        // Option surcharges are priced from the menu item's own option groups,
        // not from the priceDelta the client sent alongside its choice.
        let optionsDeltaBaht = 0;
        if (Array.isArray(item.selectedOptions)) {
          const groups = Array.isArray(itemData.optionGroups) ? itemData.optionGroups : [];
          for (const selected of item.selectedOptions) {
            const group = groups.find((g) => g.name === selected.groupName);
            const choice = group?.choices?.find((c) => c.name === selected.choiceName);
            if (choice) {
              optionsDeltaBaht += Number(choice.priceDelta) || 0;
            } else if (groups.length === 0) {
              // Menu item carries no option definitions (legacy record): accept
              // the client value but never let it reduce the price.
              optionsDeltaBaht += Math.max(0, Number(selected.priceDelta) || 0);
            }
          }
        }

        const unitTotalSatang = Math.round((basePriceBaht + optionsDeltaBaht) * 100);
        const lineTotalSatang = unitTotalSatang * item.quantity;
        calculatedSubtotalSatang += lineTotalSatang;

        itemSnapshots.push({
          menuItemId: item.menuItemId,
          name: itemName,
          price: basePriceBaht,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions || [],
          specialNote: item.specialNote || '',
          subtotal: lineTotalSatang / 100
        });
      }

      // Satang-precision discount calculation (฿20 off for orders >= ฿200)
      const discountSatang = calculatedSubtotalSatang >= 20000 ? 2000 : 0;
      const totalSatang = Math.max(0, calculatedSubtotalSatang - discountSatang);

      // Financial breakdown calculations
      const platformFeeSatang = Math.round(totalSatang * 0.10); // 10% platform fee
      const estimatedGatewayFeeSatang = paymentMethod === 'cash' ? 0 : Math.round(totalSatang * 0.0165 * 1.07);
      const merchantNetSatang = Math.max(0, totalSatang - platformFeeSatang - estimatedGatewayFeeSatang);

      // 4-digit pickup PIN with HMAC SHA-256 hash (never store plain PIN in DB)
      const exchangePin = `${Math.floor(1000 + Math.random() * 9000)}`;
      const exchangePinHash = crypto.createHmac('sha256', HMAC_SECRET).update(exchangePin).digest('hex');

      // Statuses decoupled
      const initialStatus = paymentMethod === 'cash' ? 'PAID_AWAITING_MERCHANT' : 'PAYMENT_PENDING';
      const initialPaymentStatus = 'REQUIRES_PAYMENT';
      const initialSettlementStatus = paymentMethod === 'cash' ? 'NOT_APPLICABLE' : 'PENDING_ORDER_ACCEPTANCE';

      const now = new Date().toISOString();

      const newOrder = {
        id: orderId,
        orderNumber: 'รอร้านค้ายืนยัน', // Queue number is strictly issued when merchant accepts
        customerId,
        customerName: resolvedCustomerName,
        customerPhone: resolvedPhone,
        storeId,
        storeName: storeData.name || 'ร้านค้า',
        storeLogo: storeData.logo || null,
        schoolId: storeData.schoolId || null,
        items: itemSnapshots,
        
        // Exact integer Satang values
        subtotalSatang: calculatedSubtotalSatang,
        discountSatang,
        totalSatang,
        platformFeeSatang,
        estimatedGatewayFeeSatang,
        merchantNetSatang,

        // Baht equivalents for backward compatibility
        subtotal: calculatedSubtotalSatang / 100,
        discount: discountSatang / 100,
        total: totalSatang / 100,

        status: initialStatus,
        canonicalStatus: 'AWAITING_CONFIRMATION',
        paymentMethod,
        paymentStatus: initialPaymentStatus,
        settlementStatus: initialSettlementStatus,

        // Security: Store HMAC hash, not plain PIN
        exchangePinHash,
        exchangePinFailedAttempts: 0,
        exchangePinLockedUntil: null,

        pickupTime,
        estimatedCompletionTime: '15-20 นาที',
        specialNote,
        allergenAcknowledged: !!allergenAcknowledged,
        contactChannelsSnapshot: storeData.contactChannels || null,
        exchangeTermsSnapshot: storeData.exchangeTerms || null,
        reservationId: reservationId || null,
        slotId: req.body.slotId || null,
        workload: req.body.workload || (Array.isArray(items) ? items.reduce((s, it) => s + (it.quantity || 1), 0) : 1),
        version: 1,
        idempotencyKey: key,
        createdAt: now,
        updatedAt: now
      };

      // Write Order Document
      t.set(orderRef, newOrder);

      // Confirm slot reservation inside transaction if slotId was attached
      if (req.body.slotId && reservationId) {
        const slotRef = SlotTransactionService.getSlotRef(storeId, req.body.slotId);
        const slotSnap = await t.get(slotRef);
        if (slotSnap.exists) {
          const slotData = slotSnap.data();
          const pending = Array.isArray(slotData.pending) ? slotData.pending : [];
          const foundIdx = pending.findIndex(r => r.reservationId === reservationId);
          if (foundIdx !== -1) {
            const targetRes = pending[foundIdx];
            const remainingPending = pending.filter((_, idx) => idx !== foundIdx);
            t.update(slotRef, {
              confirmedWorkload: (slotData.confirmedWorkload || 0) + targetRes.workload,
              confirmedOrders: (slotData.confirmedOrders || 0) + 1,
              pending: remainingPending,
              updatedAt: now
            });
          }
        }
        const resRef = adminDb.collection('reservations').doc(reservationId);
        t.set(resRef, {
          reservationId,
          orderId,
          status: 'CONFIRMED',
          confirmedAt: now,
          updatedAt: now
        }, { merge: true });
      }

      // Write Audit Event Subcollection
      const eventRef = orderRef.collection('events').doc();
      t.set(eventRef, {
        orderId,
        fromStatus: null,
        toStatus: initialStatus,
        changedBy: customerId,
        changerRole: 'customer',
        note: `Order created. Payment method: ${paymentMethod}`,
        timestamp: now
      });

      // Update User summary stats (atomic increment)
      t.set(userStatsRef, {
        totalOrders: FieldValue.increment(1),
        totalSpent: FieldValue.increment(totalSatang / 100),
        lastOrderAt: now,
        updatedAt: now
      }, { merge: true });

      const responsePayload = {
        success: true,
        orderId,
        orderNumber: 'รอร้านค้ายืนยัน',
        order: {
          ...newOrder,
          exchangePin // Only returned to client on creation
        },
        exchangePin
      };

      // Save idempotency record inside transaction
      t.set(idempotencyRef, {
        idempotencyKey: key,
        orderId,
        response: responsePayload,
        createdAt: now
      });

      return responsePayload;
    });

    // Send ORDER_CREATED notification asynchronously after transaction commit
    if (customerId && customerId !== 'guest-user') {
      const customerSchoolId = req.user?.schoolId || null;
      NotificationEngine.send({
        recipientId: customerId,
        schoolId: customerSchoolId,
        type: 'ORDER_CREATED',
        title: '🛒 สั่งอาหารสำเร็จ',
        message: `ระบบได้รับออเดอร์ของคุณแล้ว รอร้านค้ายืนยันและออกหมายเลขคิวค่ะ`,
        idempotencyKey: `order_${orderId}_ORDER_CREATED`,
        deepLink: '/queue-tracking',
        relatedId: orderId,
        relatedType: 'order'
      }).catch(e => console.warn('[Order API] Order created notification note:', e.message));
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('[Order API] Create order error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    return res.status(400).json({
      success: false,
      error: 'ORDER_CREATION_FAILED',
      message: msg
    });
  }
});

/**
 * PATCH /api/orders/:id/status
 * State Machine Queue Transition with Optimistic Locking
 */
orderRouter.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { status: nextStatus, note = '', version: expectedVersion } = req.body;
    const changerUid = req.user.uid;
    const changerRole = req.user.role || 'customer';

    if (!nextStatus) {
      return res.status(400).json({ success: false, error: 'MISSING_STATUS', message: 'Target status is required.' });
    }

    const orderRef = adminDb.collection('orders').doc(orderId);

    // Authorise before opening the transaction: store operators may drive any
    // transition; the customer who placed the order may only cancel it.
    const preSnap = await orderRef.get();
    if (!preSnap.exists) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND' });
    }
    const preOrder = preSnap.data();
    const operatesStore = await isStoreOperator(req.user, preOrder.storeId);
    const isOrderCustomer = req.user.uid === preOrder.customerId;

    if (!operatesStore && !(isOrderCustomer && nextStatus === 'CANCELLED')) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not have permission to change this order.'
      });
    }

    const updatedResult = await adminDb.runTransaction(async (t) => {
      const orderSnap = await t.get(orderRef);
      if (!orderSnap.exists) {
        throw new Error(`ORDER_NOT_FOUND: Order "${orderId}" does not exist.`);
      }

      const orderData = orderSnap.data();
      const currentStatus = orderData.status;

      // 1. Verify State Machine Transition
      const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(nextStatus) && nextStatus !== currentStatus) {
        throw new Error(`INVALID_TRANSITION: Cannot transition order from "${currentStatus}" to "${nextStatus}". Allowed: [${allowedNext.join(', ')}]`);
      }

      // 2. Verify Optimistic Locking Version
      if (expectedVersion !== undefined && orderData.version !== undefined) {
        if (Number(orderData.version) !== Number(expectedVersion)) {
          throw new Error(`CONCURRENCY_CONFLICT: Order has been modified concurrently. Expected version ${expectedVersion}, found ${orderData.version}.`);
        }
      }

      const newVersion = (orderData.version || 1) + 1;
      const now = new Date().toISOString();

      // 3. Update Order Document
      const isOnlinePaid = orderData.paymentMethod !== 'cash' && orderData.paymentStatus === 'PAID';
      const orderUpdates = {
        status: nextStatus,
        canonicalStatus: nextStatus,
        version: newVersion,
        updatedAt: now
      };

      if (nextStatus === 'COMPLETED') {
        orderUpdates.completedAt = now;
        if (isOnlinePaid && orderData.settlementStatus === 'PENDING_FULFILLMENT') {
          orderUpdates.settlementStatus = 'ON_HOLD';
          orderUpdates.fundReleaseAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

          const merchantNetSatang = orderData.merchantNetSatang || Math.max(0, (orderData.totalSatang || (orderData.total * 100)) - (orderData.platformFeeSatang || 0));
          await recordOrderFulfilled(t, adminDb, {
            orderId,
            storeId: orderData.storeId,
            merchantNetSatang,
            now
          });
        }
      }

      t.update(orderRef, orderUpdates);

      // 4. Record State Change in Events Subcollection
      const eventRef = orderRef.collection('events').doc();
      t.set(eventRef, {
        orderId,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        changedBy: changerUid,
        changerRole,
        note,
        timestamp: now
      });

      // 5. Update user stats when reaching terminal states
      if (nextStatus === 'COMPLETED' || nextStatus === 'CANCELLED' || nextStatus === 'MERCHANT_REJECTED') {
        const userStatsRef = adminDb.collection('users').doc(orderData.customerId).collection('stats').doc('summary');
        const fieldToIncrement = nextStatus === 'COMPLETED' ? 'completedOrders' : 'cancelledOrders';
        t.set(userStatsRef, {
          [fieldToIncrement]: FieldValue.increment(1),
          updatedAt: now
        }, { merge: true });
      }

      // 6. Atomic Capacity Release on Cancellation / Rejection (Requirement #7)
      if (nextStatus === 'CANCELLED' || nextStatus === 'MERCHANT_REJECTED') {
        if (orderData.storeId && orderData.slotId) {
          const slotRef = SlotTransactionService.getSlotRef(orderData.storeId, orderData.slotId);
          const slotSnap = await t.get(slotRef);
          if (slotSnap.exists) {
            const slotData = slotSnap.data();
            const currentConfirmed = slotData.confirmedWorkload ?? 0;
            const orderWorkload = Number(orderData.workload) || (Array.isArray(orderData.items) ? orderData.items.reduce((s, it) => s + (it.quantity || 1), 0) : 1);
            const newConfirmed = Math.max(0, currentConfirmed - orderWorkload);
            t.update(slotRef, {
              confirmedWorkload: newConfirmed,
              updatedAt: now
            });
          }
        }
        if (orderData.reservationId) {
          const resRef = adminDb.collection('reservations').doc(orderData.reservationId);
          t.set(resRef, {
            status: 'CANCELLED',
            cancelledAt: now,
            updatedAt: now
          }, { merge: true });
        }
      }

      return {
        success: true,
        orderId,
        previousStatus: currentStatus,
        status: nextStatus,
        version: newVersion
      };
    });

    // Send status change / ready push notification asynchronously after commit
    orderRef.get().then(snap => {
      if (snap.exists) {
        const orderData = snap.data();
        if (orderData.customerId && orderData.customerId !== 'guest-user') {
          if (nextStatus === 'READY' || nextStatus === 'READY_FOR_PICKUP') {
            NotificationEngine.sendOrderReady({
              orderId,
              queueNumber: orderData.orderNumber || orderData.queueNumber || 'คิวของคุณ',
              storeId: orderData.storeId,
              storeName: orderData.storeName || 'ร้านอาหาร',
              customerId: orderData.customerId,
              schoolId: orderData.schoolId
            }).catch(e => console.warn('[Order API] Order ready push error:', e.message));
          } else {
            NotificationEngine.sendOrderStatusChange({
              orderId,
              queueNumber: orderData.orderNumber || orderData.queueNumber || 'คิวของคุณ',
              storeName: orderData.storeName || 'ร้านอาหาร',
              customerId: orderData.customerId,
              schoolId: orderData.schoolId,
              status: nextStatus
            }).catch(e => console.warn('[Order API] Status change push error:', e.message));
          }
        }
      }
    }).catch(() => {});

    return res.status(200).json(updatedResult);
  } catch (error) {
    console.error('[Order API] Status update error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const isConflict = msg.includes('CONCURRENCY_CONFLICT');
    return res.status(isConflict ? 409 : 400).json({
      success: false,
      error: isConflict ? 'CONCURRENCY_CONFLICT' : 'STATUS_UPDATE_FAILED',
      message: msg
    });
  }
});

/**
 * GET /api/orders/:id
 * Retrieve order details
 */
orderRouter.get('/:id', optionalAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const docSnap = await adminDb.collection('orders').doc(id).get();
    if (!docSnap.exists) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    }

    const order = docSnap.data();
    const isOrderCustomer = Boolean(req.user?.uid) && req.user.uid === order.customerId;
    const isGuestOrder = order.customerId === 'guest-user';
    const operatesStore = await isStoreOperator(req.user, order.storeId);

    if (!isOrderCustomer && !operatesStore && !isGuestOrder) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not have permission to view this order.'
      });
    }

    // The pickup PIN is the customer's proof of collection: it is returned once
    // at creation and is never re-exposed to anyone else, staff included.
    if (!isOrderCustomer) {
      delete order.exchangePin;
      delete order.exchangePinHash;
    }

    return res.status(200).json({ success: true, order });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
