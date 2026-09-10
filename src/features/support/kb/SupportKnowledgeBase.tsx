import React, { useState } from "react";
import {
  BookOpen,
  Search,
  Copy,
  Check,
  ChevronRight,
  LifeBuoy,
  FileText,
} from "lucide-react";
import { useToast } from "../../../components/ToastProvider.jsx";

interface KbArticle {
  id: string;
  category: "SAFETY" | "PAYMENT" | "ORDERS" | "GUARDIAN";
  title: string;
  summary: string;
  sopSteps: string[];
  cannedResponse: string;
}

export const SupportKnowledgeBase: React.FC = () => {
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedArticleId, setSelectedArticleId] = useState<string>("kb-allergen");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const articles: KbArticle[] = [
    {
      id: "kb-allergen",
      category: "SAFETY",
      title: "SOP-01: ขั้นตอนรับมือเมื่อเกิดเหตุสารก่อภูมิแพ้ฉุกเฉิน (Severe Allergen Protocol)",
      summary: "แนวปฏิบัติเมื่อได้รับรายงานว่าลูกค้าหรือนักศึกษาได้รับอาหารที่ปนเปื้อนสารก่อภูมิแพ้รุนแรง",
      sopSteps: [
        "1. ปรับระดับความสำคัญของตั๋วเป็น CRITICAL ทันทีเพื่อล็อก SLA ภายใน 3 นาที",
        "2. ขอสิทธิ์ชั่วคราว (JIT Elevation) เพื่อดูเบอร์ติดต่อฉุกเฉินและติดต่อโรงพยาบาล/ห้องพยาบาล มข.",
        "3. ประสานงานระงับเมนูดังกล่าวของร้านค้าชั่วคราวผ่าน Business Console",
        "4. บันทึกรายงานเหตุการณ์ความปลอดภัย (Safety Incident) ลงในระบบ Campus Portal",
      ],
      cannedResponse:
        "ทางทีมงาน QueueUp ได้รับรายงานเหตุการณ์ฉุกเฉินเกี่ยวกับสารก่อภูมิแพ้แล้ว ขณะนี้ได้ประสานงานกับห้องพยาบาลส่วนกลางและระงับการสั่งเมนูดังกล่าวของร้านค้าทันทีเพื่อความปลอดภัย หากต้องการความช่วยเหลือทางการแพทย์ฉุกเฉิน กรุณาติดต่อสายด่วนห้องพยาบาล 043-000-000",
    },
    {
      id: "kb-payment",
      category: "PAYMENT",
      title: "SOP-02: การตรวจสอบสลิปโอนเงินค้างและระบบตัดเงินซ้ำ (PromptPay & Refund)",
      summary: "วิธีตรวจสอบกรณีสแกนจ่ายสำเร็จแต่สถานะออเดอร์ไม่เปลี่ยนเป็น PAID",
      sopSteps: [
        "1. ตรวจสอบหมายเลข Transaction Ref กับระบบ PromptPay Webhook Log",
        "2. หากพบยอดเงินเข้าจริงแต่ติด Timeout ให้ใช้ฟังก์ชัน 'Verify & Confirm Payment' ในตั๋ว",
        "3. หากลูกค้าโอนซ้ำ ให้สร้างข้อเสนอคืนเงิน (Propose Refund) ส่งต่อให้ฝ่ายการเงินอนุมัติ",
        "4. ห้ามเจ้าหน้าที่สนับสนุนโอนเงินคืนโดยตรงเด็ดขาด",
      ],
      cannedResponse:
        "เจ้าหน้าที่ได้ตรวจสอบข้อมูลรายการโอนเงินของท่านเรียบร้อยแล้ว พบว่ายอดเงินเข้าสู่ระบบสมบูรณ์ จึงได้ยืนยันสถานะออเดอร์ให้เข้าสู่คิวในครัวเรียบร้อย ขออภัยในความล่าช้าจากระบบสื่อสารของธนาคารครับ",
    },
    {
      id: "kb-guardian",
      category: "GUARDIAN",
      title: "SOP-03: การแก้ปัญหาคำขอผูกบัญชีผู้ปกครองไม่สำเร็จ (Guardian Link Dispute)",
      summary: "แนวทางตรวจสอบกรณีผู้ปกครองไม่ได้รับ OTP หรือนักศึกษาไม่กดยืนยันคำขอ",
      sopSteps: [
        "1. ตรวจสอบรหัสนักศึกษาและเบอร์โทรผู้ปกครองในระบบ Campus Registry",
        "2. แนะนำให้นักศึกษาเปิดแอป QueueUp เข้าเมนู บัญชี ➔ การเชื่อมโยงผู้ปกครอง เพื่อกดยืนยัน",
        "3. หากข้อมูลไม่ตรงกัน แนะนำให้นำบัตรนักศึกษาติดต่อกองพัฒนานักศึกษา มข.",
      ],
      cannedResponse:
        "สวัสดีครับ สำหรับการผูกบัญชีผู้ปกครอง ขอความกรุณาให้น้องนักศึกษาเข้าแอป QueueUp ที่เมนู 'บัญชีของฉัน' ➔ 'การเชื่อมโยงผู้ปกครอง' เพื่อกดยืนยันคำขอของท่าน หากยังไม่พบคำขอ เจ้าหน้าที่ได้ส่งคำขอใหม่ไปยังบัญชีนักศึกษาเรียบร้อยแล้วครับ",
    },
  ];

  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "ALL" || a.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const activeArticle = articles.find((a) => a.id === selectedArticleId) || articles[0];

  const handleCopyCanned = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("คัดลอกข้อความตอบกลับมาตรฐานแล้ว");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-white font-kanit flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" />
          <span>ฐานความรู้เจ้าหน้าที่ (Support Knowledge Base & SOPs)</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          คู่มือขั้นตอนปฏิบัติงานมาตรฐาน (SOP) ข้อความตอบกลับสำเร็จรูป และแนวทางแก้ไขเหตุการณ์ฉุกเฉิน
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาคู่มือ SOP, อาการปัญหา หรือข้อความตอบกลับ..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {["ALL", "SAFETY", "PAYMENT", "GUARDIAN"].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl font-bold transition-all ${
                selectedCategory === cat
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {cat === "ALL" && "ทุกหมวดหมู่"}
              {cat === "SAFETY" && "ความปลอดภัย/แพ้อาหาร"}
              {cat === "PAYMENT" && "การเงิน/สลิป"}
              {cat === "GUARDIAN" && "ผู้ปกครอง"}
            </button>
          ))}
        </div>
      </div>

      {/* Master-Detail Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Article List */}
        <div className="space-y-3">
          {filteredArticles.map((art) => (
            <div
              key={art.id}
              onClick={() => setSelectedArticleId(art.id)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedArticleId === art.id
                  ? "bg-blue-600/10 border-blue-500 text-white shadow-sm"
                  : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1">
                <span className={art.category === "SAFETY" ? "text-rose-400" : "text-blue-400"}>
                  {art.category}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <h4 className="font-bold text-xs text-white line-clamp-2 leading-relaxed">
                {art.title}
              </h4>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{art.summary}</p>
            </div>
          ))}
        </div>

        {/* Right 2 Cols: Article Detail View */}
        <div className="md:col-span-2 space-y-4">
          <div className="p-6 rounded-2xl bg-slate-900/95 border border-slate-800 space-y-5">
            <div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                {activeArticle.category} SOP
              </span>
              <h2 className="text-lg font-bold text-white font-kanit mt-2">
                {activeArticle.title}
              </h2>
              <p className="text-xs text-slate-400 mt-1">{activeArticle.summary}</p>
            </div>

            {/* SOP Steps */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2.5">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>ขั้นตอนการปฏิบัติงาน (Step-by-Step SOP)</span>
              </h3>
              <div className="space-y-2 text-xs text-slate-300">
                {activeArticle.sopSteps.map((step, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            {/* Canned Response */}
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <LifeBuoy className="w-4 h-4 text-orange-400" />
                  <span>ข้อความตอบกลับมาตรฐาน (Canned Response Template)</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyCanned(activeArticle.cannedResponse, activeArticle.id)}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold transition-colors"
                >
                  {copiedId === activeArticle.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>คัดลอกแล้ว</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>คัดลอกไปใช้</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans italic">
                "{activeArticle.cannedResponse}"
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportKnowledgeBase;
