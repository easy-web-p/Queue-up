import { useNavigate, Link } from "react-router-dom";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";
import "./NotFound.css";

function NotFound() {
  const navigate = useNavigate();
  const { language } = usePreferences();

  return (
    <div className="queue-notfound-page">
      {/* Header Navigation Search Bar */}
      <ShopeeSearchBar />

      {/* Main Centered 404 Content */}
      <main className="queue-notfound-container">
        <div className="queue-notfound-card">
          {/* Animated/Glowing 404 Code Display */}
          <div className="queue-notfound-code">404</div>

          {/* Heading Title */}
          <h1 className="queue-notfound-title">
            {language === "en" ? "Page Not Found" : "ไม่พบหน้าที่คุณต้องการ"}
          </h1>

          {/* Subtitle Message */}
          <p className="queue-notfound-desc">
            {language === "en"
              ? "Oops! The page you are looking for might have been moved, removed, or doesn't exist."
              : "ขออภัย หน้าที่คุณกำลังตามหาอาจถูกย้าย ลบ หรือไม่มีอยู่จริง"}
          </p>

          {/* Action Buttons */}
          <div className="queue-notfound-actions">
            <button
              type="button"
              className="queue-btn-back"
              onClick={() => navigate(-1)}
            >
              <i className="bi bi-arrow-left me-2" />
              {language === "en" ? "Go Back" : "ย้อนกลับหน้าก่อนหน้า"}
            </button>

            <Link to="/home" className="queue-btn-home">
              <i className="bi bi-house-door-fill me-2" />
              {language === "en" ? "Back to Home" : "กลับสู่หน้าหลัก"}
            </Link>
          </div>

          {/* Quick Help Links */}
          <div className="queue-notfound-footer">
            <span className="text-muted text-xs">
              {language === "en" ? "Need help?" : "ต้องการความช่วยเหลือเพิ่มเติม?"}
            </span>
            <div className="queue-notfound-links">
              <Link to="/search?keyword=โรงอาหาร">
                <i className="bi bi-search me-1" /> {language === "en" ? "Search Foods" : "ค้นหาอาหาร"}
              </Link>
              <span>•</span>
              <Link to="/user/account/profile?tab=bookings">
                <i className="bi bi-receipt me-1" /> {language === "en" ? "My Orders" : "รายการคิวของคุณ"}
              </Link>
              <span>•</span>
              <Link to="/queueup">
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
