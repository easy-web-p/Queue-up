import { Store, FoodItem, QueueOrder } from '../../types';
import { ChatMessage, ChatThread } from '../../types/schema';

export interface ScopeBoundStoreTools {
  getStoreId(): string | undefined;
  getStoreName(): string;
  getQueueStatus(): Promise<{
    hasActiveOrder: boolean;
    storeName: string;
    orderId?: string;
    queueNumber?: string;
    status?: string;
    pickupPin?: string;
    estimatedWaitMinutes?: number;
    itemsSummary?: string;
    total?: number;
    isOpen?: boolean;
    currentQueueCount?: number;
    averageWaitMinutes?: number;
  }>;
  getStoreStatus(): Promise<{
    storeId?: string;
    storeName: string;
    isOpen: boolean;
    openingHours: string;
    averageWaitMinutes: number;
    currentQueueCount: number;
    pickupLocation: string;
  }>;
  getMenuCatalog(categoryFilter?: string | null): Promise<{
    storeName: string;
    itemCount: number;
    items: Array<{
      id: string;
      name: string;
      price: number;
      category?: string;
      isAvailable: boolean;
      allergens: string[];
    }>;
  }>;
  findMenuItem(queryText: string): Promise<{
    id: string;
    name: string;
    price: number;
    description: string;
    isAvailable: boolean;
    allergens: string[];
  } | null>;
  checkAllergens(queryText?: string): Promise<{
    queryText: string;
    identifiedAllergens: string[];
    matchedDishes: Array<{
      name: string;
      allergens: string[];
    }>;
  }>;
}

export interface AssistantReplyResult {
  handled: boolean;
  replyText?: string;
  senderRole?: 'ai_assistant';
  reason?: string;
  messageType?: 'text' | 'order_card' | 'booking_card';
  bookingSnapshot?: {
    bookingDate?: string;
    bookingTime?: string;
    guestCount?: number;
    itemsSummary?: string;
    total?: number;
    status?: string;
    canPay?: boolean;
    foodId?: string;
    quantity?: number;
    specialNote?: string;
  };
  orderSnapshot?: {
    queueNumber?: string;
    itemsSummary?: string;
    total?: number;
    status?: string;
  };
  aiMeta?: {
    layer: 1 | 2;
    toolsUsed: string[];
    escalated: boolean;
    model?: string;
    latencyMs: number;
  };
}

/**
 * 1. Scope-Bound Store Tools Factory
 * Locks storeId, customerId, and schoolId to the closure.
 */
