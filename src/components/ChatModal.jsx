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
    <div className="queueup-chat-overlay" onClick={onClose}>
      <div className="queueup-chat-card" onClick={(e) => e.stopPropagation()}>
        {/* ---------------- 1. LEFT SIDEBAR (STORE CHAT LIST) ---------------- */}
        <aside className="queueup-chat-sidebar">
          <div className="queueup-chat-sidebar-header">
            <div className="queueup-chat-sidebar-title">
              <i className="bi bi-chat-dots-fill text-danger fs-5" />
              <span>แชทติดต่อร้านค้า</span>
            </div>
            <span className="badge bg-danger-subtle text-danger rounded-pill px-2 py-1 small">
              {conversations.reduce((sum, c) => sum + (c.unread || 0), 0)} ใหม่
            </span>
          </div>

          {conversations.length === 0 ? (
            <div className="p-4 text-center text-muted small">
              <i className="bi bi-inbox text-slate-300 fs-3 d-block mb-1" />
              ยังไม่มีแชทกับร้านค้า
            </div>
          ) : (
            <ul className="queueup-chat-list">
              {conversations.map((chat) => (
                <li
                  key={chat.id}
                  className={`queueup-chat-item ${activeChatId === chat.id ? "active" : ""}`}
                  onClick={() => handleSelectChat(chat.id)}
                >
                  <div className="queueup-chat-item-avatar-wrapper">
                    <img
                      src={chat.avatar}
                      alt={chat.storeName}
                      className="queueup-chat-item-avatar"
                    />
                    {chat.online && <span className="queueup-chat-online-dot" />}
                  </div>

                  <div className="queueup-chat-item-info">
                    <div className="queueup-chat-item-name">{chat.storeName}</div>
                    <div className="queueup-chat-item-preview">
                      {chat.messages[chat.messages.length - 1]?.text || "เริ่มการสนทนา"}
                    </div>
                  </div>

                  <div className="queueup-chat-item-meta">
                    <span className="queueup-chat-item-time">{chat.lastTime}</span>
                    {chat.unread > 0 && (
                      <span className="queueup-chat-unread-badge">{chat.unread}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* ---------------- 2. RIGHT MAIN CHAT WINDOW ---------------- */}
        <main className="queueup-chat-main">
          {!activeChat ? (
            <div className="d-flex flex-column align-items-center justify-content-center h-100 p-4 text-center bg-white">
              <i className="bi bi-chat-square-text text-muted mb-3" style={{ fontSize: "3.5rem", opacity: 0.4 }} />
              <h5 className="fw-bold text-dark mb-2">ยังไม่มีรายการแชทกับร้านค้า</h5>
              <p className="text-muted small mb-0 px-3" style={{ maxWidth: "340px", lineHeight: "1.6" }}>
                คุณสามารถเพิ่มแชทและเริ่มการสนทนากับทางร้านได้ โดยกดปุ่ม{" "}
                <span className="text-danger fw-bold"><i className="bi bi-chat-dots-fill me-1" />แชทเลย</span> ที่รายการคำสั่งซื้อของคุณ
              </p>
              <button className="queueup-chat-close-btn position-absolute top-0 end-0 m-3" onClick={onClose}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="queueup-chat-main-header">
                <div className="queueup-chat-header-user">
                  <img
                    src={activeChat.avatar}
                    alt={activeChat.storeName}
                    className="queueup-chat-item-avatar"
                  />
                  <div>
                    <div className="queueup-chat-header-title">{activeChat.storeName}</div>
                    <div className="queueup-chat-header-status">
                      <i className="bi bi-circle-fill text-success me-1" style={{ fontSize: "8px" }} />
                      {activeChat.statusText}
                    </div>
                  </div>
                </div>

                <button className="queueup-chat-close-btn" onClick={onClose} title="ปิดแชท">
                  <i className="bi bi-x-lg" />
                </button>
              </div>

              {/* Attached Order Context Banner */}
              {activeChat.orderContext && (
                <div className="queueup-chat-order-banner">
                  <div className="queueup-chat-order-info">
                    <span className="queueup-chat-order-tag">
                      {activeChat.orderContext.queueNo || "ออเดอร์จองคิว"}
                    </span>
                    <span className="fw-bold text-dark">
                      {activeChat.orderContext.itemTitle || "รายการอาหาร"}
                    </span>
                    <span className="text-muted">
                      (฿{activeChat.orderContext.price?.toFixed(2) || "0.00"})
                    </span>
                  </div>
                  <span className="small text-danger fw-bold">
                    ID: {activeChat.orderContext.orderId}
                  </span>
                </div>
              )}

              {/* Messages Body */}
              <div className="queueup-chat-messages-body">
                {activeChat.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`queueup-chat-msg-row ${msg.sender === "user" ? "sent" : "received"}`}
                  >
                    <div className="queueup-chat-msg-bubble">{msg.text}</div>
                    <span className="queueup-chat-msg-time">{msg.time}</span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestions Bar */}
              <div className="queueup-chat-suggestions">
                {QUICK_SUGGESTIONS.map((chip, idx) => (
                  <button
                    key={idx}
                    className="queueup-chat-suggest-chip"
                    onClick={() => handleSendMessage(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              {/* Footer Input Area */}
              <form
                className="queueup-chat-input-footer"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <input
                  type="text"
                  className="queueup-chat-input-box"
                  placeholder="พิมพ์ข้อความตอบกลับร้านค้า..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button type="submit" className="queueup-chat-send-btn" title="ส่งข้อความ">
                  <i className="bi bi-send-fill" />
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
