/**
 * Smart Pre-order & Dynamic Capacity v2.1
 * Domain Service: Pure Functional Core for Slot Capacity & Workload Management
 * 
 * Architectural Rules:
 * 1. PURE FUNCTIONS ONLY: This module performs ZERO database calls and ZERO network I/O.
 * 2. Shared Capacity Pool: NOW and SCHEDULED share the exact same capacity window.
 * 3. Sum of Workload: Never use pending.length; always sum workloads of active items.
 * 4. Lazy Expiration: Expired pending reservations are filtered out on-the-fly during calculation.
 * 5. Idempotent & Deterministic: Output depends strictly on the provided input state.
 */

/**
 * Calculates total workload for an array of items.
 * Workload represents actual kitchen production effort.
 * 
 * @param {Array<{ quantity?: number, workload?: number, itemWorkload?: number }>} items 
 * @returns {number} Integer workload (minimum 1 per order)
 */
export function calculateWorkload(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return 1; // Default minimal base workload
  }

  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 1;
    // Item can define custom workload rating (e.g. complex dish = 2, simple drink = 1)
    const perItemWorkload = Number(item.workload || item.itemWorkload || 1);
    return sum + (qty * perItemWorkload);
  }, 0);

  return Math.max(1, Math.round(total));
}

/**
 * Filters out expired pending reservations (Lazy Expiration).
 * 
 * @param {Array<{ reservationId: string, workload: number, expiresAt: number, pickupType?: string }>} pendingList 
 * @param {number} [now=Date.now()] 
 * @returns {{ activePending: Array<any>, expiredPending: Array<any>, freedWorkload: number }}
 */
export function cleanupExpiredPending(pendingList = [], now = Date.now()) {
  if (!Array.isArray(pendingList) || pendingList.length === 0) {
    return { activePending: [], expiredPending: [], freedWorkload: 0 };
  }

  const activePending = [];
  const expiredPending = [];
  let freedWorkload = 0;

  for (const r of pendingList) {
    const expiresAt = Number(r.expiresAt) || 0;
    const workload = Number(r.workload) || 0;

    if (expiresAt > now) {
      activePending.push(r);
    } else {
      expiredPending.push(r);
      freedWorkload += workload;
    }
  }

  return {
    activePending,
    expiredPending,
    freedWorkload
  };
}

/**
 * Calculates pending workload from active pending reservations list.
 * 
 * @param {Array<any>} pendingList
 * @returns {number}
 */
export function calculatePendingWorkload(pendingList = []) {
  if (!Array.isArray(pendingList)) return 0;
  return pendingList.reduce((sum, r) => sum + (Number(r.workload) || 0), 0);
}

export const cleanupExpired = cleanupExpiredPending;

/**
 * Calculates used workload from confirmed workload and active pending reservations.
 * 
 * @param {number} confirmedWorkload 
 * @param {Array<any>} activePending 
 * @returns {{ confirmedWorkload: number, pendingWorkload: number, usedWorkload: number }}
 */
export function calculateUsedWorkload(confirmedWorkload = 0, activePending = []) {
  const confirmed = Math.max(0, Number(confirmedWorkload) || 0);
  const pendingWorkload = calculatePendingWorkload(activePending);
  const usedWorkload = confirmed + pendingWorkload;

  return {
    confirmedWorkload: confirmed,
    pendingWorkload,
    usedWorkload
  };
}

/**
 * Calculates remaining capacity / workload.
 * 
 * @param {number} capacity 
 * @param {number} usedWorkload 
 * @returns {number}
 */
export function calculateRemainingCapacity(capacity = 0, usedWorkload = 0) {
  const cap = Math.max(0, Number(capacity) || 0);
  const used = Math.max(0, Number(usedWorkload) || 0);
  return Math.max(0, cap - used);
}

export const calculateRemainingWorkload = calculateRemainingCapacity;