export function makeStoreTools({
  store,
  activeOrder,
  menuItems = [],
  schoolId,
  customerId
}: {
  store?: Store | null;
  activeOrder?: QueueOrder | null;
  menuItems?: FoodItem[];
  schoolId?: string;
  customerId?: string;
}): ScopeBoundStoreTools {
  const storeId = store?.id;
  const storeName = store?.name || 'ร้านค้า';

  return {
    getStoreId() {
      return storeId;
    },
    getStoreName() {
      return storeName;
    },

    async getQueueStatus() {
      if (activeOrder && activeOrder.status !== 'COMPLETED' && activeOrder.status !== 'CANCELLED') {
        return {
          hasActiveOrder: true,
          storeName,
          orderId: activeOrder.id,
          queueNumber: (activeOrder as any).queueNumber || (activeOrder as any).orderNumber || 'A01',
          status: activeOrder.status,
          pickupPin: activeOrder.exchangePin || (activeOrder as any).pickupPin || '----',
          estimatedCompletionTime: activeOrder.estimatedCompletionTime || activeOrder.pickupTime || '10-15 นาที',
          estimatedWaitMinutes: (activeOrder as any).estimatedWaitMinutes || 5,
          itemsSummary: activeOrder.items?.map(i => `${i.food?.name || 'อาหาร'} x${i.quantity}`).join(', ') || 'รายการอาหาร',
          total: activeOrder.total || 0
        };
      }

      return {
        hasActiveOrder: false,
        storeName,
        isOpen: Boolean(store?.isOpen),
        currentQueueCount: store?.currentQueueCount || 0,
        averageWaitMinutes: store?.averageWaitMinutes || 10
      };
    },

    async getStoreStatus() {
      return {
        storeId,
        storeName,
        isOpen: Boolean(store?.isOpen),
        openingHours: store?.openingHours || '08:00 - 17:00 น.',
        averageWaitMinutes: store?.averageWaitMinutes || 10,
        currentQueueCount: store?.currentQueueCount || 0,
        pickupLocation: store?.contactChannels?.pickupCounterLocation || 'ช่องรับอาหารหน้าร้าน'
      };
    },

    async getMenuCatalog(categoryFilter = null) {
      let items = menuItems.filter(item => item.isAvailable !== false);
      if (categoryFilter) {
        items = items.filter(item => item.category?.toLowerCase() === (categoryFilter as string).toLowerCase());
      }
      return {
        storeName,
        itemCount: items.length,
        items: items.slice(0, 10).map(i => ({
          id: i.id,
          name: i.name,
          price: i.price,
          category: i.category,
          isAvailable: i.isAvailable !== false,
          allergens: [] // Menu allergens in FoodItem can be extended
        }))
      };
    },

    async findMenuItem(queryText: string) {
      const q = queryText.toLowerCase().trim();
      const matched = menuItems.find(i =>
        i.name.toLowerCase().includes(q) ||
        (i.nameEn && i.nameEn.toLowerCase().includes(q))
      );
      if (!matched) return null;
      return {
        id: matched.id,
        name: matched.name,
        price: matched.price,
        description: matched.description || '',
        isAvailable: matched.isAvailable !== false,
        allergens: []
      };
    },

    async checkAllergens(queryText = '') {
      const q = queryText.toLowerCase();
      const matchedDishes: Array<{ name: string; allergens: string[] }> = [];
      const identifiedAllergens = new Set<string>();

      for (const item of menuItems) {
        const itemAllergens: string[] = []; // In future, attach allergens array to FoodItem
        const matchesDish = q.includes(item.name.toLowerCase());
        const hasMatchingAllergen = itemAllergens.some(a => q.includes(a.toLowerCase()));

        if (matchesDish || hasMatchingAllergen) {
          matchedDishes.push({
            name: item.name,
            allergens: itemAllergens
          });
          itemAllergens.forEach(a => identifiedAllergens.add(a));
        }
      }

      return {
        queryText,
        identifiedAllergens: Array.from(identifiedAllergens),
        matchedDishes
      };
    }
  };
}

/**
 * 2. Inviolable Guard: Allergen Safety Check (Rule 2)
 */
export async function checkAllergenGuard(
  message: string,
  tools: ScopeBoundStoreTools
): Promise<AssistantReplyResult | null> {
  const allergenPattern = /(แพ้|ถั่ว|กุ้ง|นม|กลูเตน|หอย|ปู|ไข่|แป้งสาลี|ปลาหมึก|งา|allergy|allergens)/i;
  if (!allergenPattern.test(message)) {
    return null;
  }

  const result = await tools.checkAllergens(message);
  const storeName = tools.getStoreName();

  let details = '';
  if (result.matchedDishes.length > 0) {
    details = result.matchedDishes.map(d =>
      `• เมนู "${d.name}": ${d.allergens.length > 0 ? d.allergens.join(', ') : 'ไม่มีรายงานสารก่อภูมิแพ้ในระบบ'}`
    ).join('\n');
  } else {
    details = '• ไม่พบรายการสารก่อภูมิแพ้ตรงกับเมนูที่ค้นหาในฐานข้อมูล';
  }

  const replyText =
`⚠️ [ระบบความปลอดภัยด้านสารก่อภูมิแพ้ — Allergen Guard]
ข้อมูลสารก่อภูมิแพ้จากฐานข้อมูลร้าน "${storeName}":
${details}

🚨 คำเตือนสำคัญ: เพื่อความปลอดภัยสูงสุดของผู้มีอาการแพ้อาหาร ห้ามอ้างอิงข้อมูลอัตโนมัติเพียงอย่างเดียว กรุณายืนยันส่วนผสมและแจ้งให้ทางร้านแยกภาชนะปรุงโดยตรงอีกครั้งนะคะ
(ระบบได้ส่งสัญญาณแจ้งเตือนข้อความนี้ไปยังเจ้าของร้านเรียบร้อยแล้วค่ะ) 👩‍🍳`;

  return {
    handled: true,
    replyText,
    senderRole: 'ai_assistant',
    aiMeta: {
      layer: 1,
      toolsUsed: ['checkAllergens'],
      escalated: true,
      latencyMs: 1
    }
  };
}

/**
 * 3. Inviolable Guard: Read-Only Store Commitments (Rule 3)
 */
