import React, { useState } from 'react';
import { MenuItem, MenuCategory } from '../../types';
import { ToggleLeft, ToggleRight, Plus, Utensils, AlertTriangle, Edit2, Check } from 'lucide-react';

interface Props {
  menuItems: MenuItem[];
  onToggleAvailability: (itemId: string) => void;
  onUpdateStock: (itemId: string, newStock: number) => void;
  onUpdatePrice: (itemId: string, newPrice: number) => void;
  onAddNewItem: (item: Omit<MenuItem, 'id'>) => void;
}

export const MerchantMenuManager: React.FC<Props> = ({
  menuItems,
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

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onAddNewItem({
      name: newName,
      category: newCategory,
      price: newPrice,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=60',
      isAvailable: true,
      stock: newStock,
      maxStock: newStock,
      prepTimeMinutes: newPrepTime,
      description: newDescription || 'เมนูอร่อยปรุงสดใหม่หน้าร้าน',
    });

    setNewName('');
    setNewDescription('');
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
            เปิด/ปิดขายเมนูอาหาร ปรับราคา และตั้งค่าจำนวนคงเหลือแบบทันที
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
                <th className="p-4">ราคา (บาท)</th>
                <th className="p-4">จำนวนคงเหลือ (จาน)</th>
                <th className="p-4">สถานะเปิดขาย</th>
                <th className="p-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {menuItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-4 font-bold text-slate-800 flex items-center gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-10 h-10 rounded-xl object-cover shrink-0"
                    />
                    <div>
                      <span className="block text-sm">{item.name}</span>
                      <span className="text-[11px] text-slate-400 font-normal">{item.description}</span>
                    </div>
                  </td>

                  <td className="p-4">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                      {item.category === 'single_dish'
                        ? 'จานเดียว'
                        : item.category === 'noodle'
                        ? 'ก๋วยเตี๋ยว'
                        : item.category === 'drink'
                        ? 'เครื่องดื่ม'
                        : 'ทานเล่น/Snack Box'}
                    </span>
                  </td>

                  {/* Price cell */}
                  <td className="p-4">
                    {editingItemId === item.id ? (
                      <input
                        type="number"
                        value={tempPrice}
                        onChange={(e) => setTempPrice(Number(e.target.value))}
                        className="w-20 p-1 border border-orange-400 rounded-lg text-xs font-bold"
                      />
                    ) : (
                      <span className="font-bold text-slate-800">{item.price} ฿</span>
                    )}
                  </td>

                  {/* Stock cell */}
                  <td className="p-4">
                    {editingItemId === item.id ? (
                      <input
                        type="number"
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
                        {item.stock} / {item.maxStock} จาน
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
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4">
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
                    <option value="single_dish">จานเดียว</option>
                    <option value="noodle">ก๋วยเตี๋ยว</option>
                    <option value="drink">เครื่องดื่ม</option>
                    <option value="snack">ทานเล่น/Snack Box</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ราคา (บาท)</label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">จำนวนสต็อก (จาน)</label>
                  <input
                    type="number"
                    required
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
                    value={newPrepTime}
                    onChange={(e) => setNewPrepTime(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">รายละเอียดเมนู</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="คำอธิบายสั้นๆ..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-medium h-16"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition-all text-xs"
              >
                บันทึกเมนูใหม่
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
