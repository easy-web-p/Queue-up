import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

function Loading() {
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    // Fill progress bar smoothly up to 100% over 3.35 seconds
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        return prev + 5;
      });
    }, 160);

    // Trigger Pudding Bounce Exit animation at 3.35 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 3350);

    // Total 4 seconds (4000ms) before navigating to next page
    const navTimer = setTimeout(() => {
      if (user) {
        navigate("/home", { replace: true });
      } else {
        navigate("/login", { replace: true });
      }
    }, 4000);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(exitTimer);
      clearTimeout(navTimer);
    };
  }, [navigate, user]);

  return (
    <div
      id="loading-screen"
      className={`fixed inset-0 z-[100] flex min-h-screen w-full items-center justify-center transition-all duration-500 ease-in-out ${isExiting ? 'opacity-0 invisible' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div 
        className={`flex flex-col items-center gap-5 px-6 text-center ${isExiting ? 'pudding-exit' : ''}`}
      >
        {/* Animated Circle Container */}
        <div className="relative flex h-44 w-44 items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-orange-200/70 dark:border-orange-500/30" />
          <div className="loading-orbit absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_16px_4px_rgba(249,115,22,0.35)]" />
          <img
            data-template-id="loading-logo"
            src="/logo.png"
            alt="QueueUp Logo"
            className="loading-logo canva-image h-40 w-40 object-contain"
            loading="eager"
          />
        </div>

        {/* Loading Message */}
        <p
          data-template-id="loading-message"
          className="loading-copy canva-text text-base font-medium text-gray-600 dark:text-gray-300 mb-0"
        >
          {isExiting ? 'พร้อมทำงานแล้ว!' : 'กำลังเตรียมเมนู...'}
        </p>

        {/* Animated Progress Bar */}
        <div className="h-2 w-44 overflow-hidden rounded-full bg-orange-100 dark:bg-stone-800 shadow-inner">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-amber-400 transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default Loading;