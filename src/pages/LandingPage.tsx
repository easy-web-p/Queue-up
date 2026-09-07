import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function LandingPage() {
  const [form, setForm] = useState({ schoolName: "", phone: "", email: "" });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // บันทึก Lead สำหรับติดต่อกลับ
    console.log("Lead submitted:", form);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-white text-gray-800 font-['Kanit',sans-serif]">
      {/* ============ NAVBAR ============ */}
      <nav className="flex items-center justify-between px-6 py-4 shadow-sm sticky top-0 bg-white/95 backdrop-blur-md z-50">
        <Link to="/" className="text-2xl font-black text-orange-500 tracking-tight flex items-center gap-2">
          <img src="/logo.png" alt="QueueUp Logo" className="w-8 h-8 rounded-lg object-contain" />
          <span>QueueUp</span>
        </Link>
        <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
          <a href="#how-it-works" className="hover:text-orange-500 transition-colors">วิธีใช้งาน</a>
          <a href="#benefits" className="hover:text-orange-500 transition-colors">ประโยชน์</a>
          <a href="#testimonials" className="hover:text-orange-500 transition-colors">เสียงตอบรับ</a>
          <a href="#faq" className="hover:text-orange-500 transition-colors">คำถามที่พบบ่อย</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-sm font-semibold text-gray-700 hover:text-orange-500 px-3 py-1.5 transition"
          >
            เข้าสู่ระบบ
          </Link>
          <a
            href="#pilot-form"
            className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-orange-600 transition shadow-sm"
          >
            สำหรับผู้บริหารโรงเรียน
          </a>
        </div>
      </nav>

      {/* ============ HERO SECTION ============ */}
      <section className="px-6 py-16 md:py-24 max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
        <div>
          <span className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-3 py-1 rounded-full mb-4">
            นวัตกรรมจองคิวโรงอาหารอัจฉริยะ
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold leading-tight mb-4 text-slate-900">
            หมดปัญหาต่อคิวโรงอาหารยาวเหยียด <br />
            <span className="text-orange-500">พักเที่ยงอิ่มไว มีเวลาพักผ่อนเต็มที่</span>
          </h1>
          <p className="text-gray-600 text-lg mb-6 leading-relaxed">
            แพลตฟอร์มสั่งอาหารและจองคิวล่วงหน้าสำหรับโรงเรียน สั่งจากห้องเรียน
            เดินมารับได้ตรงเวลา ไม่ต้องต่อแถว ไม่ต้องพกเงินสด ไม่ต้องรอเงินทอน
          </p>

          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <MetricCard number="~25 นาที" label="เวลาที่ประหยัดได้ต่อมื้อ" />
            <MetricCard number="50+" label="ร้านค้าที่เข้าร่วม" />
            <MetricCard number="~3 นาที" label="อาหารพร้อมรับ" />
          </div>
          <p className="text-xs text-gray-400 -mt-4 mb-8">
            *ตัวเลขอ้างอิงจากผลลัพธ์เป้าหมายของโครงการนำร่อง อาจแตกต่างตามบริบทของแต่ละสถานศึกษา
          </p>

          {/* Dual CTA - Primary/Secondary */}
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href="#pilot-form"
              className="bg-orange-500 text-white text-center px-6 py-3 rounded-full font-semibold hover:bg-orange-600 transition shadow-lg hover:shadow-orange-500/25"
            >
              🏫 สำหรับผู้บริหารโรงเรียน — ขอรับข้อเสนอโครงการ
            </a>
            <Link
              to="/login"
              className="border border-orange-500 text-orange-500 text-center px-6 py-3 rounded-full font-semibold hover:bg-orange-50 transition"
            >
              เริ่มสั่งอาหารล่วงหน้า (ฟรี)
            </Link>
          </div>
        </div>

        {/* Mockup Showcase */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-100/60 rounded-3xl p-6 md:p-8 border border-orange-200/50 shadow-inner flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-xs font-bold text-slate-800">คิวอาหารของคุณ</span>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">
                พร้อมรับอาหาร
              </span>
            </div>
            <div className="flex items-center gap-3">
              <img src="/crispy_fried_chicken.jpg" alt="อาหาร" className="w-14 h-14 rounded-xl object-cover shadow-sm" />
              <div>
                <div className="text-sm font-bold text-slate-800">ชุดไก่บักเก็ตซอสเกาหลี</div>
                <div className="text-xs text-slate-500">ร้านป้าแดง ตามสั่ง & ไก่ทอด</div>
                <div className="text-xs text-orange-600 font-semibold mt-0.5">หมายเลขคิว #A-042</div>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">เวลานัดรับ:</span>
              <span className="font-bold text-slate-800">12:15 น. (ตรงเวลา)</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-orange-600 font-semibold">
            <span>✨ จองคิวก่อนพักเที่ยง ไม่ต้องยืนรอแถวยาว</span>
          </div>
        </div>
      </section>

      {/* ============ BEFORE / AFTER ============ */}
      <section className="bg-gray-50 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-slate-900">
            ชีวิตเดิม <span className="text-gray-400">vs</span>{" "}
            <span className="text-orange-500">เมื่อมี QueueUp</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white border border-red-100 rounded-2xl p-8 shadow-sm">
              <h3 className="text-red-500 font-bold text-lg mb-4 flex items-center gap-2">
                <span>❌</span> ชีวิตเดิมในโรงอาหาร
              </h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center gap-2"><span>🕐</span> ยืนเบียดในแถวร้อน 20–30 นาที</li>
                <li className="flex items-center gap-2"><span>😩</span> เมนูโปรดหมดก่อนถึงคิว</li>
                <li className="flex items-center gap-2"><span>🪙</span> ควานหาเศษเหรียญรอทอน</li>
                <li className="flex items-center gap-2"><span>🤢</span> รีบกินจนปวดท้องเพราะหมดเวลาพัก</li>
              </ul>
            </div>
            <div className="bg-white border border-green-100 rounded-2xl p-8 shadow-sm">
              <h3 className="text-green-600 font-bold text-lg mb-4 flex items-center gap-2">
                <span>✅</span> เมื่อเปลี่ยนมาใช้ QueueUp
              </h3>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center gap-2"><span>📱</span> สั่งล่วงหน้าใน 3 คลิกก่อนพักเที่ยง</li>
                <li className="flex items-center gap-2"><span>✅</span> ระบบการันตีวัตถุดิบและเวลาแม่นยำ</li>
                <li className="flex items-center gap-2"><span>🔔</span> แจ้งเตือนทันทีที่อาหารพร้อม</li>
                <li className="flex items-center gap-2"><span>😌</span> นั่งทานข้าวสบายๆ สุขภาพจิตดีขึ้น</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-4 text-slate-900">
          3 สเต็ปง่ายๆ สู่มื้อเที่ยงที่ไร้การยืนรอ
        </h2>
        <p className="text-center text-gray-500 mb-12">ไม่ซับซ้อน ใช้เวลาไม่ถึงนาที</p>
        <div className="grid md:grid-cols-3 gap-8">
          <StepCard step="1" title="เลือกเมนู & แต่งรส" desc="เลือกอาหาร ปรับความเผ็ด เส้น ท็อปปิ้งตามใจ" />
          <StepCard step="2" title="ระบุเวลารับอาหาร" desc="เลือกสล็อตเวลาที่สะดวก ระบบจัดคิวให้อัตโนมัติ" />
          <StepCard step="3" title="เดินมารับทันทีที่พร้อม" desc="รับแจ้งเตือน เดินมารับได้เลย ไม่ต้องยืนรอ" />
        </div>
      </section>

      {/* ============ STAKEHOLDER BENEFITS ============ */}
      <section id="benefits" className="bg-gray-50 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-slate-900">
            แก้ปัญหาตรงจุด ครบทุกมิติ
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <BenefitCard
              icon="🎓"
              title="นักเรียน/นักศึกษา"
              desc="ไม่ต้องวิ่งแย่งคิว มีเวลาอ่านหนังสือและพักผ่อนมากขึ้น"
            />
            <BenefitCard
              icon="🍳"
              title="ร้านค้าในโรงอาหาร"
              desc="รู้ยอดสั่งล่วงหน้า ไม่สับสนออเดอร์ วางแผนวัตถุดิบได้แม่นยำขึ้น"
            />
            <BenefitCard
              icon="🏫"
              title="ผู้บริหาร & โรงเรียน"
              desc="ลดความแออัดในโรงอาหาร มองเห็นข้อมูลความหนาแน่นแบบภาพรวม"
            />
            <BenefitCard
              icon="👨‍👩‍👧"
              title="ผู้ปกครอง"
              desc="มั่นใจว่าบุตรหลานได้รับประทานอาหารตรงเวลา สะอาด ถูกสุขอนามัย"
            />
          </div>
        </div>
      </section>

      {/* ============ SECURITY / ARCHITECTURE ============ */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-slate-900">
          ปลอดภัย โปร่งใส ใช้งานง่าย
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <SecurityCard
            icon="💳"
            title="ไม่ต้องพกเงินสด"
            desc="สั่งจองคิวได้ทันที ไม่ต้องผูกบัตร ไม่ต้องรอเงินทอนหน้าร้าน"
          />
          <SecurityCard
            icon="🔒"
            title="ระบบคิวที่แม่นยำ"
            desc="ป้องกันการแย่งคิวและของหมดซ้อนทับด้วยระบบตรวจสอบแบบเรียลไทม์"
          />
          <SecurityCard
            icon="🛡️"
            title="มาตรฐาน PDPA"
            desc="ข้อมูลนักเรียนและผู้ปกครองถูกจัดเก็บตามมาตรฐานความปลอดภัยข้อมูลส่วนบุคคล"
          />
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section id="testimonials" className="bg-gray-50 py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12 text-slate-900">
            เสียงจากผู้ใช้งานจริง
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <TestimonialCard
              name="น้องมิว"
              role="นักเรียนชั้น ม.5"
              quote="สั่งตอนพักคาบสุดท้าย พอถึงเวลาพักเที่ยงก็เดินไปรับเลย ไม่ต้องต่อแถวอีกต่อไป"
            />
            <TestimonialCard
              name="ป้าแดง"
              role="เจ้าของร้านในโรงอาหาร"
              quote="รู้ล่วงหน้าว่าต้องเตรียมกี่จาน ทำอาหารทันเวลา ไม่ต้องเดาสุ่มอีกแล้ว"
            />
            <TestimonialCard
              name="อาจารย์สมศรี"
              role="รองผู้อำนวยการฝ่ายกิจการนักเรียน"
              quote="โรงอาหารไม่แออัดเหมือนเดิม ดูแลนักเรียนได้ทั่วถึงขึ้นมาก"
            />
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section id="faq" className="py-16 px-6 max-w-4xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10 text-slate-900">คำถามที่พบบ่อย</h2>
        <div className="space-y-4">
          <FaqItem
            q="ถ้านักเรียนสั่งแล้วไม่มารับอาหาร ร้านค้าจะเสียหายไหม?"
            a="ระบบมีการตั้งเวลาจำกัดในการรับอาหารต่อคิว และแจ้งเตือนล่วงหน้าเพื่อลดปัญหานี้ ทางทีมงานสามารถปรับกฎเกณฑ์ร่วมกับโรงเรียนได้ตามความเหมาะสม"
          />
          <FaqItem
            q="ข้อมูลนักเรียนปลอดภัยแค่ไหน?"
            a="ระบบจัดเก็บและประมวลผลข้อมูลตามมาตรฐาน PDPA มีการเข้าถึงข้อมูลตามสิทธิ์การใช้งานเท่านั้น"
          />
          <FaqItem
            q="โรงเรียนต้องเตรียมอุปกรณ์อะไรเพิ่มไหม?"
            a="ใช้งานผ่านเว็บเบราว์เซอร์ได้ทันที ไม่ต้องติดตั้งฮาร์ดแวร์เพิ่มเติม ทางทีมงานมีบริการเทรนการใช้งานให้ฟรี"
          />
        </div>
      </section>

      {/* ============ PILOT CTA FORM ============ */}
      <section id="pilot-form" className="bg-orange-500 py-16 px-6">
        <div className="max-w-3xl mx-auto text-center text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            โครงการนำร่องฟรี! ตลอด 1 ภาคการศึกษาเต็ม
          </h2>
          <p className="mb-8 opacity-90 text-sm md:text-base">
            ไม่มีค่าติดตั้ง มีทีมเทรนหน้าร้านให้ฟรี — กรอกข้อมูลเพื่อรับเอกสารโครงการและนัด Live Demo
          </p>

          {submitted ? (
            <div className="bg-white text-gray-800 rounded-2xl p-8 shadow-xl">
              <div className="text-4xl mb-2">🎉</div>
              <div className="text-xl font-bold text-slate-900 mb-1">ขอบคุณสำหรับความสนใจครับ!</div>
              <p className="text-gray-600 text-sm">ทีมงาน QueueUp จะติดต่อกลับเพื่อส่งมอบเอกสารโครงการและนัด Live Demo ภายใน 24 ชั่วโมง</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 md:p-8 grid gap-4 text-left shadow-2xl">
              <div>
                <label htmlFor="schoolName" className="block text-xs font-semibold text-gray-700 mb-1">ชื่อสถานศึกษา *</label>
                <input
                  id="schoolName"
                  name="schoolName"
                  value={form.schoolName}
                  onChange={handleChange}
                  required
                  placeholder="เช่น โรงเรียนสาธิตฯ / วิทยาลัยฯ"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-gray-700 mb-1">เบอร์โทรติดต่อ *</label>
                <input
                  id="phone"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                  required
                  placeholder="เช่น 081-234-5678"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">อีเมลติดต่อ *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="เช่น director@school.ac.th"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <button
                type="submit"
                className="bg-orange-500 text-white font-bold py-3.5 rounded-lg hover:bg-orange-600 transition shadow-md hover:shadow-lg mt-2 cursor-pointer"
              >
                ขอรับเอกสารโครงการ & นัด Live Demo
              </button>
            </form>
          )}

          <div className="flex justify-center gap-6 mt-8 text-sm opacity-90">
            <a href="tel:0812345678" className="underline hover:opacity-100">📞 สายด่วนโทรติดต่อ</a>
            <a href="https://line.me" target="_blank" rel="noreferrer" className="underline hover:opacity-100">💬 Line Official</a>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer className="py-8 px-6 text-center text-sm text-gray-400 bg-slate-900">
        © {new Date().getFullYear()} QueueUp for Campus. All rights reserved.
      </footer>
    </div>
  );
}

/* ============ Reusable Components ============ */

function MetricCard({ number, label }: { number: string; label: string }) {
  return (
    <div className="text-center bg-orange-50/60 rounded-xl p-3 border border-orange-100">
      <div className="text-xl md:text-2xl font-black text-orange-500">{number}</div>
      <div className="text-xs text-gray-600 font-medium mt-0.5">{label}</div>
    </div>
  );
}

function StepCard({ step, title, desc }: { step: string; title: string; desc: string }) {
  return (
    <div className="text-center p-6 rounded-2xl border border-gray-100 hover:shadow-md transition bg-white">
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
        {step}
      </div>
      <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function BenefitCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition border border-gray-100">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function SecurityCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="text-center p-6 bg-white rounded-2xl border border-gray-100">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function TestimonialCard({ name, role, quote }: { name: string; role: string; quote: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
      <p className="text-gray-600 italic mb-4 leading-relaxed">"{quote}"</p>
      <div>
        <div className="font-bold text-slate-800 text-sm">{name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{role}</div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white transition-colors">
      <button
        onClick={() => setOpen(!open)}
        className="flex justify-between items-center w-full text-left font-bold text-slate-800 text-sm md:text-base cursor-pointer"
        type="button"
      >
        <span>{q}</span>
        <span className="text-lg text-orange-500 font-bold ml-2">{open ? "−" : "+"}</span>
      </button>
      {open && <p className="text-sm text-gray-600 mt-3 leading-relaxed border-t pt-3 border-gray-100">{a}</p>}
    </div>
  );
}
