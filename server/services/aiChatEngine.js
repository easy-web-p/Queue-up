/**
 * AI Chat Assistant Engine for QueueUp (School Canteen Edition)
 * 
 * Strict Architecture:
 * - NO RAG: Structured canteen data (pricing, status, allergens) is queried via deterministic tools.
 * - Layer 1: Deterministic Intent Router (handles ~80% of common queries instantly, 0 cost, 0 hallucinations)
 * - Layer 2: Scope-Bound Tool Calling (LLM formats responses from real JSON; storeId/schoolId bound at server)
 * - Layer 3: Human Escalation & Inviolable Safety Hard-Blocks (Allergens & Store commitments)
 */

import { runLayer2, isLayer2Enabled } from './aiLayer2.js';

/** Lowercase, collapse whitespace, drop decorative punctuation. */
function normalizeQuery(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[?!.,ๆฯ"'`()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes the words that wrap a question around a dish name, so what is left
 * is close to the dish itself.
 */
const QUESTION_WORDS = [
  'ราคา', 'เท่าไหร่', 'เท่าไร', 'กี่บาท', 'จานละ', 'แก้วละ', 'กล่องละ',
  'มีไหม', 'มีมั้ย', 'ยังมีไหม', 'หมดยัง', 'ขายไหม', 'สั่งได้ไหม',
  'อยากได้', 'ขอ', 'เมนู', 'อาหาร', 'ครับ', 'ค่ะ', 'คะ', 'ฮะ', 'นะ',
  'คือ', 'ช่วย', 'บอก', 'หน่อย', 'ด้วย'
];

function stripQuestionWords(text) {
  let out = text;
  for (const word of QUESTION_WORDS) {
    out = out.split(word).join(' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * 1. Scope-Bound Store Tools Factory
 * Enforces server-side binding of storeId, customerId, and schoolId.
 * The caller or LLM CANNOT pass or tamper with storeId!
 */
export function makeStoreTools({ store, activeOrder, menuItems = [], schoolId, customerId }) {
  const storeId = store?.id;
  const storeName = store?.name || 'ร้านค้า';

  return {
    getStoreId() {
      return storeId;
    },
    getStoreName() {
      return storeName;
    },
    
    /**
     * Tool: Get current queue status for this customer & store
     */
    async getQueueStatus() {
      if (activeOrder && activeOrder.status !== 'COMPLETED' && activeOrder.status !== 'CANCELLED') {
        return {
          hasActiveOrder: true,
          storeName,
          orderId: activeOrder.id,
          queueNumber: activeOrder.queueNumber || activeOrder.orderNumber || 'A01',
          status: activeOrder.status,
          pickupPin: activeOrder.pickupPin || activeOrder.exchangePin || '----',
          estimatedWaitMinutes: activeOrder.estimatedWaitMinutes || 5,
          itemsSummary: activeOrder.items?.map(i => `${i.food?.name || i.name} x${i.quantity}`).join(', ') || 'รายการอาหาร',
          total: activeOrder.total || activeOrder.totalSatang ? (activeOrder.total || activeOrder.totalSatang / 100) : 0
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

    /**
     * Tool: Get store open/closed status and business hours
     */
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

    /**
     * Tool: Get list of available food items & prices
     */
    async getMenuCatalog(categoryFilter = null) {
      let items = menuItems.filter(item => item.isAvailable !== false);
      if (categoryFilter) {
        items = items.filter(item => item.category?.toLowerCase() === categoryFilter.toLowerCase());
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
          allergens: i.allergens || []
        }))
      };
    },

    /**
     * Tool: Search item by keyword.
     *
     * Thai is written without spaces between words, so a customer's sentence
     * normally CONTAINS the dish name rather than the reverse:
     * "ข้าวมันไก่ทอดราคาเท่าไหร่" is a single token. Matching only
     * name.includes(query) therefore never fired for a real question, which is
     * why price queries used to answer with the whole catalogue.
     */
    async findMenuItem(queryText) {
      const raw = normalizeQuery(queryText);
      if (!raw) return null;

      // Try the sentence as typed first, then again with the question words
      // stripped, so "ข้าวมันไก่ราคาเท่าไหร่" still reaches "ข้าวมันไก่ต้ม".
      const candidates = [raw, stripQuestionWords(raw)].filter(Boolean);
      let best = null;

      for (const q of candidates) {
        for (const item of menuItems) {
          const name = normalizeQuery(item.name);
          const nameEn = normalizeQuery(item.nameEn || '');
          const names = [name, nameEn].filter(Boolean);

          const matchedName = names.find((n) => q.includes(n) || n.includes(q));
          if (!matchedName) continue;

          // The longest matching name wins, so "ข้าวมันไก่ทอด" is preferred
          // over the shorter "ข้าวมันไก่" when both appear.
          if (!best || matchedName.length > best.matchLength) {
            best = { item, matchLength: matchedName.length };
          }
        }
        if (best) break;
      }

      if (!best) return null;
      const matched = best.item;
      return {
        id: matched.id,
        name: matched.name,
        price: matched.price,
        description: matched.description || '',
        isAvailable: matched.isAvailable !== false,
        allergens: matched.allergens || [],
        spicyLevel: matched.spicyLevel,
        preparationMinutes: matched.preparationMinutes,
        tags: matched.tags || []
      };
    },

    /**
     * Tool: Items the store actually sells most, for "what do you recommend".
     */
    async getRecommendations(limit = 3) {
      const available = menuItems.filter((i) => i.isAvailable !== false);
      const ranked = [...available].sort((a, b) =>
        (b.orderCount || 0) - (a.orderCount || 0) || (b.rating || 0) - (a.rating || 0)
      );
      return {
        storeName,
        // Nothing has been ordered yet, so there is no honest "best seller".
        hasOrderHistory: available.some((i) => (i.orderCount || 0) > 0),
        items: ranked.slice(0, limit).map((i) => ({
          name: i.name, price: i.price, orderCount: i.orderCount || 0, rating: i.rating || 0
        }))
      };
    },

    /**
     * Tool: Pickup point, payment methods and cancellation policy as the store
     * itself published them.
     */
    async getServiceInfo() {
      return {
        storeName,
        pickupLocation: store?.contactChannels?.pickupCounterLocation || null,
        pickupPolicy: store?.exchangeTerms?.pickupPolicy || null,
        pickupWindowMinutes: store?.exchangeTerms?.pickupWindowMinutes || null,
        paymentTerms: store?.exchangeTerms?.paymentTerms || null,
        cancellationPolicy: store?.exchangeTerms?.cancellationPolicy || null,
        phone: store?.contactChannels?.phone || null
      };
    },

    /**
     * Tool: Dietary filtering, answered only from tags the store set. Absent
     * tags mean "unknown", never "safe".
     */
    async findByDietaryTag(tagPatterns) {
      const available = menuItems.filter((i) => i.isAvailable !== false);
      const anyTagged = available.some((i) => Array.isArray(i.tags) && i.tags.length > 0);
      const matches = available.filter((i) =>
        (i.tags || []).some((tag) => tagPatterns.some((p) => p.test(String(tag))))
      );
      return {
        storeName,
        storeTagsItems: anyTagged,
        items: matches.map((i) => ({ name: i.name, price: i.price }))
      };
    },

    /**
     * Tool: Check allergens directly from database
     */
    async checkAllergens(queryText = '') {
      const q = queryText.toLowerCase();
      const matchedDishes = [];
      const identifiedAllergens = new Set();

      for (const item of menuItems) {
        const itemAllergens = item.allergens || [];
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
 * Hard-blocks LLM reinterpretation. Returns raw DB allergens and mandates human confirmation.
 */
export async function checkAllergenGuard(message, tools) {
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
 * AI CANNOT make promises, discount, cancel, or modify store policy.
 */
export function checkEscalationGuard(message, tools) {
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
 * 4. Layer 1: Deterministic Intent Router (~80% coverage)
 */
export async function routeIntentLayer1(message, tools) {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  /** A reply the assistant could answer from store data. */
  const answered = (replyText, toolsUsed = []) => ({
    handled: true,
    replyText,
    senderRole: 'ai_assistant',
    aiMeta: { layer: 1, toolsUsed, escalated: false, latencyMs: 1 }
  });

  /**
   * A reply that hands the question to the store. Escalating is the honest
   * answer whenever the data would have to be guessed — saying "I don't know,
   * the shop will reply" beats an invented answer about food.
   */
  const escalate = (replyText, toolsUsed = []) => ({
    handled: true,
    replyText,
    senderRole: 'ai_assistant',
    aiMeta: { layer: 1, toolsUsed, escalated: true, latencyMs: 1 }
  });

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

  // A. Queue & Wait Time Queries
  if (/(คิว|ถึงยัง|ถึงไหน|อีกกี่คิว|คิวที่|สถานะคิว|รออีก|นานไหม|เสร็จยัง|เสร็จหรือยัง|ใกล้เสร็จ|ออเดอร์.*(ถึงไหน|สถานะ|ยังไง|เป็นไง)|อาหาร.*(เสร็จ|พร้อม))/i.test(lower)) {
    const qData = await tools.getQueueStatus();
    let replyText = '';

    if (qData.hasActiveOrder) {
      const statusThaiMap = {
        PREPARING: 'กำลังปรุงอาหารอย่างพิถีพิถัน 🍳',
        READY: 'พร้อมรับอาหารที่หน้าร้านแล้วค่ะ! 🔔',
        READY_FOR_PICKUP: 'พร้อมรับอาหารที่หน้าร้านแล้วค่ะ! 🔔',
        PAYMENT_PENDING: 'รอการยืนยันชำระเงิน',
        PAID_AWAITING_MERCHANT: 'ร้านค้ารับออเดอร์แล้ว รอเริ่มปรุง',
        COMPLETED: 'ส่งมอบอาหารเรียบร้อยแล้ว'
      };
      const statusText = statusThaiMap[qData.status] || qData.status;

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

  // B. Store Hours & Opening Status Queries
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

  // B2. Pickup Location Queries
  if (/(รับอาหาร|รับของ|มารับ|ไปรับ|จุดรับ|รับที่ไหน|รับตรงไหน|อยู่ตรงไหน|ร้านอยู่ไหน|บูธ)/i.test(lower)) {
    const info = await tools.getServiceInfo();

    if (!info.pickupLocation) {
      return escalate(
        `ขออภัยค่ะ ระบบยังไม่มีข้อมูลจุดรับอาหารของร้าน "${info.storeName}" บันทึกไว้ ` +
        'ได้แจ้งให้ทางร้านมาตอบให้แล้วนะคะ 🙏',
        ['getServiceInfo']
      );
    }

    let replyText = `📍 จุดรับอาหารของร้าน "${info.storeName}": ${info.pickupLocation}`;
    if (info.pickupPolicy) replyText += `\n🔑 วิธีรับ: ${info.pickupPolicy}`;
    if (info.pickupWindowMinutes) {
      replyText += `\n⏱️ กรุณามารับภายใน ${info.pickupWindowMinutes} นาที หลังได้รับแจ้งว่าอาหารพร้อมค่ะ`;
    }

    return answered(replyText, ['getServiceInfo']);
  }

  // B3. Payment Method Queries
  if (/(เงินสด|พร้อมเพย์|promptpay|โอน|จ่ายยังไง|จ่ายเงิน|ชำระเงิน|ชำระยังไง|บัตรเครดิต|สแกนจ่าย|qr|วอลเล็ท|wallet)/i.test(lower)) {
    const info = await tools.getServiceInfo();

    if (!info.paymentTerms) {
      return escalate(
        `ขออภัยค่ะ ระบบยังไม่มีข้อมูลช่องทางชำระเงินของร้าน "${info.storeName}" บันทึกไว้ ` +
        'ได้แจ้งให้ทางร้านมาตอบให้แล้วนะคะ 🙏',
        ['getServiceInfo']
      );
    }

    return answered(
      `💳 ช่องทางชำระเงินของร้าน "${info.storeName}":\n${info.paymentTerms}`,
      ['getServiceInfo']
    );
  }

  // B4. Dietary Queries (เจ / มังสวิรัติ / ฮาลาล)
  //
  // Answered strictly from tags the store set, and only from the tags of the
  // category actually asked about. Matching every dietary pattern at once would
  // answer "is there halal food?" with a vegetarian dish — a wrong answer about
  // what someone may eat, which is the failure mode the allergen guard exists
  // to prevent. No tag means "we do not know", never "yes, it is fine".
  const DIETARY_CATEGORIES = [
    {
      name: 'อาหารเจ / มังสวิรัติ',
      asks: /(อาหารเจ|เมนูเจ|กินเจ|ทานเจ|มังสวิรัติ|วีแกน|vegan|vegetarian|ไม่กินเนื้อ|ไม่ทานเนื้อ)/i,
      tags: [/เจ/i, /มังสวิรัติ/i, /vegan/i, /vegetarian/i]
    },
    {
      name: 'อาหารฮาลาล',
      asks: /(ฮาลาล|halal|มุสลิม|ไม่มีหมู)/i,
      tags: [/ฮาลาล/i, /halal/i]
    }
  ];

  const dietaryCategory = DIETARY_CATEGORIES.find((c) => c.asks.test(lower));
  if (dietaryCategory) {
    const result = await tools.findByDietaryTag(dietaryCategory.tags);

    if (result.items.length > 0) {
      const list = result.items.map((i) => `• ${i.name} (฿${i.price})`).join('\n');
      return answered(
        `🥗 เมนูที่ร้าน "${result.storeName}" ระบุไว้ว่าเป็น${dietaryCategory.name}:\n${list}\n\n` +
        'หากต้องการความมั่นใจเรื่องวัตถุดิบและการแยกภาชนะ รบกวนยืนยันกับทางร้านอีกครั้งนะคะ 🙏',
        ['findByDietaryTag']
      );
    }

    return escalate(
      `ทางร้าน "${result.storeName}" ยังไม่ได้ระบุว่ามีเมนู${dietaryCategory.name}ไว้ในระบบค่ะ ` +
      'ผู้ช่วยอัตโนมัติจึงไม่สามารถยืนยันแทนร้านได้ ได้ส่งคำถามให้ทางร้านมาตอบโดยตรงแล้วนะคะ 🙏',
      ['findByDietaryTag']
    );
  }

  // B5. Recommendation / Best Seller Queries
  // Kept ahead of the generic catalogue so "อะไรขายดี" gets an actual answer
  // instead of the full menu printed back.
  if (/(แนะนำ|ขายดี|เด็ด|อร่อย|ยอดนิยม|ฮิต|signature|best seller|ที่เด็ด)/i.test(lower)) {
    const rec = await tools.getRecommendations(3);

    if (rec.items.length === 0) {
      return escalate(
        `ขณะนี้ร้าน "${rec.storeName}" ยังไม่มีเมนูที่พร้อมจำหน่ายค่ะ`,
        ['getRecommendations']
      );
    }

    const heading = rec.hasOrderHistory
      ? `⭐ เมนูที่ลูกค้าสั่งเยอะที่สุดของร้าน "${rec.storeName}":`
      : `🍽️ เมนูแนะนำของร้าน "${rec.storeName}":`;
    const list = rec.items
      .map((i) => `• ${i.name} (฿${i.price})${i.orderCount > 0 ? ` — สั่งไปแล้ว ${i.orderCount} ครั้ง` : ''}`)
      .join('\n');

    return answered(`${heading}\n${list}`, ['getRecommendations']);
  }

  // C. Menu & Pricing Queries
  if (/(ราคา|เมนู|มีอะไรบ้าง|ขายอะไร|กี่บาท|จานละ|แก้วละ|กล่องละ|มีไหม|มีมั้ย|หมดยัง|ยังมี|ขายไหม)/i.test(lower)) {
    // Match against the whole sentence: Thai has no word boundaries to split on.
    const matchedItem = await tools.findMenuItem(trimmed);

    if (matchedItem) {
      const lines = [`🍽️ ข้อมูลเมนู "${matchedItem.name}":`, `💵 ราคา: ฿${matchedItem.price}`];
      lines.push(matchedItem.isAvailable
        ? '📌 สถานะ: พร้อมจำหน่าย ✅'
        : '📌 สถานะ: หมดชั่วคราว ❌ (ยังสั่งไม่ได้ในตอนนี้ค่ะ)');
      if (matchedItem.description) lines.push(`📝 รายละเอียด: ${matchedItem.description}`);
      if (matchedItem.preparationMinutes) {
        lines.push(`⏱️ เวลาปรุงโดยประมาณ: ${matchedItem.preparationMinutes} นาที`);
      }
      if (matchedItem.allergens && matchedItem.allergens.length > 0) {
        lines.push(`⚠️ มีสารก่อภูมิแพ้: ${matchedItem.allergens.join(', ')}`);
      }

      return answered(lines.join('\n'), ['findMenuItem']);
    }

    // General menu catalog
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


  // Z. Greetings and thanks.
  // Placed last so a greeting attached to a real question does not swallow it.
  // Escalating a plain "สวัสดีครับ" used to notify the merchant of a message
  // that needed no reply, which trains them to ignore the inbox.
  if (/^(สวัสดี|หวัดดี|ดีครับ|ดีค่ะ|hello|hi|hey|ขอบคุณ|ขอบใจ|thank|thx|โอเค|ok|ครับ|ค่ะ|จ้า)\b/i.test(lower)
      || /^(สวัสดี|หวัดดี|ขอบคุณ|ขอบใจ)/.test(trimmed)) {
    const isThanks = /(ขอบคุณ|ขอบใจ|thank|thx)/i.test(lower);
    const storeName = tools.getStoreName();

    return answered(
      isThanks
        ? `ยินดีค่ะ 🙏 หากมีอะไรให้ช่วยเพิ่มเติมเกี่ยวกับร้าน "${storeName}" ทักมาได้เลยนะคะ`
        : `สวัสดีค่ะ 👋 ผู้ช่วยอัตโนมัติของร้าน "${storeName}" ยินดีให้บริการค่ะ\n` +
          'สอบถามได้เลยนะคะ เช่น เมนูและราคา · ร้านเปิดกี่โมง · คิวตอนนี้นานไหม · รับอาหารตรงไหน',
      []
    );
  }

  return null;
}

/**
 * 5. Master Assistant Dispatcher
 * Coordinates Layer 1, Safety Hard-Blocks, and fallback to Escalation
 */
export async function processAssistantReply({
  message,
  chatThread,
  store,
  activeOrder,
  menuItems = []
}) {
  const startTime = Date.now();

  // Guard 0: Check if AI auto-reply is disabled by store or silenced
  if (chatThread?.aiAutoReply === false) {
    return { handled: false, reason: 'AI_DISABLED_BY_STORE' };
  }

  if (chatThread?.aiSilencedUntil && new Date(chatThread.aiSilencedUntil) > new Date()) {
    return { handled: false, reason: 'AI_SILENCED_DUE_TO_RECENT_MERCHANT_REPLY' };
  }

  // Create scope-bound tools with storeId locked in closure
  const tools = makeStoreTools({
    store,
    activeOrder,
    menuItems,
    schoolId: chatThread?.schoolId || store?.schoolId,
    customerId: chatThread?.customerId
  });

  // Guard 1: Allergen Safety Hard-Block (Rule 2)
  const allergenResult = await checkAllergenGuard(message, tools);
  if (allergenResult) {
    allergenResult.aiMeta.latencyMs = Date.now() - startTime;
    return allergenResult;
  }

  // Guard 2: Escalation / Store Commitment Hard-Block (Rule 3)
  const escalationResult = checkEscalationGuard(message, tools);
  if (escalationResult) {
    escalationResult.aiMeta.latencyMs = Date.now() - startTime;
    return escalationResult;
  }

  // Layer 1: Deterministic Router
  const layer1Result = await routeIntentLayer1(message, tools);
  if (layer1Result) {
    layer1Result.aiMeta.latencyMs = Date.now() - startTime;
    return layer1Result;
  }

  // Layer 2: Scope-bound tool calling. Only reached when Layer 1 did not
  // recognise the question, and only after both safety hard-blocks have run,
  // so the model is never the thing clearing an allergen or promising on the
  // store's behalf. Disabled unless GEMINI_API_KEY is configured.
  if (isLayer2Enabled()) {
    const layer2Result = await runLayer2({ message, tools });
    if (layer2Result) {
      return {
        handled: true,
        replyText: layer2Result.replyText,
        senderRole: 'ai_assistant',
        aiMeta: {
          layer: 2,
          toolsUsed: layer2Result.toolsUsed,
          escalated: false,
          latencyMs: Date.now() - startTime
        }
      };
    }
  }

  // Layer 3 Fallback: Unrecognized question -> escalate politely
  const storeName = tools.getStoreName();
  return {
    handled: true,
    replyText: `🤖 สวัสดีค่ะผู้ช่วยอัตโนมัติประจำร้าน "${storeName}" ยินดีให้บริการค่ะ สำหรับคำถามเพิ่มเติมเกี่ยวกับ "${message.slice(0, 40)}" ระบบได้แจ้งเตือนร้านค้าให้แล้ว เจ้าของร้านจะเข้ามาตอบกลับคุณในไม่ช้านะคะ 🙏`,
    senderRole: 'ai_assistant',
    aiMeta: {
      layer: 1,
      toolsUsed: [],
      escalated: true,
      latencyMs: Date.now() - startTime
    }
  };
}
