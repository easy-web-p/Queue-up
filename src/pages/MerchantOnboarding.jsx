import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { switchRole, clearUser } from "../store/authSlice.js";
import { db, doc, setDoc } from "../firebase/config.js";
import {
  generateAccountId,
  generateMerchantId,
  generateStoreId,
  recordAuditLog,
} from "../services/storeIsolationEngine.js";
import SellerAssistantModal from "../components/SellerAssistantModal.jsx";
import "./MerchantOnboarding.css";

/**
 * QUEUEUP MERCHANT ONBOARDING PAGE (/portal/th-onboarding)
 * Matching exact reference mockup: Welcome new seller, store setup, PromptPay verification.
 */
function MerchantOnboarding() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // Onboarding Step State: 0 (Welcome Screen) | 1 (Store Info Form) | 2 (Payment Setup) | 3 (Complete)
  const [step, setStep] = useState(0);

  const [isSellerAssistantOpen, setIsSellerAssistantOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);

  const handleLogout = () => {
    dispatch(clearUser());
    navigate("/login", { replace: true });
  };

  const getCleanName = () => {
    if (!user) return "";
    const raw = user.name || "";
    if (!raw || raw.toLowerCase().includes("anime manga")) {
      if (user.email && user.email.includes("@")) return user.email.split("@")[0];
      return "สมาชิก";
    }
    return raw;
  };

  const cleanOwnerName = getCleanName();

  // Merchant Form States
  const [storeName, setStoreName] = useState(
    cleanOwnerName ? `ร้านค้าของคุณ ${cleanOwnerName}` : "ร้านอาหารโรงอาหาร 1"
  );
  const [canteenLocation, setCanteenLocation] = useState("โรงอาหาร 1 (อาคารเรียน 2)");
  const [counterNo, setCounterNo] = useState("เคาน์เตอร์ 4");
  const [phone, setPhone] = useState("081-234-5678");
  const [promptpayName, setPromptpayName] = useState(cleanOwnerName || "เจ้าของร้าน QueueUp");
  const [promptpayNo, setPromptpayNo] = useState("081-234-5678");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Complete Merchant Registration (Architecture v3.0)
  const handleCompleteRegistration = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);

    const accountId = generateAccountId();
    const merchantId = generateMerchantId();
    const storeId = generateStoreId();

    const userProfileUpdate = {
      accountId,
      merchantId,
      storeId,
      isMerchantRegistered: true,
      role: "merchant",
      isMerchantVerified: true,
      updatedAt: new Date().toISOString(),
    };

    // Save to Firestore Structure v3.0
    if (user && user.uid) {
      try {
        // 1. users/{uid}
        await setDoc(doc(db, "users", user.uid), userProfileUpdate, { merge: true });

        // 2. merchantProfiles/{merchantId}
        await setDoc(
          doc(db, "merchantProfiles", merchantId),
          {
            merchantId,
            storeId,
            ownerUid: user.uid,
            merchantStoreName: storeName,
            businessPhone: phone,
            canteenLocation: `${canteenLocation} (${counterNo})`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // 3. shops/{storeId}
        await setDoc(
          doc(db, "shops", storeId),
          {
            storeId,
            merchantId,
            ownerUid: user.uid,
            storeName,
            canteenLocation: `${canteenLocation} (${counterNo})`,
            phone,
            storeHours: "07:00 - 15:00 น.",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // 4. merchantProfiles/{merchantId}/private/finance (Private Isolated Subcollection)
        await setDoc(
          doc(db, "merchantProfiles", merchantId, "private", "finance"),
          {
            ownerUid: user.uid,
            bankName: "PromptPay (พร้อมเพย์)",
            accountNumber: promptpayNo,
            accountOwner: promptpayName,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // 5. Audit Log in auditLogs
        await recordAuditLog(db, {
          action: "REGISTER_MERCHANT",
          actorUid: user.uid,
          merchantId,
          metadata: { storeId, accountId, storeName },
        });
      } catch (err) {
        console.error("Firestore Onboarding Error:", err);
      }
    }

    // Save non-sensitive transient UI reference keys ONLY (Architecture v3.0 LocalStorage Policy)
    localStorage.setItem("queueup_last_store_id", storeId);
    localStorage.setItem("queueup_last_merchant_id", merchantId);

    // Switch Role to Merchant
    dispatch(switchRole("merchant"));

    setTimeout(() => {
      setIsSubmitting(false);
      setStep(3);
    }, 600);
  };

  const handleGoToDashboard = () => {
    dispatch(switchRole("merchant"));
    navigate("/merchant/dashboard", { replace: true });
  };

  return (
    <div className="shopee-onboarding-page">
      {/* Top Header Bar */}
      <header className="shopee-onboarding-header">
        <div className="shopee-onboarding-header-container">
          <div className="shopee-onboarding-brand" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>
            <img src="/logo.png" alt="QueueUp Logo" className="shopee-onboarding-logo" />
            <span className="shopee-onboarding-title">QueueUp Seller Centre</span>
          </div>

          {/* User Profile Dropdown matching Screenshot Reference 2 */}
          <div className="position-relative">
            <button
              className="btn btn-light d-flex align-items-center gap-2 font-weight-bold rounded-pill px-3 shadow-sm border"
              onClick={() => setIsUserDropdownOpen((prev) => !prev)}
            >
              <div
                className="rounded-circle bg-secondary-subtle d-flex align-items-center justify-content-center"
                style={{ width: "28px", height: "28px" }}
              >
                <i className="bi bi-person-fill text-secondary fs-6" />
              </div>
              <span className="text-dark small font-weight-bold">
                {user ? user.name || user.email : "สมาชิก QueueUp"}
              </span>
              <i className={`bi bi-chevron-${isUserDropdownOpen ? "up" : "down"} text-muted small`} />
            </button>

            {isUserDropdownOpen && (
              <div
                className="position-absolute end-0 mt-2 bg-white rounded-3 shadow-lg p-3 text-dark text-center border"
                style={{ width: "220px", zIndex: 9999 }}
              >
                <div
                  className="rounded-circle bg-light d-flex align-items-center justify-content-center mx-auto mb-2 border"
                  style={{ width: "64px", height: "64px" }}
                >
                  <i className="bi bi-person-fill text-secondary display-6" />
                </div>
                <div className="fw-bold text-dark fs-6 mb-2">
                  {user ? user.name || user.email : "สมาชิก QueueUp"}
                </div>
                <hr className="my-2" />
                <button
                  className="btn btn-outline-danger w-100 font-weight-bold d-flex align-items-center justify-content-center gap-2 py-2 rounded-3"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right fs-5" /> ออกจากระบบ
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body Onboarding Container */}
      <main className="shopee-onboarding-main">
        {/* STEP 0: WELCOME SCREEN (Matching Reference Screenshot 2) */}
        {step === 0 && (
          <div className="shopee-onboarding-card fade-in">
            <div className="shopee-onboarding-illustration-box">
              <img
                src="/logo.png"
                alt="Welcome Merchant"
                className="shopee-onboarding-illustration-img"
              />
            </div>
            <h2 className="shopee-onboarding-card-title">ยินดีต้อนรับผู้ใช้ใหม่</h2>
            <p className="shopee-onboarding-card-subtitle">
              คุณสามารถเริ่มต้นการขายสินค้าใน QueueUp ได้โดยสร้างบัญชีผู้ขาย
            </p>
            <button
              className="shopee-onboarding-btn-primary"
              onClick={() => setStep(1)}
            >
              สร้างบัญชีผู้ขาย
            </button>
          </div>
        )}

        {/* STEP 1: STORE & CANTEEN INFO FORM */}
        {step === 1 && (
          <div className="shopee-onboarding-card form-card fade-in">
            <div className="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom">
              <div>
                <h3 className="fw-bold mb-1" style={{ color: "#222" }}>
                  ขั้นตอนที่ 1/2: ข้อมูลร้านค้าและโรงอาหาร
                </h3>
                <p className="text-muted small mb-0">กรอกข้อมูลร้านค้าของคุณสำหรับแสดงในระบบจองคิวโรงอาหาร</p>
              </div>
              <span className="badge bg-warning text-dark px-3 py-2 rounded-pill">ขั้นตอน 1 จาก 2</span>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
              <div className="mb-3">
                <label className="form-label fw-bold small text-dark">ชื่อร้านค้า (Store Name) *</label>
                <input
                  type="text"
                  className="form-control"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="เช่น ร้านครัวโรงเรียน ป้าแดงตามสั่ง"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-bold small text-dark">ตำแหน่งโรงอาหาร (Canteen Location) *</label>
                <select
                  className="form-select"
                  value={canteenLocation}
                  onChange={(e) => setCanteenLocation(e.target.value)}
                  required
                >
                  <option value="โรงอาหาร 1 (อาคารเรียน 2)">โรงอาหาร 1 (อาคารเรียน 2)</option>
                  <option value="โรงอาหาร 2 (ศูนย์กิจกรรมนักเรียน)">โรงอาหาร 2 (ศูนย์กิจกรรมนักเรียน)</option>
                  <option value="โรงอาหารกลาง มหาวิทยาลัย">โรงอาหารกลาง มหาวิทยาลัย</option>
                </select>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label fw-bold small text-dark">เลขเคาน์เตอร์ / ล็อคร้านค้า *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={counterNo}
                    onChange={(e) => setCounterNo(e.target.value)}
                    placeholder="เช่น เคาน์เตอร์ 4"
                    required
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label fw-bold small text-dark">เบอร์โทรศัพท์ติดต่อร้านค้า *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="เช่น 081-234-5678"
                    required
                  />
                </div>
              </div>

              <div className="d-flex justify-content-between pt-3 border-top">
                <button type="button" className="btn btn-outline-secondary px-4 rounded-pill" onClick={() => setStep(0)}>
                  ยกเลิก
                </button>
                <button type="submit" className="shopee-onboarding-btn-primary px-5 min-w-[180px]">
                  ถัดไป (ข้อมูลชำระเงิน) &rarr;
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: PROMPTPAY & PAYMENT DETAILS */}
        {step === 2 && (
          <div className="shopee-onboarding-card form-card fade-in">
            <div className="d-flex align-items-center justify-content-between mb-4 pb-2 border-bottom">
              <div>
                <h3 className="fw-bold mb-1" style={{ color: "#222" }}>
                  ขั้นตอนที่ 2/2: ข้อมูลการรับเงิน (PromptPay)
                </h3>
                <p className="text-muted small mb-0">กรอกข้อมูล PromptPay สำหรับรับเงินค่าอาหารจากนักเรียนและบุคลากร</p>
              </div>
              <span className="badge bg-success text-white px-3 py-2 rounded-pill">ขั้นตอน 2 จาก 2</span>
            </div>

            <form onSubmit={handleCompleteRegistration}>
              <div className="mb-3">
                <label className="form-label fw-bold small text-dark">ชื่อบัญชีรับเงิน (PromptPay Name) *</label>
                <input
                  type="text"
                  className="form-control"
                  value={promptpayName}
                  onChange={(e) => setPromptpayName(e.target.value)}
                  placeholder="เช่น นายสมชาย ใจดี"
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label fw-bold small text-dark">หมายเลข PromptPay / เบอร์โทรศัพท์รับเงิน *</label>
                <input
                  type="text"
                  className="form-control"
                  value={promptpayNo}
                  onChange={(e) => setPromptpayNo(e.target.value)}
                  placeholder="เช่น 081-234-5678 หรือ 1-1002-xxxx-xx-x"
                  required
                />
                <span className="form-text small text-muted">
                  💡 ระบบจะนำหมายเลข PromptPay นี้ไปเจน QR Code สำหรับให้นักเรียนสแกนจ่ายเงินค่าอาหารโดยตรง
                </span>
              </div>

              <div className="d-flex justify-content-between pt-3 border-top">
                <button type="button" className="btn btn-outline-secondary px-4 rounded-pill" onClick={() => setStep(1)}>
                  &larr; ย้อนกลับ
                </button>
                <button
                  type="submit"
                  className="shopee-onboarding-btn-primary px-5"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "⏳ กำลังยืนยันเปิดร้าน..." : "✓ ยืนยันการสร้างบัญชีผู้ขาย"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: REGISTRATION COMPLETE */}
        {step === 3 && (
          <div className="shopee-onboarding-card fade-in">
            <div className="text-success mb-3">
              <i className="bi bi-check-circle-fill display-2 text-danger" />
            </div>
            <h2 className="shopee-onboarding-card-title">สร้างบัญชีผู้ขายสำเร็จแล้ว! 🎉</h2>
            <p className="shopee-onboarding-card-subtitle mb-4">
              ร้านค้า <b>"{storeName}"</b> ของคุณพร้อมรับคำสั่งจองคิวอาหารและบริหารจัดการเมนูแล้ว
            </p>

            <div className="bg-light p-3 rounded-4 mb-4 text-start border w-100">
              <div className="fw-bold text-dark mb-1">📍 รายละเอียดร้านค้าของคุณ:</div>
              <div className="small text-muted mb-1"><b>ชื่อร้าน:</b> {storeName}</div>
              <div className="small text-muted mb-1"><b>ตำแหน่ง:</b> {canteenLocation} ({counterNo})</div>
              <div className="small text-muted"><b>PromptPay:</b> {promptpayName} ({promptpayNo})</div>
            </div>

            <button
              className="shopee-onboarding-btn-primary w-100 py-3"
              onClick={handleGoToDashboard}
            >
              🚀 เข้าสู่ระบบหลังบ้านร้านค้า (Go to Merchant Dashboard)
            </button>
          </div>
        )}
      </main>

      {/* Seller Assistant Floating Widget Trigger */}
      <button
        className="btn btn-danger rounded-circle shadow-lg position-fixed d-flex align-items-center justify-content-center"
        style={{
          bottom: "30px",
          right: "30px",
          width: "62px",
          height: "62px",
          zIndex: 9990,
          background: "linear-gradient(135deg, #ee4d2d 0%, #ff7337 100%)",
          border: "none",
        }}
        onClick={() => setIsSellerAssistantOpen(true)}
        title="เปิด Seller Assistant ผู้ช่วยร้านค้า"
      >
        <i className="bi bi-headset fs-2 text-white" />
      </button>

      {/* Seller Assistant Modal matching reference screenshot 1 */}
      <SellerAssistantModal
        isOpen={isSellerAssistantOpen}
        onClose={() => setIsSellerAssistantOpen(false)}
        userName={cleanOwnerName || (user ? user.name || user.email : "ผู้ขาย")}
      />
    </div>
  );
}

export default MerchantOnboarding;
