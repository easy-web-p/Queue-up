import React from "react";
import { AlertCircle, Trash2, X } from "lucide-react";

interface CrossStoreCartModalProps {
  isOpen: boolean;
  existingStoreName?: string;
  newStoreName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const CrossStoreCartModal: React.FC<CrossStoreCartModalProps> = ({
  isOpen,
  existingStoreName = "ร้านค้าเดิม",
  newStoreName = "ร้านค้าใหม่",
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-[#241C16] border border-orange-500/30 rounded-2xl shadow-2xl p-6 text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cross-store-title"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 id="cross-store-title" className="text-lg font-bold font-kanit">
                ต้องการเปลี่ยนร้านค้าใช่หรือไม่?
              </h3>
              <p className="text-xs text-slate-400">สั่งอาหารได้ทีละ 1 ร้านค้าต่อคำสั่งซื้อ</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white transition-colors p-1"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-[#1A1410] border border-white/10 rounded-xl mb-6 text-sm text-slate-300 leading-relaxed">
          คุณมีรายการอาหารจาก <span className="font-semibold text-orange-400">"{existingStoreName}"</span> อยู่ในตะกร้า
          <br />
          การเพิ่มรายการจาก <span className="font-semibold text-emerald-400">"{newStoreName}"</span> จะล้างตะกร้าเดิมออกทั้งหมด คุณต้องการดำเนินการต่อหรือไม่?
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 rounded-xl border border-white/20 text-slate-300 hover:bg-white/5 font-medium transition-colors text-sm"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-950/40 text-sm"
          >
            <Trash2 className="w-4 h-4" />
            ล้างตะกร้าและเพิ่ม
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrossStoreCartModal;
