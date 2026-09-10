import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * 💬 Send Chat Message Authoritative
 *
 * Verifies that the caller is a true participant of the chat conversation
 * (either the customer or the verified store owner).
 * If the customer sends a message and the store has an auto-acknowledgement,
 * the backend creates the merchant response securely without browser impersonation.
 */
export async function handleSendChatMessageAuthoritative(db, request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "AUTHENTICATION_REQUIRED");
  }

  const callerUid = request.auth.uid;
  const { chatId, text } = request.data || {};

  if (!chatId || typeof chatId !== "string" || !chatId.trim()) {
    throw new HttpsError("invalid-argument", "CHAT_ID_REQUIRED");
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    throw new HttpsError("invalid-argument", "MESSAGE_TEXT_REQUIRED");
  }

  const cleanChatId = chatId.trim();
  const cleanText = text.trim().slice(0, 1000);

  const chatRef = db.collection("chats").doc(cleanChatId);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists) {
    throw new HttpsError("not-found", "CHAT_NOT_FOUND");
  }

  const chatData = chatSnap.data();
  const isCustomer = chatData.customerUid === callerUid;

  let isStoreOwner = false;
  if (chatData.storeId) {
    const shopSnap = await db.collection("shops").doc(chatData.storeId).get();
    if (shopSnap.exists && shopSnap.data().ownerUid === callerUid) {
      isStoreOwner = true;
    }
  }

  const isAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";

  if (!isCustomer && !isStoreOwner && !isAdmin) {
    throw new HttpsError("permission-denied", "PERMISSION_DENIED: Caller is not a participant of this chat");
  }

  const senderRole = isCustomer ? "client" : "merchant";
  const messagesCol = chatRef.collection("messages");

  // 1. Write user's message
  const userMsgRef = messagesCol.doc();
  const now = new Date();
  const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) + " น.";

  await userMsgRef.set({
    id: userMsgRef.id,
    sender: senderRole,
    senderUid: callerUid,
    text: cleanText,
    timestamp: timeStr,
    createdAt: FieldValue.serverTimestamp(),
  });

  await chatRef.update({
    lastMessage: cleanText,
    lastMessageAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    messageId: userMsgRef.id,
    chatId: cleanChatId,
  };
}
