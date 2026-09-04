import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Utensils } from 'lucide-react';

export const ClientCartModal = ({
  isOpen,
  onClose,
  cartItems = [],
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  if (!isOpen) return null;

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (item.menuItem?.price || 0) * item.quantity,
    0
  );

  const handleProceedToBooking = (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (onCheckout) {
      onCheckout();
    }
    onClose();
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
                      <small className="text-muted">{item.menuItem?.price} ฿ / รายการ</small>
                      {item.customNotes && (
                        <div className="text-muted text-xs mt-1" style={{ fontSize: '0.75rem' }}>
                          {item.customNotes}
                        </div>
                      )}
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="btn-group btn-group-sm">
                        <button onClick={() => onUpdateQuantity && onUpdateQuantity(index, -1)} className="btn btn-outline-secondary">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="btn btn-outline-secondary disabled text-dark fw-bold">{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity && onUpdateQuantity(index, 1)} className="btn btn-outline-secondary">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button onClick={() => onRemoveItem && onRemoveItem(index)} className="btn btn-sm btn-outline-danger border-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Zero-Payment Summary Notice */}
              <div className="p-3 bg-amber-50 rounded-3 border border-amber-200 text-amber-900 small">
                <div className="d-flex align-items-center gap-2 fw-bold mb-1">
                  <Utensils className="w-4 h-4 text-amber-700" />
                  <span>ระบบ Zero-Payment สั่งปุ๊บรับคิวทันที</span>
                </div>
                <div>คุณสามารถเลือกวันและเวลารับอาหารได้ในขั้นตอนถัดไป โดยไม่ต้องชำระเงินล่วงหน้า</div>
              </div>
            </>
          )}
        </div>

        {/* Footer Checkout Button */}
        {cartItems.length > 0 && (
          <div className="p-3 bg-light border-top d-flex align-items-center justify-content-between gap-3">
            <div>
              <small className="text-muted d-block">ยอดรวมโดยประมาณ</small>
              <h5 className="fw-bold text-dark mb-0">{totalAmount} ฿</h5>
            </div>
            <button
              onClick={handleProceedToBooking}
              className="btn btn-theme-red px-4 py-2 fw-bold d-flex align-items-center gap-2"
            >
              <span>ไปหน้าจองคิวอาหาร</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ClientCartModal;