export function checkEscalationGuard(
  message: string,
  tools: ScopeBoundStoreTools
): AssistantReplyResult | null {
  const escalationPattern = /(ขอลด|ลดได้ไหม|ลดราคา|แถม|เก็บไว้ให้|ฝากไว้|ขอยกเลิก|ยกเลิกออเดอร์|ขอคืนเงิน|เปลี่ยนเมนู|ทำไมช้า|ร้องเรียน|คืนเงิน)/i;
  if (!escalationPattern.test(message)) {
    return null;
  }

  const storeName = tools.getStoreName();
  const replyText =
`👩‍🍳 เรื่องนี้เกินขอบเขตที่ผู้ช่วย AI สามารถตัดสินใจแทนร้านค้าได้ค่ะ

ระบบได้ส่งต่อข้อความของคุณไปยังเจ้าของร้าน "${storeName}" โดยตรงเรียบร้อยแล้ว กรุณารอสักครู่นะคะ ทางร้านจะตอบกลับคุณผ่านช่องทางแชทนี้ค่ะ 🙏`;

  return {
    handled: true,
    replyText,
    senderRole: 'ai_assistant',
    aiMeta: {
      layer: 1,
      toolsUsed: [],
      escalated: true,
      latencyMs: 1
    }
  };
}

/**
 * 4. Layer 1: Deterministic Intent Router
 */
