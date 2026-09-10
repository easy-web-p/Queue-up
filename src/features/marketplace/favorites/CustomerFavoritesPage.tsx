import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  Heart,
  Store,
  Utensils,
  Plus,
  Star,
  Clock,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { addItem, selectCartStoreId, clearCart } from "../../../store/cartSlice";
import { MenuItem, CartItem } from "../../../types";
import { CrossStoreCartModal } from "../cart/CrossStoreCartModal";

export const CustomerFavoritesPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentCartStoreId = useSelector(selectCartStoreId);

  const [activeTab, setActiveTab] = useState<"dishes" | "shops">("dishes");
  const [crossStorePendingItem, setCrossStorePendingItem] = useState<CartItem | null>(null);

  // Mock initial favorite dishes
  const [favoriteDishes, setFavoriteDishes] = useState<MenuItem[]>([
    {
      id: "fav-dish-1",
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
      id: "fav-dish-2",
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
      id: "fav-dish-3",
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
  ]);

  // Mock initial favorite shops
  const [favoriteShops, setFavoriteShops] = useState([
    {
      id: "store-kku-01",
      name: "ร้านคุณกานต์ กะเพราถาด",
      zone: "โรงอาหารคอมเพล็กซ์ โซน A ล็อค 04",
      coverUrl: "/crispy_fried_chicken.jpg",
      rating: 4.8,
      reviewCount: 320,
      isOpen: true,
      currentQueue: 4,
      prepTimeMinutes: 6,
      category: "อาหารจานเดียว • ผัดกะเพรา",
    },
    {
      id: "store-kku-student-01",
      name: "Craft Tea Club (ร้านนักศึกษา)",
      zone: "โรงอาหารคอมเพล็กซ์ โซน C ล็อค 12",
      coverUrl: "/pork_satay.jpg",
      rating: 4.9,
      reviewCount: 195,
      isOpen: true,
      currentQueue: 1,
      prepTimeMinutes: 3,
      category: "เครื่องดื่ม • เบเกอรี่",
      isStudentVendor: true,
    },
  ]);

  const handleRemoveDish = (dishId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteDishes((prev) => prev.filter((d) => d.id !== dishId));
  };

  const handleRemoveShop = (shopId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteShops((prev) => prev.filter((s) => s.id !== shopId));
  };

  const handleQuickAdd = (dish: MenuItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const itemToAdd: CartItem = {
      menuItem: dish,
      quantity: 1,
      unitPriceSatang: dish.priceSatang || dish.price * 100,
    };

    if (currentCartStoreId && dish.storeId && currentCartStoreId !== dish.storeId) {
      setCrossStorePendingItem(itemToAdd);
      return;
    }

    dispatch(addItem(itemToAdd));
  };

  const handleConfirmCrossStore = () => {
    if (crossStorePendingItem) {
      dispatch(clearCart());
      dispatch(addItem(crossStorePendingItem));
      setCrossStorePendingItem(null);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-kanit flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            <span>รายการโปรดของคุณ</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            เข้าถึงเมนูประจำและร้านค้าที่คุณชื่นชอบได้ทันทีในคลิกเดียว
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex p-1 bg-slate-100 dark:bg-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("dishes")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "dishes"
                ? "bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>เมนูที่บันทึก ({favoriteDishes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("shops")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "shops"
                ? "bg-white dark:bg-zinc-900 text-orange-600 dark:text-orange-400 shadow-sm"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>ร้านค้าที่ติดตาม ({favoriteShops.length})</span>
          </button>
        </div>
      </div>

      {/* Dishes Tab */}
      {activeTab === "dishes" && (
        <div className="space-y-4">
          {favoriteDishes.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="w-14 h-14 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-500 flex items-center justify-center mx-auto">
                <Heart className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-base">
                ยังไม่มีเมนูโปรดที่บันทึกไว้
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                กดไอคอนหัวใจที่การ์ดอาหารในหน้าหลักหรือหน้าค้นหา เพื่อบันทึกเป็นเมนูโปรดของคุณ
              </p>
              <button
                type="button"
                onClick={() => navigate("/app/search")}
                className="mt-2 px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors"
              >
                สำรวจเมนูอาหาร
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {favoriteDishes.map((dish) => (
                <div
                  key={dish.id}
                  onClick={() => navigate(`/app/products/${dish.id}`)}
                  className="group bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-orange-400/50 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-36 w-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                      <img
                        src={dish.imageUrl || "/crispy_fried_chicken.jpg"}
                        alt={dish.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        onClick={(e) => handleRemoveDish(dish.id, e)}
                        className="absolute top-2.5 right-2.5 p-2 rounded-full bg-white/90 dark:bg-zinc-900/90 text-rose-500 hover:scale-110 transition-transform shadow"
                        title="ลบออกจากรายการโปรด"
                      >
                        <Heart className="w-4 h-4 fill-rose-500" />
                      </button>
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-[10px] font-medium text-white flex items-center gap-1">
                        <Clock className="w-3 h-3 text-orange-400" />
                        <span>~{dish.prepTimeMinutes || 5} นาที</span>
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                        <span className="truncate max-w-[140px] font-medium">{dish.shopName}</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3 h-3 fill-amber-400" />
                          <span>{dish.rating || 4.8}</span>
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {dish.name}
                      </h3>

                      {dish.allergens && dish.allergens.length > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-md w-fit">
                          <ShieldAlert className="w-3 h-3" />
                          <span>มี {dish.allergens.join(", ")}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 pt-0 flex items-center justify-between mt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="font-black text-base text-orange-600 dark:text-orange-400 font-jetbrains">
                      ฿{dish.price}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleQuickAdd(dish, e)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-transform active:scale-95 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ใส่ตะกร้า</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Shops Tab */}
      {activeTab === "shops" && (
        <div className="space-y-4">
          {favoriteShops.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="w-14 h-14 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-500 flex items-center justify-center mx-auto">
                <Store className="w-7 h-7" />
              </div>
              <h3 className="font-bold text-slate-800 dark:text-zinc-200 text-base">
                ยังไม่มีร้านค้าที่ติดตามไว้
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                ติดตามร้านค้าเพื่อรับทราบเมนูพิเศษและโปรโมชันเฉพาะร้าน
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {favoriteShops.map((shop) => (
                <div
                  key={shop.id}
                  onClick={() => navigate(`/app/shops/${shop.id}`)}
                  className="group p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-orange-500/50 cursor-pointer transition-all flex flex-col justify-between shadow-sm hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-slate-200 dark:border-zinc-700">
                        <img
                          src={shop.coverUrl}
                          alt={shop.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                            {shop.name}
                          </h3>
                          {shop.isStudentVendor && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                              นักศึกษา
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{shop.category}</p>
                        <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">{shop.zone}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleRemoveShop(shop.id, e)}
                      className="p-2 rounded-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                      title="เลิกติดตามร้านนี้"
                    >
                      <Heart className="w-4 h-4 fill-rose-500" />
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3 text-slate-600 dark:text-zinc-400">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{shop.rating}</span>
                        <span className="text-[10px] text-slate-400">({shop.reviewCount})</span>
                      </div>
                      <span>•</span>
                      <span>คิวรอ {shop.currentQueue} คิว</span>
                    </div>

                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 font-bold text-xs group-hover:translate-x-0.5 transition-transform">
                      <span>ดูหน้าร้าน</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cross-Store Conflict Modal */}
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

export default CustomerFavoritesPage;
