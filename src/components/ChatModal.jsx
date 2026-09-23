import { useState, useEffect, useRef, useCallback } from "react";
import { pressableProps } from "../utils/pressable.js";
import { getChatGPTResponse } from "../services/aiChatService.js";
import { analyzeAndShieldInput, checkRateLimit } from "../services/aiSecurityShield.js";
import { useToast } from "./ToastProvider.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  SENDER,
  ensureChat,
  fetchChatsForCustomer,
  subscribeToMessages,
  sendMessage,
} from "../services/chatService.js";
import { Skeleton, EmptyState, ErrorState } from "./LoadingStates.jsx";
import "./ChatModal.css";

/*
 * This file used to open with INITIAL_CONVERSATIONS: three invented shops —
 * "ร้านครัวโรงเรียน QueueUp Canteen", "ร้านสเต็กพี่ตั้ม", "ร้านชาไข่มุก
 * บราวน์ชูการ์ Express" — each carrying an order id, a queue number, a price and
 * messages announcing status ("คิวของคุณพร้อมรับแล้วที่เคาน์เตอร์ 1 ครับ").
 * Conversations were kept in localStorage, so nothing a customer typed ever
 * reached a shop, and a reply arrived one second later from a canned string
 * stored as `sender: "merchant"` under the shop's own name and avatar.
 *
 * Conversations are Firestore documents now, readable by both the customer and
 * the shop, and the automated reply is labelled as an assistant.
 */

const QUICK_SUGGESTIONS = [
  "อาหารใกล้เสร็จหรือยังครับ?",
  "ขอเปลี่ยนระดับความเผ็ดได้ไหมครับ?",
  "ไม่ใส่ผักหอมนะครับ",
  "กำลังเดินทางไปรับที่เคาน์เตอร์ครับ",
  "ขอบคุณครับ!",
];

const STORE_AVATAR = "/logo.png";

