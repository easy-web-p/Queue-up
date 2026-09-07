import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config.js";
import { analyzeAndShieldInput } from "./aiSecurityShield.js";

/**
 * Generate smart merchant response via the server-side assistant or a local fallback.
 *
 * 🔒 The OpenAI API key is NOT read here. Vite inlines every VITE_* variable into the
 * client bundle, so a key referenced from this file would ship to every visitor's
 * browser. The key lives in Cloud Functions secrets and the call is proxied by the
 * `generateAssistantReply` function instead.
 *
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

  try {
    const callable = httpsCallable(functions, "generateAssistantReply");
    const res = await callable({ userMessage: cleanMessage, storeName, orderContext });
    const aiText = res?.data?.text;
    if (typeof aiText === "string" && aiText.trim()) {
      return aiText.trim();
    }
  } catch (err) {
    console.warn("Assistant reply service notice:", err);
  }

  // Smart Context-Aware Local Fallback Response Engine
  const msg = cleanMessage.toLowerCase();
  
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
