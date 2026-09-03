/**
 * 🏪 storeOperationsService.ts (Wave 4.2.5.x Hardened)
 * Operating Hours Matrix (7-day + Overnight), Emergency Rush Mode, Pause Engine, and Authoritative Atomic Slot Reservation.
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
 * 🕒 1. Check Store Availability based on 7-Day Matrix (with Overnight support) and Operational Overrides
 */
export function evaluateStoreAvailability(
  store: StoreOperationalState,
  targetDate: Date = new Date()
): StoreAvailabilityResult {
  // 1. Master switch check (Manual Override)
  if (!store.isOpen) {
    return { canAcceptOrder: false, reason: 'STORE_CLOSED_MANUALLY', estimatedBufferMinutes: 0 };
  }

  // 2. Emergency Pause Check (Auto-resumes only if now >= pauseUntil)
  const override = store.operationalOverride;
  if (override?.isPaused) {
    const now = targetDate.getTime();
    if (override.pauseUntil && now >= override.pauseUntil) {
      // Auto-resumed logically after pause expiration
    } else {
      return {
        canAcceptOrder: false,
        reason: override.pausedReason || 'STORE_PAUSED_EMERGENCY',
        estimatedBufferMinutes: 0
      };
    }
  }

  // 3. 7-Day Operating Hours Matrix Check (Supports Overnight schedule)
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

      const { open, close } = todaySchedule;
      let isWithinHours = false;

      if (open <= close) {
        // Standard daytime schedule (e.g. 08:00 - 17:00)
        isWithinHours = currentTimeStr >= open && currentTimeStr <= close;
      } else {
        // Overnight schedule (e.g. 22:00 - 02:00)
        isWithinHours = currentTimeStr >= open || currentTimeStr <= close;
      }

      if (!isWithinHours) {
        return {
          canAcceptOrder: false,
          reason: `OUTSIDE_OPERATING_HOURS (${open} - ${close})`,
          estimatedBufferMinutes: 0
        };
      }
    }
  }

  // 4. Rush Mode Buffer Calculation (Rejects negative buffer strictly at creation/update, normalized safely at eval)
  let rushBuffer = 0;
  if (override?.isRushMode) {
    if (override.rushBufferMinutes < 0) {
      throw new Error('INVALID_BUFFER: rushBufferMinutes cannot be negative');
    }
    rushBuffer = override.rushBufferMinutes || 0;
  }

  return {
    canAcceptOrder: true,
    estimatedBufferMinutes: rushBuffer
  };
}

/**
 * 🔒 2. Authoritative Atomic Capacity Slot Reservation Boundary
 * Reads shop maxOrdersPerSlot from authoritative Store doc inside transaction rather than trusting client input.
 */
export async function reserveCapacitySlotAtomic(
  db: Firestore,
  storeId: string,
  slotId: string,
  clientCapacityHint?: number
): Promise<{ success: boolean; slotId: string; currentOrders: number; capacity: number }> {
  if (!storeId || !slotId) throw new Error('storeId and slotId are required');

  return await runTransaction(db, async (tx) => {
    // 🔒 1. Authoritative Store Capacity Pre-read
    const shopRef = doc(db, 'shops', storeId);
    const shopSnap = await tx.get(shopRef);

    let authoritativeCapacity = 20; // Default fallback if not set in store doc
    if (shopSnap.exists()) {
      const shopData = shopSnap.data();
      if (typeof shopData.maxOrdersPerSlot === 'number' && shopData.maxOrdersPerSlot > 0) {
        authoritativeCapacity = shopData.maxOrdersPerSlot;
      } else if (shopData.capacityConfig?.maxOrdersPerSlot && shopData.capacityConfig.maxOrdersPerSlot > 0) {
        authoritativeCapacity = shopData.capacityConfig.maxOrdersPerSlot;
      }
    } else if (clientCapacityHint && clientCapacityHint > 0) {
      authoritativeCapacity = clientCapacityHint;
    }

    // 🔒 2. Read current slot orders atomically
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

    if (currentOrders + 1 > authoritativeCapacity) {
      throw new Error(`SLOT_CAPACITY_EXCEEDED: Slot ${slotId} is fully booked (${currentOrders}/${authoritativeCapacity})`);
    }

    const nextCount = currentOrders + 1;
    tx.set(
      slotRef,
      {
        slotId,
        storeId,
        capacity: authoritativeCapacity,
        currentOrders: nextCount,
        updatedAt: new Date()
      },
      { merge: true }
    );

    return { success: true, slotId, currentOrders: nextCount, capacity: authoritativeCapacity };
  });
}
