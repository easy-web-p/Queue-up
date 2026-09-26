import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Modal } from '../ui/Modal';
import {
  Store,
  ChefHat,
  MapPin,
  Clock,
  Phone,
  Image,
  Tag,
  Check,
  AlertCircle
} from 'lucide-react';

export const CreateStoreModal: React.FC = () => {
  const { isCreateStoreModalOpen, setIsCreateStoreModalOpen, addNewStore, currentUser, openCreateStore } = useQueue();

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'rice' | 'noodles' | 'beverages' | 'desserts' | 'fastfood'>('rice');
  const [boothNumber, setBoothNumber] = useState('');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [openTime, setOpenTime] = useState('07:30 - 18:00 น.');
  const [image, setImage] = useState('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80');
  const [tagsInput, setTagsInput] = useState('อาหารจานด่วน, ข้าวราดแกง, รสเด็ด');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    addNewStore({
      name: name.trim(),
      nameEn: nameEn.trim() || name.trim(),
      description: description.trim() || 'ร้านอาหารในโรงอาหาร เสิร์ฟอาหารปรุงสดใหม่ทุกจาน',
      category,
      address: boothNumber ? `โรงอาหาร อาคารเรียนรวม ซุ้มที่ ${boothNumber}` : 'ศูนย์อาหาร อาคารเรียนรวม',
      image,
      tags: tags.length > 0 ? tags : ['อาหารจานเดียว', 'เมนูยอดนิยม']
    });

    setIsCreateStoreModalOpen(false);
    // Reset fields
    setName('');
    setNameEn('');
    setDescription('');
    setBoothNumber('');
  };

  return (
    <Modal
      isOpen={isCreateStoreModalOpen}
      onClose={() => setIsCreateStoreModalOpen(false)}
      title="🏪 สร้างและลงทะเบียนร้านค้าใหม่"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between p-3 rounded-2xl bg-orange-50/80 dark:bg-zinc-800/80 border border-orange-200/80 dark:border-zinc-700 text-xs">
          <div className="space-y-0.5">
            <span className="font-bold text-orange-950 dark:text-orange-300 block">
              ต้องการเปิดหน้าสร้างร้านค้าแบบเต็มจอพร้อมระบบซัพพอร์ต?
            </span>
            <span className="text-[11px] text-stone-500 dark:text-zinc-400">
              มี 4 กลุ่มข้อมูล จุดเริ่มต้นเปิดร้าน และเชื่อมต่อ User ID
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreateStoreModalOpen(false);
              openCreateStore();
            }}
            className="px-3 py-1.5 rounded-xl bg-orange-600 text-white font-bold text-xs hover:bg-orange-700 transition-colors shrink-0 cursor-pointer shadow-xs"
          >
            เปิดหน้าเพจสร้างร้านค้า
          </button>
        </div>

        <p className="text-xs text-stone-600 dark:text-zinc-400">
          กรอกข้อมูลเพื่อเปิดร้านค้าในระบบ QueueUp สำหรับอาจารย์, ผู้ประกอบการ หรือตัวแทนสาขา
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* ชื่อร้านค้า ภาษาไทย */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              ชื่อร้านค้า (ภาษาไทย) *
            </label>
            <div className="relative">
              <Store className="w-4 h-4 absolute left-3 top-2.5 text-orange-500" />
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น ข้าวหมูกรอบนายฮุย"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>

          {/* ชื่อร้านค้า ภาษาอังกฤษ */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              ชื่อร้านค้า (English)
            </label>
            <input
              type="text"
              value={nameEn}
              onChange={e => setNameEn(e.target.value)}
              placeholder="e.g. Crispy Pork Rice Stall"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
            />
          </div>
        </div>

        {/* หมวดหมู่อาหาร & ซุ้มที่ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              หมวดหมู่หลัก *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
            >
              <option value="rice">ข้าวราดแกง / อาหารจานเดียว</option>
              <option value="noodles">ก๋วยเตี๋ยว / เส้น</option>
              <option value="beverages">ชา / กาแฟ / เครื่องดื่ม</option>
              <option value="fastfood">ทอด / ปิ้งย่าง / กินเล่น</option>
              <option value="desserts">ของหวาน / เบเกอรี่</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              เลขที่บูธ / ซุ้มในโรงอาหาร
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={boothNumber}
                onChange={e => setBoothNumber(e.target.value)}
                placeholder="เช่น ซุ้ม B-04 โซนหน้า"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* เบอร์โทรศัพท์ & เวลาทำการ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              เบอร์ติดต่อร้านค้า / พร้อมเพย์
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
              ช่วงเวลาเปิดให้บริการ
            </label>
            <div className="relative">
              <Clock className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                value={openTime}
                onChange={e => setOpenTime(e.target.value)}
                placeholder="เช่น 07:30 - 18:00 น."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* คำอธิบายร้าน */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
            คำอธิบาย & เอกลักษณ์ของร้าน
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="เช่น หมูกรอบทอดใหม่หนังฟู น้ำราดสูตรโบราณ 30 ปี คั่วพริกเกลือสูตรเด็ด..."
            className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
          />
        </div>

        {/* แท็กค้นหา */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1">
            แท็กเมนูเด่น (คั่นด้วยเครื่องหมายจุลภาค ,)
          </label>
          <div className="relative">
            <Tag className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
              placeholder="ข้าวหมูกรอบ, ไข่ดาว, อาหารจานด่วน"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setIsCreateStoreModalOpen(false)}
            className="px-4 py-2 text-xs font-bold rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>ยืนยันสร้างร้านค้า</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
