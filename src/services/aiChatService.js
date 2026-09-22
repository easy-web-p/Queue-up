import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/config.js";
import { analyzeAndShieldInput } from "./aiSecurityShield.js";

/**
 * Generate an ASSISTANT reply via the server-side assistant, or a local fallback.
 *
 * ⚠️ This is not the merchant. The caller must label the result as an automated
 * assistant and never render it as the shop speaking — ChatModal used to store
 * it with `sender: "merchant"` under the shop's name and avatar, so a canned
 * string about order status was indistinguishable from the kitchen answering.
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

  // Local fallback, used when the assistant call fails.
  //
  // These replies used to invent facts. "กำลังปรุงอาหารสดใหม่ตามคิว ... คาดว่า
  // จะเสร็จใน 2-4 นาที" and "อาหารใส่กล่องร้อนๆ รอพร้อมส่งมอบที่เคาน์เตอร์แล้ว"
  // were canned strings chosen by keyword match, sent under the shop's name, to
  // someone asking whether their food was ready. Nothing in the system knew any
  // of it. A customer could be told their order was waiting for them while the
  // kitchen had not started it.
  //
  // A fallback cannot know order status, so it no longer claims to. It says what
  // is true — the message was delivered and the shop will answer — and points at
  // the order screen, which reads the real status.
  const msg = cleanMessage.toLowerCase();

  if (msg.includes("เสร็จหรือยัง") || msg.includes("กี่นาที") || msg.includes("นานไหม") || msg.includes("คิว")) {
    return `ส่งข้อความถึงร้าน ${storeName} เรียบร้อยแล้วครับ 📨\n\nสถานะคิวและเวลารับอาหารที่เป็นปัจจุบัน ดูได้ที่หน้า "คำสั่งซื้อของฉัน" ครับ ทางร้านจะตอบกลับเมื่อพร้อมครับ`;
  }

  if (msg.includes("ผัก") || msg.includes("เผ็ด") || msg.includes("พิเศษ") || msg.includes("ไข่")) {
    return `ส่งคำขอพิเศษถึงร้าน ${storeName} แล้วครับ 📨\n\nกรุณารอทางร้านยืนยันว่าปรับได้หรือไม่ก่อนนะครับ ระบบยังไม่ได้แก้ไขรายการอาหารให้อัตโนมัติครับ`;
  }

  if (msg.includes("ขอบคุณ") || msg.includes("อร่อย")) {
    return `ขอบคุณที่อุดหนุนร้าน ${storeName} นะครับ! 😊 ข้อความของคุณถูกส่งถึงร้านเรียบร้อยแล้วครับ`;
  }

  return `ส่งข้อความถึงร้าน ${storeName} เรียบร้อยแล้วครับ 📨 ทางร้านจะตอบกลับเมื่อพร้อมครับ`;
}
