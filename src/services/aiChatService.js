import { analyzeAndShieldInput } from "./aiSecurityShield.js";

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-3.5-turbo"; // ChatGPT Classic Model

/**
 * Generate smart merchant response via ChatGPT Classic API or smart local fallback
 * @param {string} userMessage - Message sent by customer
 * @param {string} storeName - Target Canteen Merchant Name
 * @param {object} orderContext - Attached order information (itemTitle, queueNo, price)
 * @returns {Promise<string>} - Generated AI response string
 */
export async function getChatGPTResponse(userMessage, storeName = "ร้านค้า QueueUp", orderContext = null) {
  // Pass message through AI Threat Engine
  const shield = analyzeAndShieldInput(userMessage);
  if (!shield.safe) {
    return `🛡️ [AI Security Sentinel] ตรวจพบข้อความสุ่มเสี่ยงความปลอดภัย (${shield.threats[0]}) ระบบได้ทำการบล็อกและรีเซ็ตการสนทนาเพื่อความปลอดภัยครับ`;
  }
  const cleanMessage = shield.sanitized;
  // If OpenAI API key is configured, call ChatGPT Classic API
  if (OPENAI_API_KEY) {
    try {
      const systemPrompt = `คุณคือผู้ช่วย AI ร้านค้าโรงเรียนชื่อ "${storeName}" ในระบบ QueueUp CRM 
หน้าที่ของคุณคือตอบกลับลูกค้าที่สั่งอาหารด้วยความสุภาพ เป็นกันเอง ภาษาไทย รวดเร็ว และกระชับ (ไม่เกิน 2-3 ประโยค)
${orderContext ? `บริบทออเดอร์ปัจจุบัน: ${orderContext.itemTitle} | ${orderContext.queueNo} | ฿${orderContext.price}` : ""}`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiText = data.choices[0]?.message?.content?.trim();
        if (aiText) return aiText;
      }
    } catch (err) {
      console.warn("ChatGPT Classic API connection notice:", err);
    }
  }

  // Smart Context-Aware Local Fallback Response Engine
  const msg = userMessage.toLowerCase();
  
  if (msg.includes("เสร็จหรือยัง") || msg.includes("กี่นาที") || msg.includes("นานไหม")) {
    return `สวัสดีครับ! ทางร้าน ${storeName} กำลังปรุงอาหารสดใหม่ตามคิว ${orderContext?.queueNo || ""} คาดว่าจะเสร็จพร้อมเสิร์ฟใน 2-4 นาทีครับ 🍳⏱️`;
  }
  
  if (msg.includes("ผัก") || msg.includes("เผ็ด") || msg.includes("พิเศษ") || msg.includes("ไข่")) {
    return `รับทราบเงื่อนไขพิเศษแล้วครับ ทางพ่อครัวจัดเตรียมเมนู ${orderContext?.itemTitle || "อาหาร"} ตามรายละเอียดที่แจ้งเรียบร้อยครับ! 👍✨`;
  }

  if (msg.includes("เดินทาง") || msg.includes("ถึงโรงอาหาร") || msg.includes("ไปรับ")) {
    return `ยินดีครับ! อาหารใส่กล่องร้อนๆ รอพร้อมส่งมอบให้คุณที่เคาน์เตอร์แล้วครับ มารับได้เลยครับ 🛍️💨`;
  }

  if (msg.includes("ขอบคุณ") || msg.includes("อร่อย")) {
    return `ขอบคุณที่อุดหนุนร้าน ${storeName} นะครับ! ทานให้อร่อยและฝากให้คะแนนรีวิวสะสมแต้ม CRM ด้วยนะครับ 🌟😊`;
  }

  return `สวัสดีครับร้าน ${storeName} ยินดีให้บริการครับ! ได้รับข้อความ "${userMessage}" เรียบร้อยแล้ว กำลังดำเนินการให้ทันทีครับ 🍳✨`;
}
