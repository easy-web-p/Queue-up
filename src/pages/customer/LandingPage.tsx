import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { Button } from '../../components/ui/Button';
import {
  Layers,
  ArrowRight,
  Sparkles,
  Clock,
  ShieldCheck,
  ChefHat,
  CheckCircle2,
  Phone,
  Mail,
  MapPin,
  Send,
  ShoppingBag,
  TrendingUp,
  CreditCard,
  QrCode,
  ShieldAlert,
  Quote,
  Zap,
  UserPlus,
  Lock,
  LogIn,
  School as SchoolIcon,
  FileSpreadsheet
} from 'lucide-react';
import { analyzeAndShieldInput } from '../../services/engines/securityShield';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { setCurrentView, setRole, addToast, setIsRegisterModalOpen, currentUser } = useQueue();

  // Interactive Developer Contact Form State
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    topic: 'partnership',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) {
      addToast('ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อ อีเมล และข้อความให้ครบ', 'warning');
      return;
    }

    // Security check on message
    const shieldCheck = analyzeAndShieldInput(contactForm.message, 1000);
    if (!shieldCheck.isSafe) {
      addToast('ข้อความไม่ผ่านการตรวจสอบ', shieldCheck.errorMessage, 'error');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setContactSuccess(true);
      addToast('ส่งข้อความสำเร็จ', 'ทีมวิศวกรผู้พัฒนาได้รับข้อความเรียบร้อยแล้วและจะติดต่อกลับโดยเร็ว', 'success');
      setContactForm({
        name: '',
        email: '',
        phone: '',
        topic: 'partnership',
        message: ''
      });
    }, 600);
  };

  return (
    <div className="flex flex-col gap-16 sm:gap-24 pb-20 text-stone-900 dark:text-zinc-100 transition-colors">
      {/* 1. HERO SECTION */}
      <section className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-50 via-amber-50/60 to-red-50/40 border border-orange-200/90 p-6 sm:p-12 lg:p-16 shadow-xl dark:bg-gradient-to-b dark:from-black dark:via-[#09090b] dark:to-black dark:border-zinc-800 dark:shadow-2xl">
        {/* Ambient Glows */}
        <div className="absolute top-0 right-1/4 -mt-20 w-96 h-96 bg-orange-400/15 rounded-full blur-3xl pointer-events-none dark:bg-orange-500/10" />
        <div className="absolute bottom-0 left-10 -mb-20 w-80 h-80 bg-amber-400/20 rounded-full blur-3xl pointer-events-none dark:bg-yellow-500/10" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left Column: Headlines & Call to action */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 border border-orange-300 text-orange-800 text-xs font-bold w-fit dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-400">
                <Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                <span>Smart Food Court & Campus Queue Platform</span>
              </div>

              {!currentUser && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/90 border border-amber-300 text-amber-900 text-xs font-semibold dark:bg-amber-950/40 dark:border-amber-700/60 dark:text-amber-300">
                  <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>ระบบล็อกสิทธิ์: เข้าสู่ระบบเพื่อเริ่มใช้งาน</span>
                </div>
              )}
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-stone-900 tracking-tight leading-[1.15] dark:text-zinc-100">
              บอกลาการยืนรอคิว <br />
              สั่งอาหารล่วงหน้า <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 via-amber-500 to-red-600 dark:from-orange-400 dark:via-yellow-400 dark:to-red-400">
                รับตรงเวลาด้วย QueueUp
              </span>
            </h1>

            <p className="text-sm sm:text-base text-stone-700 leading-relaxed max-w-xl dark:text-zinc-300">
              นวัตกรรมระบบจัดการคิวดิจิทัลและการสั่งอาหารแบบเรียลไทม์ เชื่อมโยงลูกค้าเข้ากับจอครัว KDS ของร้านค้าในโรงอาหารอย่างแม่นยำ พร้อมระบบสแกนสารก่อภูมิแพ้อัตโนมัติและการชำระเงินไร้สัมผัส
            </p>

            {/* Quick Highlights in Hero */}
            <div className="flex flex-wrap items-center gap-5 sm:gap-6 py-3 border-y border-orange-200/80 text-xs text-stone-700 dark:border-zinc-800 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>ลดเวลาแออัดเฉลี่ย <strong className="text-stone-900 dark:text-zinc-100 font-bold">18 นาที</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-yellow-400" />
                <span>แม่นยำด้วย <strong className="text-stone-900 dark:text-zinc-100 font-bold">PromptPay QR</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span>ปลอดภัยด้วย <strong className="text-stone-900 dark:text-zinc-100 font-bold">Allergen Guard</strong></span>
              </div>
            </div>

            {/* Buttons Group */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                size="lg"
                variant="primary"
                onClick={() => {
                  if (!currentUser) {
                    setIsRegisterModalOpen(true);
                  } else {
                    setRole('customer');
                    setCurrentView('home');
                  }
                }}
                className="px-8 py-3.5 text-sm font-black shadow-lg shadow-orange-500/25 flex items-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                <span>{currentUser ? `เข้าสู่หน้าหลัก (${currentUser.fullName.split(' ')[0]})` : 'เข้าสู่ระบบ / สมัครสมาชิก'}</span>
              </Button>

              <button
                onClick={() => {
                  const elem = document.getElementById('contact-developer');
                  elem?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-orange-600 dark:text-zinc-400 dark:hover:text-orange-400 transition-colors cursor-pointer"
              >
                ติดต่อผู้พัฒนา & องค์กร ↓
              </button>
            </div>
          </div>

          {/* Right Column: Live Mockup Interactive Card */}
          <div className="lg:col-span-5 relative">
            <div className="rounded-3xl bg-white border border-orange-200/90 p-5 sm:p-6 shadow-xl backdrop-blur-xl relative dark:bg-[#09090b] dark:border-zinc-800">
              <div className="flex items-center justify-between border-b border-orange-100 pb-4 mb-4 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-xs">
                    <Layers className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-stone-900 dark:text-zinc-200">บัตรคิวดิจิทัล (Live Ticket)</span>
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">อัปเดตสถานะแบบ Real-time</p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40">
                  กำลังปรุง (Cooking)
                </span>
              </div>

              {/* Ticket Hero Number */}
              <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 text-center space-y-1 mb-4 dark:bg-black dark:border-zinc-800">
                <span className="text-[11px] text-stone-600 dark:text-zinc-400 font-medium">หมายเลขคิวของคุณ</span>
                <div className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-orange-600 dark:text-yellow-400">
                  A08
                </div>
                <div className="text-xs text-stone-700 dark:text-zinc-300 flex items-center justify-center gap-1.5 pt-1">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-orange-400" />
                  <span>เวลารับโดยประมาณ: <strong className="text-orange-700 dark:text-orange-400">12:20 น. (~8 นาที)</strong></span>
                </div>
              </div>

              {/* Sample Food Item with Allergen Badge */}
              <div className="p-3 rounded-xl bg-orange-50/50 border border-orange-100 flex items-center justify-between text-xs mb-3 dark:bg-zinc-900/60 dark:border-zinc-800">
                <div className="flex items-center gap-2.5">
                  <img
                    src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=120&auto=format&fit=crop&q=80"
                    alt="ข้าวกะเพราหมูกรอบ"
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                  <div>
                    <div className="font-bold text-stone-900 dark:text-zinc-100">ข้าวกะเพราหมูกรอบไข่ดาว</div>
                    <div className="text-[10px] text-stone-500 dark:text-zinc-400">ร้านป้าสมใจ อาหารตามสั่ง</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-red-600 dark:text-red-400">฿65</div>
                  <span className="text-[9px] text-orange-800 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-300 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40">
                    ชำระแล้ว
                  </span>
                </div>
              </div>

              {/* Security & Allergen Guard Banner */}
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-2 dark:bg-zinc-950 dark:border-zinc-800 dark:text-amber-300">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600 dark:text-yellow-400" />
                <span>Allergen Guard: ตรวจสอบแล้ว ปราศจากสารก่อภูมิแพ้ที่ท่านระบุ</span>
              </div>

              {/* Quick direct launch to menu */}
              <Button
                variant="primary"
                onClick={() => {
                  if (!currentUser) {
                    setIsRegisterModalOpen(true);
                  } else {
                    setRole('customer');
                    setCurrentView('home');
                  }
                }}
                className="w-full mt-4 text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{currentUser ? 'เปิดหน้าร้านและสั่งอาหาร' : 'เข้าสู่ระบบ / สมัครสมาชิก'}</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS (ขั้นตอนการใช้งานเว็บไซต์ 4 สเต็ป) */}
      <section className="flex flex-col gap-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">
            Simple & Effortless Flow
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight dark:text-zinc-100">
            ขั้นตอนการสั่งอาหารและจองคิว 4 สเต็ป
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed dark:text-zinc-400">
            เชื่อมต่อประสบการณ์ตั้งแต่ปลายนิ้วคุณจนถึงจานอาหารร้อนๆ จากกระทะของแม่ครัว
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Step 1 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-orange-400 transition-all flex flex-col gap-4 shadow-sm dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-700 font-mono font-black text-lg dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-400">
              01
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 mb-1">เลือกร้านและเมนู</h3>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                ดูรายการอาหาร รูปภาพ ราคา และสถานะสต็อกแบบเรียลไทม์จากร้านค้าพาร์ทเนอร์ในโรงอาหาร
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-orange-400 transition-all flex flex-col gap-4 shadow-sm dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 font-mono font-black text-lg dark:bg-yellow-500/15 dark:border-yellow-500/30 dark:text-yellow-400">
              02
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 mb-1">ปรับแต่ง & สแกนภูมิแพ้</h3>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                เลือกระดับความเผ็ด เพิ่มท็อปปิ้ง และมี Allergen Guard ตรวจสอบความเสี่ยงแพ้อาหารให้อัตโนมัติ
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-orange-400 transition-all flex flex-col gap-4 shadow-sm dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-300 flex items-center justify-center text-red-700 font-mono font-black text-lg dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-400">
              03
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 mb-1">ชำระเงินไร้สัมผัส</h3>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                สแกนจ่ายผ่านพร้อมเพย์ QR Code หรือเลือกชำระเงินสดหน้าร้าน คำนวณส่วนลดแม่นยำระดับสตางค์
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-orange-400 transition-all flex flex-col gap-4 shadow-sm dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-12 h-12 rounded-2xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-700 font-mono font-black text-lg dark:bg-cyan-500/15 dark:border-cyan-500/30 dark:text-cyan-400">
              04
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100 mb-1">รับอาหารตรงรอบคิว</h3>
              <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
                ติดตามบัตรคิวดิจิทัล เมื่อหน้าจอขึ้นสถานะ "พร้อมรับ" จึงค่อยเดินไปรับอาหาร ไม่ต้องยืนรอนาน
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CORE FEATURES & SALES CAPABILITIES (ฟังก์ชันการขายและจุดเด่นระบบ) */}
      <section className="flex flex-col gap-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">
            Enterprise & Campus Ready
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight dark:text-zinc-100">
            ฟังก์ชันการขายและเทคโนโลยีเบื้องหลัง
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed dark:text-zinc-400">
            ระบบที่ถูกออกแบบมาเพื่อรองรับชั่วโมงเร่งด่วน พักเที่ยง และการจัดการที่ราบรื่น
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-orange-400 transition-all flex flex-col gap-3 group shadow-xs dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-11 h-11 rounded-2xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-700 group-hover:scale-110 transition-transform dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-400">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Smart Slot Allocation</h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              จัดการช่วงเวลาสั่งซื้อแบบบล็อก 15 นาที คำนวณเวลาการปรุงจริงตามจำนวนจานและคิวก่อนหน้า ป้องกันครัว Overload ในช่วงพักเที่ยง
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-red-400 transition-all flex flex-col gap-3 group shadow-xs dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-11 h-11 rounded-2xl bg-red-100 border border-red-300 flex items-center justify-center text-red-700 group-hover:scale-110 transition-transform dark:bg-red-500/20 dark:border-red-500/40 dark:text-red-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Authoritative Allergen Guard</h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              สแกนตรวจสอบส่วนผสมอาหาร 5 กลุ่มเสี่ยง (อาหารทะเล, ถั่วลิสง, นม, กลูเตน, ไข่) เปรียบเทียบกับโปรไฟล์ผู้ใช้อัตโนมัติ ปกป้องสุขภาพของผู้ทาน
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-amber-400 transition-all flex flex-col gap-3 group shadow-xs dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 group-hover:scale-110 transition-transform dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-yellow-400">
              <ChefHat className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Kitchen Display System (KDS)</h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              จอครัวอัจฉริยะสำหรับแม่ครัว อัปเดตคิวแบบ Kanban แยกหมวดหมู่เตา พร้อมปุ่มปิดเมนูที่วัตถุดิบหมดได้ทันทีแบบเรียลไทม์
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-orange-400 transition-all flex flex-col gap-3 group shadow-xs dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-11 h-11 rounded-2xl bg-orange-100 border border-orange-300 flex items-center justify-center text-orange-700 group-hover:scale-110 transition-transform dark:bg-orange-500/20 dark:border-orange-500/40 dark:text-orange-400">
              <QrCode className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Satang-Precision Cashless</h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              รองรับระบบชำระเงินดิจิทัลผ่านพร้อมเพย์ QR Code และบัตรเครดิต ตรวจสอบความถูกต้องแม่นยำระดับสตางค์ ลดปัญหาเงินทอนผิดพลาด
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-red-400 transition-all flex flex-col gap-3 group shadow-xs dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-11 h-11 rounded-2xl bg-red-100 border border-red-300 flex items-center justify-center text-red-700 group-hover:scale-110 transition-transform dark:bg-cyan-500/20 dark:border-cyan-500/40 dark:text-cyan-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Cyber Threat Security Shield</h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              ระบบตรวจสอบและป้องกันภัยไซเบอร์ กรองโค้ดอันตราย (Anti-XSS), Prompt Injection ในช่องหมายเหตุ และ NoSQL Injection ตามมาตรฐานความปลอดภัย
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-6 rounded-3xl bg-white border border-orange-200/90 hover:border-amber-400 transition-all flex flex-col gap-3 group shadow-xs dark:bg-[#09090b] dark:border-zinc-800 dark:hover:border-zinc-700">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 group-hover:scale-110 transition-transform dark:bg-yellow-500/20 dark:border-yellow-500/40 dark:text-yellow-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">Merchant Data Access & Audit</h3>
            <p className="text-xs text-stone-600 dark:text-zinc-400 leading-relaxed">
              ระบบบันทึกประวัติการทำรายการร้านค้า (Immutable Audit Log) ตรวจสอบความโปร่งใส สรุปยอดขาย และสถิติความเร็วในการปรุงอาหาร
            </p>
          </div>
        </div>
      </section>

      {/* 4. LIVE METRICS & SOCIAL PROOF (ยอดผู้ใช้งานและสถิติความสำเร็จ) */}
      <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-orange-50 via-amber-50 to-red-50 border border-orange-200/90 relative overflow-hidden dark:bg-gradient-to-r dark:from-black dark:via-[#09090b] dark:to-black dark:border-zinc-800">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">
              Proven Track Record
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight dark:text-zinc-100">
              ตัวเลขความสำเร็จและยอดผู้ใช้งาน
            </h2>
            <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400">
              ประสิทธิภาพที่ได้รับการพิสูจน์แล้วจากศูนย์อาหารและโรงอาหารมหาวิทยาลัย
            </p>
          </div>

          {/* 4 Major Metrics Counters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div className="p-4 rounded-2xl bg-white border border-orange-200/90 shadow-xs dark:bg-black/60 dark:border-zinc-800">
              <div className="text-3xl sm:text-4xl font-black text-orange-600 font-mono dark:text-orange-400">15,400+</div>
              <div className="text-xs font-bold text-stone-900 mt-1 dark:text-zinc-200">ผู้ใช้งานประจำ</div>
              <p className="text-[10px] text-stone-500 mt-0.5 dark:text-zinc-400">นักศึกษาและบุคลากร</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-orange-200/90 shadow-xs dark:bg-black/60 dark:border-zinc-800">
              <div className="text-3xl sm:text-4xl font-black text-red-600 font-mono dark:text-red-400">128,500+</div>
              <div className="text-xs font-bold text-stone-900 mt-1 dark:text-zinc-200">คิวอาหารสำเร็จ</div>
              <p className="text-[10px] text-stone-500 mt-0.5 dark:text-zinc-400">ส่งมอบตรงเวลา</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-orange-200/90 shadow-xs dark:bg-black/60 dark:border-zinc-800">
              <div className="text-3xl sm:text-4xl font-black text-amber-600 font-mono dark:text-yellow-400">48+</div>
              <div className="text-xs font-bold text-stone-900 mt-1 dark:text-zinc-200">ร้านค้าในเครือข่าย</div>
              <p className="text-[10px] text-stone-500 mt-0.5 dark:text-zinc-400">ร้านอาหาร & เครื่องดื่ม</p>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-orange-200/90 shadow-xs dark:bg-black/60 dark:border-zinc-800">
              <div className="text-3xl sm:text-4xl font-black text-orange-700 font-mono dark:text-cyan-400">99.8%</div>
              <div className="text-xs font-bold text-stone-900 mt-1 dark:text-zinc-200">ความพึงพอใจ</div>
              <p className="text-[10px] text-stone-500 mt-0.5 dark:text-zinc-400">สำรวจจากผู้ใช้จริง</p>
            </div>
          </div>

          {/* User Testimonial Quotes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
            <div className="p-5 rounded-2xl bg-white/80 border border-orange-200/80 flex flex-col justify-between gap-3 shadow-xs dark:bg-black/40 dark:border-zinc-800">
              <Quote className="w-5 h-5 text-orange-600 dark:text-orange-400 opacity-75" />
              <p className="text-xs text-stone-700 italic leading-relaxed dark:text-zinc-300">
                "แต่ก่อนช่วงพักเที่ยงต้องรีบวิ่งมาจองโต๊ะและยืนรอคิวข้าวกว่า 20 นาที ตอนนี้กดสั่งล่วงหน้าตั้งแต่ตอนกำลังเดินมา พอมาถึงโรงอาหารอาหารก็สุกพอดี สะดวกมากครับ"
              </p>
              <div className="flex items-center gap-2 pt-1 border-t border-orange-100 dark:border-zinc-800 text-[11px]">
                <div className="w-6 h-6 rounded-full bg-orange-100 text-orange-800 font-bold flex items-center justify-center text-[10px] dark:bg-orange-500/20 dark:text-orange-400">
                  ธ
                </div>
                <div>
                  <span className="font-bold text-stone-900 dark:text-zinc-200">ธนกฤต วิศวกรรมศาสตร์ ปี 3</span>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-400">ผู้ใช้งานประจำ</span>
                </div>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/80 border border-orange-200/80 flex flex-col justify-between gap-3 shadow-xs dark:bg-black/40 dark:border-zinc-800">
              <Quote className="w-5 h-5 text-amber-600 dark:text-yellow-400 opacity-75" />
              <p className="text-xs text-stone-700 italic leading-relaxed dark:text-zinc-300">
                "ระบบจอครัว KDS ช่วยร้านได้เยอะมาก ไม่ต้องตะโกนเรียกคิวอีกต่อไป ลูกค้าดูผ่านมือถือแล้วมารับเอง ยอดขายเพิ่มขึ้น 30% เพราะทำอาหารได้ต่อเนื่อง"
              </p>
              <div className="flex items-center gap-2 pt-1 border-t border-orange-100 dark:border-zinc-800 text-[11px]">
                <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[10px] dark:bg-amber-500/20 dark:text-yellow-400">
                  ป
                </div>
                <div>
                  <span className="font-bold text-stone-900 dark:text-zinc-200">ป้าสมใจ (ร้านอาหารตามสั่ง บูธ 4)</span>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-400">ร้านค้าพาร์ทเนอร์</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. DEVELOPER CONTACT & INQUIRY FORM (ข้อมูลติดต่อผู้พัฒนา) */}
      <section id="contact-developer" className="scroll-mt-20 flex flex-col gap-8">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">
            Contact & Partnership
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight dark:text-zinc-100">
            ข้อมูลติดต่อทีมวิศวกรผู้พัฒนา (Developer Contact)
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 leading-relaxed dark:text-zinc-400">
            สนใจนำระบบ QueueUp ไปติดตั้งในโรงอาหาร มหาวิทยาลัย อาคารสำนักงาน หรือเสนอแนะการพัฒนา ติดต่อเราได้ตลอดเวลา
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Developer Details Card */}
          <div className="lg:col-span-5 p-6 sm:p-8 rounded-3xl bg-white border border-orange-200/90 space-y-6 shadow-sm dark:bg-[#09090b] dark:border-zinc-800">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-orange-100 text-orange-800 text-[11px] font-bold mb-2 dark:bg-orange-500/15 dark:text-orange-400">
                <Layers className="w-3.5 h-3.5" />
                <span>QueueUp Core Engineering Lab</span>
              </div>
              <h3 className="text-lg font-bold text-stone-900 dark:text-zinc-100">ศูนย์พัฒนานวัตกรรมระบบดิจิทัล</h3>
              <p className="text-xs text-stone-600 mt-1 leading-relaxed dark:text-zinc-400">
                ทีมวิศวกรซอฟต์แวร์ผู้พัฒนาระบบคิวและการประมวลผลคำสั่งซื้อแบบ High-Concurrency รองรับการเติบโตระดับวิทยาเขต
              </p>
            </div>

            <div className="space-y-4 text-xs text-stone-700 dark:text-zinc-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0 dark:bg-zinc-900 dark:text-orange-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">อีเมลฝ่ายพัฒนาและสนับสนุน</span>
                  <a href="mailto:dev@queueup-smartcampus.io" className="font-semibold text-stone-900 hover:text-orange-600 transition-colors dark:text-zinc-200 dark:hover:text-orange-400">
                    dev@queueup-smartcampus.io
                  </a>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">support@queueup.app</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0 dark:bg-zinc-900 dark:text-yellow-400">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">เบอร์โทรศัพท์ติดต่อสอบถาม</span>
                  <span className="font-semibold text-stone-900 dark:text-zinc-200">02-555-QUEUE (02-555-7838)</span>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">สายด่วนร้านค้า: 089-123-4567</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0 dark:bg-zinc-900 dark:text-red-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">ที่อยู่ห้องปฏิบัติการ</span>
                  <span className="font-semibold text-stone-900 dark:text-zinc-200">
                    ชั้น 4 อาคารนวัตกรรมดิจิทัล ศูนย์อาหารกลาง มหาวิทยาลัย
                  </span>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">กรุงเทพมหานคร 10400</span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 shrink-0 dark:bg-zinc-900 dark:text-cyan-400">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">เวลาทำการประสานงาน</span>
                  <span className="font-semibold text-stone-900 dark:text-zinc-200">จันทร์ - ศุกร์ 08:30 - 18:00 น.</span>
                  <span className="text-stone-500 block text-[10px] dark:text-zinc-500">ระบบ Cloud KDS ทำงาน 24/7</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-orange-200/80 text-[11px] text-stone-600 flex items-center justify-between dark:border-zinc-800 dark:text-zinc-400">
              <span>เวอร์ชันระบบ: v2.4.0 (Enterprise)</span>
              <span className="text-orange-600 font-bold flex items-center gap-1 dark:text-orange-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse dark:bg-orange-400" /> Cloud Online
              </span>
            </div>
          </div>

          {/* Interactive Message Form */}
          <div className="lg:col-span-7 p-6 sm:p-8 rounded-3xl bg-white border border-orange-200/90 shadow-sm dark:bg-[#09090b] dark:border-zinc-800">
            <h3 className="text-base font-bold text-stone-900 mb-1 dark:text-zinc-100">
              ส่งข้อความติดต่อทีมพัฒนา (Send Inquiry)
            </h3>
            <p className="text-xs text-stone-600 mb-5 dark:text-zinc-400">
              กรอกข้อมูลด้านล่างเพื่อติดต่อทีมงานเรื่องความร่วมมือ การติดตั้ง หรือสอบถามข้อสงสัย
            </p>

            {contactSuccess && (
              <div className="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 text-xs mb-4 flex items-center gap-3 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-300">
                <CheckCircle2 className="w-5 h-5 text-orange-600 shrink-0 dark:text-orange-400" />
                <div>
                  <div className="font-bold">ส่งข้อมูลถึงผู้พัฒนาเรียบร้อยแล้ว</div>
                  <div className="text-[11px] text-orange-700 dark:text-orange-400/90">ทีมงานจะตอบกลับผ่านอีเมลที่ท่านระบุภายใน 24 ชั่วโมงทำการ</div>
                </div>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-800 font-medium mb-1 dark:text-zinc-300">ชื่อผู้ติดต่อ *</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={e => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="เช่น อาจารย์ประสิทธิ์ / คุณสมชาย"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-orange-50/40 border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-stone-800 font-medium mb-1 dark:text-zinc-300">อีเมลติดต่อกลับ *</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={e => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="yourname@organization.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-orange-50/40 border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-stone-800 font-medium mb-1 dark:text-zinc-300">เบอร์โทรศัพท์ (ถ้าสะดวก)</label>
                  <input
                    type="tel"
                    value={contactForm.phone}
                    onChange={e => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="08x-xxx-xxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-orange-50/40 border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="block text-stone-800 font-medium mb-1 dark:text-zinc-300">หัวข้อการติดต่อ</label>
                  <select
                    value={contactForm.topic}
                    onChange={e => setContactForm(prev => ({ ...prev, topic: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-orange-50/40 border border-orange-200 text-stone-800 focus:outline-none focus:border-orange-500 transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-200"
                  >
                    <option value="partnership">สนใจติดตั้งระบบในโรงอาหาร / ศูนย์อาหาร</option>
                    <option value="merchant">ต้องการสมัครเป็นร้านค้าพาร์ทเนอร์</option>
                    <option value="api">สอบถามการเชื่อมต่อ API / มหาวิทยาลัย</option>
                    <option value="bug">รายงานปัญหาหรือข้อเสนอแนะทางเทคนิค</option>
                    <option value="other">เรื่องอื่นๆ</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-stone-800 font-medium mb-1 dark:text-zinc-300">ข้อความรายละเอียด *</label>
                <textarea
                  rows={4}
                  value={contactForm.message}
                  onChange={e => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="ระบุรายละเอียด เช่น ขนาดโรงอาหาร จำนวนร้านค้า หรือข้อสงสัยที่ต้องการให้ทีมพัฒนาช่วยตอบ..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-orange-50/40 border border-orange-200 text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-orange-500 resize-none transition-colors dark:bg-black dark:border-zinc-800 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-stone-500 dark:text-zinc-500">
                  ข้อมูลจะถูกส่งเข้าสู่ระบบ Support Ticket ของทีมพัฒนาโดยตรง
                </span>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 flex items-center gap-2 font-bold"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'กำลังส่งข้อมูล...' : 'ส่งข้อความถึงผู้พัฒนา'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 5.5 SCHOOL PARTNERSHIP CALLOUT (สำหรับสถานศึกษาที่สนใจเข้าร่วมโครงการ) */}
      <section className="p-8 sm:p-10 rounded-3xl bg-white dark:bg-zinc-950 border-2 border-orange-300/80 dark:border-zinc-800 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-orange-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-4 text-left">
            <div className="w-14 h-14 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 shadow-xs">
              <SchoolIcon className="w-7 h-7 stroke-[2.2]" />
            </div>

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-400">
                <span>สำหรับโรงเรียนและสถาบันการศึกษา</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                🏫 โรงเรียนต้องการเข้าร่วมโครงการ?
              </h3>
              <p className="text-xs sm:text-sm text-stone-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                สมัครเข้าร่วมโครงการกับ <strong>QueueUp</strong> เพื่อเปิดใช้งานระบบจัดการคิวและสั่งอาหารดิจิทัลล่วงหน้า พร้อมจอครัว KDS สำหรับโรงเรียนของคุณ รองรับการนำเข้าสมาชิกผ่าน Excel
              </p>
            </div>
          </div>

          <div className="shrink-0 w-full md:w-auto">
            <button
              onClick={() => navigate('/register-school')}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-full text-sm font-black bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <span>สมัครเข้าร่วมโครงการ</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. BOTTOM PROMO BANNER CTA */}
      <section className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 text-white text-center space-y-6 shadow-xl dark:bg-gradient-to-r dark:from-zinc-950 dark:via-black dark:to-zinc-950 dark:border dark:border-zinc-800">
        <div className="max-w-2xl mx-auto space-y-3">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white dark:text-zinc-100">
            พร้อมสัมผัสประสบการณ์โรงอาหารไร้คิวแล้วหรือยัง?
          </h2>
          <p className="text-xs sm:text-sm text-orange-100 leading-relaxed dark:text-zinc-400">
            เริ่มต้นใช้งานได้ทันทีทั้งบนสมาร์ทโฟน แท็บเล็ต และคอมพิวเตอร์ โดยไม่ต้องดาวน์โหลดแอปพลิเคชัน
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button
            size="lg"
            variant="secondary"
            onClick={() => {
              if (!currentUser) {
                setIsRegisterModalOpen(true);
              } else {
                setRole('customer');
                setCurrentView('home');
              }
            }}
            className="px-8 py-3.5 font-black text-stone-950 bg-white hover:bg-orange-50 text-sm shadow-lg dark:bg-gradient-to-r dark:from-orange-500 dark:to-amber-400 dark:text-black flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{currentUser ? `เข้าสู่หน้าสั่งอาหาร (${currentUser.fullName.split(' ')[0]})` : 'เข้าสู่ระบบ / สมัครสมาชิก'}</span>
          </Button>
        </div>
      </section>
    </div>
  );
};
