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
    <div className="shopee-search-page min-h-screen flex flex-col justify-between bg-[#f5f5f5] dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 w-full">
      {/* Shopee Thailand Style Header Search Bar */}
      <ShopeeSearchBar />

      <div className="shopee-search-container max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        {/* Keyword Result Header Hint */}
        <div className="shopee-search-hint-header text-sm text-slate-600 dark:text-slate-400 mb-5 flex items-center gap-2">
          <i className="bi bi-lightbulb text-warning" />
          <span>
            ผลการค้นหาสำหรับคำว่า{" "}
            <span className="shopee-search-keyword-highlight text-[#ee4d2d] font-bold">
              "{keyword}"
            </span>
          </span>
        </div>

        {/* Main Search Grid */}
        <div className="shopee-search-main-grid flex flex-col lg:flex-row gap-6">
          {/* 1. Left Filter Sidebar */}
          <aside className="shopee-filter-sidebar w-full lg:w-56 shrink-0 bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm h-fit">
            <div className="shopee-filter-header text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800 mb-4">
              <i className="bi bi-funnel text-[#ee4d2d]" /> ตัวกรองการค้นหา
            </div>

            {/* หมวดหมู่อาหาร */}
            <div className="shopee-filter-group mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="shopee-filter-title text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">หมวดหมู่อาหาร</div>
              {[
                { key: "single_dish", label: "ไก่บักเก็ต & จานเดี่ยว" },
                { key: "western", label: "เบอร์เกอร์ & สเต็ก" },
                { key: "boba_tea", label: "ชานม & เครื่องดื่ม" },
                { key: "noodle", label: "ก๋วยเตี๋ยว & ต้มยำ" },
                { key: "japanese", label: "อาหารญี่ปุ่น & ชาบู" },
                { key: "streetfood", label: "ไก่ป็อบ & ทานเล่น" },
              ].map((cat) => (
                <label key={cat.key} className="shopee-filter-item flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 mb-2 cursor-pointer hover:text-[#ee4d2d] select-none">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-[#ee4d2d] focus:ring-[#ee4d2d]"
                    checked={selectedCategories.includes(cat.key)}
                    onChange={() => toggleCategory(cat.key)}
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>

            {/* พิกัดโรงอาหาร */}
            <div className="shopee-filter-group mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="shopee-filter-title text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">พิกัดโรงอาหาร</div>
              {[
                { key: "โรงอาหาร 1", label: "โรงอาหาร 1 (อาคารเรียน 2)" },
                { key: "โรงอาหารกลาง", label: "โรงอาหารกลาง ชั้น 1" },
                { key: "โรงอาหาร 2", label: "โรงอาหาร 2 (อาคารกิจกรรม)" },
              ].map((loc) => (
                <label key={loc.key} className="shopee-filter-item flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 mb-2 cursor-pointer hover:text-[#ee4d2d] select-none">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-[#ee4d2d] focus:ring-[#ee4d2d]"
                    checked={selectedLocations.includes(loc.key)}
                    onChange={() => toggleLocation(loc.key)}
                  />
                  <span>{loc.label}</span>
                </label>
              ))}
            </div>

            {/* ช่วงราคา */}
            <div className="shopee-filter-group mb-5 pb-4 border-b border-slate-100 dark:border-slate-800/80">
              <div className="shopee-filter-title text-xs font-bold text-slate-700 dark:text-slate-300 mb-2.5">ช่วงราคา (บาท)</div>
              <form onSubmit={handleApplyPrice}>
                <div className="shopee-price-range-inputs flex items-center gap-2 mb-2.5">
                  <input
                    type="number"
                    className="shopee-price-input w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#ee4d2d]"
                    placeholder="ขั้นต่ำ ฿"
                    value={inputMinPrice}
                    onChange={(e) => setInputMinPrice(e.target.value)}
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="number"
                    className="shopee-price-input w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#ee4d2d]"
                    placeholder="สูงสุด ฿"
                    value={inputMaxPrice}
                    onChange={(e) => setInputMaxPrice(e.target.value)}
                  />
                </div>
                <button type="submit" className="shopee-price-btn w-full bg-[#ee4d2d] hover:bg-[#d73211] text-white py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer border-0">
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
                className="btn btn-outline-danger btn-sm w-100 mt-2 w-full py-1.5 border border-rose-500 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                onClick={handleResetFilters}
              >
                <i className="bi bi-arrow-counterclockwise me-1" /> ล้างตัวกรองทั้งหมด
              </button>
            )}
          </aside>

          {/* 2. Right Products Area */}
          <main className="shopee-products-area flex-1 min-w-0">
            {/* Top Sort Panel */}
            <div className="shopee-sort-bar bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-5 flex items-center justify-between shadow-sm">
              <div className="shopee-sort-options flex items-center gap-2 flex-wrap">
                <span className="shopee-sort-label text-xs font-bold text-slate-500 dark:text-slate-400">เรียงตาม</span>
                <button
                  className={`shopee-sort-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                    sortBy === "related"
                      ? "active bg-[#ee4d2d] text-white shadow-sm font-black"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  onClick={() => setSortBy("related")}
                >
                  เกี่ยวข้อง
                </button>
                <button
                  className={`shopee-sort-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                    sortBy === "latest"
                      ? "active bg-[#ee4d2d] text-white shadow-sm font-black"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  onClick={() => setSortBy("latest")}
                >
                  ล่าสุด
                </button>
                <button
                  className={`shopee-sort-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 ${
                    sortBy === "top_sales"
                      ? "active bg-[#ee4d2d] text-white shadow-sm font-black"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                  onClick={() => setSortBy("top_sales")}
                >
                  ขายดี
                </button>
                <select
                  className="shopee-sort-select bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer focus:outline-none focus:border-[#ee4d2d]"
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
              <div className="shopee-product-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
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
                <div className="shopee-empty-search-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-sm mb-6">
                  <div className="shopee-empty-icon-circle w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-500 flex items-center justify-center text-2xl mx-auto mb-4">
                    <i className="bi bi-search" />
                  </div>
                  <h3 className="shopee-empty-title text-base sm:text-lg font-black text-slate-900 dark:text-white mb-2">
                    ไม่พบข้อมูลเมนูนี้ที่คุณค้นหาสำหรับ "{keyword}"
                  </h3>
                  <p className="shopee-empty-sub text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
                    ลองตรวจสอบตัวสะกด หรือค้นหาด้วยคีย์เวิร์ดยอดนิยม เช่น "ไก่ทอด", "ชานม", "ก๋วยเตี๋ยว", "เบอร์เกอร์"
                  </p>

                  <div className="d-flex justify-content-center gap-2 flex-wrap mt-3 flex justify-center">
                    {["ไก่ทอด", "ชานม", "ก๋วยเตี๋ยว", "สเต็ก", "ชาบู"].map((kw) => (
                      <button
                        key={kw}
                        className="btn btn-outline-danger btn-sm rounded-pill px-3 py-1.5 border border-rose-500/60 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full text-xs font-bold transition-all cursor-pointer"
                        onClick={() => navigate(`/search?keyword=${encodeURIComponent(kw)}`)}
                      >
                        <i className="bi bi-search me-1" /> ลองค้นหา "{kw}"
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <button
                      className="shopee-clear-filter-btn px-5 py-2.5 bg-[#ee4d2d] hover:bg-[#d73211] text-white font-black text-xs rounded-full shadow-md shadow-orange-500/20 transition-all cursor-pointer border-0"
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
                <div className="shopee-recommendation-header mb-4">
                  <div className="shopee-recommendation-title font-black text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span><i className="bi bi-fire text-danger me-1 text-orange-500" /> รายการเมนูอาหารที่ใกล้เคียง / เมนูแนะนำที่คุณอาจสนใจ</span>
                  </div>
                </div>

                <div className="shopee-product-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
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
        className="queue-floating-chat-btn fixed bottom-6 right-6 z-40 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white rounded-full shadow-xl flex items-center gap-2 text-xs font-black cursor-pointer hover:shadow-2xl hover:scale-105 transition-all border-0"
        onClick={() => setIsChatOpen(true)}
        title="เปิดแชทผู้ช่วย QueueUp"
      >
        <i className="bi bi-chat-dots-fill text-sm" />
        <span>Chat</span>
        <span className="queue-chat-badge bg-white text-orange-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">3</span>
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
