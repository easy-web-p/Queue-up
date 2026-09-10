import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Search,
  Flame,
  Clock,
  ChevronRight,
  Tag,
  Star,
  Plus,
  GraduationCap,
} from "lucide-react";
import { addItem, selectCartStoreId, clearCart } from "../../../store/cartSlice";
import { CrossStoreCartModal } from "../cart/CrossStoreCartModal";
import { CartItem, MenuItem } from "../../../types";
import DailyMenuBoard from "../../../components/DailyMenuBoard";

export const MarketplaceHomePage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const currentCartStoreId = useSelector(selectCartStoreId);

  const [searchQuery, setSearchQuery] = useState("");
  const [crossStorePendingItem, setCrossStorePendingItem] = useState<CartItem | null>(null);

  // Mock Active Order (if user recently ordered)
  const [activeOrder] = useState({
    orderId: "ORD-9021",
    queueNumber: "Q007",
    status: "PREPARING",
    storeName: "ก๋วยเตี๋ยวเรืออยุธยา ป้าสมศรี",
    estimatedPickup: "12:15 น.",
  });

  const categories = [
    { id: "rice", label: "ข้าวจานเดียว", icon: "🍛" },
    { id: "noodles", label: "ก๋วยเตี๋ยว", icon: "🍜" },
    { id: "snacks", label: "ของทานเล่น", icon: "🥟" },
    { id: "drinks", label: "เครื่องดื่ม", icon: "🧋" },
    { id: "halal", label: "ฮาลาล", icon: "🌙" },
    { id: "veg", label: "มังสวิรัติ", icon: "🥗" },
    { id: "low_allergen", label: "ไร้สารก่อภูมิแพ้", icon: "🛡️" },
    { id: "budget", label: "งบประหยัด", icon: "💰" },
  ];

  const featuredDishes: MenuItem[] = [
    {
      id: "dish-1",
      name: "ข้าวกะเพราหมูกรอบไข่ดาว",
      category: "ข้าวจานเดียว",
      price: 55,
      priceSatang: 5500,
      storeId: "store-kku-01",
      shopName: "ร้านคุณกานต์ กะเพราถาด",
      imageUrl: "/crispy_fried_chicken.jpg",
      prepTimeMinutes: 5,
      rating: 4.8,
      salesCount: 1420,
      allergens: ["soy"],
      isBestseller: true,
    },
    {
      id: "dish-2",
      name: "บะหมี่ต้มยำทะเลน้ำข้น",
      category: "ก๋วยเตี๋ยว",
      price: 65,
      priceSatang: 6500,
      storeId: "store-kku-02",
      shopName: "ป้าต้อย เตี๋ยวต้มยำ",
      imageUrl: "/salmon_salad.jpg",
      prepTimeMinutes: 7,
      rating: 4.9,
      salesCount: 1120,
      allergens: ["seafood"],
      isBestseller: true,
    },
    {
      id: "dish-3",
      name: "ชาไทยเย็นหวานน้อย ชาใต้แท้",
      category: "เครื่องดื่ม",
      price: 35,
      priceSatang: 3500,
      storeId: "store-kku-student-01",
      shopName: "Craft Tea Club (ร้านนักศึกษา)",
      imageUrl: "/pork_satay.jpg",
      prepTimeMinutes: 3,
      rating: 4.9,
      salesCount: 980,
      allergens: ["dairy"],
      isBestseller: true,
    },
  ];

  const handleQuickAdd = (dish: MenuItem) => {
    const itemToAdd: CartItem = {
      menuItem: dish,
      quantity: 1,
      unitPriceSatang: dish.priceSatang || dish.price * 100,
    };

    // Decision 3: Check single-vendor rule
    if (currentCartStoreId && dish.storeId && currentCartStoreId !== dish.storeId) {
      setCrossStorePendingItem(itemToAdd);
    } else {
      dispatch(addItem(itemToAdd));
    }
  };

  const handleConfirmCrossStore = () => {
    if (crossStorePendingItem) {
      dispatch(clearCart());
      dispatch(addItem(crossStorePendingItem));
      setCrossStorePendingItem(null);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/app/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/app/search");
    }
  };

  return (
    <div className="space-y-6">
      {/* Prominent Natural-Language Search */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-[#241C16] border border-orange-500/25 shadow-lg focus-within:border-orange-500 transition-all">
          <Search className="w-5 h-5 text-orange-400 ml-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาด้วยภาษาธรรมชาติ เช่น 'งบ 50 เผ็ดน้อย', 'เมนูทำเร็ว'..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none px-2 py-1"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shrink-0 transition-colors shadow-sm"
          >
            ค้นหา
          </button>
        </div>
      </form>

      {/* Active Order Card (If user has pending order) */}
      {activeOrder && (
        <div
          onClick={() => navigate(`/app/orders/${activeOrder.orderId}`)}
          className="p-4 rounded-2xl bg-gradient-to-r from-orange-900/40 via-amber-900/30 to-[#241C16] border border-orange-500/40 flex items-center justify-between cursor-pointer hover:border-orange-500 transition-all shadow-lg shadow-orange-950/20 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-600/30 border border-orange-500/50 flex flex-col items-center justify-center font-jetbrains font-bold text-orange-400">
              <span className="text-[10px] text-orange-300">คิวที่</span>
              <span className="text-sm">{activeOrder.queueNumber}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white group-hover:text-orange-300 transition-colors">
                  {activeOrder.storeName}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                  กำลังปรุง
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> เวลานัดรับประมาณ {activeOrder.estimatedPickup}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-orange-400 group-hover:translate-x-1 transition-transform">
            <span>ดูตั๋วคิวสด</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      )}

      {/* Quick Category Chips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold font-kanit text-slate-200">หมวดหมู่อาหารยอดนิยม</h2>
          <button
            onClick={() => navigate("/app/search")}
            className="text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            ดูทั้งหมด
          </button>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => navigate(`/app/search?category=${cat.id}`)}
              className="p-2.5 rounded-xl bg-[#241C16] border border-white/5 hover:border-orange-500/40 flex flex-col items-center justify-center gap-1 transition-all group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">{cat.icon}</span>
              <span className="text-[11px] font-medium text-slate-300 group-hover:text-white text-center line-clamp-1">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Promotional Campaign Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-600/30 via-orange-600/20 to-red-600/30 border border-amber-500/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white font-kanit">ช่วงเวลา Early-Bird รับส่วนลดสูงสุด 30%</h3>
            <p className="text-xs text-slate-300">สั่งจองรับอาหารรอบ 11:00 - 11:30 น. ช่วยลดความแออัดคิว</p>
          </div>
        </div>
        <button
          onClick={() => navigate("/app/search")}
          className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shrink-0 transition-colors"
        >
          ดูดีลช่วงเวลา
        </button>
      </div>

      {/* Student Vendor Spotlight */}
      <section className="p-4 rounded-2xl bg-[#241C16] border border-indigo-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold font-kanit text-white">พื้นที่ร้านค้าผู้ประกอบการนักศึกษา</h2>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Student Enterprise
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          สนับสนุนธุรกิจจำลองและรายได้ระหว่างเรียนของเพื่อนนักศึกษาในวิทยาเขต
        </p>
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
          <div
            onClick={() => navigate("/app/shops/store-kku-student-01")}
            className="min-w-[200px] p-3 rounded-xl bg-[#1A1410] border border-white/10 hover:border-indigo-400 transition-all cursor-pointer"
          >
            <div className="font-semibold text-xs text-white">Craft Tea Club</div>
            <div className="text-[11px] text-indigo-300">ชาไทยแท้ & โกโก้เข้มข้น</div>
            <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> 4.9 (980 รีวิว)
            </div>
          </div>
        </div>
      </section>

      {/* Popular Bestseller Cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold font-kanit text-slate-200">เมนูยอดนิยมวันนี้</h2>
          </div>
          <button
            onClick={() => navigate("/app/search")}
            className="text-xs text-orange-400 hover:text-orange-300"
          >
            ดูยอดนิยม
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {featuredDishes.map((dish) => (
            <div
              key={dish.id}
              className="rounded-2xl bg-[#241C16] border border-white/10 hover:border-orange-500/40 overflow-hidden flex flex-col transition-all group"
            >
              <div
                className="h-36 w-full bg-slate-800 relative cursor-pointer overflow-hidden"
                onClick={() => navigate(`/app/products/${dish.id}`)}
              >
                {dish.imageUrl ? (
                  <img
                    src={dish.imageUrl}
                    alt={dish.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    รูปภาพอาหาร
                  </div>
                )}
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-600 text-white shadow">
                  ขายดี #{dish.salesCount} จาน
                </span>
                <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-black/70 backdrop-blur text-slate-200 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-orange-400" /> ~{dish.prepTimeMinutes} นาที
                </span>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="text-[11px] text-orange-400 font-medium line-clamp-1">{dish.shopName}</div>
                  <h3
                    onClick={() => navigate(`/app/products/${dish.id}`)}
                    className="font-bold text-sm text-white hover:text-orange-300 transition-colors cursor-pointer line-clamp-1 mt-0.5"
                  >
                    {dish.name}
                  </h3>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5">
                  <div className="font-bold text-base text-white font-jetbrains">
                    ฿{dish.price}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickAdd(dish)}
                    className="p-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow transition-all hover:scale-105"
                    title="เพิ่มลงตะกร้าทันที"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Daily Menu Board (Embedded reusable component) */}
      <section>
        <DailyMenuBoard />
      </section>

      {/* Decision 3 Modal: Cross-Store Cart Replacement Alert */}
      <CrossStoreCartModal
        isOpen={!!crossStorePendingItem}
        existingStoreName="ร้านค้าเดิมในตะกร้า"
        newStoreName={crossStorePendingItem?.menuItem?.shopName || "ร้านค้าใหม่"}
        onConfirm={handleConfirmCrossStore}
        onCancel={() => setCrossStorePendingItem(null)}
      />
    </div>
  );
};

export default MarketplaceHomePage;
