/**
 * Pure Domain Engine: Slot Helper
 * Manages 15-minute canonical time slots, capacity enforcement,
 * and dynamic wait times for pickup scheduling.
 */

/**
 * Canteen-local time zone. Slot ids travel to the server and into Firestore, so
 * they must be identical no matter what time zone the device is set to — a
 * traveller's phone must still book the same 12:00 Bangkok window as the kitchen.
 * Mirrors SLOT_TIME_ZONE in server/services/capacityService.js.
 */
export const CANTEEN_TIME_ZONE = 'Asia/Bangkok';

const zonedPartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: CANTEEN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** Wall-clock fields of an instant, read in CANTEEN_TIME_ZONE. */
function zonedParts(date: Date): ZonedParts {
  const parts = zonedPartsFormatter.formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    // Some ICU builds render midnight as hour 24 under hour12: false.
    hour: read('hour') % 24,
    minute: read('minute')
  };
}

export interface SlotInfo {
  slotId: string; // e.g. "2026-09-21_12-15"
  displayTime: string; // e.g. "12:15 - 12:30 น."
  availableCapacity: number;
  maxCapacity: number;
  isFull: boolean;
}

/**
 * Generates a canonical slot ID based on Date and 15-minute block
 */
export function getCanonicalSlotId(date: Date = new Date()): string {
  const { year, month, day, hour, minute } = zonedParts(date);
  const yyyy = year;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const slotMinute = Math.floor(minute / 15) * 15;

  return `${yyyy}-${mm}-${dd}_${String(hour).padStart(2, '0')}-${String(slotMinute).padStart(2, '0')}`;
}

/**
 * Calculates estimated completion time in HH:mm format given total items and preparation minutes
 */
export function calculateEstimatedCompletionTime(
  basePrepMinutes: number = 10,
  currentQueueLength: number = 0,
  itemCount: number = 1
): { estimatedMinutes: number; timeString: string } {
  // 5 mins base + 2 mins per queue ahead + 1 min per extra item
  const queueDelay = Math.min(30, currentQueueLength * 3);
  const itemDelay = Math.max(0, (itemCount - 1) * 2);
  const totalMinutes = Math.max(5, basePrepMinutes + queueDelay + itemDelay);

  const future = zonedParts(new Date(Date.now() + totalMinutes * 60 * 1000));
  const timeString = `${String(future.hour).padStart(2, '0')}:${String(future.minute).padStart(2, '0')}`;

  return {
    estimatedMinutes: totalMinutes,
    timeString
  };
}

/**
 * Formats a slot ID into human-readable Thai pickup text
 */
export function formatSlotDisplay(slotId: string): string {
  const parts = slotId.split('_');
  if (parts.length < 2) return 'ทันที (ด่วน)';
  const [hh, mm] = parts[1].split('-');
  const startH = parseInt(hh, 10);
  const startM = parseInt(mm, 10);
  const endM = (startM + 15) % 60;
  const endH = startM + 15 >= 60 ? (startH + 1) % 24 : startH;

  return `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} - ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')} น.`;
}

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
export function getTodayDateString(date: Date = new Date()): string {
  const { year, month, day } = zonedParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Generates next N 15-minute slot intervals starting from the next upcoming slot
 */
export function getUpcomingSlots(count: number = 8, date: Date = new Date()): { slotId: string; displayTime: string; startTime: string; endTime: string }[] {
  const slots: { slotId: string; displayTime: string; startTime: string; endTime: string }[] = [];
  const { hour, minute } = zonedParts(date);
  const currentMinutes = hour * 60 + minute;
  const nextSlotMinute = Math.ceil((currentMinutes + 1) / 15) * 15;
  const dateStr = getTodayDateString(date);

  for (let i = 0; i < count; i++) {
    const totalMin = nextSlotMinute + (i * 15);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h >= 21) break; // Past store hours

    const endTotalMin = totalMin + 15;
    const endH = Math.floor(endTotalMin / 60);
    const endM = endTotalMin % 60;

    const hStr = String(h).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');
    const endHStr = String(endH).padStart(2, '0');
    const endMStr = String(endM).padStart(2, '0');

    const slotId = `${dateStr}_${hStr}-${mStr}`;
    const startTime = `${hStr}:${mStr}`;
    const endTime = `${endHStr}:${endMStr}`;
    const displayTime = `${hStr}:${mStr} - ${endHStr}:${endMStr} น.`;
    slots.push({ slotId, displayTime, startTime, endTime });
  }

  return slots;
}

