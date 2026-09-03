/**
 * 🧩 MerchantModifierManager.tsx (Wave 4.2.3)
 * Store-Isolated Modifier Groups & Options Management with Exact Satang Support.
 */

import React, { useState } from 'react';
import type { ModifierGroup, ModifierOption } from '../types';
import { Plus, Trash2, Edit2, Check, Layers, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';

interface Props {
  storeId: string;
  modifierGroups: ModifierGroup[];
  onCreateGroup: (group: Omit<ModifierGroup, 'id' | 'storeId'>) => Promise<void>;
  onToggleOptionStock?: (groupId: string, optionId: string) => Promise<void>;
  onDeleteGroup?: (groupId: string) => Promise<void>;
}

export const MerchantModifierManager: React.FC<Props> = ({
  storeId,
  modifierGroups,
  onCreateGroup,
  onToggleOptionStock,
  onDeleteGroup
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectionType, setSelectionType] = useState<'single' | 'multiple'>('single');
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState<Array<{ name: string; price: number }>>([
    { name: 'ปกติ', price: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddOptionField = () => {
    setOptions([...options, { name: '', price: 0 }]);
  };

  const handleRemoveOptionField = (index: number) => {
    if (options.length <= 1) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, field: 'name' | 'price', value: string | number) => {
    const updated = [...options];
    if (field === 'name') updated[index].name = String(value);
    if (field === 'price') updated[index].price = Math.max(0, Number(value) || 0);
    setOptions(updated);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) {
      setErrorMsg('กรุณากรอกชื่อกลุ่มตัวเลือก');
      return;
    }

    const validOptions: ModifierOption[] = options
      .filter((o) => o.name.trim().length > 0)
      .map((o, idx) => {
        const satang = Math.round(o.price * 100);
        return {
          id: `opt_${Date.now()}_${idx}`,
          name: o.name.trim(),
          priceModifier: satang / 100,
          priceModifierSatang: satang,
          isOutOfStock: false
        };
      });

    if (validOptions.length === 0) {
      setErrorMsg('ต้องมีตัวเลือกอย่างน้อย 1 รายการ');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await onCreateGroup({
        name: groupName.trim(),
        selectionType,
        isRequired,
        options: validOptions
      });

      setGroupName('');
      setSelectionType('single');
      setIsRequired(false);
      setOptions([{ name: 'ปกติ', price: 0 }]);
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'ไม่สามารถสร้างกลุ่มตัวเลือกได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-500" />
            <span>กลุ่มตัวเลือกเพิ่มเติม (Modifier Groups Engine)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            จัดการตัวเลือกเมนู เช่น ระดับความหวาน, ท็อปปิ้ง, หรือระดับความเผ็ดแบบแยกอิสระ (Store-Isolated)
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>สร้างกลุ่มตัวเลือกใหม่</span>
        </button>
      </div>

      {/* Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modifierGroups.length > 0 ? (
          modifierGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-indigo-200 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">{group.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {group.selectionType === 'single' ? 'เลือกได้ 1 อย่าง' : 'เลือกได้หลายอย่าง'}
                    </span>
                    {group.isRequired ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600">
                        จำเป็นต้องเลือก
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-500">
                        ไม่บังคับ
                      </span>
                    )}
                  </div>
                </div>

                {onDeleteGroup && (
                  <button
                    onClick={() => onDeleteGroup(group.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="ลบกลุ่มตัวเลือก"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Options List */}
              <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
                <div className="text-[11px] font-bold text-slate-500 mb-2">ตัวเลือกย่อย ({group.options?.length || 0} รายการ):</div>
                {group.options?.map((opt) => (
                  <div
                    key={opt.id}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white border border-slate-200/60"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${opt.isOutOfStock ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {opt.name}
                      </span>
                      {opt.isOutOfStock && (
                        <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.2 rounded">
                          หมด
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-indigo-600">
                        {opt.priceModifier > 0 ? `+฿${opt.priceModifier.toFixed(2)}` : 'ฟรี'}
                      </span>

                      {onToggleOptionStock && (
                        <button
                          onClick={() => onToggleOptionStock(group.id, opt.id)}
                          className="text-slate-400 hover:text-slate-600"
                          title={opt.isOutOfStock ? 'เปิดใช้งาน' : 'ตั้งเป็นของหมด'}
                        >
                          {opt.isOutOfStock ? (
                            <ToggleLeft className="w-4 h-4 text-rose-400" />
                          ) : (
                            <ToggleRight className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white p-8 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 space-y-2">
            <Layers className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm font-medium">ยังไม่มีกลุ่มตัวเลือกเพิ่มเติมสำหรับร้านค้านี้</p>
            <p className="text-xs text-slate-400">คลิก "สร้างกลุ่มตัวเลือกใหม่" เพื่อเพิ่มความหวาน, ท็อปปิ้ง, หรือระดับความเผ็ด</p>
          </div>
        )}
      </div>

      {/* Modal Add Group */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">สร้างกลุ่มตัวเลือกเพิ่มเติมใหม่</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateGroup} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อกลุ่มตัวเลือก</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="เช่น ระดับความหวาน, ท็อปปิ้งไข่ดาว, ประเภทเนื้อสัตว์"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">รูปแบบการเลือก</label>
                  <select
                    value={selectionType}
                    onChange={(e) => setSelectionType(e.target.value as 'single' | 'multiple')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  >
                    <option value="single">เลือกได้ 1 รายการ (Single)</option>
                    <option value="multiple">เลือกได้หลายรายการ (Multiple)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ความจำเป็น</label>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="reqCheck"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <label htmlFor="reqCheck" className="text-slate-700 font-medium">ลูกค้าต้องเลือก</label>
                  </div>
                </div>
              </div>

              {/* Options Builder */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700">รายการตัวเลือกย่อย & ราคาบวกเพิ่ม</label>
                  <button
                    type="button"
                    onClick={handleAddOptionField}
                    className="text-indigo-600 hover:text-indigo-700 font-bold text-[11px] flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มตัวเลือก</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        required
                        value={opt.name}
                        onChange={(e) => handleOptionChange(idx, 'name', e.target.value)}
                        placeholder={`ชื่อตัวเลือก เช่น ${idx === 0 ? 'หวาน 50%' : 'ไข่ดาวกรอบ'}`}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2 font-medium"
                      />
                      <div className="w-28 relative">
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={opt.price}
                          onChange={(e) => handleOptionChange(idx, 'price', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 pr-6 font-medium text-right"
                        />
                        <span className="absolute right-2 top-2 text-slate-400 font-bold text-[10px]">฿</span>
                      </div>
                      {options.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveOptionField(idx)}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกกลุ่มตัวเลือก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
