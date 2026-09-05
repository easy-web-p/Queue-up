import { useState, useEffect, useRef } from "react";
import { getChatGPTResponse } from "../services/aiChatService.js";
import { analyzeAndShieldInput, checkRateLimit } from "../services/aiSecurityShield.js";
import "./ChatModal.css";

const INITIAL_CONVERSATIONS = [
  {
    id: "chat_canteen",
    storeName: "ร้านครัวโรงเรียน QueueUp Canteen",
    avatar: "/logo.png",
    online: true,
    statusText: "ตอบกลับใน 2 นาที",
    unread: 1,
    lastTime: "11:42 น.",
    orderContext: {
      orderId: "240809QUEUE01",
      itemTitle: "ชุดข้าวผัดกุ้งกะทะร้อน + ไข่ดาวสด",
      queueNo: "คิวพร้อมรับ A05",
      price: 65,
    },
    messages: [
      {
        id: "m1",
        sender: "merchant",
        text: "สวัสดีครับร้านครัวโรงเรียน QueueUp Canteen ยินดีให้บริการครับ! คิวของคุณพร้อมรับแล้วที่เคาน์เตอร์ 1 ครับ 🍳",
        time: "11:40 น.",
      },
      {
        id: "m2",
        sender: "user",
        text: "รับทราบครับ กำลังลงไปที่โรงอาหารครับ!",
        time: "11:42 น.",
      },
    ],
  },
  {
    id: "chat_steak",
    storeName: "ร้านสเต็กพี่ตั้ม School Food",
    avatar: "https://images.unsplash.com/photo-1544025162-d76694265947?w=100&auto=format&fit=crop&q=80",
    online: true,
    statusText: "กำลังเตรียมคิวอาหาร",
    unread: 2,
    lastTime: "11:35 น.",
    orderContext: {
      orderId: "240809QUEUE02",
      itemTitle: "สเต็กหมูพริกไทยดำ + เฟรนช์ฟรายส์กรอบ",
      queueNo: "กำลังปรุงคิว (10 นาที)",
      price: 120,
    },
    messages: [
      {
        id: "s1",
        sender: "merchant",
        text: "สวัสดีครับ! ร้านสเต็กพี่ตั้มได้รับออเดอร์แล้วครับ กำลังย่างหมูสดใหม่ฉ่ำๆ ครับ 🥩",
        time: "11:30 น.",
      },
      {
        id: "s2",
        sender: "merchant",
        text: "เพิ่มเฟรนช์ฟรายส์กรอบให้เป็นพิเศษครับเสร็จใน 10 นาทีครับ",
        time: "11:35 น.",
      },
    ],
  },
  {
    id: "chat_boba",
    storeName: "ร้านชาไข่มุก บราวน์ชูการ์ Express",
    avatar: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=100&auto=format&fit=crop&q=80",
    online: false,
    statusText: "ไม่อยู่ชั่วคราว",
    unread: 0,
    lastTime: "เมื่อวาน",
    orderContext: null,
    messages: [
      {
        id: "b1",
        sender: "merchant",
        text: "ขอบคุณที่อุดหนุนร้านชาไข่มุก บราวน์ชูการ์ Express นะครับ 🧋",
        time: "เมื่อวาน 15:20 น.",
      },
    ],
  },
];

const QUICK_SUGGESTIONS = [
  "อาหารใกล้เสร็จหรือยังครับ?",
  "ขอเปลี่ยนระดับความเผ็ดได้ไหมครับ?",
  "ไม่ใส่ผักหอมนะครับ",
  "กำลังเดินทางไปรับที่เคาน์เตอร์ครับ",
  "ขอบคุณครับ!",
];

