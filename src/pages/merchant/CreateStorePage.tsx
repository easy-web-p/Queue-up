import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { ImageUploader } from '../../components/ui/ImageUploader';
import {
  Store as StoreIcon,
  ChefHat,
  MapPin,
  Clock,
  Phone,
  Tag,
  Check,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  DollarSign,
  CreditCard,
  UserCheck,
  Layers,
  HelpCircle,
  X,
  Plus,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';

export const CreateStorePage: React.FC = () => {
  const { addNewStore, currentUser, setCurrentView } = useQueue();

  // Onboarding guidance popup state
  const [showGuideModal, setShowGuideModal] = useState<boolean>(true);

  // Group 1: Store Brand & Identity
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'rice' | 'noodles' | 'beverages' | 'desserts' | 'fastfood'>('rice');
  const [boothNumber, setBoothNumber] = useState('ซุ้ม A-08 ชั้น 1 โซนโรงอาหารกลาง');
  const [logo, setLogo] = useState('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80');
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80');
  const [tagsInput, setTagsInput] = useState('อาหารจานเดียว, ปรุงสดใหม่, รสเด็ด');

  // Group 2: Operations & Schedule
  const [openTime, setOpenTime] = useState('07:30 - 18:00 น.');
  const [operatingDays, setOperatingDays] = useState('จันทร์ - เสาร์');
  const [avgWaitMinutes, setAvgWaitMinutes] = useState<number>(10);
  const [priceRange, setPriceRange] = useState<'฿' | '฿฿' | '฿฿฿'>('฿');

  // Group 3: Initial Signature Menus (1-2 items)
  const [initialMenu1Name, setInitialMenu1Name] = useState('ข้าวกะเพราหมูกรอบไข่ดาวลาวา');
  const [initialMenu1Price, setInitialMenu1Price] = useState('65');
  const [initialMenu1Image, setInitialMenu1Image] = useState('https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80');
  
  const [enableMenu2, setEnableMenu2] = useState<boolean>(true);
  const [initialMenu2Name, setInitialMenu2Name] = useState('ชาไทยปักษ์ใต้สูตรโบราณแก้วโต');
  const [initialMenu2Price, setInitialMenu2Price] = useState('35');
  const [initialMenu2Image, setInitialMenu2Image] = useState('https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80');

  // Group 4: Payments & Account Association
  const ownerId = currentUser?.id || 'USR-89241';
  const [ownerName, setOwnerName] = useState(currentUser?.fullName || 'ธนากร สุขเกษม');
  const [phone, setPhone] = useState(currentUser?.phone || '089-876-5432');
  const [promptPayNumber, setPromptPayNumber] = useState(currentUser?.phone?.replace(/-/g, '') || '0898765432');

  // Preset logo options for fast creation
  const PRESET_LOGOS = [
    { label: 'อาหารจานด่วน/ผัด', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80' },
    { label: 'กะเพรา/เนื้อย่าง', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=150&auto=format&fit=crop&q=80' },
    { label: 'ก๋วยเตี๋ยว/เส้น', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=150&auto=format&fit=crop&q=80' },
    { label: 'ชา/กาแฟ/เครื่องดื่ม', url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=150&auto=format&fit=crop&q=80' },
    { label: 'ของหวาน/เบเกอรี่', url: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=150&auto=format&fit=crop&q=80' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const tags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    // Initial menus array
    const initialMenus = [];
    if (initialMenu1Name.trim()) {
      initialMenus.push({
        name: initialMenu1Name.trim(),
        nameEn: 'Signature Dish 1',
        price: Number(initialMenu1Price) || 50,
        description: 'เมนูแนะนำปรุงสดใหม่ทุกวัน รสชาติกลมกล่อม',
        image: initialMenu1Image || logo,
        preparationMinutes: avgWaitMinutes
      });
    }
    if (enableMenu2 && initialMenu2Name.trim()) {
      initialMenus.push({
        name: initialMenu2Name.trim(),
        nameEn: 'Special Refreshment 2',
        price: Number(initialMenu2Price) || 35,
        description: 'เมนูเครื่องดื่มและอาหารเสริมรสกลมกล่อม',
        image: initialMenu2Image || coverImage,
        preparationMinutes: 5
      });
    }

    addNewStore(
      {
        name: name.trim(),
        nameEn: nameEn.trim() || name.trim(),
        description: description.trim() || 'ร้านอาหารในโรงอาหาร เสิร์ฟอาหารปรุงสดใหม่ทุกจาน สะอาด อร่อย ทันใจ',
        category,
        address: boothNumber || 'ศูนย์อาหาร อาคารเรียนรวม ชั้น 1',
        logo,
        coverImage,
        image: coverImage,
        averageWaitMinutes: avgWaitMinutes,
        priceRange,
        tags: tags.length > 0 ? tags : ['อาหารจานเดียว', 'เมนูยอดนิยม', 'คิวเร็ว'],
        ownerId,
        ownerName: ownerName.trim(),
        ownerPhone: phone.trim(),
        promptPayNumber: promptPayNumber.trim()
      },
      initialMenus
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Top Breadcrumb / Back button */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setCurrentView('home')}
          className="flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>กลับสู่หน้ารวมอาหาร</span>
        </button>

        <button
          type="button"
          onClick={() => setShowGuideModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-orange-200 bg-orange-50/80 hover:bg-orange-100 text-orange-800 dark:bg-zinc-900 dark:border-zinc-700 dark:text-orange-400 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" />
          <span>คำแนะนำเริ่มต้นสร้างร้าน</span>
        </button>
      </div>

      {/* Hero Title Section */}
      <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-xs font-black tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>จุดเริ่มต้นการสร้างร้านค้าในระบบ QueueUp</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            ลงทะเบียนสร้างร้านค้าของคุณ
          </h1>
          <p className="text-xs sm:text-sm text-orange-100 max-w-2xl leading-relaxed">
            เชื่อมต่อร้านค้าเข้ากับบัญชียูสเซอร์ของคุณทันที เพื่อเข้าใช้งานระบบแอดมินเฉพาะร้านค้า จัดการคิว KDS และรับการดูแลจากทีมซัพพอร์ตพาร์ทเนอร์
          </p>
        </div>
      </div>

      {/* Main Creation Form with Data Groups */}
      <form onSubmit={handleSubmit} className="space-y-6">

        {/* กลุ่มข้อมูลที่ 1: ข้อมูลและอัตลักษณ์ร้านค้า (Brand & Identity) */}
        <div className="bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-stone-100 dark:border-zinc-800">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              1
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                กลุ่มข้อมูลที่ 1: อัตลักษณ์และข้อมูลทั่วไปของร้านค้า
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                ชื่อร้าน หมวดหมู่อาหาร ซุ้มที่ตั้ง และภาพโลโก้ที่จะแสดงให้ลูกค้าเห็น
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* ชื่อร้านค้า ภาษาไทย */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                ชื่อร้านค้า (ภาษาไทย) *
              </label>
              <div className="relative">
                <StoreIcon className="w-4 h-4 absolute left-3 top-3 text-orange-500" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="เช่น ข้าวหมูกรอบนายฮุยเตาถ่าน"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
                />
              </div>
            </div>

            {/* ชื่อร้านค้า ภาษาอังกฤษ */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                ชื่อร้านค้า (English)
              </label>
              <input
                type="text"
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="e.g. Crispy Pork Rice Stall"
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* หมวดหมู่ */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                หมวดหมู่อาหารหลัก *
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white cursor-pointer"
              >
                <option value="rice">ข้าวราดแกง / อาหารจานเดียว</option>
                <option value="noodles">ก๋วยเตี๋ยว / บะหมี่ / เมนูเส้น</option>
                <option value="beverages">ชา / กาแฟ / ชานม / เครื่องดื่ม</option>
                <option value="fastfood">ทอด / ปิ้งย่าง / กินเล่น</option>
                <option value="desserts">ของหวาน / เบเกอรี่ / ไอศกรีม</option>
              </select>
            </div>

            {/* ซุ้ม/บูธ */}
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                เลขที่ซุ้ม / บูธ / สถานที่ตั้งในศูนย์อาหาร
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="text"
                  value={boothNumber}
                  onChange={e => setBoothNumber(e.target.value)}
                  placeholder="เช่น ซุ้ม B-04 โซนหน้า อาคารเรียนรวม"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* คำอธิบาย */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
              คำอธิบาย & เอกลักษณ์ของร้าน
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="เช่น หมูกรอบทอดใหม่หนังฟู น้ำราดสูตรโบราณ 30 ปี คั่วพริกเกลือสูตรเด็ด อร่อยสดใหม่ทุกจาน..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
            />
          </div>

          {/* โลโก้ร้านค้า */}
          <div className="pt-2 border-t border-stone-100 dark:border-zinc-800 space-y-3">
            <ImageUploader
              value={logo}
              onChange={setLogo}
              label="เลือกหรืออัปโหลดรูปโลโก้ร้านค้า (จะนำไปแสดงเป็นปุ่มที่แถบนำทางหลังสร้างเสร็จ) *"
              helperText="อัปโหลดรูปภาพจากเครื่อง/มือถือ ลากไฟล์มาวาง หรือเลือกจากหมวดหมู่อาหารสำเร็จรูปด้านล่าง"
              aspectRatio="square"
              presets={PRESET_LOGOS}
              allowUrlInput={true}
            />

            {/* พรีวิวโลโก้ปัจจุบันบน Navbar Button */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-zinc-950 border border-stone-200 dark:border-zinc-800 mt-2">
              <img
                src={logo}
                alt="Logo Preview"
                className="w-12 h-12 rounded-xl object-cover border border-orange-300 shadow-sm shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-bold text-stone-700 dark:text-zinc-300 block">
                  ตัวอย่างการแสดงผลบนปุ่มนำทาง (Navbar Button Preview):
                </span>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 mt-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300 text-xs font-bold shadow-xs">
                  <img src={logo} alt="Preview" className="w-5 h-5 rounded-md object-cover" />
                  <span>{name || 'ชื่อร้านค้าของคุณ'}</span>
                  <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium">
                    (ร้านของฉัน)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ภาพปกและแบนเนอร์หน้าร้าน */}
          <div className="pt-3 border-t border-stone-100 dark:border-zinc-800">
            <ImageUploader
              value={coverImage}
              onChange={setCoverImage}
              label="รูปภาพปกและบรรยากาศหน้าร้านค้า (Cover Banner Image)"
              helperText="รูปภาพแนวนอนที่จะแสดงเป็นภาพพื้นหลังด้านบนสุดของหน้าร้านค้า (แนะนำ 16:9)"
              aspectRatio="banner"
              presets={[
                { label: 'บรรยากาศโรงอาหาร 1', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80' },
                { label: 'เคาน์เตอร์อาหารปรุงสด', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&auto=format&fit=crop&q=80' },
                { label: 'โต๊ะอาหารสไตล์โมเดิร์น', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=80' }
              ]}
              allowUrlInput={true}
            />
          </div>
        </div>

        {/* กลุ่มข้อมูลที่ 2: การดำเนินงานและเวลาเปิด-ปิด (Operations & Schedule) */}
        <div className="bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-stone-100 dark:border-zinc-800">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              2
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                กลุ่มข้อมูลที่ 2: การดำเนินงาน เวลาเปิด-ปิด และการรอคิว
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                กำหนดเวลาให้บริการและการประเมินเวลาสำหรับระบบคิวอัตโนมัติ
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                เวลาเปิดทำการ
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="text"
                  value={openTime}
                  onChange={e => setOpenTime(e.target.value)}
                  placeholder="07:30 - 18:00 น."
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                วันเปิดให้บริการ
              </label>
              <input
                type="text"
                value={operatingDays}
                onChange={e => setOperatingDays(e.target.value)}
                placeholder="จันทร์ - เสาร์"
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                เวลารอคิวเฉลี่ย (นาที)
              </label>
              <input
                type="number"
                min={2}
                max={60}
                value={avgWaitMinutes}
                onChange={e => setAvgWaitMinutes(Number(e.target.value) || 10)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                ระดับราคาเฉลี่ย
              </label>
              <select
                value={priceRange}
                onChange={e => setPriceRange(e.target.value as any)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white cursor-pointer"
              >
                <option value="฿">฿ (30 - 60 บาท)</option>
                <option value="฿฿">฿฿ (60 - 120 บาท)</option>
                <option value="฿฿฿">฿฿฿ (120+ บาท)</option>
              </select>
            </div>
          </div>
        </div>

        {/* กลุ่มข้อมูลที่ 3: เมนูเด่นชุดแรก (Initial Signature Menus) */}
        <div className="bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h2 className="text-base font-bold text-stone-900 dark:text-white">
                  กลุ่มข้อมูลที่ 3: เมนูอาหารเด่นชุดแรกของร้าน (เริ่มต้น 1-2 เมนู)
                </h2>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  เพื่อให้ร้านค้าพร้อมเปิดรับออเดอร์ได้ทันทีหลังจากกดยืนยันสร้างร้าน
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* เมนูที่ 1 */}
            <div className="p-4 rounded-2xl bg-orange-50/50 dark:bg-zinc-950 border border-orange-200/70 dark:border-zinc-800 space-y-3">
              <span className="text-xs font-bold text-orange-800 dark:text-orange-400 flex items-center gap-1.5">
                <ChefHat className="w-4 h-4" />
                <span>เมนูหลักที่ 1 (ซิกเนเจอร์ยอดนิยม) *</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                    ชื่อเมนูอาหาร
                  </label>
                  <input
                    type="text"
                    required
                    value={initialMenu1Name}
                    onChange={e => setInitialMenu1Name(e.target.value)}
                    placeholder="เช่น ข้าวกะเพราหมูกรอบไข่ดาว"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                    ราคาขาย (บาท)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={initialMenu1Price}
                    onChange={e => setInitialMenu1Price(e.target.value)}
                    placeholder="60"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
                  />
                </div>
              </div>

              {/* อัปโหลดรูปภาพเมนู 1 */}
              <div className="pt-2 border-t border-orange-200/50 dark:border-zinc-800">
                <ImageUploader
                  value={initialMenu1Image}
                  onChange={setInitialMenu1Image}
                  label="รูปภาพเมนูหลักที่ 1 (อัปโหลดจากเครื่องได้)"
                  helperText="ภาพอาหารที่น่าทานช่วยเพิ่มยอดขายได้มากถึง 40%"
                  aspectRatio="square"
                  presets={[
                    { label: 'ข้าวกะเพรา', url: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80' },
                    { label: 'ข้าวผัดทะเล', url: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=600&auto=format&fit=crop&q=80' },
                    { label: 'ก๋วยเตี๋ยวต้มยำ', url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80' }
                  ]}
                  allowUrlInput={true}
                />
              </div>
            </div>

            {/* เมนูที่ 2 (ตัวเลือกเปิด/ปิด) */}
            {enableMenu2 ? (
              <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-zinc-950 border border-amber-200/70 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5">
                    <ChefHat className="w-4 h-4" />
                    <span>เมนูที่ 2 (เครื่องดื่ม / เมนูเสริม)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEnableMenu2(false)}
                    className="text-stone-400 hover:text-red-500 p-1 cursor-pointer"
                    title="ลบเมนูที่ 2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                      ชื่อเมนู
                    </label>
                    <input
                      type="text"
                      value={initialMenu2Name}
                      onChange={e => setInitialMenu2Name(e.target.value)}
                      placeholder="เช่น ชาไทยปักษ์ใต้สูตรเข้มข้น"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 dark:text-zinc-400 mb-1">
                      ราคาขาย (บาท)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={initialMenu2Price}
                      onChange={e => setInitialMenu2Price(e.target.value)}
                      placeholder="35"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-900 dark:border-zinc-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* อัปโหลดรูปภาพเมนู 2 */}
                <div className="pt-2 border-t border-amber-200/50 dark:border-zinc-800">
                  <ImageUploader
                    value={initialMenu2Image}
                    onChange={setInitialMenu2Image}
                    label="รูปภาพเมนูที่ 2 (อัปโหลดจากเครื่องได้)"
                    helperText="รูปภาพแก้วเครื่องดื่มหรือของหวาน"
                    aspectRatio="square"
                    presets={[
                      { label: 'ชาไทยเย็น', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80' },
                      { label: 'กาแฟเย็น', url: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?w=600&auto=format&fit=crop&q=80' },
                      { label: 'น้ำส้มคั้นสด', url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?w=600&auto=format&fit=crop&q=80' }
                    ]}
                    allowUrlInput={true}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEnableMenu2(true)}
                className="w-full py-2.5 rounded-xl border border-dashed border-stone-300 hover:border-orange-400 text-stone-600 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มเมนูเริ่มต้นรายการที่ 2</span>
              </button>
            )}
          </div>
        </div>

        {/* กลุ่มข้อมูลที่ 4: การเงินและการเชื่อมต่อบัญชียูสเซอร์ (Account & Payment Association) */}
        <div className="bg-white dark:bg-zinc-900 border border-orange-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-stone-100 dark:border-zinc-800">
            <div className="w-9 h-9 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
              4
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">
                กลุ่มข้อมูลที่ 4: เชื่อมต่อบัญชีผู้ใช้ & บัญชีรับเงิน
              </h2>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                ผูกสิทธิ์แอดมินของร้านค้าเข้ากับ User ID ปัจจุบัน และระบุหมายเลขรับเงิน
              </p>
            </div>
          </div>

          {/* User ID Association Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 flex items-start gap-3.5">
            <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-emerald-900 dark:text-emerald-200">
              <span className="font-bold block">
                การเชื่อมต่อบัญชีผู้ดูแลร้านค้า (Connected User Identity)
              </span>
              <p className="leading-relaxed text-[11px]">
                ร้านค้านี้จะถูกผูกเข้ากับ <strong>User ID: {ownerId}</strong> ({ownerName}) โดยตรง เมื่อสร้างเสร็จแล้ว ปุ่มบนแถบนำทางจะเปลี่ยนเป็นรูปและชื่อร้านของคุณทันที
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                ชื่อผู้ดูแล / ผู้ประกอบการ
              </label>
              <input
                type="text"
                required
                value={ownerName}
                onChange={e => setOwnerName(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
                เบอร์โทรศัพท์สำหรับร้านค้า / ติดต่อด่วน
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-zinc-300 mb-1.5">
              หมายเลขพร้อมเพย์สำหรับรับเงินจากลูกค้า (PromptPay ID)
            </label>
            <div className="relative">
              <CreditCard className="w-4 h-4 absolute left-3 top-3 text-emerald-600" />
              <input
                type="text"
                required
                value={promptPayNumber}
                onChange={e => setPromptPayNumber(e.target.value)}
                placeholder="เบอร์โทรศัพท์ หรือ หมายเลขบัตรประชาชน 13 หลัก"
                className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-zinc-950 dark:border-zinc-700 dark:text-white font-mono"
              />
            </div>
            <p className="text-[10px] text-stone-500 dark:text-zinc-400 mt-1">
              ระบบจะสร้าง QR Code พร้อมเพย์ให้ลูกค้าสแกนจ่ายเงินและโอนเข้าบัญชีนี้โดยตรง
            </p>
          </div>
        </div>

        {/* Submit Button Section */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 bg-orange-50/60 dark:bg-zinc-900/60 p-5 rounded-3xl border border-orange-200/80 dark:border-zinc-800">
          <div className="text-xs text-stone-600 dark:text-zinc-400">
            เมื่อคลิกยืนยัน ระบบจะเปิดแผงควบคุมแอดมินเฉพาะร้านค้า และเปลี่ยนปุ่มนำทางเป็นรูปร้านค้าของคุณทันที
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCurrentView('home')}
              className="flex-1 sm:flex-none px-5 py-3 text-xs font-bold rounded-2xl border border-stone-300 hover:bg-stone-100 text-stone-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 sm:flex-none px-7 py-3 text-xs font-bold rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>ยืนยันสร้างร้านค้าและเปิดแผงควบคุม</span>
            </button>
          </div>
        </div>
      </form>

      {/* ป๊อปอัพจุดเริ่มต้นการสร้างร้านค้า (Onboarding Guidance Popup) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-orange-200 dark:border-zinc-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 relative">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-zinc-800 dark:hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md">
                <StoreIcon className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">
                  Welcome to Merchant Onboarding
                </span>
                <h3 className="text-lg font-black text-stone-900 dark:text-white">
                  จุดเริ่มต้นการสร้างร้านค้า QueueUp
                </h3>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-zinc-300 leading-relaxed">
              ยินดีต้อนรับเข้าสู่ระบบสร้างร้านค้า การเปิดร้านในระบบ QueueUp มี 4 ขั้นตอนง่ายๆ ที่เตรียมไว้ให้คุณกรอกในหน้านี้:
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-orange-50/70 dark:bg-zinc-950 border border-orange-100 dark:border-zinc-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <div className="text-xs">
                  <strong className="text-stone-900 dark:text-white">กำหนดชื่อและอัตลักษณ์ร้านค้า:</strong>
                  <p className="text-stone-500 dark:text-zinc-400 text-[11px]">
                    ใส่ชื่อร้านค้าและเลือกรูปโลโก้ ซึ่งจะนำไปเป็นปุ่มเปิดแอดมินที่แถบด้านบน
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-orange-50/70 dark:bg-zinc-950 border border-orange-100 dark:border-zinc-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <div className="text-xs">
                  <strong className="text-stone-900 dark:text-white">เวลาเปิด-ปิดและการรอคิว:</strong>
                  <p className="text-stone-500 dark:text-zinc-400 text-[11px]">
                    ระบุเวลาเปิดบริการและเวลารอเฉลี่ยเพื่อคำนวณคิวอัตโนมัติ
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-orange-50/70 dark:bg-zinc-950 border border-orange-100 dark:border-zinc-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="text-xs">
                  <strong className="text-stone-900 dark:text-white">สร้างเมนูเด่น 1-2 จานแรก:</strong>
                  <p className="text-stone-500 dark:text-zinc-400 text-[11px]">
                    เปิดร้านพร้อมมีเมนูอาหารให้ลูกค้ากดสั่งได้ทันที
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-orange-50/70 dark:bg-zinc-950 border border-orange-100 dark:border-zinc-800">
                <span className="w-6 h-6 rounded-lg bg-orange-500 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  4
                </span>
                <div className="text-xs">
                  <strong className="text-stone-900 dark:text-white">เชื่อมโยง User ID และระบบซัพพอร์ต:</strong>
                  <p className="text-stone-500 dark:text-zinc-400 text-[11px]">
                    ผูกกับ User ID: {ownerId} พร้อมระบบซัพพอร์ตร้านค้าเฉพาะคุณ
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 text-xs font-bold rounded-2xl bg-orange-600 hover:bg-orange-700 text-white shadow-md active:scale-95 transition-all cursor-pointer"
            >
              เข้าใจแล้ว เริ่มกรอกข้อมูลสร้างร้านค้าทันที
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