/**
 * Checks whether a new reservation of `newWorkload` can fit into the slot.
 * Evaluates lazy expiration of existing pending reservations before making a decision.
 * 
 * @param {Object} params
 * @param {number} params.capacity - Max workload allowed in slot
 * @param {number} [params.confirmedWorkload=0] - Already finalized/paid workload
 * @param {Array<any>} [params.pending=[]] - Current pending reservations
 * @param {number} params.newWorkload - Workload requested
 * @param {number} [params.now=Date.now()] - Current timestamp
 * @returns {Object} Evaluation details
 */
export function canReserve({
  capacity = 0,
  confirmedWorkload = 0,
  pending = [],
  newWorkload = 1,
  now = Date.now()
}) {
  const cap = Math.max(0, Number(capacity) || 0);
  const requested = Math.max(1, Number(newWorkload) || 1);

  // 1. Lazy cleanup of expired reservations
  const { activePending, expiredPending, freedWorkload } = cleanupExpiredPending(pending, now);

  // 2. Compute workload
  const { confirmedWorkload: confirmed, pendingWorkload, usedWorkload } = calculateUsedWorkload(confirmedWorkload, activePending);

  // 3. Availability check
  const projectedWorkload = usedWorkload + requested;
  const allowed = projectedWorkload <= cap;
  const remainingWorkload = allowed ? (cap - projectedWorkload) : Math.max(0, cap - usedWorkload);

  return {
    allowed,
    capacity: cap,
    confirmedWorkload: confirmed,
    pendingWorkload,
    usedWorkload,
    newWorkload: requested,
    projectedWorkload,
    remainingWorkload,
    activePending,
    expiredPending,
    freedWorkload,
    reason: allowed ? null : 'CAPACITY_EXCEEDED'
  };
}

/**
 * Applies a new reservation into the slot state if capacity allows.
 * 
 * @param {Object} params
 * @param {number} params.capacity
 * @param {number} [params.confirmedWorkload=0]
 * @param {Array<any>} [params.pending=[]]
 * @param {string} params.reservationId
 * @param {number} params.newWorkload
 * @param {'NOW'|'SCHEDULED'} [params.pickupType='NOW']
 * @param {number} [params.ttlMs=600000] - Default 10 minutes TTL
 * @param {number} [params.now=Date.now()]
 * @returns {Object} Result with new pending array or rejection reason
 */
export function reserve({
  capacity = 0,
  confirmedWorkload = 0,
  pending = [],
  reservationId,
  newWorkload = 1,
  pickupType = 'NOW',
  ttlMs = 10 * 60 * 1000,
  now = Date.now()
}) {
  if (!reservationId) {
    throw new Error('reservationId is strictly required for reserve()');
  }

  const check = canReserve({
    capacity,
    confirmedWorkload,
    pending,
    newWorkload,
    now
  });

  if (!check.allowed) {
    return {
      success: false,
      reason: check.reason,
      details: check
    };
  }

  const newReservation = {
    reservationId,
    workload: check.newWorkload,
    expiresAt: now + ttlMs,
    pickupType: pickupType === 'SCHEDULED' ? 'SCHEDULED' : 'NOW',
    createdAt: now
  };

  const newPending = [...check.activePending, newReservation];
  const newPendingWorkload = check.pendingWorkload + check.newWorkload;
  const newUsedWorkload = check.confirmedWorkload + newPendingWorkload;

  return {
    success: true,
    reservation: newReservation,
    confirmedWorkload: check.confirmedWorkload,
    pending: newPending,
    pendingWorkload: newPendingWorkload,
    usedWorkload: newUsedWorkload,
    remainingWorkload: Math.max(0, check.capacity - newUsedWorkload),
    cleanedCount: check.expiredPending.length
  };
}

/**
 * Transitions a pending reservation to CONFIRMED status.
 * Transfers workload from pendingWorkload -> confirmedWorkload.
 * 
 * @param {Object} params
 * @param {number} [params.confirmedWorkload=0]
 * @param {Array<any>} [params.pending=[]]
 * @param {string} params.reservationId
 * @param {number} [params.now=Date.now()]
 * @returns {Object}
 */
