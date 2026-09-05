import { Link, useSearchParams } from "react-router-dom";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import Footer from "../components/Footer.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";
import "./PdpaPolicy.css";

/**
 * QUEUEUP STANDALONE PDPA PRIVACY POLICY & TERMS OF SERVICE PAGE (/pdpa, /privacy, /terms)
 * Official Legal Framework for School Food CRM (PDPA 2562 Compliant)
 */
function PdpaPolicy() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = usePreferences();
  
  // Tab state: 'privacy' | 'terms' | 'parent' | 'merchant' | 'refund'
  const activeTab = searchParams.get("tab") || "privacy";

  const handleTabChange = (tab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="pdpa-page-wrapper min-h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 pb-16">
      {/* Header Search Bar */}
      <ShopeeSearchBar />

      {/* Main Content Container */}
      <main className="pdpa-page-container max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Page Banner Header */}
        <div className="pdpa-page-header bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="pdpa-header-icon-box w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center text-2xl shadow-md shadow-orange-500/20">
              <i className="bi bi-shield-check" />
            </div>
            <div>
              <h1 className="pdpa-page-title text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-1">
                {language === "en"
                  ? "Terms of Service & Privacy Policy (PDPA)"
                  : "ข้อตกลงและนโยบายความเป็นส่วนตัว (PDPA Policy & Terms)"}
              </h1>
              <p className="pdpa-page-subtitle text-xs text-slate-500 dark:text-slate-400 mb-0">
                {language === "en"
                  ? "Personal Data Protection Act B.E. 2562 — QueueUp School Food CRM v2.5"
                  : "พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 — QueueUp School Food CRM v2.5"}
              </p>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="pdpa-page-tabs flex items-center gap-2 overflow-x-auto pb-2">
          <button
            className={`pdpa-page-tab-btn px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-0 ${
              activeTab === "privacy"
                ? "active bg-[#ee4d2d] text-white shadow-md shadow-orange-500/20 font-black"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            onClick={() => handleTabChange("privacy")}
          >
            <i className="bi bi-file-earmark-lock" />
            {language === "en" ? "Privacy Policy (PDPA)" : "นโยบายความเป็นส่วนตัว (PDPA)"}
          </button>

          <button
            className={`pdpa-page-tab-btn px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-0 ${
              activeTab === "terms"
                ? "active bg-[#ee4d2d] text-white shadow-md shadow-orange-500/20 font-black"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            onClick={() => handleTabChange("terms")}
          >
            <i className="bi bi-file-earmark-text" />
            {language === "en" ? "Terms of Service" : "เงื่อนไขการใช้งาน (Terms)"}
          </button>

          <button
            className={`pdpa-page-tab-btn px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-0 ${
              activeTab === "parent"
                ? "active bg-[#ee4d2d] text-white shadow-md shadow-orange-500/20 font-black"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            onClick={() => handleTabChange("parent")}
          >
            <i className="bi bi-people-fill" />
            {language === "en" ? "Minor & Parent Policy" : "นโยบายผู้ปกครอง & ผู้เยาว์"}
          </button>

          <button
            className={`pdpa-page-tab-btn px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-0 ${
              activeTab === "merchant"
                ? "active bg-[#ee4d2d] text-white shadow-md shadow-orange-500/20 font-black"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            onClick={() => handleTabChange("merchant")}
          >
            <i className="bi bi-shop" />
            {language === "en" ? "Merchant Policy" : "นโยบายร้านค้า & โรงอาหาร"}
          </button>

          <button
            className={`pdpa-page-tab-btn px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border-0 ${
              activeTab === "refund"
                ? "active bg-[#ee4d2d] text-white shadow-md shadow-orange-500/20 font-black"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            onClick={() => handleTabChange("refund")}
          >
            <i className="bi bi-arrow-counterclockwise" />
            {language === "en" ? "Refund Policy" : "นโยบายการคืนเงิน"}
          </button>
        </div>

        {/* Tab Content Box */}
        <div className="pdpa-page-content-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm leading-relaxed space-y-6">
          {/* TAB 1: PRIVACY POLICY */}
          {activeTab === "privacy" && (
            <div className="pdpa-content-section">
              <h2 className="pdpa-section-title">
                นโยบายความเป็นส่วนตัว (PDPA Privacy Policy) และการยินยอมการใช้ข้อมูลส่วนบุคคล
              </h2>
              <p className="pdpa-lead-p">
                ข้าพเจ้าได้อ่าน ทำความเข้าใจ และยินยอมให้ QueueUp School Food CRM เก็บรวบรวม ใช้ เปิดเผย และประมวลผลข้อมูลส่วนบุคคลของข้าพเจ้าตามวัตถุประสงค์ที่ระบุไว้ในนโยบายความเป็นส่วนตัวฉบับนี้ ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
              </p>

              <h3 className="pdpa-sub-title">1. วัตถุประสงค์ของระบบ QueueUp</h3>
              <p>QueueUp เป็นแพลตฟอร์มบริหารจัดการโรงอาหารและระบบสั่งอาหารล่วงหน้าสำหรับโรงเรียนและมหาวิทยาลัย มีวัตถุประสงค์เพื่อ:</p>
              <ul>
                <li>ลดระยะเวลาการรอคิวซื้ออาหารในโรงอาหาร</li>
                <li>อำนวยความสะดวกในการสั่งอาหารและจองคิวล่วงหน้า</li>
                <li>ช่วยร้านค้าบริหารจัดการออเดอร์ คิว และสินค้าได้อย่างเป็นระบบ</li>
                <li>สนับสนุนการสร้างลูกค้าประจำผ่านระบบ CRM สะสมแต้มและคูปอง</li>
                <li>ช่วยผู้ปกครองติดตามการใช้จ่ายและการรับประทานอาหารของบุตรหลาน</li>
                <li>ช่วยสถานศึกษาบริหารจัดการระบบโรงอาหารได้อย่างมีประสิทธิภาพสูงสุด</li>
              </ul>

              <h3 className="pdpa-sub-title">2. ข้อมูลที่ระบบอาจเก็บรวบรวม</h3>
              <div className="pdpa-info-box">
                <h4>2.1 ข้อมูลบัญชีผู้ใช้</h4>
                <p>ชื่อ-นามสกุล, อีเมล, เบอร์โทรศัพท์, วันเดือนปีเกิด (ถ้ามี), รูปโปรไฟล์, รหัสอ้างอิงบัญชี (Account ID)</p>
              </div>
              <div className="pdpa-info-box">
                <h4>2.2 ข้อมูลการใช้งานระบบ</h4>
                <p>ประวัติการเข้าสู่ระบบ, ประวัติการสั่งซื้ออาหาร, ประวัติการจองคิว, รายการโปรด, ประวัติการค้นหา, คะแนนสะสมและคูปอง</p>
              </div>
              <div className="pdpa-info-box">
                <h4>2.3 ข้อมูลการชำระเงิน</h4>
                <p>หลักฐานการโอนเงิน (สลิป PromptPay), วันที่และเวลาทำรายการ, ยอดชำระเงิน, สถานะการชำระเงิน <br />
                <span className="text-warning"><b>หมายเหตุ:</b> ระบบจะไม่จัดเก็บรหัสผ่านธนาคาร บัตรเครดิต รหัส OTP หรือข้อมูลทางการเงินที่ละเอียดอ่อนของผู้ใช้งาน</span></p>
              </div>
              <div className="pdpa-info-box">
                <h4>2.4 ข้อมูลร้านค้า (สำหรับผู้ขาย)</h4>
                <p>ข้อมูลร้านค้า, รายการสินค้า, ประวัติคำสั่งซื้อ, ข้อมูลบัญชีรับชำระเงิน (ข้อมูลทางการเงินของร้านค้าจะถูกจัดเก็บในพื้นที่จำกัดสิทธิ์พิเศษ 100%)</p>
              </div>

              <h3 className="pdpa-sub-title">3. สิทธิของเจ้าของข้อมูลส่วนบุคคล (PDPA Rights)</h3>
              <p>ผู้ใช้งานมีสิทธิตามกฎหมาย PDPA ในการ:</p>
              <ul>
                <li>ขอเข้าถึงและรับสำเนาข้อมูลส่วนบุคคลของตนเอง</li>
                <li>ขอแก้ไขข้อมูลส่วนบุคคลให้ถูกต้อง เป็นปัจจุบัน และสมบูรณ์</li>
                <li>ขอถอนความยินยอมในการประมวลผลข้อมูลส่วนบุคคลได้ตลอดเวลา</li>
                <li>ขอระงับการใช้ หรือขอให้ลบทำลายข้อมูลส่วนบุคคลตามเงื่อนไขทางกฎหมาย</li>
              </ul>
            </div>
          )}

          {/* TAB 2: TERMS OF SERVICE */}
          {activeTab === "terms" && (
            <div className="pdpa-content-section">
              <h2 className="pdpa-section-title">เงื่อนไขการใช้งาน (Terms of Service)</h2>
              <h3 className="pdpa-sub-title">1. สิทธิและหน้าที่ของผู้ใช้งาน</h3>
              <p>ผู้ใช้งานต้องกรอกข้อมูลที่เป็นความจริงในการสมัครสมาชิก และรักษาความลับของรหัสผ่านเข้าสู่ระบบ</p>

              <h3 className="pdpa-sub-title">2. ข้อห้ามในการใช้งาน</h3>
              <p>ห้ามใช้ระบบในการสั่งอาหารปลอม (Spam Orders), สแกนสลิปโอนเงินปลอม, หรือพยายามเจาะระบบข้อมูลของผู้อื่น</p>

              <h3 className="pdpa-sub-title">3. การระงับและปิดบัญชี</h3>
              <p>หากพบการกระทำผิดเงื่อนไขหรือการทุจริตคำสั่งซื้อ ผู้ดูแลระบบมีสิทธิระงับการใช้งานบัญชีชั่วคราวหรือถาวรได้ทันที</p>
            </div>
          )}

          {/* TAB 3: MINOR & PARENT POLICY */}
          {activeTab === "parent" && (
            <div className="pdpa-content-section">
              <h2 className="pdpa-section-title">นโยบายสำหรับผู้ปกครองและคุ้มครองผู้เยาว์ (Minor & Parent Policy)</h2>
              <p>เนื่องจาก QueueUp ออกแบบมาสำหรับสถานศึกษา จึงมีมาตรการคุ้มครองผู้เยาว์เป็นพิเศษ:</p>
              <ul>
                <li><strong>ขอบเขตข้อมูลขั้นต่ำ:</strong> บัญชีนักเรียน/ผู้เยาว์จะไม่ถูกร้องขอข้อมูลที่เกินจำเป็น เช่น พิกัด GPS หรือข้อมูลบัตรเครดิต</li>
                <li><strong>การเชื่อมต่อบัญชีผู้ปกครอง:</strong> ผู้ปกครองสามารถเชื่อมต่อบัญชีกับบุตรหลานเพื่อช่วยกำกับดูแลการเติมเงินและประวัติโภชนาการได้</li>
                <li><strong>ความปลอดภัยสูงสุด:</strong> ข้อมูลนักเรียนทุกคนได้รับการคุ้มครองสิทธิ์ตามมาตรฐานสถานศึกษา</li>
              </ul>
            </div>
          )}

          {/* TAB 4: MERCHANT POLICY */}
          {activeTab === "merchant" && (
            <div className="pdpa-content-section">
              <h2 className="pdpa-section-title">นโยบายสำหรับร้านค้าและโรงอาหาร (Merchant & Canteen Policy)</h2>
              <ul>
                <li><strong>ข้อกำหนดการเปิดร้าน:</strong> ร้านค้าต้องเป็นผู้ประกอบการที่ได้รับอนุญาตจากโรงเรียน/สถานศึกษา</li>
                <li><strong>มาตรฐานคุณภาพอาหาร:</strong> อาหารทุกรายการต้องมีความสะอาด สดใหม่ และตรงตามราคาที่แสดงในระบบ</li>
                <li><strong>การจัดการคิว:</strong> ร้านค้าต้องอัปเดตสถานะอาหาร (กำลังปรุง &rarr; พร้อมรับ) อย่างแม่นยำเพื่อประโยชน์ของผู้ใช้</li>
              </ul>
            </div>
          )}

          {/* TAB 5: REFUND POLICY */}
          {activeTab === "refund" && (
            <div className="pdpa-content-section">
              <h2 className="pdpa-section-title">นโยบายการคืนเงินและยกเลิกคำสั่งซื้อ (Refund & Cancellation Policy)</h2>
              <ul>
                <li><strong>การยกเลิกออเดอร์:</strong> สามารถยกเลิกได้ก่อนที่ร้านค้าจะกดรับออเดอร์/เริ่มปรุงอาหาร</li>
                <li><strong>เงื่อนไขการคืนเงิน:</strong> กรณีร้านค้าไม่สามารถจัดส่งอาหารได้ หรือสินค้าหมด ระบบจะดำเนินการคืนเงินเต็มจำนวนเข้าบัญชีผู้ใช้ทันที</li>
              </ul>
            </div>
          )}

          {/* Action Footer */}
          <div className="pdpa-page-actions pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-center">
            <Link to="/home" className="btn btn-primary fw-bold px-6 py-2.5 rounded-full bg-[#ee4d2d] hover:bg-[#ff7337] text-white border-0 shadow-lg shadow-orange-500/30 font-black text-sm flex items-center gap-2 transition-all cursor-pointer">
              <i className="bi bi-house-door-fill" />
              กลับสู่หน้าหลักโรงอาหาร
            </Link>
          </div>
        </div>
      </main>

      {/* Global Reusable Footer */}
      <Footer />
    </div>
  );
}

export default PdpaPolicy;
