import { useState } from "react";
import "./PdpaPolicyModal.css";

/**
 * QUEUEUP PDPA PRIVACY POLICY & TERMS OF SERVICE MODAL
 * Official Legal Framework for School Food CRM (PDPA 2562 Compliant)
 */
export default function PdpaPolicyModal({ isOpen, onClose, initialTab = "privacy" }) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'privacy' | 'terms' | 'merchant' | 'parent' | 'refund'

  if (!isOpen) return null;

  return (
    <div className="pdpa-modal-overlay" tabIndex="-1">
      <div className="pdpa-modal-card">
        {/* Header */}
        <div className="pdpa-modal-header">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-shield-check text-warning fs-3" />
            <div>
              <h4 className="fw-bold mb-0 text-white fs-5">
                ข้อตกลงและนโยบายความเป็นส่วนตัว (PDPA Policy & Terms)
              </h4>
              <span className="text-slate-300 small">
                พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 — QueueUp School Food CRM v2.5
              </span>
            </div>
          </div>
          <button type="button" className="btn-close btn-close-white" onClick={onClose} />
        </div>

        {/* Tab Navigation */}
        <div className="pdpa-nav-tabs">
          <button
            className={`pdpa-tab-btn ${activeTab === "privacy" ? "active" : ""}`}
            onClick={() => setActiveTab("privacy")}
          >
            <i className="bi bi-file-earmark-lock me-1" /> นโยบายความเป็นส่วนตัว (PDPA)
          </button>
          <button
            className={`pdpa-tab-btn ${activeTab === "terms" ? "active" : ""}`}
            onClick={() => setActiveTab("terms")}
          >
            <i className="bi bi-file-earmark-text me-1" /> เงื่อนไขการใช้งาน (Terms)
          </button>
          <button
            className={`pdpa-tab-btn ${activeTab === "parent" ? "active" : ""}`}
            onClick={() => setActiveTab("parent")}
          >
            <i className="bi bi-people-fill me-1" /> นโยบายผู้ปกครอง & ผู้เยาว์
          </button>
          <button
            className={`pdpa-tab-btn ${activeTab === "merchant" ? "active" : ""}`}
            onClick={() => setActiveTab("merchant")}
          >
            <i className="bi bi-shop me-1" /> นโยบายร้านค้า & โรงอาหาร
          </button>
          <button
            className={`pdpa-tab-btn ${activeTab === "refund" ? "active" : ""}`}
            onClick={() => setActiveTab("refund")}
          >
            <i className="bi bi-arrow-counterclockwise me-1" /> นโยบายการคืนเงิน
          </button>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="pdpa-modal-body">
          {/* TAB 1: PRIVACY POLICY */}
          {activeTab === "privacy" && (
            <div className="pdpa-section-text">
              <h5 className="fw-bold text-warning mb-3">
                นโยบายความเป็นส่วนตัว (PDPA Privacy Policy) และการยินยอมการใช้ข้อมูลส่วนบุคคล
              </h5>
              <p className="lead-text">
                ข้าพเจ้าได้อ่าน ทำความเข้าใจ และยินยอมให้ QueueUp School Food CRM เก็บรวบรวม ใช้ เปิดเผย และประมวลผลข้อมูลส่วนบุคคลของข้าพเจ้าตามวัตถุประสงค์ที่ระบุไว้ในนโยบายความเป็นส่วนตัวฉบับนี้ ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
              </p>

              <h6 className="fw-bold text-white mt-4 mb-2">1. วัตถุประสงค์ของระบบ QueueUp</h6>
              <p>QueueUp เป็นแพลตฟอร์มบริหารจัดการโรงอาหารและระบบสั่งอาหารล่วงหน้าสำหรับโรงเรียนและมหาวิทยาลัย มีวัตถุประสงค์เพื่อ:</p>
              <ul>
                <li>ลดระยะเวลาการรอคิวซื้ออาหารในโรงอาหาร</li>
                <li>อำนวยความสะดวกในการสั่งอาหารและจองคิวล่วงหน้า</li>
                <li>ช่วยร้านค้าบริหารจัดการออเดอร์ คิว และสินค้าได้อย่างเป็นระบบ</li>
                <li>สนับสนุนการสร้างลูกค้าประจำผ่านระบบ CRM สะสมแต้มและคูปอง</li>
                <li>ช่วยผู้ปกครองติดตามการใช้จ่ายและการรับประทานอาหารของบุตรหลาน</li>
                <li>ช่วยสถานศึกษาบริหารจัดการระบบโรงอาหารได้อย่างมีประสิทธิภาพสูงสุด</li>
                <li>พัฒนาคุณภาพการให้บริการและประสบการณ์ผู้ใช้งานภายในสถานศึกษา</li>
              </ul>

              <h6 className="fw-bold text-white mt-4 mb-2">2. ข้อมูลที่ระบบอาจเก็บรวบรวม</h6>
              <div className="pdpa-box">
                <h6 className="fw-bold text-info mb-1">2.1 ข้อมูลบัญชีผู้ใช้</h6>
                <p className="mb-0">ชื่อ-นามสกุล, อีเมล, เบอร์โทรศัพท์, วันเดือนปีเกิด (ถ้ามี), รูปโปรไฟล์, รหัสอ้างอิงบัญชี (Account ID)</p>
              </div>
              <div className="pdpa-box">
                <h6 className="fw-bold text-info mb-1">2.2 ข้อมูลการใช้งานระบบ</h6>
                <p className="mb-0">ประวัติการเข้าสู่ระบบ, ประวัติการสั่งซื้ออาหาร, ประวัติการจองคิว, รายการโปรด, ประวัติการค้นหา, คะแนนสะสมและคูปอง</p>
              </div>
              <div className="pdpa-box">
                <h6 className="fw-bold text-info mb-1">2.3 ข้อมูลการชำระเงิน</h6>
                <p className="mb-0">หลักฐานการโอนเงิน (สลิป PromptPay), วันที่และเวลาทำรายการ, ยอดชำระเงิน, สถานะการชำระเงิน <br />
                <span className="text-warning"><b>หมายเหตุ:</b> ระบบจะไม่จัดเก็บรหัสผ่านธนาคาร บัตรเครดิต รหัส OTP หรือข้อมูลทางการเงินที่ละเอียดอ่อนของผู้ใช้งาน</span></p>
              </div>
              <div className="pdpa-box">
                <h6 className="fw-bold text-info mb-1">2.4 ข้อมูลร้านค้า (สำหรับผู้ขาย)</h6>
                <p className="mb-0">ข้อมูลร้านค้า, รายการสินค้า, ประวัติคำสั่งซื้อ, ข้อมูลบัญชีรับชำระเงิน (ข้อมูลทางการเงินของร้านค้าจะถูกจัดเก็บในพื้นที่จำกัดสิทธิ์พิเศษ 100%)</p>
              </div>

              <h6 className="fw-bold text-white mt-4 mb-2">3. สิทธิของเจ้าของข้อมูลส่วนบุคคล (PDPA Rights)</h6>
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
            <div className="pdpa-section-text">
              <h5 className="fw-bold text-warning mb-3">เงื่อนไขการใช้งาน (Terms of Service)</h5>
              <h6 className="fw-bold text-white mt-3">1. สิทธิและหน้าที่ของผู้ใช้งาน</h6>
              <p>ผู้ใช้งานต้องกรอกข้อมูลที่เป็นความจริงในการสมัครสมาชิก และรักษาความลับของรหัสผ่านเข้าสู่ระบบ</p>

              <h6 className="fw-bold text-white mt-3">2. ข้อห้ามในการใช้งาน</h6>
              <p>ห้ามใช้ระบบในการสั่งอาหารปลอม (Spam Orders), สแกนสลิปโอนเงินปลอม, หรือพยายามเจาะระบบข้อมูลของผู้อื่น</p>

              <h6 className="fw-bold text-white mt-3">3. การระงับและปิดบัญชี</h6>
              <p>หากพบการกระทำผิดเงื่อนไขหรือการทุจริตคำสั่งซื้อ ผู้ดูแลระบบมีสิทธิระงับการใช้งานบัญชีชั่วคราวหรือถาวรได้ทันที</p>
            </div>
          )}

          {/* TAB 3: PARENT & MINOR POLICY */}
          {activeTab === "parent" && (
            <div className="pdpa-section-text">
              <h5 className="fw-bold text-warning mb-3">นโยบายสำหรับผู้ปกครองและคุ้มครองผู้เยาว์ (Minor & Parent Policy)</h5>
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
            <div className="pdpa-section-text">
              <h5 className="fw-bold text-warning mb-3">นโยบายสำหรับร้านค้าและโรงอาหาร (Merchant & Canteen Policy)</h5>
              <ul>
                <li><strong>ข้อกำหนดการเปิดร้าน:</strong> ร้านค้าต้องเป็นผู้ประกอบการที่ได้รับอนุญาตจากโรงเรียน/สถานศึกษา</li>
                <li><strong>มาตรฐานคุณภาพอาหาร:</strong> อาหารทุกรายการต้องมีความสะอาด สดใหม่ และตรงตามราคาที่แสดงในระบบ</li>
                <li><strong>การจัดการคิว:</strong> ร้านค้าต้องอัปเดตสถานะอาหาร (กำลังปรุง &rarr; พร้อมรับ) อย่างแม่นยำเพื่อประโยชน์ของผู้ใช้</li>
              </ul>
            </div>
          )}

          {/* TAB 5: REFUND POLICY */}
          {activeTab === "refund" && (
            <div className="pdpa-section-text">
              <h5 className="fw-bold text-warning mb-3">นโยบายการคืนเงินและยกเลิกคำสั่งซื้อ (Refund & Cancellation Policy)</h5>
              <ul>
                <li><strong>การยกเลิกออเดอร์:</strong> สามารถยกเลิกได้ก่อนที่ร้านค้าจะกดรับออเดอร์/เริ่มปรุงอาหาร</li>
                <li><strong>เงื่อนไขการคืนเงิน:</strong> กรณีร้านค้าไม่สามารถจัดส่งอาหารได้ หรือสินค้าหมด ระบบจะดำเนินการคืนเงินเต็มจำนวนเข้าบัญชีผู้ใช้ทันที</li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pdpa-modal-footer">
          <div className="text-slate-400 small me-auto">
            <i className="bi bi-lock-fill me-1" /> ข้อมูลทั้งหมดได้รับการดูแลภายใต้ พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562
          </div>
          <button type="button" className="btn btn-warning font-weight-bold px-4" onClick={onClose}>
            รับทราบและปิดหน้านี้ ✕
          </button>
        </div>
      </div>
    </div>
  );
}