function ChatModal({ isOpen, onClose, initialStoreName, initialOrderContext }) {
  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem("queueup_chat_conversations");
    return saved ? JSON.parse(saved) : INITIAL_CONVERSATIONS;
  });

  const [activeChatId, setActiveChatId] = useState(null);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  // Dynamic Store Conversation Creation & Selection on "แชทเลย" Click
  useEffect(() => {
    if (!isOpen) return;

    if (initialStoreName) {
      const match = conversations.find((c) =>
        c.storeName.toLowerCase().includes(initialStoreName.toLowerCase()) ||
        initialStoreName.toLowerCase().includes(c.storeName.toLowerCase())
      );

      if (match) {
        // If chat with store already exists, activate it and update orderContext
        setTimeout(() => {
          if (activeChatId !== match.id) {
            setActiveChatId(match.id);
          }
          setConversations((prev) =>
            prev.map((c) =>
              c.id === match.id
                ? {
                    ...c,
                    unread: 0,
                    orderContext: initialOrderContext || c.orderContext,
                  }
                : c
            )
          );
        }, 0);
      } else {
        // If chat with store does NOT exist yet, create a BRAND NEW store conversation dynamically!
        const newChatId = "chat_" + Math.random().toString(36).substring(2, 9);
        const currentTime = new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }) + " น.";

        const newChat = {
          id: newChatId,
          storeName: initialStoreName,
          avatar: "/logo.png",
          online: true,
          statusText: "ตอบกลับใน 2 นาที",
          unread: 0,
          lastTime: currentTime,
          orderContext: initialOrderContext || null,
          messages: [
            {
              id: "m_welcome_" + Math.random().toString(36).substring(2, 9),
              sender: "merchant",
              text: `สวัสดีครับ! ${initialStoreName} ยินดีให้บริการ สอบถามข้อมูลเมนูอาหารหรือคิวได้เลยครับ 🍳`,
              time: currentTime,
            },
          ],
        };

        setTimeout(() => {
          setConversations((prev) => [newChat, ...prev]);
          setActiveChatId(newChatId);
        }, 0);
      }
    } else if (conversations.length > 0 && !activeChatId) {
      setTimeout(() => setActiveChatId(conversations[0].id), 0);
    }
  }, [isOpen, initialStoreName, initialOrderContext, activeChatId, conversations]);

  // Save to LocalStorage whenever conversations change
  useEffect(() => {
    localStorage.setItem("queueup_chat_conversations", JSON.stringify(conversations));
  }, [conversations]);

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, activeChatId, conversations]);

  if (!isOpen) return null;

  const activeChat = conversations.find((c) => c.id === activeChatId) || conversations[0];

  const handleSendMessage = (textToSend) => {
    const rawText = textToSend || inputText.trim();
    if (!rawText) return;

    // Check Rate Limiting
    const rateCheck = checkRateLimit("CHAT_MESSAGE", 10, 60000);
    if (!rateCheck.allowed) {
      alert(`🛡️ [AI Security Sentinel] ${rateCheck.message}`);
      return;
    }

    // Shield & Sanitize Input Text
    const shieldResult = analyzeAndShieldInput(rawText);
    if (!shieldResult.safe) {
      alert(`🛡️ [AI Security Sentinel] ตรวจพบแพทเทิร์นสุ่มเสี่ยง: ${shieldResult.threats[0]} ระบบได้บล็อกข้อความนี้เรียบร้อยแล้ว`);
      setInputText("");
      return;
    }

    const messageText = shieldResult.sanitized;

    const currentTime = new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " น.";

    /* eslint-disable-next-line react-hooks/purity */
    const msgRandomId = Math.random().toString(36).substring(2, 9);
    const userMsg = {
      id: "msg_" + msgRandomId,
      sender: "user",
      text: messageText,
      time: currentTime,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeChatId) {
          return {
            ...c,
            lastTime: currentTime,
            messages: [...c.messages, userMsg],
          };
        }
        return c;
      })
    );

    if (!textToSend) setInputText("");

    // ChatGPT Classic / AI Intelligent Merchant Auto-Reply
    setTimeout(async () => {
      const replyTime = new Date().toLocaleTimeString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
      }) + " น.";

      const storeName = activeChat?.storeName || "ร้านค้า QueueUp";
      const orderContext = activeChat?.orderContext || null;

      const autoReplyText = await getChatGPTResponse(messageText, storeName, orderContext);

      const merchantReply = {
        id: "msg_reply_" + Date.now(),
        sender: "merchant",
        text: autoReplyText,
        time: replyTime,
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === activeChatId) {
            return {
              ...c,
              lastTime: replyTime,
              messages: [...c.messages, merchantReply],
            };
          }
          return c;
        })
      );
    }, 1000);
  };

  const handleSelectChat = (chatId) => {
    setActiveChatId(chatId);
    setConversations((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c))
    );
  };

  return (
    <div className="queueup-chat-overlay fixed inset-0 z-[100000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="queueup-chat-card w-full max-w-4xl h-[620px] max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex overflow-hidden font-sans" onClick={(e) => e.stopPropagation()}>
        {/* ---------------- 1. LEFT SIDEBAR (STORE CHAT LIST) ---------------- */}
        <aside className="queueup-chat-sidebar w-72 shrink-0 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-slate-50 dark:bg-slate-900/60">
          <div className="queueup-chat-sidebar-header p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="queueup-chat-sidebar-title flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-100">
              <i className="bi bi-chat-dots-fill text-[#ee4d2d]" />
              <span>แชทติดต่อร้านค้า</span>
            </div>
            <span className="badge bg-danger-subtle text-danger rounded-pill px-2 py-0.5 text-[11px] font-bold bg-orange-100 text-[#ee4d2d] dark:bg-orange-950/50 dark:text-orange-300">
              {conversations.reduce((sum, c) => sum + (c.unread || 0), 0)} ใหม่
            </span>
          </div>

          {conversations.length === 0 ? (
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
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="queueup-chat-item-avatar-wrapper relative w-10 h-10 shrink-0">
                    <img
                      src={chat.avatar}
                      alt={chat.storeName}
                      className="queueup-chat-item-avatar w-full h-full rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    {chat.online && <span className="queueup-chat-online-dot absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />}
                  </div>

                  <div className="queueup-chat-item-info flex-1 min-w-0">
                    <div className="queueup-chat-item-name font-bold text-xs text-slate-800 dark:text-slate-200 truncate">{chat.storeName}</div>
                    <div className="queueup-chat-item-preview text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {chat.messages[chat.messages.length - 1]?.text || "เริ่มการสนทนา"}
                    </div>
                  </div>

                  <div className="queueup-chat-item-meta text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="queueup-chat-item-time text-[10px] text-slate-400">{chat.lastTime}</span>
                    {chat.unread > 0 && (
                      <span className="queueup-chat-unread-badge bg-[#ee4d2d] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">{chat.unread}</span>
                    )}
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
                <span className="text-danger fw-bold text-[#ee4d2d] font-bold"><i className="bi bi-chat-dots-fill me-1" />แชทเลย</span> ที่รายการคำสั่งซื้อของคุณ
              </p>
              <button className="queueup-chat-close-btn position-absolute top-0 end-0 m-3 absolute top-3 right-3 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border-0" onClick={onClose}>
                <i className="bi bi-x-lg text-sm" />
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="queueup-chat-main-header p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div className="queueup-chat-header-user flex items-center gap-2.5">
                  <img
                    src={activeChat.avatar}
                    alt={activeChat.storeName}
                    className="queueup-chat-item-avatar w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                  <div>
                    <div className="queueup-chat-header-title font-bold text-xs text-slate-900 dark:text-white">{activeChat.storeName}</div>
                    <div className="queueup-chat-header-status text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <i className="bi bi-circle-fill text-emerald-500 text-[6px]" />
                      {activeChat.statusText}
                    </div>
                  </div>
                </div>

                <button className="queueup-chat-close-btn p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border-0" onClick={onClose} title="ปิดแชท">
                  <i className="bi bi-x-lg text-sm" />
                </button>
              </div>

              {/* Attached Order Context Banner */}
              {activeChat.orderContext && (
                <div className="queueup-chat-order-banner px-4 py-2 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs">
                  <div className="queueup-chat-order-info flex items-center gap-2 truncate">
                    <span className="queueup-chat-order-tag bg-[#ee4d2d] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {activeChat.orderContext.queueNo || "ออเดอร์จองคิว"}
                    </span>
                    <span className="fw-bold text-dark font-bold text-slate-800 dark:text-slate-200 truncate">
                      {activeChat.orderContext.itemTitle || "รายการอาหาร"}
                    </span>
                    <span className="text-muted text-slate-500 dark:text-slate-400">
                      (฿{activeChat.orderContext.price?.toFixed(2) || "0.00"})
                    </span>
                  </div>
                  <span className="small text-danger fw-bold text-[#ee4d2d] font-mono text-[11px] shrink-0">
                    ID: {activeChat.orderContext.orderId}
                  </span>
                </div>
              )}

              {/* Messages Body */}
              <div className="queueup-chat-messages-body flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 dark:bg-slate-950/30">
                {activeChat.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`queueup-chat-msg-row flex flex-col ${msg.sender === "user" ? "sent items-end" : "received items-start"}`}
                  >
                    <div className={`queueup-chat-msg-bubble max-w-[80%] rounded-2xl p-3 text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-[#ee4d2d] text-white rounded-tr-xs shadow-xs"
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
                    onClick={() => handleSendMessage(chip)}
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
                  handleSendMessage();
                }}
              >
                <input
                  type="text"
                  className="queueup-chat-input-box flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#ee4d2d]"
                  placeholder="พิมพ์ข้อความตอบกลับร้านค้า..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button type="submit" className="queueup-chat-send-btn p-2 w-9 h-9 rounded-xl bg-[#ee4d2d] hover:bg-[#d73211] text-white flex items-center justify-center transition-all cursor-pointer border-0 shadow-xs" title="ส่งข้อความ">
                  <i className="bi bi-send-fill text-xs" />
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
