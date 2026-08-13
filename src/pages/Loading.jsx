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
      className={`fixed inset-0 z-[100] flex min-h-screen w-full items-center justify-center ${isExiting ? 'is-hidden' : ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.55s ease, visibility 0.55s ease'
      }}
      role="status"
      aria-live="polite"
    >
      <div 
        className={`flex flex-col items-center gap-5 px-6 text-center d-flex flex-column align-items-center gap-3 px-4 text-center ${isExiting ? 'pudding-exit' : ''}`}
      >
        {/* Animated Circle Container */}
        <div 
          className="relative flex h-44 w-44 items-center justify-center position-relative d-flex align-items-center justify-content-center"
          style={{ width: '176px', height: '176px' }}
        >
          <div 
            className="absolute inset-0 rounded-full border border-orange-200/70 position-absolute rounded-circle"
            style={{
              inset: 0,
              border: '1px solid rgba(254, 215, 170, 0.7)'
            }}
          />
          <div 
            className="loading-orbit absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-orange-500 position-absolute rounded-circle"
            style={{
              left: '50%',
              top: '50%',
              width: '8px',
              height: '8px',
              backgroundColor: '#f97316',
              boxShadow: '0 0 16px 4px rgba(249,115,22,0.35)'
            }}
          />
          <img
            data-template-id="loading-logo"
            src="/logo.png"
            alt="QueueUp Logo"
            className="loading-logo canva-image h-40 w-40 object-contain img-fluid"
            style={{ width: '160px', height: '160px', objectFit: 'contain' }}
            loading="eager"
          />
        </div>

        {/* Loading Message */}
        <p
          data-template-id="loading-message"
          className="loading-copy canva-text text-base font-medium text-gray-600 mb-0"
          style={{ fontSize: '1rem', fontWeight: 500, color: '#4b5563' }}
        >
          {isExiting ? 'พร้อมทำงานแล้ว!' : 'กำลังเตรียมเมนู...'}
        </p>

        {/* Animated Progress Bar */}
        <div 
          className="h-2 w-44 overflow-hidden rounded-full bg-orange-100 shadow-inner rounded-pill overflow-hidden"
          style={{
            height: '8px',
            width: '176px',
            backgroundColor: '#ffedd5',
            borderRadius: '9999px',
            boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
          }}
        >
          <div 
            className="h-full rounded-full bg-gradient-to-r from-orange-500 via-red-500 to-amber-400 rounded-pill"
            style={{
              height: '100%',
              width: `${progress}%`,
              borderRadius: '9999px',
              background: 'linear-gradient(to right, #f97316, #ef4444, #fbbf24)',
              transition: 'width 0.2s ease-out'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Loading;