/**
 * 🍲 MerchantMenuManager.tsx (Wave 4.2.3)
 * Store-Isolated Menu Management with Modifier Group Binding & Exact Satang Integrity.
 */

import React, { useState } from 'react';
import type { MenuItem, MenuCategory, ModifierGroup } from '../types';
import { ToggleLeft, ToggleRight, Plus, Utensils, AlertTriangle, Edit2, Check, Layers } from 'lucide-react';

interface Props {
  storeId?: string;
  menuItems: MenuItem[];
  modifierGroups?: ModifierGroup[];
  onToggleAvailability: (itemId: string) => void;
  onUpdateStock: (itemId: string, newStock: number) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onAddNewItem: (item: Omit<MenuItem, 'id'>) => void;
}

export const MerchantMenuManager: React.FC<Props> = ({
  storeId,
  menuItems,
  modifierGroups = [],
  onToggleAvailability,
  onUpdateStock,
  onUpdatePrice,
  onAddNewItem,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<number>(0);
  const [tempStock, setTempStock] = useState<number>(0);

  // New Item Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<MenuCategory>('single_dish');
  const [newPrice, setNewPrice] = useState<number>(40);
  const [newStock, setNewStock] = useState<number>(20);
  const [newPrepTime, setNewPrepTime] = useState<number>(5);
  const [newDescription, setNewDescription] = useState('');
  const [selectedModifierIds, setSelectedModifierIds] = useState<string[]>([]);

  const handleToggleModifierSelection = (modId: string) => {
    setSelectedModifierIds((prev) =>
      prev.includes(modId) ? prev.filter((id) => id !== modId) : [...prev, modId]
    );
  };

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const satang = Math.round(newPrice * 100);

    onAddNewItem({
      storeId: storeId || 'store_canteen01',
      name: newName.trim(),
      category: newCategory,
      price: satang / 100,
      priceSatang: satang,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
      stock: Math.max(0, newStock),
      maxStock: Math.max(0, newStock),
      prepTimeMinutes: newPrepTime,
      description: newDescription || 'เมนูอร่อยปรุงสดใหม่หน้าร้าน',
      modifierGroupIds: selectedModifierIds,
    });

    setNewName('');
    setNewDescription('');
    setSelectedModifierIds([]);
    setShowAddModal(false);
  };

  const startEdit = (item: MenuItem) => {
    setEditingItemId(item.id);
    setTempPrice(item.price);
    setTempStock(item.stock);
  };

  const saveEdit = (itemId: string) => {
    onUpdatePrice(itemId, tempPrice);
    onUpdateStock(itemId, tempStock);
    setEditingItemId(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
            <Utensils className="w-5 h-5 text-orange-500" />
            <span>จัดการรายการเมนูอาหาร & สต็อกประจำวัน (Daily Stock Control)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            เปิด/ปิดขายเมนูอาหาร ปรับราคา และผูกกลุ่มตัวเลือก (Modifier Groups) ประจำร้าน
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มเมนูอาหารใหม่</span>
        </button>
      </div>

      {/* Menu Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-[11px] border-b border-slate-200">
              <tr>
                <th className="p-4">เมนูอาหาร</th>
                <th className="p-4">หมวดหมู่</th>
                <th className="p-4">ตัวเลือกเสริม</th>
                <th className="p-4">ราคา (บาท)</th>
                <th className="p-4">จำนวนคงเหลือ (จาน)</th>
                <th className="p-4">สถานะเปิดขาย</th>
                <th className="p-4 text-right">การทำงาน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {menuItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Item Image & Title */}
                  <td className="p-4 flex items-center gap-3">
                    <img
                      src={item.image || item.imageUrl || '/crispy_fried_chicken.jpg'}
                      alt={item.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-xs"
                    />
                    <div>
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{item.description}</div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="p-4">
                    <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      {item.category === 'single_dish' ? 'อาหารจานเดียว' : item.category === 'noodles' ? 'ก๋วยเตี๋ยว' : item.category === 'drinks' ? 'เครื่องดื่ม' : item.category}
                    </span>
                  </td>

                  {/* Modifier Groups Badge */}
                  <td className="p-4">
                    {item.modifierGroupIds && item.modifierGroupIds.length > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md text-[11px] font-bold">
                        <Layers className="w-3 h-3" />
                        {item.modifierGroupIds.length} กลุ่มตัวเลือก
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">- ไม่มี -</span>
                    )}
                  </td>

                  {/* Price */}
                  <td className="p-4">
                    {editingItemId === item.id ? (
                      <input
                        type="number"
                        min="1"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(Number(e.target.value))}
                        className="w-20 p-1 border border-orange-400 rounded-lg text-xs font-bold"
                      />
                    ) : (
                      <span className="font-bold text-slate-900">฿{item.price.toFixed(2)}</span>
                    )}
                  </td>

                  {/* Stock */}
                  <td className="p-4">
                    {editingItemId === item.id ? (
                      <input
                        type="number"
                        min="0"
                        value={tempStock}
                        onChange={(e) => setTempStock(Number(e.target.value))}
                        className="w-20 p-1 border border-orange-400 rounded-lg text-xs font-bold"
                      />
                    ) : (
                      <span
                        className={`font-bold px-2 py-0.5 rounded-md ${
                          item.stock > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {item.stock} / {item.maxStock || item.stock} จาน
                      </span>
                    )}
                  </td>

                  {/* Toggle availability */}
                  <td className="p-4">
                    <button
                      onClick={() => onToggleAvailability(item.id)}
                      className={`flex items-center gap-1.5 font-bold text-xs px-3 py-1 rounded-full transition-all ${
                        item.isAvailable && item.stock > 0
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {item.isAvailable && item.stock > 0 ? (
                        <>
                          <ToggleRight className="w-5 h-5 text-emerald-600" />
                          <span>เปิดขาย</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-5 h-5 text-rose-500" />
                          <span>ปิดขาย</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Action buttons */}
                  <td className="p-4 text-right">
                    {editingItemId === item.id ? (
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-bold text-xs"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="แก้ไขราคา/สต็อก"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-base">เพิ่มรายการอาหารใหม่</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ชื่อเมนูอาหาร</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="เช่น ข้าวผัดพะแนงหมูไข่ดาว"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">หมวดหมู่</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MenuCategory)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  >
                    <option value="single_dish">อาหารจานเดียว</option>
                    <option value="noodles">ก๋วยเตี๋ยว</option>
                    <option value="drinks">เครื่องดื่ม</option>
                    <option value="snacks">ของทานเล่น</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ราคา (บาท)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.5"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">สต็อกประจำวัน</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newStock}
                    onChange={(e) => setNewStock(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">เวลาปรุง (นาที)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={newPrepTime}
                    onChange={(e) => setNewPrepTime(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>

              {/* Modifier Groups Attachment */}
              {modifierGroups.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    <span>ผูกกลุ่มตัวเลือกสำหรับเมนูนี้ (Modifiers)</span>
                  </label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                    {modifierGroups.map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-white border border-slate-200 text-xs cursor-pointer hover:border-indigo-300"
                      >
                        <input
                          type="checkbox"
                          checked={selectedModifierIds.includes(g.id)}
                          onChange={() => handleToggleModifierSelection(g.id)}
                          className="rounded text-indigo-600"
                        />
                        <span className="font-bold text-slate-800">{g.name}</span>
                        <span className="text-[10px] text-slate-400">({g.options?.length || 0} ตัวเลือก)</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">คำอธิบายเมนู</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="เช่น รสชาติจัดจ้าน หอมกลิ่นใบกะเพราแท้..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 shadow-md shadow-orange-500/20"
                >
                  บันทึกเมนูใหม่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