export function confirmReservation({
  confirmedWorkload = 0,
  pending = [],
  reservationId,
  now = Date.now()
}) {
  if (!reservationId) {
    throw new Error('reservationId is strictly required for confirmReservation()');
  }

  const confirmed = Math.max(0, Number(confirmedWorkload) || 0);
  const foundIndex = pending.findIndex(r => r.reservationId === reservationId);

  if (foundIndex === -1) {
    return {
      success: false,
      reason: 'RESERVATION_NOT_FOUND',
      confirmedWorkload: confirmed,
      pending
    };
  }

  const targetReservation = pending[foundIndex];
  // Verify if it expired before payment confirmation arrived
  if (targetReservation.expiresAt <= now) {
    // Remove expired reservation
    const remainingPending = pending.filter(r => r.reservationId !== reservationId);
    return {
      success: false,
      reason: 'RESERVATION_EXPIRED',
      confirmedWorkload: confirmed,
      pending: remainingPending
    };
  }

  // Remove from pending and add to confirmed workload
  const remainingPending = pending.filter((_, idx) => idx !== foundIndex);
  const newConfirmedWorkload = confirmed + targetReservation.workload;

  return {
    success: true,
    reservation: targetReservation,
    confirmedWorkload: newConfirmedWorkload,
    pending: remainingPending,
    workloadTransferred: targetReservation.workload
  };
}

/**
 * Releases capacity for a reservation.
 * Handles both pending cancellation (pre-payment) and confirmed cancellation (post-payment/rejected).
 * 
 * @param {Object} params
 * @param {number} [params.confirmedWorkload=0]
 * @param {Array<any>} [params.pending=[]]
 * @param {string} [params.reservationId]
 * @param {boolean} [params.isConfirmed=false]
 * @param {number} [params.workloadToRelease=0]
 * @returns {Object}
 */
export function releaseReservation({
  confirmedWorkload = 0,
  pending = [],
  reservationId,
  isConfirmed = false,
  workloadToRelease = 0
}) {
  let confirmed = Math.max(0, Number(confirmedWorkload) || 0);
  let cleanedPending = [...pending];
  let releasedAmount = 0;

  if (isConfirmed || workloadToRelease > 0) {
    // Releasing confirmed workload (e.g. merchant rejected order, refund)
    const amount = Number(workloadToRelease) || 0;
    releasedAmount = Math.min(confirmed, amount);
    confirmed = Math.max(0, confirmed - releasedAmount);
  } else if (reservationId) {
    // Releasing pending reservation (e.g. user canceled checkout)
    const target = cleanedPending.find(r => r.reservationId === reservationId);
    if (target) {
      releasedAmount = target.workload;
      cleanedPending = cleanedPending.filter(r => r.reservationId !== reservationId);
    }
  }

  return {
    success: true,
    confirmedWorkload: confirmed,
    pending: cleanedPending,
    releasedWorkload: releasedAmount
  };
}

export const addPendingReservation = reserve;

/**
 * Removes a pending reservation from the pending array
 * @param {Array<any>} pendingList
 * @param {string} reservationId
 * @returns {Array<any>}
 */
export function removePendingReservation(pendingList = [], reservationId) {
  if (!Array.isArray(pendingList) || !reservationId) return [...pendingList];
  return pendingList.filter(r => r.reservationId !== reservationId);
}

/**
 * Releases confirmed workload directly (e.g. order cancelled)
 * @param {number} confirmedWorkload
 * @param {number} amount
 * @returns {number}
 */
export function releaseConfirmedWorkload(confirmedWorkload = 0, amount = 0) {
  const current = Math.max(0, Number(confirmedWorkload) || 0);
  const toRelease = Math.max(0, Number(amount) || 0);
  return Math.max(0, current - toRelease);
}

/**
 * Canteen-local time zone used for every slot boundary.
 *
 * Slot ids are shared between the server, the client and Firestore documents,
 * so they must NOT depend on the host's local time. A server running UTC would
 * otherwise file a 12:00 Bangkok pickup under the 05:00 slot and roll the date
 * over at 07:00 local time.
 */
