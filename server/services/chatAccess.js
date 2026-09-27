/**
 * Who may act in which chat thread.
 *
 * The sender's role was already derived from the verified identity rather than
 * the request body — a customer could not post as the shop. The *room* was not:
 * both the message endpoint and the assistant endpoint took chatId from the
 * body and wrote wherever it pointed. So any signed-in account could drop a
 * message into a stranger's conversation with a shop, and a shop could write
 * into a competitor's threads.
 *
 * It compounded: the thread document lists everyone who has posted in
 * participantIds, and read access trusted that list — so writing into someone
 * else's thread earned read access to the rest of it.
 *
 * One resolver now decides the room, for every route that touches one.
 */

import { adminDb } from '../firebaseAdmin.js';
import { isStoreOperator } from '../middleware/authenticate.js';

/** The thread id a store and customer share. */
export function canonicalChatId(storeId, customerId) {
  return `chat_${storeId}_${customerId}`;
}

/**
 * Resolves the thread a caller is allowed to write in.
 *
 * A caller may write in the thread they share with the shop, and a shop
 * operator may write in a thread belonging to their own shop. Anything else is
 * refused rather than created: an unknown id is a mistake or a probe, never a
 * room to open.
 *
 * @param {object} user req.user, already verified
 * @param {object} params
 * @param {string} params.storeId Store the message is about
 * @param {string} [params.chatId] Thread the caller asked for
 * @param {string} [params.customerId] Only honoured for a shop operator
 * @returns {Promise<{
 *   allowed: boolean, chatId: string, thread: object|null, customerId: string,
 *   isMerchant: boolean, status?: number, error?: string, message?: string
 * }>}
 */
export async function resolveThreadAccess(user, { storeId, chatId, customerId: rawCustomerId }) {
  const isMerchant = await isStoreOperator(user, storeId);

  // A shop may open a thread on a customer's behalf; a customer is always
  // themselves, whatever the body says.
  const customerId = isMerchant ? (rawCustomerId || 'guest-customer') : user.uid;
  const canonical = canonicalChatId(storeId, customerId);

  if (!chatId || chatId === canonical) {
    return { allowed: true, chatId: canonical, thread: null, customerId, isMerchant };
  }

  const snap = await adminDb.collection('chats').doc(chatId).get();
  if (!snap.exists) {
    return {
      allowed: false,
      status: 404,
      error: 'CHAT_NOT_FOUND',
      message: 'ไม่พบห้องแชทนี้',
      chatId,
      thread: null,
      customerId,
      isMerchant
    };
  }

  const thread = snap.data() || {};

  // Judged against the thread's own store, never the storeId in the body:
  // operating one shop must not grant another shop's conversations.
  const isThreadCustomer = thread.customerId === user.uid;
  const operatesThreadStore = await isStoreOperator(user, thread.storeId);

  if (!isThreadCustomer && !operatesThreadStore) {
    return {
      allowed: false,
      status: 403,
      error: 'FORBIDDEN',
      message: 'คุณไม่มีสิทธิ์เข้าถึงห้องแชทนี้',
      chatId,
      thread,
      customerId,
      isMerchant
    };
  }

  return {
    allowed: true,
    chatId,
    thread,
    // The thread decides whose conversation it is, so a merchant writing into an
    // existing thread cannot relabel it as another customer's.
    customerId: thread.customerId || customerId,
    isMerchant: operatesThreadStore
  };
}

/**
 * Whether a caller may read a thread.
 *
 * participantIds is deliberately not consulted. It lists everyone who has ever
 * posted, so while the write path was open it could name people who had no
 * business there — and any thread poisoned that way would still grant them
 * access. The thread's customer and its shop's operators are the whole set;
 * staff and platform admins are already covered by isStoreOperator.
 *
 * @returns {Promise<{ allowed: boolean, notFound?: boolean, thread?: object }>}
 */
export async function canReadThread(user, chatId) {
  const snap = await adminDb.collection('chats').doc(chatId).get();
  if (!snap.exists) return { allowed: false, notFound: true };

  const thread = snap.data() || {};
  if (thread.customerId === user.uid) return { allowed: true, thread };

  return { allowed: await isStoreOperator(user, thread.storeId), thread };
}
