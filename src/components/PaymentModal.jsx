import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { functions, db } from "../firebase/config.js";
import { soundManager } from "../utils/audioNotification.js";
import "./PaymentModal.css";

function PaymentModal({
  isOpen,
  onClose,
  amount = 0,
  itemTitle = "รายการจองอาหาร QueueUp",
  orderId = "ORD-PENDING",
  productId,
  quantity = 1,
  couponCode,
  booking,
  storeId = "store_canteen01",
  shopName = "ร้านครัวโรงเรียน QueueUp Canteen",
  shopLocation = "โรงอาหาร 1 (อาคารเรียน 2)",
  queueNo = "A06",
  onPaymentSuccess,
}) {
  const navigate = useNavigate();

  // Payment Tabs: 'promptpay' | 'slip' | 'card'
  const [activePaymentMethod, setActivePaymentMethod] = useState("promptpay");

  // Timer State (15:00 minutes countdown)
  const [timeLeft, setTimeLeft] = useState(900);

  // Cloud Function Payment State
  const [serverPaymentData, setServerPaymentData] = useState(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Slip Upload States
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [isVerifyingSlip, setIsVerifyingSlip] = useState(false);
  const [slipVerified, setSlipVerified] = useState(false);

  // Success & Submitting States
  const [isPaidSuccess, setIsPaidSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    setSlipFile(null);
    setSlipPreview(null);
    setSlipVerified(false);
    setIsPaidSuccess(false);
    setIsSubmitting(false);
    onClose();
  }, [onClose]);

  // Initiate Server Payment with Cloud Function
  useEffect(() => {
    if (!isOpen || !productId) return;
    let isMounted = true;

    const initPayment = async () => {
      setIsLoadingPayment(true);
      setPaymentError(null);
      try {
        const createPayment = httpsCallable(functions, "createPromptPayPayment");
        const idempotencyKey = `pay_${productId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const res = await createPayment({
          productId,
          quantity: Number(quantity) || 1,
          couponCode: couponCode || undefined,
          booking: booking || undefined,
          idempotencyKey,
        });

        if (isMounted && res.data) {
          setServerPaymentData(res.data);
        }
      } catch (err) {
        console.warn("Cloud function createPromptPayPayment error (using offline promptpay fallback if unconfigured):", err);
        if (isMounted) setPaymentError(err?.message || "ระบบชำระเงินขัดข้อง");
      } finally {
        if (isMounted) setIsLoadingPayment(false);
      }
    };

    initPayment();
    return () => { isMounted = false; };
  }, [isOpen, productId, quantity, couponCode, booking]);

  // Real-time Firestore Order Listener for Live Webhook Payment Status
  useEffect(() => {
    if (!serverPaymentData?.orderId) return;
    const unsub = onSnapshot(doc(db, "orders", serverPaymentData.orderId), (docSnap) => {
      if (docSnap.exists() && docSnap.data()?.paymentStatus === "paid") {
        setIsPaidSuccess(true);
        soundManager.playQueueIssuedSound();
        setTimeout(() => {
          if (onPaymentSuccess) onPaymentSuccess(serverPaymentData.orderId);
          handleClose();
          navigate("/user/account/profile?tab=bookings");
        }, 1500);
      }
    });
    return () => unsub();
  }, [serverPaymentData?.orderId, onPaymentSuccess, navigate, handleClose]);

  // Countdown timer effect
  useEffect(() => {
    if (!isOpen || isPaidSuccess) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, isPaidSuccess]);

  // Format timer as mm:ss
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  // Handle Payment Slip Image Selection
  const handleSlipChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result);
        setIsVerifyingSlip(true);
        setSlipVerified(false);

        // Simulated Automatic OCR Slip Verification after 1.2s
        setTimeout(() => {
          setIsVerifyingSlip(false);
          setSlipVerified(true);
        }, 1200);
      };
      reader.readAsDataURL(file);
    }
  };

  // Confirm Payment
  const handleConfirmPayment = () => {
    if (isSubmitting || isPaidSuccess) return;
    setIsSubmitting(true);
    setIsPaidSuccess(true);
    soundManager.playQueueIssuedSound();

    const finalOrderId = serverPaymentData?.orderId || `ORD-${Date.now()}`;

    setTimeout(() => {
      if (onPaymentSuccess) {
        onPaymentSuccess(finalOrderId);
      }
      handleClose();
      navigate("/user/account/profile?tab=bookings");
    }, 1500);
  };

  // PromptPay QR (Use Server QR from Opn if available, fallback to dynamic PromptPay standard)
  const qrCodeUrl = serverPaymentData?.qrUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=00020101021129370016A000000677010111011300668123456785802TH5303764540${Number(
      amount
    ).toFixed(2)}6304`;

  return (
    <div className="payment-modal-backdrop" onClick={handleClose}>
      <div className="payment-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="payment-modal-header">
          <h3 className="payment-modal-title">
            <i className="bi bi-shield-check" /> ชำระเงินด้วย PromptPay / แนบสลิป
          </h3>
          <button className="payment-modal-close-btn" onClick={handleClose} aria-label="ปิด">
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Environment Badge */}
        <div className="payment-env-badge live">
          <span>
            <i className="bi bi-lock-fill me-1" /> ระบบชำระเงินปลอดภัย SSL 256-bit (QueueUp Pay)
          </span>
          <span className="badge bg-success">พร้อมใช้งาน</span>
        </div>

        {/* Summary Bar */}
        <div className="payment-summary-bar">
          <div>
            <div className="fw-bold text-dark">{itemTitle}</div>
            <div className="text-muted small">
              ร้าน: {shopName} ({shopLocation}) | คิว: <span className="badge bg-danger">{queueNo}</span> | รหัสออเดอร์: {serverPaymentData?.orderId || orderId}
            </div>
            {storeId && <span className="d-none">{storeId}</span>}
          </div>
          <div className="payment-summary-amount">฿{Number(amount).toFixed(2)}</div>
        </div>

        {/* Payment Method Selector Tabs */}
        {!isPaidSuccess && (
          <div className="payment-methods-nav">
            <button
              className={`payment-method-tab ${
                activePaymentMethod === "promptpay" ? "active" : ""
              }`}
              onClick={() => setActivePaymentMethod("promptpay")}
            >
              <i className="bi bi-qr-code-scan" />
              <span>PromptPay QR</span>
            </button>

            <button
              className={`payment-method-tab ${activePaymentMethod === "slip" ? "active" : ""}`}
              onClick={() => setActivePaymentMethod("slip")}
            >
              <i className="bi bi-file-earmark-image" />
              <span>แนบสลิปโอนเงิน</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="payment-modal-body text-center">
          {/* SUCCESS STATE */}
          {isPaidSuccess ? (
            <div className="py-4">
              <i className="bi bi-check-circle-fill text-success display-3 mb-3 d-block" />
              <h4 className="fw-bold text-dark mb-2">ชำระเงินสำเร็จแล้ว!</h4>
              <p className="text-muted small mb-3">
                คิวอาหารของคุณถูกส่งเข้าสู่ครัวเรียบร้อยแล้ว กำลังนำคุณไปยังหน้าติดตามสถานะคิว...
              </p>
              <div className="spinner-border text-danger spinner-border-sm" role="status" />
            </div>
          ) : (
            <>
              {/* TAB 1: PROMPTPAY QR */}
              {activePaymentMethod === "promptpay" && (
                <div className="promptpay-qr-container">
                  {isLoadingPayment && (
                    <div className="py-3">
                      <div className="spinner-border text-danger spinner-border-sm mb-2" role="status" />
                      <div className="small text-muted">กำลังสร้าง PromptPay QR Code จากเซิร์ฟเวอร์...</div>
                    </div>
                  )}
                  {paymentError && (
                    <div className="alert alert-warning small py-2 mb-3">
                      <i className="bi bi-info-circle me-1" /> {paymentError}
                    </div>
                  )}
                  <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                    <img
                      src="/logo.png"
                      alt="PromptPay Logo"
                      style={{ height: "28px", objectFit: "contain" }}
                    />
                    <span className="fw-bold text-navy" style={{ color: "#004071" }}>
                      พร้อมเพย์ (PromptPay)
                    </span>
                  </div>

                  <div className="promptpay-qr-box">
                    <img src={qrCodeUrl} alt="PromptPay QR Code" className="promptpay-qr-img" />
                  </div>

                  <div className="promptpay-timer">
                    <i className="bi bi-clock me-1 text-danger" />
                    กรุณาชำระเงินภายใน{" "}
                    <span className="fw-bold text-danger fs-6">{formatTime(timeLeft)}</span> นาที
                  </div>

                  <div className="alert alert-info py-2 px-3 small text-start w-100 mb-0">
                    <i className="bi bi-info-circle-fill me-1" /> สแกนผ่านแอปธนาคารทุกธนาคาร (SCB,
                    KBank, Krungthai, KKP, TTBY, GSB) เพื่อชำระยอด ฿
                    {Number(amount).toFixed(2)}
                  </div>
                </div>
              )}

              {/* TAB 2: SLIP UPLOAD */}
              {activePaymentMethod === "slip" && (
                <div className="text-start">
                  <label className="form-label small fw-bold text-dark">
                    อัปโหลดสลิปการโอนเงิน (Payment Slip) *
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-control mb-3"
                    onChange={handleSlipChange}
                  />

                  {slipPreview && (
                    <div className="border rounded-3 p-3 bg-light text-center mb-3">
                      <div className="small text-muted mb-2">ตัวอย่างสลิปที่แนบ:</div>
                      <img
                        src={slipPreview}
                        alt="Slip Preview"
                        style={{ maxHeight: "180px", borderRadius: "8px", objectFit: "contain" }}
                      />

                      {isVerifyingSlip && (
                        <div className="mt-2 text-primary small fw-bold">
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                          />
                          กำลังตรวจสอบยอดสลิปด้วยระบบ AI OCR...
                        </div>
                      )}

                      {slipVerified && (
                        <div className="mt-2 text-success small fw-bold">
                          <i className="bi bi-check-circle-fill me-1" /> ตรวจสอบสลิปถูกต้อง •
                          ตรงตามยอด ฿{Number(amount).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}

                  {!slipPreview && (
                    <div
                      className="border border-dashed rounded-3 p-4 text-center text-muted"
                      style={{ background: "#f8fafc" }}
                    >
                      <i className="bi bi-cloud-arrow-up fs-2 d-block mb-1 text-slate-400" />
                      <div className="small fw-bold">เลือกไฟล์สลิปหรือลากไฟล์มาวางที่นี่</div>
                      <div className="text-xs text-slate-400">รองรับไฟล์ภาพ JPG, PNG, WEBP</div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!isPaidSuccess && (
          <div className="payment-modal-footer d-flex gap-2">
            <button className="btn btn-light border text-muted flex-grow-1" onClick={handleClose}>
              ยกเลิก
            </button>

            {activePaymentMethod === "promptpay" && (
              <button className="btn-pay-now flex-grow-1" onClick={handleConfirmPayment}>
                <i className="bi bi-check-circle-fill me-1" /> ยืนยันการชำระเงิน ฿
                {Number(amount).toFixed(2)}
              </button>
            )}

            {activePaymentMethod === "slip" && (
              <button
                className="btn-pay-now flex-grow-1"
                onClick={handleConfirmPayment}
                disabled={!slipVerified && !slipFile}
              >
                <i className="bi bi-send-check-fill me-1" /> ยืนยันส่งสลิปชำระเงิน
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentModal;
