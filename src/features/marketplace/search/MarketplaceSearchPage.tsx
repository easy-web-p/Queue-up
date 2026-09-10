import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Search,
  Clock,
  Star,
  Plus,
} from "lucide-react";
import { MenuItem, CartItem } from "../../../types";
import { addItem, selectCartStoreId, clearCart } from "../../../store/cartSlice";
import CrossStoreCartModal from "../cart/CrossStoreCartModal";

export const MarketplaceSearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const initialCategory = searchParams.get("category") || "";

  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [maxPrice, setMaxPrice] = useState<number>(100);
  const [crossStorePendingItem, setCrossStorePendingItem] = useState<CartItem | null>(null);

  const dispatch = useDispatch();
  const currentCartStoreId = useSelector(selectCartStoreId);
  const navigate = useNavigate();

  const mockDishes: MenuItem[] = [
    {
      id: "dish-1",
      name: "ข้าวกะเพราหมูกรอบไข่ดาว",
      category: "rice",
      price: 55,
      priceSatang: 5500,
      storeId: "store-kku-01",
      shopName: "ร้านคุณกานต์ กะเพราถาด",
      imageUrl: "/crispy_fried_chicken.jpg",
      prepTimeMinutes: 5,
      rating: 4.8,
      salesCount: 1420,
    },
    {
      id: "dish-2",
      name: "บะหมี่ต้มยำทะเลน้ำข้น",
      category: "noodles",
      price: 65,
      priceSatang: 6500,
      storeId: "store-kku-02",
      shopName: "ป้าต้อย เตี๋ยวต้มยำ",
      imageUrl: "/salmon_salad.jpg",
      prepTimeMinutes: 7,
      rating: 4.9,
      salesCount: 1120,
    },
    {
      id: "dish-3",
      name: "ชาไทยเย็นหวานน้อย ชาใต้แท้",
      category: "drinks",
      price: 35,
      priceSatang: 3500,
      storeId: "store-kku-student-01",
      shopName: "Craft Tea Club",
      imageUrl: "/pork_satay.jpg",
      prepTimeMinutes: 3,
      rating: 4.9,
      salesCount: 980,
    },
    {
      id: "dish-4",
      name: "ข้าวหมูแดงหมูกรอบ ไข่ต้มยางมะตูม",
      category: "rice",
      price: 50,
      priceSatang: 5000,
      storeId: "store-kku-01",
      shopName: "ร้านคุณกานต์ กะเพราถาด",
      imageUrl: "/crispy_fried_chicken.jpg",
      prepTimeMinutes: 4,
      rating: 4.7,
      salesCount: 890,
    },
    {
      id: "dish-5",
      name: "ส้มตำไทยไข่เค็ม รสจัดจ้าน",
      category: "snacks",
      price: 45,
      priceSatang: 4500,
      storeId: "store-kku-03",
      shopName: "เจ๊แดง แซ่บอีหลี",
      imageUrl: "/salmon_salad.jpg",
      prepTimeMinutes: 5,
      rating: 4.8,
      salesCount: 760,
    },
  ];

  const filteredDishes = mockDishes.filter((dish) => {
    if (query && !dish.name.toLowerCase().includes(query.toLowerCase()) && !dish.shopName?.toLowerCase().includes(query.toLowerCase())) {
      return false;
    }
    if (selectedCategory && dish.category !== selectedCategory) {
      return false;
    }
    if (dish.price > maxPrice) {
      return false;
    }
    return true;
  });

  const handleQuickAdd = (dish: MenuItem) => {
    const itemToAdd: CartItem = {
      menuItem: dish,
      quantity: 1,
      unitPriceSatang: dish.priceSatang || dish.price * 100,
    };

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

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 p-2 rounded-2xl bg-[#241C16] border border-orange-500/30">
          <Search className="w-5 h-5 text-orange-400 ml-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ค้นหาชื่ออาหาร, ร้านค้า, หรือประเภท..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-400 focus:outline-none px-2"
          />
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <button
          onClick={() => setSelectedCategory("")}
          className={`px-3 py-1.5 rounded-full whitespace-nowrap border transition-all ${
            !selectedCategory
              ? "bg-orange-600 text-white border-orange-500 font-semibold"
              : "bg-[#241C16] text-slate-300 border-white/10"
          }`}
        >
          ทั้งหมด ({mockDishes.length})
        </button>
        <button
          onClick={() => setSelectedCategory("rice")}
          className={`px-3 py-1.5 rounded-full whitespace-nowrap border transition-all ${
            selectedCategory === "rice"
              ? "bg-orange-600 text-white border-orange-500 font-semibold"
              : "bg-[#241C16] text-slate-300 border-white/10"
          }`}
        >
          ข้าวจานเดียว
        </button>
        <button
          onClick={() => setSelectedCategory("noodles")}
          className={`px-3 py-1.5 rounded-full whitespace-nowrap border transition-all ${
            selectedCategory === "noodles"
              ? "bg-orange-600 text-white border-orange-500 font-semibold"
              : "bg-[#241C16] text-slate-300 border-white/10"
          }`}
        >
          ก๋วยเตี๋ยว
        </button>
        <button
          onClick={() => setSelectedCategory("drinks")}
          className={`px-3 py-1.5 rounded-full whitespace-nowrap border transition-all ${
            selectedCategory === "drinks"
              ? "bg-orange-600 text-white border-orange-500 font-semibold"
              : "bg-[#241C16] text-slate-300 border-white/10"
          }`}
        >
          เครื่องดื่ม
        </button>

        <div className="ml-auto flex items-center gap-1.5 text-slate-400 pl-2">
          <span>งบไม่เกิน:</span>
          <select
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="bg-[#241C16] border border-white/10 rounded-lg px-2 py-1 text-white text-xs"
          >
            <option value={40}>฿40</option>
            <option value={60}>฿60</option>
            <option value={100}>฿100</option>
          </select>
        </div>
      </div>

      {/* Results List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredDishes.length === 0 ? (
          <div className="col-span-full p-8 text-center bg-[#241C16] border border-white/5 rounded-2xl">
            <p className="text-slate-400 text-sm">ไม่พบรายการอาหารที่ตรงกับคำค้นหาของคุณ</p>
            <button
              onClick={() => {
                setQuery("");
                setSelectedCategory("");
                setMaxPrice(100);
              }}
              className="mt-3 px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        ) : (
          filteredDishes.map((dish) => (
            <div
              key={dish.id}
              className="p-3 rounded-2xl bg-[#241C16] border border-white/10 hover:border-orange-500/40 flex gap-3 transition-all"
            >
              <div
                onClick={() => navigate(`/app/products/${dish.id}`)}
                className="w-24 h-24 rounded-xl bg-slate-800 overflow-hidden shrink-0 cursor-pointer"
              >
                {dish.imageUrl ? (
                  <img src={dish.imageUrl} alt={dish.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                    รูปภาพ
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <div className="text-[11px] text-orange-400 font-medium truncate">{dish.shopName}</div>
                  <h3
                    onClick={() => navigate(`/app/products/${dish.id}`)}
                    className="font-bold text-sm text-white hover:text-orange-300 transition-colors cursor-pointer line-clamp-1"
                  >
                    {dish.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-orange-400" /> {dish.prepTimeMinutes} นาที
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Star className="w-3 h-3 fill-amber-400" /> {dish.rating}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5">
                  <div className="font-bold text-sm text-white font-jetbrains">฿{dish.price}</div>
                  <button
                    type="button"
                    onClick={() => handleQuickAdd(dish)}
                    className="p-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-all shadow"
                    title="เพิ่มลงตะกร้า"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Decision 3 Modal */}
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

export default MarketplaceSearchPage;
