import { useNavigate, Link } from "react-router-dom";
import { usePreferences } from "../context/PreferencesContext.jsx";
import "./NotFound.css";

function NotFound() {
  const navigate = useNavigate();
  const { language } = usePreferences();

  return (
    <div className="queue-notfound-page min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans p-4">
      {/* Main Centered 404 Content (ไม่มี Header SearchBar) */}
      <main className="queue-notfound-container w-full max-w-lg flex items-center justify-center py-10 px-4">
        <div className="queue-notfound-card w-full text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl transition-all">
          {/* Animated/Glowing 404 Code Display */}
          <div className="queue-notfound-code text-7xl sm:text-8xl font-black leading-none bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent mb-4 tracking-tight">404</div>

          {/* Heading Title */}
          <h1 className="queue-notfound-title text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-3">
            {language === "en" ? "Page Not Found" : "ไม่พบหน้าที่คุณต้องการ"}
          </h1>

          {/* Subtitle Message */}
          <p className="queue-notfound-desc text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
            {language === "en"
              ? "Oops! The page you are looking for might have been moved, removed, or doesn't exist."
              : "ขออภัย หน้าที่คุณกำลังตามหาอาจถูกย้าย ลบ หรือไม่มีอยู่จริง"}
          </p>

          {/* Action Buttons */}
          <div className="queue-notfound-actions flex items-center justify-center gap-3 flex-wrap mb-8">
            <button
              type="button"
              className="queue-btn-back inline-flex items-center gap-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-5 py-2.5 rounded-full text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm cursor-pointer"
              onClick={() => navigate(-1)}
            >
              <i className="bi bi-arrow-left" />
              {language === "en" ? "Go Back" : "ย้อนกลับหน้าก่อนหน้า"}
            </button>

            <Link to="/home" className="queue-btn-home inline-flex items-center gap-2 bg-gradient-to-r from-[#ee4d2d] to-[#ff7337] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-orange-500/30 hover:opacity-95 hover:scale-105 transition-all">
              <i className="bi bi-house-door-fill" />
              {language === "en" ? "Back to Home" : "กลับสู่หน้าหลัก"}
            </Link>
          </div>

          {/* Quick Help Links */}
          <div className="queue-notfound-footer border-t border-slate-100 dark:border-slate-800 pt-6">
            <span className="text-slate-400 text-xs block mb-3">
              {language === "en" ? "Need help?" : "ต้องการความช่วยเหลือเพิ่มเติม?"}
            </span>
            <div className="queue-notfound-links flex items-center justify-center gap-3 flex-wrap text-xs font-semibold text-slate-600 dark:text-slate-400">
              <Link to="/search?keyword=โรงอาหาร" className="hover:text-orange-500 transition-colors">
                <i className="bi bi-search me-1" /> {language === "en" ? "Search Foods" : "ค้นหาอาหาร"}
              </Link>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <Link to="/user/account/profile?tab=bookings" className="hover:text-orange-500 transition-colors">
                <i className="bi bi-receipt me-1" /> {language === "en" ? "My Orders" : "รายการคิวของคุณ"}
              </Link>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <Link to="/queueup" className="hover:text-orange-500 transition-colors">
                <i className="bi bi-info-circle me-1" /> {language === "en" ? "About QueueUp" : "เกี่ยวกับเรา"}
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default NotFound;
