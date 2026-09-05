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
    <div className={`page-loader-overlay fixed inset-0 z-[9999999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 font-sans ${isFadingOut ? "fade-out opacity-0 pointer-events-none" : "opacity-100"}`}>
      <div className="page-loader-card bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-xs w-full mx-4">
        {/* Pulsing Ring & Bouncing Logo */}
        <div className="page-loader-ring-wrapper relative w-20 h-20 mb-4 flex items-center justify-center">
          <div className="page-loader-spinner-ring absolute inset-0 rounded-full border-4 border-orange-500/20 border-t-[#ee4d2d] animate-spin" />
          <div className="page-loader-icon-box w-12 h-12 flex items-center justify-center animate-pulse">
            <img
              src="/logo.png"
              alt="QueueUp Logo"
              className="page-loader-logo-img w-10 h-10 object-contain drop-shadow-md"
            />
          </div>
        </div>

        {/* Brand Title */}
        <div className="page-loader-title text-xl font-black tracking-tight mb-0.5">
          <span className="queue text-white">Queue</span>
          <span className="up text-[#ee4d2d]">Up</span>
        </div>
        <div className="page-loader-sub text-[10px] font-bold text-slate-400 tracking-widest mb-3">SCHOOL FOOD CRM</div>

        {/* Loading Message */}
        <div className="page-loader-msg text-xs text-slate-300 font-medium mb-4">{message}</div>

        {/* Progress Bar */}
        <div className="page-loader-progress-track w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="page-loader-progress-bar h-full bg-gradient-to-r from-[#ee4d2d] to-amber-500 transition-all duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default PageRouteLoader;
