import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Utensils, Store } from 'lucide-react';
import { calculateCartItemUnitPrice } from '../store/cartPricing.js';

/**
 * 🛒 The cart.
 *
 * Prices come from calculateCartItemUnitPrice — the same function the booking page
 * uses. This screen used to total `menuItem.price * quantity`, ignoring every paid
 * option, so a customer who added extra toppings saw one price here and a higher
 * one at checkout.
 */
export const ClientCartModal = ({
  isOpen,
  onClose,
  cartItems = [],
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
  onBrowseMenu,
}) => {
  if (!isOpen) return null;

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + calculateCartItemUnitPrice(item) * (item.quantity || 1),
    0
  );
  const totalCount = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0);

  // Every order goes to one store, so a cart holding two is a problem the customer
  // has to see here rather than discover when the order is refused.
  const storeNames = [...new Set(cartItems.map((i) => i.menuItem?.storeName).filter(Boolean))];
  const storeIds = [...new Set(cartItems.map((i) => i.menuItem?.storeId).filter(Boolean))];
  const hasMixedStores = storeIds.length > 1;

  const handleProceedToBooking = (e) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    if (onCheckout) onCheckout();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#241C16] rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] border border-slate-200 dark:border-white/10 font-['IBM_Plex_Sans_Thai']"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#241C16] via-[#1D140F] to-[#16100C] text-white px-5 sm:px-6 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-[#FF7A1A] flex items-center justify-center shadow-md text-white shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h5 id="cart-modal-title" className="font-['Kanit'] font-bold text-base mb-0">
                ตะกร้าอาหารของคุณ
              </h5>
              <span className="text-xs text-[#9CA3AF]">
                {cartItems.length > 0
                  ? `${cartItems.length} เมนู · ${totalCount} ชิ้น`
                  : 'ยังไม่มีรายการ'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            aria-label="ปิดตะกร้า"
            className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3 bg-slate-50/60 dark:bg-[#16100C]">
          {cartItems.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 bg-slate-100 dark:bg-[#241C16] rounded-full flex items-center justify-center mx-auto text-slate-400">
                <ShoppingBag className="w-8 h-8" />
              </div>
              <div>
                <h6 className="font-['Kanit'] font-bold text-slate-700 dark:text-[#E5E7EB] text-sm">
                  ตะกร้าของคุณยังไม่มีรายการอาหาร
                </h6>
                <p className="text-xs text-slate-400 mt-1">เลือกเมนูอาหารน่าทานจากโรงอาหารเพื่อเริ่มจองคิว</p>
              </div>
              <button
                onClick={() => {
                  // Previously this only closed the modal, leaving the customer on
                  // whatever page they were already on with nothing new to do.
                  onClose();
                  if (onBrowseMenu) onBrowseMenu();
                }}
                type="button"
                className="px-5 py-2.5 bg-[#FF7A1A] hover:bg-[#E6680D] text-white font-['Kanit'] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                เลือกเมนูอาหาร
              </button>
            </div>
          ) : (
            <>
              {storeNames.length === 1 && !hasMixedStores && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#9CA3AF] px-1">
                  <Store className="w-3.5 h-3.5 text-[#FF7A1A] shrink-0" />
                  <span className="truncate">รับที่ {storeNames[0]}</span>
                </div>
              )}

              {hasMixedStores && (
                <div
                  role="alert"
                  className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-2xl text-xs text-red-800 dark:text-red-200 leading-relaxed"
                >
                  <strong className="font-['Kanit']">ตะกร้ามีอาหารจากหลายร้าน</strong>
                  <div className="mt-0.5">
                    หนึ่งคำสั่งซื้อสั่งได้จากร้านเดียว กรุณาลบรายการที่ไม่ต้องการออกก่อนจองคิว
                  </div>
                </div>
              )}

              {/* Item List */}
              <div className="space-y-2.5">
                {cartItems.map((item, index) => {
                  const unitPrice = calculateCartItemUnitPrice(item);
                  const quantity = item.quantity || 1;
                  const modifiers = Array.isArray(item.selectedModifiers) ? item.selectedModifiers : [];
                  const note = item.customNotes;

                  return (
                    <div
                      key={index}
                      className="p-3 bg-white dark:bg-[#241C16] rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-xs flex gap-3 transition-colors hover:border-[#FF7A1A]/40"
                    >
                      {/* The cart line already carries the image the customer chose;
                          it was never shown, leaving four near-identical text rows. */}
                      {item.menuItem?.image && (
                        <img
                          src={item.menuItem.image}
                          alt=""
                          loading="lazy"
                          className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-100 dark:bg-[#16100C]"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <h6 className="font-['Kanit'] font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.menuItem?.name || item.name}
                        </h6>

                        {/* Chosen options, as chips rather than buried in a
                            "หมายเหตุ:" string the customer has to parse. */}
                        {modifiers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {modifiers.map((mod, mIdx) => (
                              <span
                                key={mIdx}
                                className="text-[10px] bg-slate-100 dark:bg-[#16100C] text-slate-600 dark:text-[#9CA3AF] px-1.5 py-0.5 rounded"
                              >
                                {mod.name}
                              </span>
                            ))}
                          </div>
                        )}

                        {note && (
                          <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF] mt-1 line-clamp-2">
                            {note}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-2">
                          <div className="text-xs text-slate-400 shrink-0">
                            ฿{unitPrice.toFixed(2)}
                            <span className="mx-1">×</span>
                            {quantity}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Line subtotal: the number that actually changes when
                                the quantity buttons are pressed. */}
                            <span className="text-sm font-black font-['Kanit'] text-[#E6680D] dark:text-[#FF7A1A]">
                              ฿{(unitPrice * quantity).toFixed(2)}
                            </span>

                            <div className="flex items-center bg-slate-100 dark:bg-[#16100C] rounded-xl border border-slate-200 dark:border-white/10 p-0.5">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity && onUpdateQuantity(index, -1)}
                                aria-label={quantity === 1 ? `ลบ ${item.menuItem?.name || 'รายการนี้'}` : `ลดจำนวน ${item.menuItem?.name || 'รายการนี้'}`}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-[#E5E7EB] transition-colors cursor-pointer"
                              >
                                <Minus className="w-3 h-3" aria-hidden="true" />
                              </button>
                              <span className="w-7 text-center text-xs font-black font-['JetBrains_Mono'] text-slate-800 dark:text-white">
                                {quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity && onUpdateQuantity(index, 1)}
                                aria-label={`เพิ่มจำนวน ${item.menuItem?.name || 'รายการนี้'}`}
                                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white dark:hover:bg-white/10 text-slate-600 dark:text-[#E5E7EB] transition-colors cursor-pointer"
                              >
                                <Plus className="w-3 h-3" aria-hidden="true" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onRemoveItem && onRemoveItem(index)}
                              aria-label={`ลบ ${item.menuItem?.name || 'รายการนี้'} ออกจากตะกร้า`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
          <div className="p-4 bg-white dark:bg-[#241C16] border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[11px] text-slate-400 block font-medium">ยอดรวม {totalCount} ชิ้น</span>
              <div className="text-xl font-black font-['Kanit'] text-slate-900 dark:text-white">
                ฿{totalAmount.toFixed(2)}
              </div>
            </div>
            <button
              type="button"
              onClick={handleProceedToBooking}
              disabled={hasMixedStores}
              className="px-5 sm:px-6 py-3 bg-[#FF7A1A] hover:bg-[#E6680D] disabled:opacity-50 disabled:cursor-not-allowed text-white font-['Kanit'] font-bold text-sm rounded-2xl shadow-lg shadow-[#FF7A1A]/20 flex items-center gap-2 transition-colors active:scale-95 cursor-pointer shrink-0"
            >
              <span>ไปหน้าจองคิวอาหาร</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientCartModal;
