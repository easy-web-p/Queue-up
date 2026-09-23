/**
 * ============================================================================
 * 🗑️ ACCOUNT DELETION RULES
 * ============================================================================
 *
 * What may be deleted, what must be kept, and when deletion has to be refused.
 * No Firestore and no Auth here — index.js does the awaiting; this is the part
 * that can be wrong, so this is the part that is tested.
 *
 * The screen this replaces deleted `users/{uid}` and nothing else. It left the
 * Firebase Auth account intact — so signing in again recreated the profile —
 * left the wallet, the orders, the guardian links and the child's allergy
 * record in place, swallowed a failed delete with `console.warn`, and showed
 * "ลบข้อมูลและประวัติต่างๆ ของคุณทั้งหมดออกจากระบบเรียบร้อยแล้ว" either way.
 * The PDPA page promises erasure. That was a sign-out with a paragraph attached.
 *
 * Three things deletion is not allowed to destroy:
 *
 *  1. **Money the school is holding.** A wallet with ฿200 in it is ฿200 a
 *     parent paid. Deleting the account deletes the claim on it, so deletion is
 *     refused until the balance is zero — spent, or refunded at the office.
 *
 *  2. **An order a stall is already cooking.** The kitchen has the ticket. It
 *     is finished or cancelled first, not orphaned.
 *
 *  3. **The audit trail.** `audit_logs` and `emergency_audit_logs` are
 *     `allow write: if false;` and record who looked up a child's medical data.
 *     Erasure does not reach a record kept to prove a legal obligation, and the
 *     policy page says so rather than this code quietly making an exception.
 *
 * Everything else about the person goes: the profile, the student record with
 * its allergies, guardian links, chats, reviews, favourites, redemptions. The
 * financial ledger stays, keyed by a uid that no longer belongs to anyone.
 */

/** Order states where food is still owed in one direction or the other. */
export const OPEN_ORDER_STATUSES = Object.freeze([
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
]);

export const DELETION_REFUSAL = Object.freeze({
  WALLET_NOT_EMPTY: "WALLET_NOT_EMPTY",
  OPEN_ORDERS: "OPEN_ORDERS",
  PENDING_TOPUP: "PENDING_TOPUP",
  OWNS_ACTIVE_SHOP: "OWNS_ACTIVE_SHOP",
  IS_LAST_ADMIN: "IS_LAST_ADMIN",
});

/**
 * Is this account in a state where deleting it would destroy something?
 *
 * Returns a refusal rather than throwing so the caller can turn it into an
 * HttpsError and the tests can call it directly.
 *
 * @param {object} state
 *   @param {number} state.walletBalanceSatang  0 when there is no wallet
 *   @param {number} state.openOrderCount       orders in OPEN_ORDER_STATUSES
 *   @param {number} state.pendingTopupCount    top-up requests still PENDING
 *   @param {number} state.activeShopCount      shops this account owns that are open
 *   @param {boolean} state.isLastAdmin         the only admin left
 * @returns {{ok: true} | {ok: false, status: string, code: string, message: string}}
 */
export function checkDeletable(state) {
  const {
    walletBalanceSatang = 0,
    openOrderCount = 0,
    pendingTopupCount = 0,
    activeShopCount = 0,
    isLastAdmin = false,
  } = state || {};

  if (Number(walletBalanceSatang) > 0) {
    return {
      ok: false,
      status: "failed-precondition",
      code: DELETION_REFUSAL.WALLET_NOT_EMPTY,
      message:
        `กระเป๋าเงินยังมียอดคงเหลือ ฿${Number(walletBalanceSatang) / 100} ` +
        "กรุณาใช้จ่ายให้หมดหรือติดต่อขอคืนเงินที่ห้องธุรการก่อนลบบัญชี",
    };
  }

  if (Number(openOrderCount) > 0) {
    return {
      ok: false,
      status: "failed-precondition",
      code: DELETION_REFUSAL.OPEN_ORDERS,
      message:
        `ยังมีคำสั่งซื้อที่ยังไม่เสร็จสิ้น ${openOrderCount} รายการ ` +
        "กรุณารับอาหารหรือยกเลิกคำสั่งซื้อให้เรียบร้อยก่อนลบบัญชี",
    };
  }

  if (Number(pendingTopupCount) > 0) {
    return {
      ok: false,
      status: "failed-precondition",
      code: DELETION_REFUSAL.PENDING_TOPUP,
      message:
        "ยังมีคำขอเติมเงินที่รอดำเนินการอยู่ กรุณารอให้เสร็จสิ้นหรือติดต่อห้องธุรการก่อนลบบัญชี",
    };
  }

  if (Number(activeShopCount) > 0) {
    return {
      ok: false,
      status: "failed-precondition",
      code: DELETION_REFUSAL.OWNS_ACTIVE_SHOP,
      message:
        "บัญชีนี้ยังเป็นเจ้าของร้านค้าที่เปิดขายอยู่ กรุณาปิดร้านหรือโอนสิทธิ์ให้ผู้อื่นก่อนลบบัญชี",
    };
  }

  if (isLastAdmin) {
    // Nobody left who can appoint another admin, grant staff roles, or review a
    // vendor application. The system would need a redeploy to recover.
    return {
      ok: false,
      status: "failed-precondition",
      code: DELETION_REFUSAL.IS_LAST_ADMIN,
      message:
        "บัญชีนี้เป็นผู้ดูแลระบบคนสุดท้าย กรุณาแต่งตั้งผู้ดูแลระบบคนอื่นก่อนลบบัญชี",
    };
  }

  return { ok: true };
}

