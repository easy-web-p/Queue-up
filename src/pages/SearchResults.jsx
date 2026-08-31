import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import FoodCard from "../components/FoodCard.jsx";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import Footer from "../components/Footer.jsx";
import { SHARED_PRODUCTS } from "../data/mockProducts.js";
import { fetchProductsFromFirestore } from "../lib/firebase.js";
import "./SearchResults.css";

const MOCK_SEARCH_PRODUCTS = SHARED_PRODUCTS;

function SearchResults() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const keyword = searchParams.get("keyword") || "อาหาร";

  const [productsList, setProductsList] = useState(MOCK_SEARCH_PRODUCTS);
  const [sortBy, setSortBy] = useState("related"); // 'related' | 'latest' | 'top_sales' | 'price_low' | 'price_high'
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Interactive Filters
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [inputMinPrice, setInputMinPrice] = useState("");
  const [inputMaxPrice, setInputMaxPrice] = useState("");
  const [appliedMinPrice, setAppliedMinPrice] = useState(null);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState(null);

  // Fetch products from Firestore
  useEffect(() => {
    fetchProductsFromFirestore().then((dbProducts) => {
      if (dbProducts && dbProducts.length > 0) {
        setProductsList(dbProducts);
      }
    });
  }, []);

  // Category Toggle Handler
  const toggleCategory = (catKey) => {
    setSelectedCategories((prev) =>
      prev.includes(catKey) ? prev.filter((c) => c !== catKey) : [...prev, catKey]
    );
  };

  // Location Toggle Handler
  const toggleLocation = (locKey) => {
    setSelectedLocations((prev) =>
      prev.includes(locKey) ? prev.filter((l) => l !== locKey) : [...prev, locKey]
    );
  };

  // Apply Price Filter
  const handleApplyPrice = (e) => {
    if (e) e.preventDefault();
    setAppliedMinPrice(inputMinPrice ? Number(inputMinPrice) : null);
    setAppliedMaxPrice(inputMaxPrice ? Number(inputMaxPrice) : null);
  };

  // Reset All Filters
  const handleResetFilters = () => {
    setSelectedCategories([]);
    setSelectedLocations([]);
    setInputMinPrice("");
    setInputMaxPrice("");
    setAppliedMinPrice(null);
    setAppliedMaxPrice(null);
  };

  // Keyword & Multi-Filter Logic
  const filteredProducts = productsList.filter((item) => {
    // 1. Natural Language AI Keyword Filter
    if (keyword && keyword !== "ทั้งหมด" && keyword !== "อาหาร") {
      const q = keyword.toLowerCase().trim();

      // AI Intent 1: อยากกินอะไรเผ็ดๆ
      if (q.includes("เผ็ด") || q.includes("แซ่บ") || q.includes("จัดจ้าน")) {
        const isSpicy =
          item.category === "curry_soup" ||
          item.category === "thai_spicy" ||
          (item.name && (item.name.includes("ต้มยำ") || item.name.includes("กะเพรา") || item.name.includes("พริก") || item.name.includes("เกาหลี") || item.name.includes("แซ่บ")));
        if (!isSpicy) return false;
      }
      // AI Intent 2: ราคาไม่เกิน 50 บาท
      else if (q.includes("ไม่เกิน 50") || q.includes("50 บาท") || q.includes("ประหยัด")) {
        if (item.price > 50) return false;
      }
      // AI Intent 3: เสิร์ฟไว / ทำเร็ว
      else if (q.includes("เร็ว") || q.includes("ไว") || q.includes("ด่วน")) {
        if (item.price > 70 && item.category !== "noodle") return false;
      }
      // AI Intent 4: ร้านยอดนิยม / แนะนำ
      else if (q.includes("ยอดนิยม") || q.includes("แนะนำ") || q.includes("ดัง")) {
        if ((item.rating || 0) < 4.8) return false;
      }
      // Standard Exact / Fuzzy Match on Name, Title, Shop, Category
      else {
        const matchTitle = item.title ? item.title.toLowerCase().includes(q) : false;
        const matchName = item.name ? item.name.toLowerCase().includes(q) : false;
        const matchCategory = item.categoryLabel ? item.categoryLabel.toLowerCase().includes(q) : false;
        const matchShop = item.shopName ? item.shopName.toLowerCase().includes(q) : false;
        if (!matchTitle && !matchName && !matchCategory && !matchShop) {
          return false;
        }
      }
    }

    // 2. Category Checkboxes Filter
    if (selectedCategories.length > 0) {
      if (!selectedCategories.includes(item.category)) {
        return false;
      }
    }

    // 3. Location Checkboxes Filter
    if (selectedLocations.length > 0) {
      const shopLoc = item.location || item.shopLocation || "";
      const matchesLoc = selectedLocations.some((loc) => shopLoc.includes(loc));
      if (!matchesLoc) return false;
    }

    // 4. Min Price Filter
    if (appliedMinPrice !== null && !isNaN(appliedMinPrice)) {
      if (item.price < appliedMinPrice) return false;
    }

    // 5. Max Price Filter
    if (appliedMaxPrice !== null && !isNaN(appliedMaxPrice)) {
      if (item.price > appliedMaxPrice) return false;
    }

    return true;
  });

  // Sort Products Logic
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === "latest") return b.id.localeCompare(a.id);
    if (sortBy === "top_sales") {
      const salesA = parseInt(a.salesCount || a.sales || "0");
      const salesB = parseInt(b.salesCount || b.sales || "0");
      return salesB - salesA;
    }
    if (sortBy === "price_low") return a.price - b.price;
    if (sortBy === "price_high") return b.price - a.price;
    return 0;
  });

  const isNoResults = sortedProducts.length === 0;

  return (
    <div className="shopee-search-page">
      {/* Shopee Thailand Style Header Search Bar */}
      <ShopeeSearchBar />

      <div className="shopee-search-container">
        {/* Keyword Result Header Hint */}
        <div className="shopee-search-hint-header">
          <i className="bi bi-lightbulb text-warning" />
          <span>
            ผลการค้นหาสำหรับคำว่า{" "}
            <span className="shopee-search-keyword-highlight">
              "{keyword}"
            </span>
          </span>
        </div>

        {/* Main Search Grid */}
        <div className="shopee-search-main-grid">
          {/* 1. Left Filter Sidebar */}
          <aside className="shopee-filter-sidebar">
            <div className="shopee-filter-header">
              <i className="bi bi-funnel" /> ตัวกรองการค้นหา
            </div>

            {/* หมวดหมู่อาหาร */}
            <div className="shopee-filter-group">
              <div className="shopee-filter-title">หมวดหมู่อาหาร</div>
              {[
                { key: "single_dish", label: "ไก่บักเก็ต & จานเดี่ยว" },
                { key: "western", label: "เบอร์เกอร์ & สเต็ก" },
                { key: "boba_tea", label: "ชานม & เครื่องดื่ม" },
                { key: "noodle", label: "ก๋วยเตี๋ยว & ต้มยำ" },
                { key: "japanese", label: "อาหารญี่ปุ่น & ชาบู" },
                { key: "streetfood", label: "ไก่ป็อบ & ทานเล่น" },
              ].map((cat) => (
                <label key={cat.key} className="shopee-filter-item">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(cat.key)}
                    onChange={() => toggleCategory(cat.key)}
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>

            {/* พิกัดโรงอาหาร */}
            <div className="shopee-filter-group">
              <div className="shopee-filter-title">พิกัดโรงอาหาร</div>
              {[
                { key: "โรงอาหาร 1", label: "โรงอาหาร 1 (อาคารเรียน 2)" },
                { key: "โรงอาหารกลาง", label: "โรงอาหารกลาง ชั้น 1" },
                { key: "โรงอาหาร 2", label: "โรงอาหาร 2 (อาคารกิจกรรม)" },
              ].map((loc) => (
                <label key={loc.key} className="shopee-filter-item">
                  <input
                    type="checkbox"
                    checked={selectedLocations.includes(loc.key)}
                    onChange={() => toggleLocation(loc.key)}
                  />
                  <span>{loc.label}</span>
                </label>
              ))}
            </div>

            {/* ช่วงราคา */}
            <div className="shopee-filter-group">
              <div className="shopee-filter-title">ช่วงราคา (บาท)</div>
              <form onSubmit={handleApplyPrice}>
                <div className="shopee-price-range-inputs">
                  <input
                    type="number"
                    className="shopee-price-input"
                    placeholder="ขั้นต่ำ ฿"
                    value={inputMinPrice}
                    onChange={(e) => setInputMinPrice(e.target.value)}
                  />
                  <span>-</span>
                  <input
                    type="number"
                    className="shopee-price-input"
                    placeholder="สูงสุด ฿"
                    value={inputMaxPrice}
                    onChange={(e) => setInputMaxPrice(e.target.value)}
                  />
                </div>
                <button type="submit" className="shopee-price-btn">
                  นำไปใช้
                </button>
              </form>
            </div>

            {/* Reset Filters Button */}
            {(selectedCategories.length > 0 ||
              selectedLocations.length > 0 ||
              appliedMinPrice !== null ||
              appliedMaxPrice !== null) && (
              <button
                className="btn btn-outline-danger btn-sm w-100 mt-2"
                onClick={handleResetFilters}
              >
                <i className="bi bi-arrow-counterclockwise me-1" /> ล้างตัวกรองทั้งหมด
              </button>
            )}
          </aside>

          {/* 2. Right Products Area */}
          <main className="shopee-products-area">
            {/* Top Sort Panel */}
            <div className="shopee-sort-bar">
              <div className="shopee-sort-options">
                <span className="shopee-sort-label">เรียงตาม</span>
                <button
                  className={`shopee-sort-btn ${
                    sortBy === "related" ? "active" : ""
                  }`}
                  onClick={() => setSortBy("related")}
                >
                  เกี่ยวข้อง
                </button>
                <button
                  className={`shopee-sort-btn ${
                    sortBy === "latest" ? "active" : ""
                  }`}
                  onClick={() => setSortBy("latest")}
                >
                  ล่าสุด
                </button>
                <button
                  className={`shopee-sort-btn ${
                    sortBy === "top_sales" ? "active" : ""
                  }`}
                  onClick={() => setSortBy("top_sales")}
                >
                  ขายดี
                </button>
                <select
                  className="shopee-sort-select"
                  value={
                    sortBy.startsWith("price") ? sortBy : "price_default"
                  }
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="price_default" disabled>
                    ราคา
                  </option>
                  <option value="price_low">ราคา: ต่ำไปสูง</option>
                  <option value="price_high">ราคา: สูงไปต่ำ</option>
                </select>
              </div>
            </div>

            {/* Condition 1: When products are found */}
            {!isNoResults && (
              <div className="shopee-product-grid">
                {sortedProducts.map((product) => (
                  <FoodCard
                    key={product.id}
                    item={{
                      ...product,
                      name: product.name || product.title,
                      shopLocation: product.location || product.shopLocation,
                      salesCount: product.salesCount || product.sales,
                    }}
                    onClick={() => navigate(`/product/${product.id}`)}
                  />
                ))}
              </div>
            )}

            {/* Condition 2: When NO products match (Empty Search State) */}
            {isNoResults && (
              <div>
                {/* Empty State Banner */}
                <div className="shopee-empty-search-card">
                  <div className="shopee-empty-icon-circle">
                    <i className="bi bi-search" />
                  </div>
                  <h3 className="shopee-empty-title">
                    ไม่พบข้อมูลเมนูนี้ที่คุณค้นหาสำหรับ "{keyword}"
                  </h3>
                  <p className="shopee-empty-sub">
                    ลองตรวจสอบตัวสะกด หรือค้นหาด้วยคีย์เวิร์ดยอดนิยม เช่น "ไก่ทอด", "ชานม", "ก๋วยเตี๋ยว", "เบอร์เกอร์"
                  </p>

                  <div className="d-flex justify-content-center gap-2 flex-wrap mt-3">
                    {["ไก่ทอด", "ชานม", "ก๋วยเตี๋ยว", "สเต็ก", "ชาบู"].map((kw) => (
                      <button
                        key={kw}
                        className="btn btn-outline-danger btn-sm rounded-pill"
                        onClick={() => navigate(`/search?keyword=${encodeURIComponent(kw)}`)}
                      >
                        <i className="bi bi-search me-1" /> ลองค้นหา "{kw}"
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <button
                      className="shopee-clear-filter-btn"
                      onClick={() => {
                        handleResetFilters();
                        navigate("/search?keyword=ทั้งหมด");
                      }}
                    >
                      แสดงเมนูอาหารทั้งหมด
                    </button>
                  </div>
                </div>

                {/* Recommended / Similar Products Grid */}
                <div className="shopee-recommendation-header">
                  <div className="shopee-recommendation-title">
                    <span><i className="bi bi-fire text-danger me-1" /> รายการเมนูอาหารที่ใกล้เคียง / เมนูแนะนำที่คุณอาจสนใจ</span>
                  </div>
                </div>

                <div className="shopee-product-grid">
                  {productsList.slice(0, 8).map((product) => (
                    <FoodCard
                      key={product.id}
                      item={{
                        ...product,
                        name: product.name || product.title,
                        shopLocation: product.location || product.shopLocation,
                        salesCount: product.salesCount || product.sales,
                      }}
                      onClick={() => navigate(`/product/${product.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Floating Bottom-Right Chat Button */}
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

      {/* Global Reusable Premium Footer */}
      <Footer />
    </div>
  );
}

export default SearchResults;
