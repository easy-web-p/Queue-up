import React, { useState } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, QrCode, Upload, CheckCircle2 } from 'lucide-react';

export const ClientCartModal = ({
  isOpen,
  onClose,
  cartItems = [],
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  const [customerName, setCustomerName] = useState('พิมพ์ชนก เรียนดี');
  const [customerPhone, setCustomerPhone] = useState('081-234-5678');
  const [orderType, setOrderType] = useState('preorder');
  const [pickupTime, setPickupTime] = useState('12:00');
  const [uploadedSlip, setUploadedSlip] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (item.menuItem?.price || 0) * item.quantity,
    0
  );

  const handleConfirmOrder = (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;

    setIsSubmitting(true);
    setTimeout(() => {
      onCheckout(customerName, customerPhone, orderType, pickupTime, uploadedSlip || undefined);
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <div className="position-fixed top-0 start-0 end-0 bottom-0 z-3 bg-dark bg-opacity-75 d-flex align-items-center justify-content-center p-3">
      <div className="bg-white rounded-4 shadow-lg w-100 overflow-hidden d-flex flex-column" style={{ maxWidth: 500, maxHeight: '90vh' }}>
        
        {/* Header */}
        <div className="bg-dark text-white p-3 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-warning" />
            <h6 className="fw-bold mb-0">ตระกร้าอาหารของคุณ ({cartItems.length} รายการ)</h6>
          </div>
          <button onClick={onClose} className="btn btn-sm btn-outline-light border-0">
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-auto flex-grow-1 space-y-3">
          {cartItems.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <ShoppingBag className="w-12 h-12 text-secondary mb-2" />
              <p className="small mb-2">ตระกร้าของคุณยังไม่มีรายการอาหาร</p>
              <button onClick={onClose} className="btn btn-theme-red btn-sm fw-bold">
                เลือกเมนูอาหาร
              </button>
            </div>
          ) : (
            <>
              {/* Item List */}
              <div className="space-y-2 mb-3">
                {cartItems.map((item, index) => (
                  <div key={index} className="p-3 bg-light rounded-3 border d-flex align-items-center justify-content-between gap-2">
                    <div>
                      <h6 className="fw-bold mb-0 small">{item.menuItem?.name}</h6>
                      <small className="text-muted">{item.menuItem?.price} ฿ / จาน</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="btn-group btn-group-sm">
                        <button onClick={() => onUpdateQuantity(index, -1)} className="btn btn-outline-secondary">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="btn btn-outline-secondary disabled text-dark fw-bold">{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(index, 1)} className="btn btn-outline-secondary">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => onRemoveItem(index)} className="btn btn-sm btn-outline-danger border-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form */}
              <form id="checkout-form" onSubmit={handleConfirmOrder} className="space-y-3 pt-3 border-top">
                <div className="row g-2">
                  <div className="col-6">
                    <label className="form-label text-muted small fw-bold mb-1">ชื่อผู้สั่ง</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="form-control form-control-sm"
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-muted small fw-bold mb-1">เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="form-control form-control-sm"
                    />
                  </div>
                </div>

                <div className="p-3 bg-dark text-white rounded-3 space-y-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="small text-warning fw-bold">ยอดชำระทั้งสิ้น</span>
                    <h5 className="fw-bold mb-0 text-white">{totalAmount} บาท</h5>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadedSlip('https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400')}
                    className="btn btn-warning btn-sm w-100 fw-bold d-flex align-items-center justify-content-center gap-1"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadedSlip ? 'แนบสลิปเรียบร้อยแล้ว' : 'แนบรูปสลิปจำลอง PromptPay'}</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer Checkout Button */}
        {cartItems.length > 0 && (
          <div className="p-3 bg-light border-top">
            <button
              type="submit"
              form="checkout-form"
              disabled={isSubmitting}
              className="btn btn-theme-red w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>{isSubmitting ? 'กำลังออกตั๋วคิว...' : 'ยืนยันการสั่งและรับตั๋วคิว Live Ticket'}</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ClientCartModal;