function ChatModal({ isOpen, onClose, storeId, storeName, initialStoreName, initialOrderContext }) {
  const toast = useToast();
  const { user } = useAuth();
  const customerUid = user?.uid || null;

  const [conversations, setConversations] = useState([]);
  // Messages carry the chat they belong to, and the rendered list is derived
  // from that. Clearing them in an effect when the conversation changed was a
  // synchronous setState inside an effect (a cascading render); deriving also
  // removes the frame where a previous conversation's messages were still on
  // screen under a different shop's name.
  const [messageState, setMessageState] = useState({ chatId: null, rows: [] });
  const [activeChatId, setActiveChatId] = useState(null);
  const [inputText, setInputText] = useState("");
  const [listStatus, setListStatus] = useState("loading");
  const [listError, setListError] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const targetStoreName = storeName || initialStoreName || "";

  // ---- Load this customer's conversations -------------------------------
  const loadConversations = useCallback(async () => {
    if (!customerUid) {
      setConversations([]);
      setListStatus("ready");
      return;
    }
    try {
      const rows = await fetchChatsForCustomer(customerUid);
      rows.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      setConversations(rows);
      setListError("");
      setListStatus("ready");
    } catch (err) {
      // A failed read is not an empty inbox. Rendering one as the other is how
      // a permissions error looks like "you have no conversations".
      setListError(err instanceof Error ? err.message : String(err));
      setListStatus("error");
    }
  }, [customerUid]);

  useEffect(() => {
    if (!isOpen) return;
    async function loadOnOpen() {
      await loadConversations();
    }
    void loadOnOpen();
  }, [isOpen, loadConversations]);

  // ---- Open (or create) the conversation this modal was invoked for ------
  useEffect(() => {
    if (!isOpen || !customerUid || !storeId) return;
    async function openRequestedChat() {
      try {
        const chatId = await ensureChat({
          customerUid,
          storeId,
          storeName: targetStoreName || storeId,
          orderContext: initialOrderContext || null,
        });
        setActiveChatId(chatId);
        await loadConversations();
      } catch (err) {
        toast.error(`เปิดแชทกับร้านไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    void openRequestedChat();
  }, [isOpen, customerUid, storeId, targetStoreName, initialOrderContext, loadConversations, toast]);

  // Fall back to the most recent conversation when none was requested.
  // Deferred rather than set in the effect body: a synchronous setState there
  // cascades an extra render, and this only needs to run after the list lands.
  useEffect(() => {
    if (!isOpen || activeChatId || conversations.length === 0) return undefined;
    const id = setTimeout(() => setActiveChatId(conversations[0].id), 0);
    return () => clearTimeout(id);
  }, [isOpen, activeChatId, conversations]);

  // ---- Live messages for the open conversation --------------------------
  useEffect(() => {
    if (!isOpen || !activeChatId) return undefined;
    const unsubscribe = subscribeToMessages(
      activeChatId,
      (rows) => setMessageState({ chatId: activeChatId, rows }),
      (err) => toast.error(`โหลดข้อความไม่สำเร็จ: ${err.message}`)
    );
    return () => unsubscribe();
  }, [isOpen, activeChatId, toast]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, activeChatId, messageState]);

  if (!isOpen) return null;

  const messages = messageState.chatId === activeChatId ? messageState.rows : [];

  const activeChat = conversations.find((c) => c.id === activeChatId) || null;

  const handleSendMessage = async (textToSend) => {
    const rawText = (textToSend || inputText).trim();
    if (!rawText) return;

    if (!customerUid) {
      toast.warning("กรุณาเข้าสู่ระบบก่อนส่งข้อความถึงร้านค้า");
      return;
    }

    // The conversation has to exist before a message can be written into it —
    // the security rules read storeId off the chat document to decide whether
    // the shop may see it.
    let chatId = activeChatId;
    if (!chatId) {
      if (!storeId) {
        toast.warning('เลือกร้านค้าที่ต้องการติดต่อก่อน โดยกดปุ่ม "แชทเลย" ที่หน้าร้านหรือรายการคำสั่งซื้อ');
        return;
      }
      chatId = await ensureChat({ customerUid, storeId, storeName: targetStoreName || storeId });
      setActiveChatId(chatId);
    }

    const rateCheck = checkRateLimit("CHAT_MESSAGE", 10, 60000);
    if (!rateCheck.allowed) {
      toast.warning(`🛡️ [AI Security Sentinel] ${rateCheck.message}`);
      return;
    }

    const shieldResult = analyzeAndShieldInput(rawText);
    if (!shieldResult.safe) {
      toast.warning(
        `🛡️ [AI Security Sentinel] ตรวจพบแพทเทิร์นสุ่มเสี่ยง: ${shieldResult.threats[0]} ระบบได้บล็อกข้อความนี้เรียบร้อยแล้ว`
      );
      setInputText("");
      return;
    }

    const messageText = shieldResult.sanitized;
    setSending(true);
    if (!textToSend) setInputText("");

    try {
      await sendMessage({
        chatId,
        sender: SENDER.USER,
        text: messageText,
        senderUid: customerUid,
      });
    } catch (err) {
      // The message did not reach the shop. Saying so is the whole point: the
      // previous version could not fail, because it never sent anything.
      toast.error(`ส่งข้อความไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`);
      setSending(false);
      return;
    }

    // The automated assistant answers while the shop is away. It is stored as
    // `assistant`, never as `merchant`: it does not know this order's status and
    // must not be mistaken for the kitchen saying it does.
    try {
      const replyText = await getChatGPTResponse(
        messageText,
        activeChat?.storeName || targetStoreName || "ร้านค้า",
        activeChat?.orderContext || initialOrderContext || null
      );
      await sendMessage({ chatId, sender: SENDER.ASSISTANT, text: replyText });
    } catch {
      // An assistant that cannot answer is not an error worth interrupting for —
      // the customer's own message is already delivered, which is what matters.
    } finally {
      setSending(false);
      await loadConversations();
    }
  };

  const handleSelectChat = (chatId) => setActiveChatId(chatId);

  return (
    <div className="queueup-chat-overlay fixed inset-0 z-[100000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="queueup-chat-card w-full max-w-4xl h-[620px] max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex overflow-hidden font-sans" onClick={(e) => e.stopPropagation()}>
        {/* ---------------- 1. LEFT SIDEBAR (STORE CHAT LIST) ---------------- */}
        <aside className="queueup-chat-sidebar w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/60">
          <div className="queueup-chat-sidebar-header p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="queueup-chat-sidebar-title flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
              <i className="bi bi-chat-dots-fill text-[#FF7A1A]" />
              <span>แชทติดต่อร้านค้า</span>
            </div>
            <span className="badge rounded-pill px-2 py-0.5 text-[11px] font-bold bg-orange-100 text-[#FF7A1A] dark:bg-orange-950/50 dark:text-orange-300">
              {conversations.length} ร้าน
            </span>
          </div>

          {listStatus === "loading" ? (
            <div className="p-3 space-y-2">
              <Skeleton className="h-14 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          ) : listStatus === "error" ? (
            <div className="p-3">
              <ErrorState
                title="โหลดรายการแชทไม่สำเร็จ"
                message={listError}
                onRetry={() => { setListStatus("loading"); void loadConversations(); }}
              />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted small text-slate-400 text-xs my-auto">
              <i className="bi bi-inbox text-slate-300 dark:text-slate-600 text-3xl block mb-2" />
              ยังไม่มีแชทกับร้านค้า
            </div>
          ) : (
            <ul className="queueup-chat-list overflow-y-auto flex-1 p-2 space-y-1 list-none m-0">
              {conversations.map((chat) => (
                <li
                  key={chat.id}
                  className={`queueup-chat-item p-2.5 rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${
                    activeChatId === chat.id
                      ? "active bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                  {...pressableProps(() => handleSelectChat(chat.id), { pressed: activeChatId === chat.id })}
                >
                  <div className="queueup-chat-item-avatar-wrapper relative w-10 h-10 shrink-0">
                    {/* Presence used to be a hardcoded `online: true` with
                        "ตอบกลับใน 2 นาที" beside it. The system has no idea
                        whether a shop is at the counter, so it no longer says. */}
                    <img loading="lazy" decoding="async"
                      src={STORE_AVATAR}
                      alt={chat.storeName || chat.storeId}
                      className="queueup-chat-item-avatar w-full h-full rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                  </div>

                  <div className="queueup-chat-item-info flex-1 min-w-0">
                    <div className="queueup-chat-item-name font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{chat.storeName || chat.storeId}</div>
                    <div className="queueup-chat-item-preview text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {chat.lastMessage || "เริ่มการสนทนา"}
                    </div>
                  </div>

                  <div className="queueup-chat-item-meta text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="queueup-chat-item-time text-[10px] text-slate-400">{chat.lastTime || ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ---------------- 2. RIGHT MAIN CHAT WINDOW ---------------- */}
        <main className="queueup-chat-main flex-1 flex flex-col bg-white dark:bg-slate-900 min-w-0">
          {!activeChat ? (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center bg-white dark:bg-slate-900 flex-1 flex flex-col items-center justify-center relative">
              <i className="bi bi-chat-square-text text-slate-300 dark:text-slate-700 mb-3 text-5xl" />
              <h5 className="fw-bold text-dark mb-2 text-slate-800 dark:text-slate-200 font-bold text-base">ยังไม่มีรายการแชทกับร้านค้า</h5>
              <p className="text-muted small mb-0 px-3 max-w-[340px] leading-relaxed text-xs text-slate-400">
                คุณสามารถเพิ่มแชทและเริ่มการสนทนากับทางร้านได้ โดยกดปุ่ม{" "}
                <span className="text-danger fw-bold text-[#FF7A1A] font-bold"><i className="bi bi-chat-dots-fill me-1" />แชทเลย</span> ที่รายการคำสั่งซื้อของคุณ
              </p>
              <button aria-label="ปิดหน้าต่างแชท" className="queueup-chat-close-btn position-absolute top-0 end-0 m-3 absolute top-3 right-3 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border-0" onClick={onClose}>
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="queueup-chat-main-header p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div className="queueup-chat-header-user flex items-center gap-2.5">
                  <img loading="lazy" decoding="async"
                    src={STORE_AVATAR}
                    alt={activeChat.storeName || activeChat.storeId}
                    className="queueup-chat-item-avatar w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <div className="queueup-chat-header-title font-bold text-xs text-slate-900 dark:text-white">{activeChat.storeName || activeChat.storeId}</div>
                    <div className="queueup-chat-header-status text-[10px] text-slate-500 dark:text-slate-400">
                      ข้อความถึงร้านค้าโดยตรง
                    </div>
                  </div>
                </div>

                <button className="queueup-chat-close-btn p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border-0" onClick={onClose} title="ปิดแชท" aria-label="ปิดแชท">
                  <i className="bi bi-x-lg text-sm" />
                </button>
              </div>

              {/* Attached Order Context Banner */}
              {activeChat.orderContext && (
                <div className="queueup-chat-order-banner px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs">
                  <div className="queueup-chat-order-info flex items-center gap-2 truncate">
                    <span className="queueup-chat-order-tag bg-[#FF7A1A] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {activeChat.orderContext.queueNo || "ออเดอร์จองคิว"}
                    </span>
                    <span className="fw-bold text-dark font-bold text-slate-800 dark:text-slate-200 truncate">
                      {activeChat.orderContext.itemTitle || "รายการอาหาร"}
                    </span>
                    <span className="text-muted text-slate-500 dark:text-slate-400">
                      (฿{activeChat.orderContext.price?.toFixed(2) || "0.00"})
                    </span>
                  </div>
                  <span className="small text-danger fw-bold text-[#FF7A1A] font-mono text-[11px] shrink-0">
                    ID: {activeChat.orderContext.orderId}
                  </span>
                </div>
              )}

              {/* Messages Body */}
              <div className="queueup-chat-messages-body flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
                {messages.length === 0 && (
                  <EmptyState
                    icon={<i className="bi bi-chat-dots text-3xl" aria-hidden="true" />}
                    title="เริ่มการสนทนากับร้านค้า"
                    message="พิมพ์ข้อความด้านล่างเพื่อส่งถึงร้านโดยตรง ทางร้านจะเห็นข้อความของคุณและตอบกลับได้"
                  />
                )}
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`queueup-chat-msg-row flex flex-col ${msg.sender === SENDER.USER ? "sent items-end" : "received items-start"}`}
                  >
                    {/* An automated reply is marked as one. It used to be stored
                        as `sender: "merchant"` and rendered identically to the
                        shop, so a canned line about order status was
                        indistinguishable from the kitchen answering. */}
                    {msg.sender === SENDER.ASSISTANT && (
                      <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 mb-1 px-1 flex items-center gap-1">
                        <i className="bi bi-robot" aria-hidden="true" />
                        ผู้ช่วยอัตโนมัติ (ไม่ใช่ข้อความจากร้าน)
                      </span>
                    )}
                    <div className={`queueup-chat-msg-bubble max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed whitespace-pre-line ${
                      msg.sender === SENDER.USER
                        ? "bg-[#FF7A1A] text-white rounded-tr-xs shadow-xs"
                        : msg.sender === SENDER.ASSISTANT
                          ? "bg-violet-50 dark:bg-violet-950/40 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-violet-200 dark:border-violet-900/50 shadow-xs"
                          : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200 dark:border-slate-700 shadow-xs"
                    }`}>
                      {msg.text}
                    </div>
                    <span className="queueup-chat-msg-time text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestions Bar */}
              <div className="queueup-chat-suggestions flex items-center gap-1.5 overflow-x-auto p-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                {QUICK_SUGGESTIONS.map((chip, idx) => (
                  <button
                    key={idx}
                    className="queueup-chat-suggest-chip px-3 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-orange-400 hover:text-orange-500 whitespace-nowrap transition-all cursor-pointer shadow-2xs"
                    onClick={() => void handleSendMessage(chip)}
                    disabled={sending}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Footer Input Area */}
              <form
                className="queueup-chat-input-footer p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-slate-900 shrink-0"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSendMessage();
                }}
              >
                <input
                  type="text"
                  className="queueup-chat-input-box flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#FF7A1A]"
                  placeholder="พิมพ์ข้อความตอบกลับร้านค้า..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={sending}
                  aria-busy={sending}
                  className="queueup-chat-send-btn p-2 w-9 h-9 min-w-[44px] min-h-[44px] rounded-xl bg-[#FF7A1A] hover:bg-[#E6680D] disabled:opacity-60 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all cursor-pointer border-0 shadow-xs"
                  title="ส่งข้อความ"
                  aria-label="ส่งข้อความ"
                >
                  <i className={sending ? "bi bi-hourglass-split text-xs" : "bi bi-send-fill text-xs"} />
                </button>
              </form>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default ChatModal;
