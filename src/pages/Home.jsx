import { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { clearUser } from "../store/authSlice.js";
import {
  fetchFoodCategoriesFromFirestore,
  saveCategoryToFirestore,
  fetchShopsFromFirestore,
  fetchProductsFromFirestore,
} from "../lib/firebase.js";
import FoodCard from "../components/FoodCard.jsx";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import { usePreferences } from "../context/PreferencesContext.jsx";
import { SHARED_PRODUCTS } from "../data/mockProducts.js";
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from "../firebase/config.js";
import "./Home.css";

const DEFAULT_CATEGORIES = [
  { id: "all", label: "ทั้งหมด", image: "/logo.png" },
  { id: "single_dish", label: "ไก่บักเก็ต", image: "/crispy_fried_chicken.jpg" },
  { id: "western", label: "เบอร์เกอร์", image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&auto=format&fit=crop&q=60" },
  { id: "streetfood", label: "ไก่ป็อบ/เทนเดอร์", image: "https://images.unsplash.com/photo-1562967914-608f82629710?w=200&auto=format&fit=crop&q=60" },
  { id: "snack", label: "ของทานเล่น", image: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=200&auto=format&fit=crop&q=60" },
  { id: "boba_tea", label: "ชานมไข่มุก", image: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=200&auto=format&fit=crop&q=60" },
  { id: "noodle", label: "ก๋วยเตี๋ยว", image: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=200&auto=format&fit=crop&q=60" },
  { id: "thai_spicy", label: "ต้มยำ/แกงเผ็ด", image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&auto=format&fit=crop&q=60" },
  { id: "shabu_hotpot", label: "ชาบู/หม้อไฟ", image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=200&auto=format&fit=crop&q=60" },
  { id: "japanese", label: "อาหารญี่ปุ่น", image: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=200&auto=format&fit=crop&q=60" },
  { id: "korean", label: "อาหารเกาหลี", image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200&auto=format&fit=crop&q=60" },
  { id: "chinese", label: "อาหารจีน", image: "https://images.unsplash.com/photo-1541696432-82c6da8ce7bf?w=200&auto=format&fit=crop&q=60" },
  { id: "regional", label: "อาหารพื้นบ้าน", image: "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=200&auto=format&fit=crop&q=60" },
  { id: "coffee", label: "กาแฟสด", image: "https://images.unsplash.com/photo-1517701604599-bb29b565090c?w=200&auto=format&fit=crop&q=60" },
  { id: "smoothie", label: "สมูทตี้", image: "https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=200&auto=format&fit=crop&q=60" },
  { id: "dessert", label: "ของหวาน", image: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=200&auto=format&fit=crop&q=60" },
  { id: "healthy", label: "อาหารคลีน", image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&auto=format&fit=crop&q=60" },
  { id: "promo", label: "โปร 1 แถม 1", image: "/crispy_fried_chicken.jpg" },
  { id: "drink", label: "เครื่องดื่ม", image: "https://images.unsplash.com/photo-1558857563-b371033873b8?w=200&auto=format&fit=crop&q=60" },
];

const DEFAULT_MENU_ITEMS = INITIAL_PRODUCTS || SHARED_PRODUCTS;



function Home() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { language } = usePreferences();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [shops, setShops] = useState([]);
  const [menuItems, setMenuItems] = useState(DEFAULT_MENU_ITEMS);
  const [favorites, setFavorites] = useState([]);
  const [showNotice, setShowNotice] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // ข้อมูลอัปเดตจากร้านค้าที่ติดตาม (แสดงเฉพาะเมื่อมีอัปเดตใหม่)
  const [followedShopUpdates, setFollowedShopUpdates] = useState([
    {
      id: "u1",
      shopName: "ร้านป้าแดง ตามสั่ง",
      message: "เปิดให้สั่งอาหารล่วงหน้ารับแต้มสะสม CRM ฟรีได้ทันที!",
    },
  ]);

  // Firestore Sync Effect
  useEffect(() => {
    fetchFoodCategoriesFromFirestore().then((dbCats) => {
      if (dbCats && dbCats.length > 0) {
        setCategories(dbCats);
      } else {
        DEFAULT_CATEGORIES.forEach((c) => saveCategoryToFirestore(c));
      }
    });

    fetchShopsFromFirestore().then((dbShops) => {
      if (dbShops && dbShops.length > 0) {
        setShops(dbShops);
      }
    });

    fetchProductsFromFirestore().then((dbProducts) => {
      if (dbProducts && dbProducts.length > 0) {
        setMenuItems(dbProducts);
      }
    });
  }, []);

  const toggleFavorite = (itemId) => {
    setFavorites((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const filteredMenuItems = (menuItems || []).filter((item) => {
    return selectedCategory === "all" || item?.category === selectedCategory;
  });

  const hasNotice = showNotice && followedShopUpdates.length > 0;

  return (
    <div className="queue-home-container">
      {/* 1. Shopee Header Search Bar */}
      <ShopeeSearchBar />

      {/* 2. Announcement Notice Banner (แสดงเฉพาะเมื่อมีการอัปเดตจากร้านค้าที่ติดตาม) */}
      {hasNotice && (
        <div className="queue-notice-banner">
          <div className="queue-notice-content">
            <i className="bi bi-bell-fill text-warning me-1" />
            <span>
              <strong>อัปเดตจากร้านค้าที่ติดตาม:</strong> [{followedShopUpdates[0].shopName}]{" "}
              {followedShopUpdates[0].message}
            </span>
          </div>
          <button
            className="queue-notice-close"
            onClick={() => setShowNotice(false)}
            title="ปิดการแจ้งเตือน"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
      )}

      <div
        className="queue-home-wrapper"
        style={{ marginTop: hasNotice ? "0px" : "24px" }}
      >
        {/* 3. Red Hero Banner Section */}
        <section className="queue-hero-banner">
          <div className="queue-hero-left">
            <span className="queue-hero-tag">
              {language === "en" ? "CRISPY · DELICIOUS · HOT" : "กรอบ อร่อย ร้อนๆ"}
            </span>
            <h1 className="queue-hero-title">
              {language === "en" ? "Delicious & Crispy," : "อร่อยกรอบ เข้มข้น"}
              <br />
              {language === "en" ? "Freshly Prepared Daily!" : "สั่งสดใหม่ทุกวัน!"}
            </h1>
            <p className="queue-hero-sub">
              {language === "en"
                ? "Freshly fried & served hot! Pre-order your meals with zero queues."
                : "ชุบแป้งสดใหม่ ทอดร้อนๆ สั่งอาหารล่วงหน้า ไม่ต้องต่อคิวยาว"}
            </p>
            <div className="queue-hero-actions">
              <button
                className="queue-hero-btn-primary"
                onClick={() => navigate("/search?keyword=ไก่ทอด")}
              >
                {language === "en" ? "Explore Hot Stores" : "สำรวจร้านเด็ด"} <i className="bi bi-arrow-right ms-1" />
              </button>
              <div className="queue-hero-points-badge">
                <span><i className="bi bi-coin text-warning me-1" /> {language === "en" ? "CRM Points: 128" : "แต้มสะสม CRM: 128"}</span>
              </div>
            </div>
          </div>

          <img
            src="/crispy_fried_chicken.jpg"
            alt="Crispy Fried Chicken"
            className="queue-hero-right-img"
          />
        </section>

        {/* 4. Circular Food Category Story Carousel */}
        <section className="queue-category-section">
          <h5 className="fw-bold queue-category-title mb-3">
            {language === "en" ? "Food Categories" : "หมวดหมู่อาหาร"}
          </h5>
          <div className="queue-category-list">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`queue-category-item ${
                  selectedCategory === cat.id ? "active" : ""
                }`}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  if (cat.id === "all") {
                    navigate("/search?keyword=ทั้งหมด");
                  } else {
                    navigate(`/search?keyword=${encodeURIComponent(cat.label)}`);
                  }
                }}
              >
                <div className="queue-category-circle">
                  <img
                    src={cat.image || "/logo.png"}
                    alt={cat.label}
                    className="queue-category-icon-img"
                  />
                </div>
                <span className="queue-category-label">
                  {language === "en" && cat.labelEn ? cat.labelEn : cat.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 5. 10 อันดับเมนูขายดีประจำโรงอาหาร (Menu Best-Sellers Grid) */}
        <section className="bg-white p-4 rounded-4 shadow-sm border mb-4">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h5 className="fw-bold text-dark mb-0">
              <i className="bi bi-fire text-danger me-1" />{" "}
              {language === "en" ? "Top 10 Bestselling Canteen Dishes" : "10 อันดับเมนูขายดีประจำโรงอาหาร"}
            </h5>
            <span className="badge bg-danger">{language === "en" ? "POPULAR" : "ยอดนิยม"}</span>
          </div>

          <div className="row g-3">
            {filteredMenuItems.map((item) => (
              <div key={item.id} className="col-6 col-md-4 col-lg-3">
                <FoodCard
                  item={item}
                  isFavorite={favorites.includes(item.id)}
                  onToggleFavorite={toggleFavorite}
                  onClick={() => navigate(`/product/${item.id}`)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* 6. AI QueueUp Smart Search Recommendation Dark Section */}
        <section className="queue-ai-section">
          <div className="queue-ai-header-row">
            <div>
              <div className="queue-ai-tag">
                <i className="bi bi-stars text-warning me-1" /> ระบบวิเคราะห์ความอร่อยใกล้คุณ (AI QueueUp Smart Search)
              </div>
              <h2 className="queue-ai-title">
                แนะนำร้านอร่อยที่สุด จากพิกัดที่ใกล้คุณที่สุด
              </h2>
            </div>
            <div className="queue-ai-location">
              <i className="bi bi-geo-alt-fill text-danger me-1" /> ตำแหน่งของคุณ: อาคารเรียน 2 (โรงอาหารกลาง)
            </div>
          </div>

          <div className="queue-ai-cards-grid">
            <div
              className="queue-ai-shop-card"
              onClick={() => navigate("/search?keyword=ป้าแดง")}
            >
              <span className="queue-ai-badge-rank">
                <i className="bi bi-trophy-fill text-warning me-1" /> อร่อยอันดับ 1 ใกล้คุณ
              </span>
              <div className="queue-ai-shop-name">ร้านป้าแดง ตามสั่ง & ไก่ทอด</div>
              <div className="queue-ai-shop-meta">
                <span><i className="bi bi-star-fill text-warning me-1" /> 4.9 / 5</span>
                <span>• เสิร์ฟไวเฉลี่ย 8 นาที</span>
              </div>
            </div>

            <div
              className="queue-ai-shop-card"
              onClick={() => navigate("/search?keyword=ก๋วยเตี๋ยว")}
            >
              <span
                className="queue-ai-badge-rank"
                style={{ background: "#059669" }}
              >
                <i className="bi bi-lightning-fill text-warning me-1" /> เสิร์ฟไวอันดับ 1
              </span>
              <div className="queue-ai-shop-name">ร้านก๋วยเตี๋ยวเรือเสือร้องไห้</div>
              <div className="queue-ai-shop-meta">
                <span><i className="bi bi-star-fill text-warning me-1" /> 4.8 / 5</span>
                <span>• เสิร์ฟไวเฉลี่ย 4 นาที</span>
              </div>
            </div>

            <div
              className="queue-ai-shop-card"
              onClick={() => navigate("/search?keyword=สเต็ก")}
            >
              <span
                className="queue-ai-badge-rank"
                style={{ background: "#7c3aed" }}
              >
                <i className="bi bi-award-fill text-warning me-1" /> ยอดนิยมสูงสุด
              </span>
              <div className="queue-ai-shop-name">ร้านสเต็กพี่ตั้ม School Food</div>
              <div className="queue-ai-shop-meta">
                <span><i className="bi bi-star-fill text-warning me-1" /> 4.9 / 5</span>
                <span>• คิวรอน้อยกว่า 12 นาที</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 7. Floating Bottom-Right Chat Button */}
      <button
        className="queue-floating-chat-btn"
        onClick={() => setIsChatOpen(true)}
        title="เปิดแชทผู้ช่วย QueueUp"
      >
        <i className="bi bi-chat-dots-fill" />
        <span>Chat</span>
        <span className="queue-chat-badge">3</span>
      </button>

      {/* Real-Time Chat Modal Component */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}

export default Home;