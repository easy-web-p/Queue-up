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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 font-['IBM_Plex_Sans_Thai']">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-stone-900 to-slate-950 text-white px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shadow-md text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h5 className="font-['Kanit'] font-bold text-base mb-0">ตะกร้าอาหารของคุณ</h5>
              <span className="text-xs text-slate-400">{cartItems.length} รายการที่เลือกไว้</span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
          {cartItems.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h6 className="font-['Kanit'] font-bold text-slate-700 dark:text-slate-200 text-sm">
                  ตะกร้าของคุณยังไม่มีรายการอาหาร
                </h6>
                <p className="text-xs text-slate-400 mt-1">เลือกเมนูอาหารน่าทานจากโรงอาหารเพื่อเริ่มจองคิว</p>
              </div>
              <button
                onClick={onClose}
                type="button"
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-500 hover:to-orange-400 text-white font-['Kanit'] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                เลือกเมนูอาหาร
              </button>
            </div>
          ) : (
            <>
              {/* Item List */}
              <div className="space-y-2.5">
                {cartItems.map((item, index) => (
                  <div
                    key={index}
                    className="p-3.5 bg-white dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex items-center justify-between gap-3 transition-all hover:border-orange-500/30"
                  >
                    <div className="flex-1 min-w-0">
                      <h6 className="font-['Kanit'] font-bold text-sm text-slate-900 dark:text-white truncate">
                        {item.menuItem?.name || item.name}
                      </h6>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                          ฿{Number(item.menuItem?.price || item.price || 0).toFixed(2)}
                        </span>
                        <span className="text-[11px] text-slate-400">/ รายการ</span>
                      </div>
                      {item.customNotes && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic truncate">
                          หมายเหตุ: {item.customNotes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Quantity Pill */}
                      <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-0.5">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity && onUpdateQuantity(index, -1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-black font-['JetBrains_Mono'] text-slate-800 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity && onUpdateQuantity(index, 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => onRemoveItem && onRemoveItem(index)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title="ลบรายการนี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Zero-Payment Notice */}
              <div className="p-3.5 bg-amber-50/80 dark:bg-amber-950/30 rounded-2xl border border-amber-200/80 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
                <div className="flex items-center gap-2 font-bold font-['Kanit'] text-amber-800 dark:text-amber-300 mb-1">
                  <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>ระบบ Zero-Payment สั่งปุ๊บรับคิวทันที</span>
                </div>
                <div>คุณสามารถเลือกวันและเวลารับอาหารได้ในขั้นตอนถัดไป โดยไม่ต้องชำระเงินล่วงหน้า</div>
              </div>
            </>
          )}
        </div>

        {/* Footer Checkout Button */}
        {cartItems.length > 0 && (
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">ยอดรวมโดยประมาณ</span>
              <div className="text-xl font-black font-['Kanit'] text-slate-900 dark:text-white">
                ฿{Number(totalAmount).toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleProceedToBooking}
              className="px-6 py-3 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-['Kanit'] font-bold text-sm rounded-2xl shadow-lg shadow-orange-500/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
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