export async function routeIntentLayer1(
  message: string,
  tools: ScopeBoundStoreTools
): Promise<AssistantReplyResult | null> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // 0. Pre-order / Reservation Booking Intent with Checkout Action (TOP PRIORITY)
  if (
    lower.includes('แจ้งการจองอาหารล่วงหน้า') ||
    lower.includes('[แจ้งการจองอาหารล่วงหน้า]') ||
    (lower.includes('จองอาหาร') && (lower.includes('เวลานัดรับ') || lower.includes('กล่อง') || lower.includes('จาน') || lower.includes('เวลารับ')))
  ) {
    let mealText = '';
    let timeText = '12:30 น.';
    let guestCount = 1;
    let noteText = '';
    let quantity = 1;

    const mealMatch = message.match(/•?\s*เมนู\s*:\s*([^\n\r]+)/i);
    if (mealMatch) mealText = mealMatch[1].trim();

    const timeMatch = message.match(/•?\s*เวลานัดรับ\s*:\s*([^\n\r(]+)/i);
    if (timeMatch) timeText = timeMatch[1].trim();

    const guestMatch = message.match(/\((\d+)\s*ท่าน\)/i) || message.match(/•?\s*จำนวน\s*:\s*(\d+)/i);
    if (guestMatch) guestCount = parseInt(guestMatch[1], 10);

    const noteMatch = message.match(/•?\s*หมายเหตุ\s*:\s*([^\n\r]+)/i);
    if (noteMatch) noteText = noteMatch[1].trim();

    // Extract quantity from mealText if present (e.g. "3 กล่อง", "2 จาน", "x3")
    const qtyMatch = mealText.match(/(\d+)\s*(กล่อง|จาน|แก้ว|ชุด|ที่)/i) || mealText.match(/x\s*(\d+)/i);
    if (qtyMatch) {
      quantity = parseInt(qtyMatch[1], 10);
    }

    // Try to find the food item in store menu
    let matchedItem = null;
    const cleanDishName = mealText.replace(/\d+\s*(กล่อง|จาน|แก้ว|ชุด|ที่)/gi, '').replace(/x\s*\d+/gi, '').trim();
    if (cleanDishName) {
      matchedItem = await tools.findMenuItem(cleanDishName);
    }

    const unitPrice = matchedItem?.price || 89;
    const total = unitPrice * quantity;
    const resolvedName = matchedItem?.name || cleanDishName || 'รายการอาหารสั่งจองล่วงหน้า';
    const storeName = tools.getStoreName();

    const bookingSnapshot = {
      bookingDate: 'วันนี้',
      bookingTime: timeText,
      guestCount,
      itemsSummary: `${resolvedName} x${quantity} กล่อง`,
      total,
      status: 'รอการชำระเงิน',
      canPay: true,
      foodId: matchedItem?.id || 'food-booking-1',
      quantity,
      specialNote: noteText
    };

    const replyText = 
`🎉 ได้รับรายละเอียดการสั่งจองอาหารล่วงหน้าของร้าน "${storeName}" เรียบร้อยค่ะ!
• 🍽️ เมนู: ${resolvedName} x${quantity} กล่อง
• ⏰ เวลานัดรับ: ${timeText} (${guestCount} ท่าน)
• 💵 ยอดรวมประมาณการ: ฿${total}
${noteText ? `• 📝 หมายเหตุ: ${noteText}` : ''}

👉 คุณลูกค้าสามารถกดปุ่ม **"💳 ชำระเงิน / ยืนยันการสั่งจอง"** ด้านล่างนี้เพื่อดำเนินการชำระเงินและรับบัตรคิวดิจิทัลได้ทันทีเลยนะคะ 🚀`;

    return {
      handled: true,
      replyText,
      senderRole: 'ai_assistant',
      messageType: 'booking_card',
      bookingSnapshot,
      aiMeta: {
        layer: 1,
        toolsUsed: ['createBookingOrderQuote'],
        escalated: false,
        latencyMs: 1
      }
    };
  }

  // A. Queue & Wait Time
  if (/(คิว|ถึงยัง|อีกกี่คิว|คิวที่|สถานะคิว|รออีก|นานไหม|เสร็จยัง|ใกล้เสร็จ)/i.test(lower)) {
    const qData = await tools.getQueueStatus();
    let replyText = '';

    if (qData.hasActiveOrder) {
      const statusThaiMap: Record<string, string> = {
        PREPARING: 'กำลังปรุงอาหารอย่างพิถีพิถัน 🍳',
        READY: 'พร้อมรับอาหารที่หน้าร้านแล้วค่ะ! 🔔',
        READY_FOR_PICKUP: 'พร้อมรับอาหารที่หน้าร้านแล้วค่ะ! 🔔',
        PAYMENT_PENDING: 'รอการยืนยันชำระเงิน',
        PAID_AWAITING_MERCHANT: 'ร้านค้ารับออเดอร์แล้ว รอเริ่มปรุง',
        COMPLETED: 'ส่งมอบอาหารเรียบร้อยแล้ว'
      };
      const statusText = (qData.status && statusThaiMap[qData.status]) || qData.status || '';

      replyText = `📋 ออเดอร์ของคุณคือ คิว #${qData.queueNumber} (${qData.itemsSummary})
สถานะปัจจุบัน: ${statusText}
⏳ เวลารอโดยประมาณ: ${qData.estimatedWaitMinutes} นาที
🔑 รหัส PIN รับอาหาร: ${qData.pickupPin} (แสดงหน้าร้านเพื่อแลกรับอาหารนะคะ)`;
    } else {
      replyText = `ขณะนี้คุณยังไม่มีคิวที่กำลังรอของร้าน "${qData.storeName}" ค่ะ
ปัจจุบันหน้าร้านมีคิวสะสม ${qData.currentQueueCount} คิว (เวลารอคอยเฉลี่ยประมาณ ${qData.averageWaitMinutes} นาที)
สามารถเลือกดูเมนูและกดสั่งอาหารผ่านแอปไว้ล่วงหน้าได้เลยนะคะ 🍛`;
    }

    return {
      handled: true,
      replyText,
      senderRole: 'ai_assistant',
      aiMeta: {
        layer: 1,
        toolsUsed: ['getQueueStatus'],
        escalated: false,
        latencyMs: 1
      }
    };
  }

  // B. Store Opening Hours
  if (/(เปิดยัง|เปิดกี่โมง|ปิดกี่โมง|ร้านเปิด|เปิดอยู่ไหม|ร้านปิด|เวลาทำการ)/i.test(lower)) {
    const sData = await tools.getStoreStatus();
    let replyText = '';

    if (sData.isOpen) {
      replyText = `🟢 ร้าน "${sData.storeName}" กำลังเปิดให้บริการตามปกติค่ะ!
⏰ เวลาทำการ: ${sData.openingHours}
📍 จุดรับอาหาร: ${sData.pickupLocation}
สั่งอาหารล่วงหน้าตอนนี้ เวลารอประมาณ ${sData.averageWaitMinutes} นาทีค่ะ ✨`;
    } else {
      replyText = `🔴 ขณะนี้ร้าน "${sData.storeName}" ปิดให้บริการชั่วคราวค่ะ
⏰ เวลาเปิด-ปิดปกติ: ${sData.openingHours}
เมื่อร้านเปิดระบบจะเปิดรับออเดอร์ทันทีค่ะ 🙏`;
    }

    return {
      handled: true,
      replyText,
      senderRole: 'ai_assistant',
      aiMeta: {
        layer: 1,
        toolsUsed: ['getStoreStatus'],
        escalated: false,
        latencyMs: 1
      }
    };
  }

  // C. Menu & Pricing
  if (/(ราคา|เมนู|มีอะไรบ้าง|ขายอะไร|แนะนำ|กี่บาท|จานละ)/i.test(lower)) {
    const words = trimmed.split(/\s+/);
    let matchedItem = null;
    for (const w of words) {
      if (w.length >= 3 && !['ราคา', 'เมนู', 'มีอะไร', 'กี่บาท'].includes(w)) {
        matchedItem = await tools.findMenuItem(w);
        if (matchedItem) break;
      }
    }

    if (matchedItem) {
      const replyText = `🍽️ ข้อมูลเมนู "${matchedItem.name}":
💵 ราคา: ฿${matchedItem.price}
📌 สถานะ: ${matchedItem.isAvailable ? 'พร้อมจำหน่าย ✅' : 'สินค้าหมดชั่วคราว ❌'}
${matchedItem.description ? `📝 รายละเอียด: ${matchedItem.description}` : ''}`;

      return {
        handled: true,
        replyText,
        senderRole: 'ai_assistant',
        aiMeta: {
          layer: 1,
          toolsUsed: ['findMenuItem'],
          escalated: false,
          latencyMs: 1
        }
      };
    }

    const catalog = await tools.getMenuCatalog();
    const itemsList = catalog.items.map(i => `• ${i.name} (฿${i.price})`).join('\n');
    const replyText = `📖 เมนูยอดนิยมของร้าน "${catalog.storeName}":
${itemsList}

สามารถกดดูเมนูและตัวเลือกพิเศษทั้งหมดในหน้าร้านได้เลยค่ะ 🍲`;

    return {
      handled: true,
      replyText,
      senderRole: 'ai_assistant',
      aiMeta: {
        layer: 1,
        toolsUsed: ['getMenuCatalog'],
        escalated: false,
        latencyMs: 1
      }
    };
  }

  return null;
}