export const SLOT_TIME_ZONE = process.env.QUEUEUP_TIMEZONE || 'Asia/Bangkok';

const slotPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: SLOT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

/** Wall-clock fields of an instant, read in SLOT_TIME_ZONE. */
function zonedParts(timestamp) {
  const parts = slotPartsFormatter.formatToParts(new Date(timestamp));
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some ICU builds render midnight as hour 24 under hour12: false.
    hour: read('hour') % 24,
    minute: read('minute')
  };
}

/** Offset of SLOT_TIME_ZONE from UTC, in ms, at the given instant. */
function zoneOffsetMs(timestamp) {
  const { year, month, day, hour, minute } = zonedParts(timestamp);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  return wallClockAsUtc - Math.floor(timestamp / 60000) * 60000;
}

/**
 * Resolves the 15-minute slot window for a given timestamp, always in
 * SLOT_TIME_ZONE regardless of the host's own time zone.
 *
 * @param {number} [timestamp=Date.now()]
 * @param {number} [slotDurationMinutes=15]
 * @returns {{ slotId: string, dateStr: string, startTimeStr: string, endTimeStr: string, startTimeMs: number, endTimeMs: number }}
 */
export function resolveCurrentSlot(timestamp = Date.now(), slotDurationMinutes = 15) {
  const { year, month, day, hour, minute } = zonedParts(timestamp);

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const currentMinutes = hour * 60 + minute;
  const slotIndex = Math.floor(currentMinutes / slotDurationMinutes);
  const slotStartMinutes = slotIndex * slotDurationMinutes;
  const slotEndMinutes = slotStartMinutes + slotDurationMinutes;

  const startHour = String(Math.floor(slotStartMinutes / 60)).padStart(2, '0');
  const startMin = String(slotStartMinutes % 60).padStart(2, '0');
  const startTimeStr = `${startHour}:${startMin}`;

  const endHour = String(Math.floor(slotEndMinutes / 60)).padStart(2, '0');
  const endMin = String(slotEndMinutes % 60).padStart(2, '0');
  const endTimeStr = `${endHour}:${endMin}`;

  const startTimeMs =
    Date.UTC(year, month - 1, day, Number(startHour), Number(startMin)) - zoneOffsetMs(timestamp);
  const endTimeMs = startTimeMs + (slotDurationMinutes * 60 * 1000);

  const slotId = `${dateStr}_${startHour}-${startMin}`;

  return {
    slotId,
    dateStr,
    startTimeStr,
    endTimeStr,
    startTimeMs,
    endTimeMs
  };
}

/**
 * Returns overall capacity status and inspection metrics for a slot.
 * 
 * @param {Object} params
 * @param {string} [params.slotId]
 * @param {string} [params.startTime]
 * @param {string} [params.endTime]
 * @param {number} params.capacity
 * @param {number} [params.confirmedWorkload=0]
 * @param {Array<any>} [params.pending=[]]
 * @param {number} [params.now=Date.now()]
 * @returns {Object}
 */
export function getCapacityStatus({
  slotId = '',
  startTime = '',
  endTime = '',
  capacity = 30,
  confirmedWorkload = 0,
  pending = [],
  now = Date.now()
}) {
  const { activePending } = cleanupExpiredPending(pending, now);
  const { confirmedWorkload: confirmed, pendingWorkload, usedWorkload } = calculateUsedWorkload(confirmedWorkload, activePending);
  const remainingWorkload = Math.max(0, capacity - usedWorkload);

  let status = 'AVAILABLE';
  if (remainingWorkload === 0) {
    status = 'FULL';
  } else if (usedWorkload / capacity >= 0.8) {
    status = 'NEAR_CAPACITY';
  }

  return {
    slotId,
    startTime,
    endTime,
    capacity,
    confirmedWorkload: confirmed,
    pendingWorkload,
    usedWorkload,
    remainingWorkload,
    status
  };
}
