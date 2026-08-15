import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import "./PageRouteLoader.css";

const MESSAGES = [
  "กำลังพาคุณไปยังหน้าหลัก QueueUp...",
  "จัดเตรียมข้อมูลคิวและเมนูอาหาร...",
  "กำลังโหลดระบบความปลอดภัย...",
  "กำลังเชื่อมต่อข้อมูลคิวออนไลน์...",
];

function PageRouteLoader() {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(MESSAGES[0]);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // ข้ามหน้าแรกรอนำทางจาก Loading.jsx หน้าแรก
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // เมื่อเกิดการเปลี่ยนเส้นทาง (Route Change) - Scroll window to top!
    window.scrollTo(0, 0);
    setIsLoading(true);
    setIsFadingOut(false);
    setProgress(20);
    const randomMsg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    setMessage(randomMsg);

    // เติมหลอด Progress Bar แบบสมูทจนเต็ม 100% ใน 450ms
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 25;
      });
    }, 100);

    // Fade-out อนิเมชันเมื่อโหลดเสร็จ
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 550);

    // ซ่อน Loader ทันทีหลัง Fade-out
    const hideTimer = setTimeout(() => {
      setIsLoading(false);
    }, 950);

    return () => {
      clearInterval(interval);
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, [location.pathname, location.search]);

  if (!isLoading) return null;

  return (
    <div className={`page-loader-overlay ${isFadingOut ? "fade-out" : ""}`}>
      <div className="page-loader-card">
        {/* Pulsing Ring & Bouncing Logo */}
        <div className="page-loader-ring-wrapper">
          <div className="page-loader-spinner-ring" />
          <div className="page-loader-icon-box">
            <img
              src="/logo.png"
              alt="QueueUp Logo"
              className="page-loader-logo-img"
            />
          </div>
        </div>

        {/* Brand Title */}
        <div className="page-loader-title">
          <span className="queue">Queue</span>
          <span className="up">Up</span>
        </div>
        <div className="page-loader-sub">SCHOOL FOOD CRM</div>

        {/* Loading Message */}
        <div className="page-loader-msg">{message}</div>

        {/* Progress Bar */}
        <div className="page-loader-progress-track">
          <div
            className="page-loader-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default PageRouteLoader;