/**
 * 5. Master Assistant Dispatcher
 */
export async function processAssistantReply({
  message,
  chatThread,
  store,
  activeOrder,
  menuItems = []
}: {
  message: string;
  chatThread?: Partial<ChatThread>;
  store?: Store | null;
  activeOrder?: QueueOrder | null;
  menuItems?: FoodItem[];
}): Promise<AssistantReplyResult> {
  const startTime = Date.now();

  if (chatThread?.aiAutoReply === false) {
    return { handled: false, reason: 'AI_DISABLED_BY_STORE' };
  }

  if (chatThread?.aiSilencedUntil && new Date(chatThread.aiSilencedUntil) > new Date()) {
    return { handled: false, reason: 'AI_SILENCED_DUE_TO_RECENT_MERCHANT_REPLY' };
  }

  const tools = makeStoreTools({
    store,
    activeOrder,
    menuItems,
    schoolId: chatThread?.schoolId || store?.schoolId,
    customerId: chatThread?.customerId
  });

  const allergenResult = await checkAllergenGuard(message, tools);
  if (allergenResult) {
    if (allergenResult.aiMeta) {
      allergenResult.aiMeta.latencyMs = Date.now() - startTime;
    }
    return allergenResult;
  }

  const escalationResult = checkEscalationGuard(message, tools);
  if (escalationResult) {
    if (escalationResult.aiMeta) {
      escalationResult.aiMeta.latencyMs = Date.now() - startTime;
    }
    return escalationResult;
  }

  const layer1Result = await routeIntentLayer1(message, tools);
  if (layer1Result) {
    if (layer1Result.aiMeta) {
      layer1Result.aiMeta.latencyMs = Date.now() - startTime;
    }
    return layer1Result;
  }

  const storeName = tools.getStoreName();
  return {
    handled: true,
    replyText: `🤖 สวัสดีค่ะ ผู้ช่วยอัตโนมัติประจำร้าน "${storeName}" ยินดีให้บริการค่ะ สำหรับคำถามเพิ่มเติมเกี่ยวกับ "${message.slice(0, 40)}" ระบบได้ส่งสัญญาณแจ้งเตือนไปยังเจ้าของร้านเรียบร้อยแล้วนะคะ ทางร้านจะรีบเข้ามาตอบกลับคุณในไม่ช้าค่ะ 🙏`,
    senderRole: 'ai_assistant',
    aiMeta: {
      layer: 1,
      toolsUsed: [],
      escalated: true,
      latencyMs: Date.now() - startTime
    }
  };
}
