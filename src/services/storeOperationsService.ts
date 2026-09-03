/**
 * 🏪 storeOperationsService.ts (Wave 4.2.5)
 * Operating Hours Matrix (7-day), Emergency Rush Mode, Pause Engine, and Atomic Capacity Slot Reservation.
 */

import {
  doc,
  runTransaction,
  type Firestore
} from 'firebase/firestore';

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export interface DailySchedule {
  isOpen: boolean;
  open: string;  // e.g. "08:00" (HH:mm 24h format)
  close: string; // e.g. "17:00" (HH:mm 24h format)
}

export type WeeklyOperatingHours = Record<DayOfWeek, DailySchedule>;

export interface OperationalOverride {
  isPaused: boolean;
  pausedReason?: string;
  pauseUntil?: number; // timestamp in ms
  isRushMode: boolean;
  rushBufferMinutes: number; // >= 0
}

export interface StoreOperationalState {
  storeId: string;
  isOpen: boolean; // Master operational switch
  operatingHours?: Partial<WeeklyOperatingHours>;
  operationalOverride?: OperationalOverride;
  maxOrdersPerSlot?: number;
}

export interface StoreAvailabilityResult {
  canAcceptOrder: boolean;
  reason?: string;
  estimatedBufferMinutes: number;
}

/**
 * 🕒 1. Check Store Availability based on 7-Day Matrix and Operational Overrides
 */
export function evaluateStoreAvailability(
  store: StoreOperationalState,
  targetDate: Date = new Date()
): StoreAvailabilityResult {
  // 1. Master switch check
  if (!store.isOpen) {
    return { canAcceptOrder: false, reason: 'STORE_CLOSED_MANUALLY', estimatedBufferMinutes: 0 };
  }

  // 2. Emergency Pause Check
  const override = store.operationalOverride;
  if (override?.isPaused) {
    const now = targetDate.getTime();
    if (override.pauseUntil && now >= override.pauseUntil) {
      // Auto-resumed after pause expiration
    } else {
      return {
        canAcceptOrder: false,
        reason: override.pausedReason || 'STORE_PAUSED_EMERGENCY',
        estimatedBufferMinutes: 0
      };
    }
  }

  // 3. 7-Day Operating Hours Matrix Check
  if (store.operatingHours) {
    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[targetDate.getDay()];
    const todaySchedule = store.operatingHours[currentDay];

    if (todaySchedule) {
      if (!todaySchedule.isOpen) {
        return { canAcceptOrder: false, reason: `STORE_CLOSED_ON_${currentDay.toUpperCase()}`, estimatedBufferMinutes: 0 };
      }

      const currentHours = targetDate.getHours().toString().padStart(2, '0');
      const currentMinutes = targetDate.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      if (currentTimeStr < todaySchedule.open || currentTimeStr > todaySchedule.close) {
        return {
          canAcceptOrder: false,
          reason: `OUTSIDE_OPERATING_HOURS (${todaySchedule.open} - ${todaySchedule.close})`,
          estimatedBufferMinutes: 0
        };
      }
    }
  }

  // 4. Rush Mode Buffer Calculation
  let rushBuffer = 0;
  if (override?.isRushMode) {
    rushBuffer = Math.max(0, override.rushBufferMinutes || 0);
  }

  return {
    canAcceptOrder: true,
    estimatedBufferMinutes: rushBuffer
  };
}

/**
 * 🔒 2. Atomic Capacity Slot Reservation Boundary
 * Guarantees race-condition-free slot booking: check capacity + mutate count atomically in runTransaction.
 */
export async function reserveCapacitySlotAtomic(
  db: Firestore,
  storeId: string,
  slotId: string,
  maxCapacity: number
): Promise<{ success: boolean; slotId: string; currentOrders: number }> {
  if (!storeId || !slotId) throw new Error('storeId and slotId are required');
  if (maxCapacity <= 0) throw new Error('maxCapacity must be greater than 0');

  return await runTransaction(db, async (tx) => {
    const slotRef = doc(db, 'store_slots', slotId);
    const slotSnap = await tx.get(slotRef);

    let currentOrders = 0;
    if (slotSnap.exists()) {
      const slotData = slotSnap.data();
      if (slotData.storeId && slotData.storeId !== storeId) {
        throw new Error('Unauthorized: Slot does not belong to this store');
      }
      currentOrders = Number(slotData.currentOrders) || 0;
    }

    if (currentOrders + 1 > maxCapacity) {
      throw new Error(`SLOT_CAPACITY_EXCEEDED: Slot ${slotId} is fully booked (${currentOrders}/${maxCapacity})`);
    }

    const nextCount = currentOrders + 1;
    tx.set(
      slotRef,
      {
        slotId,
        storeId,
        capacity: maxCapacity,
        currentOrders: nextCount,
        updatedAt: new Date()
      },
      { merge: true }
    );

    return { success: true, slotId, currentOrders: nextCount };
  });
}
