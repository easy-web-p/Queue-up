import React, { useState, useEffect } from 'react';
import { fetchShopsFromFirestore } from '../../lib/firebase';
import { Send, Image as ImageIcon, MessageSquare, Search, X, CheckCheck } from 'lucide-react';

export const ClientChatDrawer = ({
  isOpen,
  onClose,
  messages = [],
  onSendMessage,
  currentUserType = 'client',
  onOpenChat,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState(null);

  useEffect(() => {
    fetchShopsFromFirestore().then((remoteShops) => {
      if (remoteShops && remoteShops.length > 0) {
        setShops(remoteShops);
        setSelectedShopId(remoteShops[0].id);
      }
    });
  }, []);

  const activeShop = shops.find((s) => s.id === selectedShopId) || shops[0] || null;

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedImage) return;

    onSendMessage(inputText, selectedImage || undefined);
    setInputText('');
    setSelectedImage(null);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={onOpenChat || onClose}
          className="position-fixed bottom-0 end-0 me-4 mb-3 z-3 btn btn-theme-red rounded-pill shadow-lg d-flex align-items-center gap-2 px-3 py-2"
        >
          <MessageSquare className="w-5 h-5 text-white" />
          <span className="fw-bold small">Chat</span>
          {messages.length > 0 && <span className="badge bg-warning text-dark rounded-pill">{messages.length}</span>}
        </button>
      )}

      {isOpen && (
        <div className="position-fixed bottom-0 end-0 me-3 mb-3 z-3 bg-white rounded-3 shadow-lg border overflow-hidden d-flex flex-column" style={{ width: 680, height: 480, maxWidth: '95vw' }}>
          {/* Header */}
          <div className="p-3 bg-dark text-white d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <MessageSquare className="w-5 h-5 text-warning" />
              <h6 className="fw-bold mb-0 small">QueueUp Live Chat ({activeShop ? activeShop.shopName : 'ร้านค้า'})</h6>
            </div>
            <button onClick={onClose} className="btn btn-sm btn-outline-light border-0">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Body */}
          <div className="row g-0 flex-grow-1 overflow-hidden">
            {/* Shop List */}
            <div className="col-4 border-end bg-light overflow-auto p-2">
              <small className="text-muted fw-bold d-block mb-2 px-1">เลือกร้านค้า</small>
              {shops.map((shop) => (
                <button
                  key={shop.id}
                  onClick={() => setSelectedShopId(shop.id)}
                  className={`btn btn-sm w-100 text-start mb-1 ${selectedShopId === shop.id ? 'btn-danger text-white' : 'btn-outline-secondary border-0'}`}
                >
                  <div className="fw-bold text-truncate">{shop.shopName}</div>
                  <small style={{ fontSize: '0.7rem' }}>{shop.building || 'โรงอาหาร'}</small>
                </button>
              ))}
            </div>

            {/* Chat Feed */}
            <div className="col-8 d-flex flex-column bg-white">
              <div className="p-3 flex-grow-1 overflow-auto space-y-2">
                {messages.map((msg) => {
                  const isMe = (currentUserType === 'client' && msg.sender === 'client') || (currentUserType === 'merchant' && msg.sender === 'merchant');
                  return (
                    <div key={msg.id} className={`d-flex flex-column ${isMe ? 'align-items-end' : 'align-items-start'}`}>
                      <div className={`p-2 rounded-3 small max-w-75 ${isMe ? 'bg-danger text-white' : 'bg-light text-dark border'}`}>
                        {msg.text}
                      </div>
                      <small className="text-muted" style={{ fontSize: '0.65rem' }}>{msg.timestamp}</small>
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-2 border-top bg-light d-flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="พิมพ์ข้อความ..."
                  className="form-control form-control-sm"
                />
                <button type="submit" className="btn btn-theme-red btn-sm px-3">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