/**
 * The fields stripped from an order when its customer is deleted.
 *
 * Orders are not deleted: the stall's sales history and the school's settlement
 * with it both rest on them, and a vendor losing a day's takings because a
 * customer closed their account is not erasure, it is data loss for someone
 * else. What goes is everything that names a person.
 *
 * `studentId` goes too — it is the uid, and paired with wallet_transactions it
 * would re-link the ledger to a named order.
 */
export const ANONYMISED_ORDER_FIELDS = Object.freeze([
  "customerName",
  "customerPhone",
  "customerEmail",
  "userId",
  "studentId",
  "guardianNote",
  "allergyNotes",
  "specialRequest",
]);

/**
 * The patch that anonymises one order.
 *
 * `deletedCustomer: true` is what tells a merchant screen to show "ลูกค้าที่ลบบัญชีแล้ว"
 * rather than an empty name that reads as a bug.
 */
export function buildOrderAnonymisationPatch(deleteSentinel) {
  const patch = { customerName: "ผู้ใช้ที่ลบบัญชีแล้ว", deletedCustomer: true };
  for (const field of ANONYMISED_ORDER_FIELDS) {
    if (field === "customerName") continue;
    patch[field] = deleteSentinel;
  }
  return patch;
}

/**
 * Everything deletion touches, as data rather than as a sequence of awaits.
 *
 * Written out so the test can assert the list — the failure mode here is
 * silent and invisible: a collection nobody remembered keeps the person's data
 * forever, and no error is ever raised. `where` is the field that holds the
 * uid.
 */
export const DELETION_PLAN = Object.freeze({
  /**
   * Deleted outright. Personal data with no business reason to survive.
   *
   * `byId` means the document id IS the uid; `where` is a field holding it;
   * `byIdPrefix` means the id starts `<uid>_` — `coupon_redemptions` is
   * `<uid>_<code>` and a chat is `<uid>_<storeId>`, neither of which carries
   * the uid as a field to query on.
   *
   * `wallets` is keyed by the student, so it goes when a student deletes their
   * own account and stays when a guardian deletes theirs — the balance belongs
   * to the child either way.
   */
  purge: Object.freeze([
    { collection: "users", byId: true },
    { collection: "students", byId: true },
    { collection: "wallets", byId: true },
    { collection: "parent_child_links", where: "guardianId" },
    { collection: "parent_child_links", where: "studentId" },
    { collection: "reviews", where: "userId" },
    { collection: "vendor_approvals", where: "studentVendorId" },
    { collection: "coupon_redemptions", byIdPrefix: true },
    { collection: "chats", byIdPrefix: true, subcollection: "messages" },
  ]),
  /** Kept, with every naming field removed. */
  anonymise: Object.freeze([{ collection: "orders", where: "userId" }]),
  /**
   * Untouched, and why.
   *
   * Naming them here is the point: an empty list would read as "nothing else
   * exists", and the next person to add a collection needs to see that this
   * decision was made rather than overlooked.
   */
  retain: Object.freeze([
    { collection: "audit_logs", reason: "LEGAL_OBLIGATION" },
    { collection: "emergency_audit_logs", reason: "LEGAL_OBLIGATION" },
    { collection: "wallet_transactions", reason: "FINANCIAL_LEDGER" },
    { collection: "wallet_topup_requests", reason: "FINANCIAL_LEDGER" },
  ]),
});

/** Chat ids are `<customerUid>_<storeId>`, so a prefix scan finds the person's. */
export function isOwnChatId(chatId, uid) {
  return typeof chatId === "string" && typeof uid === "string" && uid.length > 0
    ? chatId === uid || chatId.startsWith(`${uid}_`)
    : false;
}
