/**
 * Pure Domain Engine: Slot Helper
 * Manages 15-minute canonical time slots, capacity enforcement,
 * and dynamic wait times for pickup scheduling.
 */

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
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hours = date.getHours();
  const minutes = Math.floor(date.getMinutes() / 15) * 15;
  
  return `${yyyy}-${mm}-${dd}_${String(hours).padStart(2, '0')}-${String(minutes).padStart(2, '0')}`;
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

  const future = new Date(Date.now() + totalMinutes * 60 * 1000);
  const timeString = `${String(future.getHours()).padStart(2, '0')}:${String(future.getMinutes()).padStart(2, '0')}`;

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
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Generates next N 15-minute slot intervals starting from the next upcoming slot
 */
export function getUpcomingSlots(count: number = 8, date: Date = new Date()): { slotId: string; displayTime: string; startTime: string; endTime: string }[] {
  const slots: { slotId: string; displayTime: string; startTime: string; endTime: string }[] = [];
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
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

