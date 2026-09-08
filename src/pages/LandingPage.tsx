import React, { useState } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config.js";
import { useToast } from "../components/ToastProvider.jsx";

export default function LandingPage() {
  const toast = useToast();

  // Form State
  const [form, setForm] = useState({
    schoolName: "",
    studentCount: "1,000 - 2,500 คน",
    contactName: "",
    position: "",
    phone: "",
    email: "",
    notes: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolName.trim() || !form.contactName.trim() || !form.phone.trim()) {
      toast.warning("กรุณากรอกข้อมูลที่จำเป็น (* ) ให้ครบถ้วน");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "pilot_leads"), {
        schoolName: form.schoolName.trim(),
        studentCount: form.studentCount,
        contactName: form.contactName.trim(),
        position: form.position.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        notes: form.notes.trim(),
        status: "PENDING",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
      toast.success("ส่งข้อมูลขอรับข้อเสนอโครงการนำร่องสำเร็จ! ทีมงานจะติดต่อกลับภายใน 24 ชั่วโมง");
    } catch (err: any) {
      console.error("Pilot Proposal Lead submission error:", err);
      toast.error(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-800 font-['Kanit',sans-serif] selection:bg-emerald-500 selection:text-white">
      {/* ============ TOP ANNOUNCEMENT BAR ============ */}
      <div className="bg-[#064e3b] text-emerald-100 text-xs py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium">
              เปิดรับสมัครสถานศึกษาเข้าร่วมโครงการนำร่องเทอม 1/2569 (ฟรีไม่มีค่าบริการแรกเข้า)
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <a href="tel:0921975525" className="hover:text-white transition flex items-center gap-1">
              <span>📞</span> 092-197-5525
            </a>
            <span className="opacity-50">•</span>
            <a href="mailto:hi00000087@gmail.com" className="hover:text-white transition flex items-center gap-1">
              <span>✉️</span> hi00000087@gmail.com
            </a>
          </div>
        </div>
      </div>

      {/* ============ NAVBAR ============ */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <img src="/logo.png" alt="QueueUp Logo" className="w-8 h-8 rounded-lg object-contain shadow-xs" />
            <span className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
              Queue<span className="text-emerald-600">Up</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <a href="#how-it-works" className="hover:text-emerald-700 transition">วิธีใช้งาน</a>
            <a href="#benefits" className="hover:text-emerald-700 transition">ประโยชน์ที่ตอบโจทย์</a>
            <a href="#security" className="hover:text-emerald-700 transition">ระบบความปลอดภัย</a>
            <a href="#testimonials" className="hover:text-emerald-700 transition">เสียงตอบรับ</a>
            <a href="#faq" className="hover:text-emerald-700 transition">คำถามที่พบบ่อย</a>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            <a
              href="#pilot-form"
              className="hidden sm:inline-flex border border-emerald-700 text-emerald-800 hover:bg-emerald-50 px-4 py-2 rounded-full text-xs font-bold transition"
            >
              สำหรับผู้บริหารโรงเรียน
            </a>
            <Link
              to="/login"
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-sm hover:shadow-md transition flex items-center gap-1.5 active:scale-95"
            >
              <span>เริ่มสั่งอาหารล่วงหน้า</span>
              <span>🚀</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* ============ HERO SECTION ============ */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Value Proposition */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>นวัตกรรมจองคิวโรงอาหารอัจฉริยะสำหรับสถานศึกษา</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 leading-[1.18] tracking-tight">
              หมดปัญหาต่อคิวโรงอาหารยาวเหยียด พักเที่ยงอิ่มไว{" "}
              <span className="text-red-500 underline decoration-red-200 decoration-wavy">
                มีเวลาพักเต็มที่
              </span>
            </h1>

            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-2xl font-normal">
              แพลตฟอร์มสั่งอาหารและจองคิวล่วงหน้าสำหรับโรงเรียนและมหาวิทยาลัย ประหยัดเวลา 25 นาทีต่อมื้อ
              ลดความแออัด ไม่ต้องพกเงินสด และช่วยให้อาหารพร้อมรับได้ตรงเวลา
            </p>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-2 pb-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 text-center shadow-xs">
                <div className="text-xl sm:text-3xl font-black text-slate-900">-25 นาที</div>
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1">เวลาที่ประหยัดได้ต่อมื้อ</div>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 text-center shadow-xs">
                <div className="text-xl sm:text-3xl font-black text-orange-500">50+</div>
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1">ร้านค้าในโรงอาหารเข้าร่วม</div>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 text-center shadow-xs">
                <div className="text-xl sm:text-3xl font-black text-emerald-600">&lt; 3 นาที</div>
                <div className="text-[11px] sm:text-xs text-slate-500 font-medium mt-1">อาหารพร้อมรับตรงเวลา</div>
              </div>
            </div>

            {/* Dual CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Link
                to="/login"
                className="bg-[#064e3b] hover:bg-[#065f46] text-white text-center px-7 py-3.5 rounded-full text-sm font-bold shadow-md hover:shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>เริ่มสั่งอาหารล่วงหน้า (ฟรี)</span>
                <span>➜</span>
              </Link>
              <a
                href="#pilot-form"
                className="bg-white border border-orange-500 text-orange-600 hover:bg-orange-50/50 text-center px-6 py-3.5 rounded-full text-sm font-bold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <span>🏫 สำหรับผู้บริหารขอรับข้อเสนอ</span>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500 pt-3">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span>✓</span> ไม่ต้องติดตั้งฮาร์ดแวร์
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span>✓</span> มาตรฐานความปลอดภัย PDPA
              </span>
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span>✓</span> รองรับระบบกระเป๋าเงินดิจิทัล
              </span>
            </div>
          </div>

          {/* Right Column: High Fidelity Queue Ticket Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden relative">
              {/* Ticket Card Header */}
              <div className="bg-[#064e3b] px-6 py-4 text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                    <img src="/logo.png" alt="QueueUp" className="w-5 h-5 object-contain" />
                  </div>
                  <div>
                    <div className="font-bold text-sm leading-tight">QueueUp Express Ticket</div>
                    <div className="text-[10px] text-emerald-300">โรงอาหารกลาง อาคารเรียน 2</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  พร้อมรับอาหารทันที (Ready)
                </span>
              </div>

              {/* Ticket Body */}
              <div className="p-6 space-y-5">
                <div className="flex items-end justify-between border-b border-dashed border-slate-200 pb-4">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">หมายเลขคิว</span>
                    <div className="text-4xl font-black text-slate-900 tracking-tight">Q-042</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-semibold text-slate-400">เวลานัดรับอาหาร</span>
                    <div className="text-sm font-bold text-red-500">12:10 - 12:20 น.</div>
                    <div className="text-[10px] text-slate-400">สล็อตเวลาพักเที่ยง ม.ปลาย</div>
                  </div>
                </div>

                {/* Ordered Items Preview */}
                <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-slate-800">ข้าวไข่เจียวทรงเครื่อง (ไก่สับ+กุ้งสับ)</div>
                      <div className="text-xs text-slate-500 mt-0.5">ร้านป้าแดงข้าวมันไก่ & ตามสั่ง (เคาน์เตอร์ 3)</div>
                    </div>
                    <span className="text-xs font-black text-slate-900">฿45.00</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 bg-emerald-50/80 px-2.5 py-1 rounded-lg font-medium inline-block border border-emerald-100">
                    ✔️ ไม่ใส่ผงชูรส, เผ็ดน้อย, ใส่กล่องรักษ์โลก
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="text-center py-2">
                  <div className="inline-block p-3 bg-white border border-slate-200 rounded-2xl shadow-xs">
                    {/* Stylized QR Code SVG */}
                    <svg className="w-32 h-32 mx-auto text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                      <rect x="10" y="10" width="24" height="24" rx="4" />
                      <rect x="14" y="14" width="16" height="16" fill="white" />
                      <rect x="18" y="18" width="8" height="8" />

                      <rect x="66" y="10" width="24" height="24" rx="4" />
                      <rect x="70" y="14" width="16" height="16" fill="white" />
                      <rect x="74" y="18" width="8" height="8" />

                      <rect x="10" y="66" width="24" height="24" rx="4" />
                      <rect x="14" y="70" width="16" height="16" fill="white" />
                      <rect x="18" y="74" width="8" height="8" />

                      <rect x="42" y="10" width="6" height="6" />
                      <rect x="52" y="10" width="6" height="6" />
                      <rect x="42" y="22" width="6" height="6" />
                      <rect x="52" y="28" width="6" height="6" />
                      <rect x="42" y="42" width="16" height="16" rx="2" fill="#064e3b" />
                      <rect x="10" y="44" width="8" height="8" />
                      <rect x="24" y="48" width="6" height="6" />
                      <rect x="70" y="44" width="8" height="6" />
                      <rect x="82" y="48" width="6" height="8" />
                      <rect x="66" y="66" width="8" height="8" />
                      <rect x="78" y="68" width="12" height="6" />
                      <rect x="70" y="80" width="8" height="10" />
                      <rect x="42" y="70" width="6" height="12" />
                      <rect x="52" y="78" width="8" height="12" />
                    </svg>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 font-medium">
                    สแกน QR Code ที่เคาน์เตอร์เพื่อรับอาหารได้ทันที ไม่ต้องรอคิว
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ BEFORE / AFTER COMPARISON ============ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-orange-600 bg-orange-100/70 border border-orange-200">
            ก่อนและหลังใช้งานระบบ
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            เปรียบเทียบชีวิตในโรงอาหาร: เดิม vs เมื่อมี QueueUp
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            เปลี่ยนชั่วโมงเร่งด่วนในโรงอาหารให้กลายเป็นช่วงเวลาพักผ่อน
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* Old Life Card */}
          <div className="bg-white border-2 border-red-100 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-12 -mt-12 pointer-events-none" />
            <h3 className="text-red-500 font-extrabold text-base sm:text-lg mb-6 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center text-sm font-black">✕</span>
              <span>เดิม: ปัญหาความแออัดที่ทุกคนเอือมระอา</span>
            </h3>
            <ul className="space-y-4 text-xs sm:text-sm text-slate-600 font-normal">
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5">🕐</span>
                <span><strong>เสียเวลา 20–30 นาที</strong> ในการยืนต่อคิวรออาหาร ทำให้เวลาพักผ่อนเหลือน้อยมาก</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5">😩</span>
                <span><strong>เข้าแถวรอแล้วอาหารหมดกะทันหัน</strong> เสียเวลา เสียอารมณ์ และต้องวิ่งไปหาอาหารร้านอื่น</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5">🪙</span>
                <span><strong>ไม่สามารถระบุเวลารับอาหารที่แน่นอนได้</strong> วุ่นวายกับการจ่ายเงินสดและรอเงินทอน</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5">⚠️</span>
                <span><strong>ผู้ปกครองไม่รู้ว่านักเรียนรับประทานอะไร</strong> มีสารก่อภูมิแพ้หรือไม่ ไม่สามารถดูแลได้</span>
              </li>
            </ul>
          </div>

          {/* New Life Card */}
          <div className="bg-white border-2 border-emerald-100 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-12 -mt-12 pointer-events-none" />
            <h3 className="text-emerald-700 font-extrabold text-base sm:text-lg mb-6 flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-black text-emerald-700">✓</span>
              <span>ใหม่: ประสบการณ์มื้อเที่ยงด้วย QueueUp</span>
            </h3>
            <ul className="space-y-4 text-xs sm:text-sm text-slate-600 font-normal">
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5 text-emerald-600">⚡</span>
                <span><strong>สั่งอาหารล่วงหน้าจากห้องเรียน</strong> เดินมารับอาหารตามเวลานัดหมายได้ทันที ไม่ต้องยืนรอ</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5 text-emerald-600">🍲</span>
                <span><strong>การันตีวัตถุดิบและอาหาร 100%</strong> อาหารพร้อมรับปรุงเสร็จใหม่ ไม่ต้องกลัวเมนูโปรดหมด</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5 text-emerald-600">🔔</span>
                <span><strong>ระบบแจ้งเตือนอัตโนมัติเมื่ออาหารเสร็จ</strong> ลดความแออัดในโรงอาหารได้อย่างชัดเจน</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-base leading-none shrink-0 mt-0.5 text-emerald-600">🛡️</span>
                <span><strong>ตรวจสอบโภชนาการและสารก่อภูมิแพ้ได้เรียลไทม์</strong> ผู้ปกครองอุ่นใจ สุขภาพจิตดีขึ้น</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 border border-emerald-200">
            ขั้นตอนการใช้งาน
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            3 สเต็ปง่ายๆ สู่มื้อเที่ยงแสนสบาย
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            ใช้งานง่ายผ่านเว็บเบราว์เซอร์ทุกอุปกรณ์ ไม่ต้องดาวน์โหลด ไม่เปลืองพื้นที่เครื่อง
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs hover:shadow-md transition relative group">
            <div className="w-10 h-10 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center font-black text-sm mb-5 shadow-sm">
              01
            </div>
            <h3 className="font-extrabold text-base text-slate-900 mb-2">เลือกเมนูโปรดและระบุแต่ง</h3>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-4">
              เลือกร้านอาหารและอาหารที่ชื่นชอบ ปรับแต่งระดับความเผ็ด ความหวาน และท็อปปิ้งได้ตามใจชอบ
            </p>
            <div className="text-[11px] font-bold text-emerald-700 pt-3 border-t border-slate-100 flex items-center gap-1">
              <span>🔍 ค้นหาง่ายตามประเภทอาหาร</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs hover:shadow-md transition relative group">
            <div className="w-10 h-10 rounded-2xl bg-orange-500 text-white flex items-center justify-center font-black text-sm mb-5 shadow-sm">
              02
            </div>
            <h3 className="font-extrabold text-base text-slate-900 mb-2">จองเลือกรอบเวลานัดรับ</h3>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-4">
              เลือกช่วงเวลาที่สะดวก ระบบจะจัดคิวและคำนวณเวลาปรุงอาหารให้อัตโนมัติ เพื่อให้ได้อาหารสดใหม่ร้อนๆ
            </p>
            <div className="text-[11px] font-bold text-orange-600 pt-3 border-t border-slate-100 flex items-center gap-1">
              <span>⏰ เลือกเวลาได้แบบ 15 นาทีต่อสล็อต</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs hover:shadow-md transition relative group">
            <div className="w-10 h-10 rounded-2xl bg-[#064e3b] text-white flex items-center justify-center font-black text-sm mb-5 shadow-sm">
              03
            </div>
            <h3 className="font-extrabold text-base text-slate-900 mb-2">เดินมารับไปทาน ไม่ต้องรอ</h3>
            <p className="text-slate-500 text-xs sm:text-sm leading-relaxed mb-4">
              เมื่ออาหารพร้อมเสร็จ ระบบจะส่งแจ้งเตือนผ่านหน้าจอ เดินมารับอาหารที่จุดรับอาหารพิเศษได้ทันที
            </p>
            <div className="text-[11px] font-bold text-emerald-700 pt-3 border-t border-slate-100 flex items-center gap-1">
              <span>⚡ มีช่องทางด่วนพิเศษรับอาหารทันที</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STAKEHOLDER BENEFITS ============ */}
      <section id="benefits" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-orange-600 bg-orange-100/70 border border-orange-200">
            ครอบคลุมทุกบทบาทในโรงเรียน
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            ประโยชน์ที่ตอบโจทย์ทุกฝ่ายอย่างแท้จริง
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            ออกแบบโครงสร้างมาเพื่อยกระดับคุณภาพชีวิตของทุกคนในระบบนิเวศโรงอาหาร
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Benefit 1 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs hover:shadow-md transition">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mb-4">
              🎓
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">สำหรับนักเรียน</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              ประหยัดเวลา ไม่ต้องวิ่งแย่งคิว มีเวลาอ่านหนังสือ ทบทวนบทเรียน และพักผ่อนมากขึ้น
            </p>
            <div className="text-[11px] font-bold text-emerald-700">✓ พักเที่ยงได้อย่างมีความสุข</div>
          </div>

          {/* Benefit 2 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs hover:shadow-md transition">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl mb-4">
              🍳
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">สำหรับร้านค้า/ผู้ประกอบการ</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              รู้ยอดสั่งล่วงหน้า เตรียมวัตถุดิบแม่นยำ ไม่สับสนออเดอร์ ทำอาหารทันเวลา ยอดขายเพิ่มขึ้น
            </p>
            <div className="text-[11px] font-bold text-orange-600">✓ ลด Food Waste วัตถุดิบเหลือทิ้ง</div>
          </div>

          {/* Benefit 3 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs hover:shadow-md transition">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center text-2xl mb-4">
              🏫
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">สำหรับผู้บริหาร/โรงเรียน</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              ลดความแออัด จัดการสุขอนามัยได้ดี มีสถิติข้อมูลการบริโภคแบบเรียลไทม์เพื่อพัฒนาโรงอาหาร
            </p>
            <div className="text-[11px] font-bold text-sky-700">✓ ภาพลักษณ์โรงเรียนทันสมัย Smart Canteen</div>
          </div>

          {/* Benefit 4 */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs hover:shadow-md transition">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl mb-4">
              👨‍👩‍👧
            </div>
            <h3 className="font-bold text-base text-slate-900 mb-2">สำหรับผู้ปกครอง</h3>
            <p className="text-slate-500 text-xs leading-relaxed mb-4">
              ตรวจสอบโภชนาการ ควบคุมการใช้จ่ายเงิน และระบุสารก่อภูมิแพ้เพื่อความปลอดภัยสูงสุดของบุตรหลาน
            </p>
            <div className="text-[11px] font-bold text-amber-700">✓ ปลอดภัยและมั่นใจในทุกมื้ออาหาร</div>
          </div>
        </div>
      </section>

      {/* ============ SECURITY & TECH FEATURES BANNER ============ */}
      <section id="security" className="py-8 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="bg-[#064e3b] rounded-3xl p-8 text-white shadow-xl grid md:grid-cols-3 gap-8">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0">
              💳
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-emerald-200 mb-1">Zero Cash & Safe Wallet</h3>
              <p className="text-xs text-emerald-100/80 leading-relaxed font-light">
                ระบบกระเป๋าเงินดิจิทัลโรงเรียน ไร้เงินสด เติมเงินและควบคุมวงเงินได้ปลอดภัย
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0">
              ⚡
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-emerald-200 mb-1">AI Queue Balancing</h3>
              <p className="text-xs text-emerald-100/80 leading-relaxed font-light">
                ระบบกระจายคิวอัจฉริยะ ป้องกันออเดอร์กระจุกตัว จัดการความเร็วในการปรุงแบบเรียลไทม์
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-xl shrink-0">
              🔒
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-emerald-200 mb-1">PDPA & Role-Based Security</h3>
              <p className="text-xs text-emerald-100/80 leading-relaxed font-light">
                มาตรฐานความปลอดภัยข้อมูลส่วนบุคคล คุ้มครองข้อมูลนักเรียน 100% แยกสิทธิ์ตามบทบาท
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section id="testimonials" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 border border-emerald-200">
            เสียงจากผู้ใช้งานจริง
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            เสียงตอบรับจากคอมมูนิตี้ผู้ใช้งาน
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            ความประทับใจจริงจากนักเรียน ร้านค้า และบุคลากรสถานศึกษา
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Testimonial 1 */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs flex flex-col justify-between">
            <div>
              <div className="text-orange-400 text-sm mb-3">★★★★★</div>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed italic mb-6">
                "สั่งตอนพักคาบสุดท้าย พอถึงเวลาพักเที่ยงก็เดินไปรับเลย ไม่ต้องต่อแถวอีกต่อไป มีเวลาอ่านหนังสือและนั่งคุยกับเพื่อนเต็มที่ค่ะ"
              </p>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs">
                ม
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-800">น้องมิว (ม.5/2)</div>
                <div className="text-[11px] text-slate-400">โรงเรียนนำร่องเขตกรุงเทพฯ</div>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs flex flex-col justify-between">
            <div>
              <div className="text-orange-400 text-sm mb-3">★★★★★</div>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed italic mb-6">
                "รู้ล่วงหน้าว่าต้องเตรียมกี่จาน ทำอาหารทันเวลา ไม่ต้องเดาสุ่มอีกแล้ว แถมไม่ต้องเสียเวลาทอนเหรียญ ยอดขายเพิ่มขึ้นกว่าเดิมมาก"
              </p>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-xs">
                ด
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-800">ป้าแดง</div>
                <div className="text-[11px] text-slate-400">ร้านอาหารตามสั่ง & ข้าวมันไก่</div>
              </div>
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-xs flex flex-col justify-between">
            <div>
              <div className="text-orange-400 text-sm mb-3">★★★★★</div>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed italic mb-6">
                "โรงอาหารไม่แออัดเหมือนเดิม ดูแลนักเรียนได้ทั่วถึงขึ้นมาก ปัญหาอุบัติเหตุและขยะลดลง เป็นโครงการที่ตอบโจทย์การศึกษา 4.0 จริงๆ"
              </p>
            </div>
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
              <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-700 font-bold text-xs">
                ส
              </div>
              <div>
                <div className="font-bold text-xs sm:text-sm text-slate-800">อาจารย์สมศรี</div>
                <div className="text-[11px] text-slate-400">รองผู้อำนวยการฝ่ายกิจการนักเรียน</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ SECTION ============ */}
      <section id="faq" className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="text-center space-y-2 mb-12">
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 border border-emerald-200">
            คำถามที่พบบ่อย
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            มีข้อสงสัยเกี่ยวกับ QueueUp?
          </h2>
          <p className="text-slate-500 text-sm max-w-xl mx-auto">
            รวมคำตอบข้อสงสัยที่พบบ่อย พร้อมให้คำแนะนำและช่วยเหลือเสมอ
          </p>
        </div>

        <div className="space-y-3.5">
          {[
            {
              q: "ระบบ QueueUp ใช้งานบนมือถือรุ่นใดได้บ้าง?",
              a: "QueueUp เป็น Web Application แบบ Responsive สามารถใช้งานได้ผ่านเว็บเบราว์เซอร์ทุกชนิด (Chrome, Safari, Edge) ทั้งบนสมาร์ทโฟนทุกระบบปฏิบัติการ (iOS, Android), แท็บเล็ต, iPad และคอมพิวเตอร์ โดยไม่ต้องดาวน์โหลดหรือติดตั้งแอปใดๆ ลงในเครื่องให้เปลืองพื้นที่",
            },
            {
              q: "หากรายการที่สั่งไม่ตรงตามที่ต้องการ สามารถเปลี่ยนหรือขอเงินคืนได้อย่างไร?",
              a: "ระบบมีขั้นตอนการยืนยันคำสั่งซื้อแบบ 5-Phase หากร้านค้ายังไม่กดเริ่มปรุง (สถานะยังเป็นรอยืนยัน) นักเรียนสามารถกดยกเลิกและรับเงินคืนเข้ากระเป๋าเงินทันที หรือสามารถแจ้งทางร้านค้าที่เคาน์เตอร์ผ่านระบบ KDS เพื่อปรับเปลี่ยนเมนูได้อย่างโปร่งใส",
            },
            {
              q: "ผู้ปกครองสามารถเลือกกำหนดขีดจำกัดค่าใช้จ่ายได้ด้วยวิธีใด?",
              a: "ผู้ปกครองสามารถเข้าสู่ระบบ Guardian Dashboard เพื่อตั้งค่าเพดานวงเงินการใช้จ่ายของบุตรหลานได้ทั้งแบบ 'รายวัน' และ 'รายสัปดาห์' พร้อมทั้งสามารถบล็อกหมวดหมู่อาหารที่ไม่ต้องการให้ซื้อ เช่น น้ำอัดลม หรือของทอด และระบบจะระงับการสั่งซื้ออัตโนมัติหากเกินวงเงินที่กำหนด",
            },
            {
              q: "โรงเรียนหรือสถานศึกษาที่สนใจทดลองใช้ ต้องเตรียมตัวอย่างไรบ้าง?",
              a: "สถานศึกษาเพียงแค่กรอกแบบฟอร์มขอรับสิทธิ์ด้านล่างนี้ ทางทีมงาน QueueUp จะประสานงานกลับเพื่อจัดเตรียมระบบ เทรนนิ่งร้านค้าหน้าร้าน และให้คำแนะนำฟรีตลอดระยะเวลาโครงการนำร่อง 1 ภาคการศึกษาเต็ม โดยไม่มีค่าติดตั้งหรือค่าอุปกรณ์ใดๆ เพิ่มเติม",
            },
          ].map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full text-left px-5 py-4 font-bold text-slate-900 text-xs sm:text-sm flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition"
                >
                  <span>{item.q}</span>
                  <span
                    className={`w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs transition-transform duration-200 ${
                      isOpen ? "rotate-180 bg-emerald-100 text-emerald-800" : ""
                    }`}
                  >
                    ▼
                  </span>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ============ PILOT CTA FORM SECTION ============ */}
      <section id="pilot-form" className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="bg-white rounded-3xl p-6 sm:p-10 lg:p-12 border border-slate-200/80 shadow-xl">
          <div className="grid lg:grid-cols-12 gap-10">
            {/* Form Left Information */}
            <div className="lg:col-span-5 space-y-6">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 border border-emerald-200">
                CAMPUS PILOT PROGRAM
              </span>

              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug">
                ลงทะเบียนขอรับสิทธิ์ทดลองใช้ QueueUp Campus
              </h2>

              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                เปิดโอกาสให้สถานศึกษาเข้าร่วมโครงการนำร่องฟรี 1 ภาคการศึกษาเต็ม
                พร้อมทีมงานผู้เชี่ยวชาญดูแลและให้คำปรึกษาตลอดการใช้งาน
              </p>

              {/* Direct Contacts Box */}
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-3">
                <div className="text-xs font-bold text-slate-800">ช่องทางติดต่อด่วนทีมงานฝ่ายพัฒนา:</div>
                <div className="space-y-2 text-xs">
                  <a href="tel:0921975525" className="flex items-center gap-2 text-emerald-800 font-bold hover:underline">
                    <span>📞</span> 092-197-5525
                  </a>
                  <a href="mailto:hi00000087@gmail.com" className="flex items-center gap-2 text-emerald-800 font-bold hover:underline">
                    <span>✉️</span> hi00000087@gmail.com
                  </a>
                </div>
                <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-200/60 leading-normal">
                  พร้อมนัดจัด Live Demo ผ่าน Zoom หรือเดินทางไปสาธิตที่สถานศึกษาฟรี
                </p>
              </div>

              <div className="text-xs text-emerald-700 font-medium flex items-center gap-2">
                <span>🛡️</span> ข้อมูลของท่านจะถูกเก็บเป็นความลับตามนโยบาย PDPA
              </div>
            </div>

            {/* Form Right Input Fields */}
            <div className="lg:col-span-7">
              {submitted ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center space-y-3 animate-fade-in">
                  <div className="w-14 h-14 rounded-full bg-emerald-500 text-white text-2xl flex items-center justify-center mx-auto shadow-md">
                    ✓
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">บันทึกข้อมูลเรียบร้อยแล้ว!</h3>
                  <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                    ขอบพระคุณสำหรับความสนใจในโครงการนำร่อง QueueUp Campus
                    ทีมงานจะจัดเตรียมเอกสารและติดต่อกลับผ่านหมายเลข <strong>{form.phone}</strong> หรืออีเมล <strong>{form.email}</strong> ภายใน 24 ชั่วโมง
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="schoolName" className="block text-xs font-bold text-slate-700 mb-1">
                        ชื่อสถานศึกษา / โรงเรียน *
                      </label>
                      <input
                        id="schoolName"
                        name="schoolName"
                        value={form.schoolName}
                        onChange={handleChange}
                        required
                        placeholder="เช่น โรงเรียนสาธิตฯ"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="studentCount" className="block text-xs font-bold text-slate-700 mb-1">
                        จำนวนนักเรียนโดยประมาณ
                      </label>
                      <select
                        id="studentCount"
                        name="studentCount"
                        value={form.studentCount}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      >
                        <option value="ต่ำกว่า 500 คน">ต่ำกว่า 500 คน</option>
                        <option value="500 - 1,000 คน">500 - 1,000 คน</option>
                        <option value="1,000 - 2,500 คน">1,000 - 2,500 คน</option>
                        <option value="2,500 - 5,000 คน">2,500 - 5,000 คน</option>
                        <option value="มากกว่า 5,000 คน">มากกว่า 5,000 คน</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="contactName" className="block text-xs font-bold text-slate-700 mb-1">
                        ชื่อ-นามสกุลผู้ประสานงาน *
                      </label>
                      <input
                        id="contactName"
                        name="contactName"
                        value={form.contactName}
                        onChange={handleChange}
                        required
                        placeholder="เช่น อ.สมชาย ใจดี"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="position" className="block text-xs font-bold text-slate-700 mb-1">
                        ตำแหน่งในสถานศึกษา *
                      </label>
                      <input
                        id="position"
                        name="position"
                        value={form.position}
                        onChange={handleChange}
                        required
                        placeholder="เช่น หัวหน้างานกิจการนักเรียน"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="phone" className="block text-xs font-bold text-slate-700 mb-1">
                        เบอร์โทรศัพท์ติดต่อ *
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        value={form.phone}
                        onChange={handleChange}
                        required
                        placeholder="เช่น 081-234-5678"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-xs font-bold text-slate-700 mb-1">
                        อีเมลสำหรับรับข้อเสนอ *
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={handleChange}
                        required
                        placeholder="เช่น director@school.ac.th"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="notes" className="block text-xs font-bold text-slate-700 mb-1">
                      ความต้องการพิเศษหรือข้อเสนอแนะเพิ่มเติม
                    </label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      value={form.notes}
                      onChange={handleChange}
                      placeholder="เช่น ต้องการให้จัด Live Demo ในวันพุธหน้า หรือข้อมูลจำนวนร้านค้าในโรงอาหาร..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#064e3b] hover:bg-[#065f46] disabled:opacity-60 text-white py-3.5 px-6 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <span>{isSubmitting ? "กำลังบันทึกข้อมูล..." : "ส่งข้อมูลขอรับข้อเสนอโครงการนำร่อง"}</span>
                    <span>➜</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ BOTTOM COMPACT FOOTER ============ */}
      <footer className="bg-white border-t border-slate-100 py-6 px-4 sm:px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>QueueUp System for Campus Food Service Canteen - All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <a href="tel:0921975525" className="hover:text-emerald-700 transition">📞 092-197-5525</a>
            <span>•</span>
            <a href="mailto:hi00000087@gmail.com" className="hover:text-emerald-700 transition">✉️ hi00000087@gmail.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
