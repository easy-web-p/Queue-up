/**
 * ============================================================================
 * 💬 CUSTOMER ↔ SHOP CHAT
 * ============================================================================
 *
 * Conversations live in Firestore, where both parties can see them.
 *
 * ChatModal — the chat every page actually opens — kept its conversations in
 * localStorage and opened with three invented shops whose messages announced
 * real-sounding order status ("คิวของคุณพร้อมรับแล้วที่เคาน์เตอร์ 1"), complete
 * with order ids, queue numbers and prices. Nothing a customer typed ever left
 * their browser, and the "merchant" who replied a second later was a canned
 * string. Chat.tsx, meanwhile, did use Firestore but was not routed anywhere.
 *
 * A chat id is `<customerUid>_<storeId>`, matching Chat.tsx and the security
 * rules. The chat document carries storeId so the rules can authorize the shop
 * as the second participant — without it, the shop could not read its own
 * customers' messages.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  documentId,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

/** Who a message is from. `assistant` is deliberately not `merchant`. */
export const SENDER = Object.freeze({
  USER: 'user',
  MERCHANT: 'merchant',
  ASSISTANT: 'assistant',
});

export function buildChatId(customerUid, storeId) {
  if (!customerUid || !storeId) return null;
  return `${customerUid}_${storeId}`;
}

/**
 * Opens (or creates) the conversation between this customer and this shop.
 *
 * `storeId` is written onto the document because the security rules read it to
 * decide whether the shop may participate. A chat created without it is one the
 * shop cannot see.
 */
export async function ensureChat({ customerUid, storeId, storeName, orderContext = null }) {
  const chatId = buildChatId(customerUid, storeId);
  if (!chatId) throw new Error('ensureChat: customerUid and storeId are both required');

  await setDoc(
    doc(db, 'chats', chatId),
    {
      chatId,
      customerUid,
      storeId,
      storeName: storeName || storeId,
      ...(orderContext ? { orderContext } : {}),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return chatId;
}

/**
 * This customer's conversations.
 *
 * Document ids are `<uid>_<storeId>`, so a range query over the id finds them
 * without a separate index.  is the highest code point Firestore will
 * order, which makes the range everything starting with `uid_`.
 */
export async function fetchChatsForCustomer(customerUid) {
  if (!customerUid) return [];
  const snap = await getDocs(
    query(
      collection(db, 'chats'),
      where(documentId(), '>=', `${customerUid}_`),
      where(documentId(), '<=', `${customerUid}_`),
      limit(50)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** The shop's side of the inbox. */
export async function fetchChatsForStore(storeId) {
  if (!storeId) return [];
  const snap = await getDocs(
    query(collection(db, 'chats'), where('storeId', '==', storeId), limit(50))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchChat(chatId) {
  if (!chatId) return null;
  const snap = await getDoc(doc(db, 'chats', chatId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Live messages for one conversation.
 *
 * @returns {() => void} unsubscribe
 */
export function subscribeToMessages(chatId, onMessages, onError) {
  if (!chatId) return () => {};
  return onSnapshot(
    query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'), limit(200)),
    (snapshot) => {
      onMessages(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            sender: data.sender || SENDER.MERCHANT,
            text: data.text || '',
            time: data.time || '',
            senderUid: data.senderUid || null,
          };
        })
      );
    },
    (err) => {
      // Surfaced, not swallowed. A chat that silently shows nothing after a
      // permission error reads as "no messages", which is the wrong conclusion.
      if (onError) onError(err);
    }
  );
}

function bangkokClock() {
  return (
    new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date()) + ' น.'
  );
}

/**
 * Sends a message.
 *
 * `senderUid` is always the caller's own uid; the rules refuse anything else, so
 * nobody can post as another person even inside a conversation they own.
 */
export async function sendMessage({ chatId, sender, text, senderUid }) {
  if (!chatId) throw new Error('sendMessage: chatId is required');
  const time = bangkokClock();

  await addDoc(collection(db, 'chats', chatId, 'messages'), {
    sender,
    text,
    time,
    ...(senderUid ? { senderUid } : {}),
    createdAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, 'chats', chatId),
    { updatedAt: serverTimestamp(), lastMessage: text.slice(0, 200), lastTime: time },
    { merge: true }
  );

  return time;
}
