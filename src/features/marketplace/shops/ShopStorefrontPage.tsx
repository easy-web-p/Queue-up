import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  Star,
  Clock,
  MapPin,
  CheckCircle2,
  Flame,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { MenuItem, CartItem } from "../../../types";
import { addItem, selectCartStoreId, clearCart } from "../../../store/cartSlice";
import CrossStoreCartModal from "../cart/CrossStoreCartModal";

export const ShopStorefrontPage: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentCartStoreId = useSelector(selectCartStoreId);

  const [crossStorePendingItem, setCrossStorePendingItem] = useState<CartItem | null>(null);

  const shopInfo = {
    id: shopId,
    name: "ร้านคุณกานต์ กะเพราถาด",
    location: "โรงอาหารคอมเพล็กซ์ โซน A ล็อค 04",
    rating: 4.8,
    reviewsCount: 340,
    isOpen: true,
    estimatedPrepMinutes: 6,
    activeQueueCount: 3,
    bannerUrl: "/crispy_fried_chicken.jpg",
  };

  const storeMenu: MenuItem[] = [
    {
      id: "dish-1",
      name: "ข้าวกะเพราหมูกรอบไข่ดาว",
      category: "main",
      price: 55,
      priceSatang: 5500,
      storeId: shopId,
      shopName: shopInfo.name,
      imageUrl: "/crispy_fried_chicken.jpg",
      prepTimeMinutes: 5,
      salesCount: 1420,
    },
    {
      id: "dish-4",
      name: "ข้าวหมูแดงหมูกรอบ ไข่ต้มยางมะตูม",
      category: "main",
      price: 50,
      priceSatang: 5000,
      storeId: shopId,
      shopName: shopInfo.name,
      imageUrl: "/crispy_fried_chicken.jpg",
      prepTimeMinutes: 4,
      salesCount: 890,
    },
    {
      id: "dish-6",
      name: "ต้มจืดเต้าหู้หมูสับสาหร่าย",
      category: "soup",
      price: 45,
      priceSatang: 4500,
      storeId: shopId,
      shopName: shopInfo.name,
      prepTimeMinutes: 5,
      salesCount: 420,
    },
  ];

  const handleQuickAdd = (dish: MenuItem) => {
    const itemToAdd: CartItem = {
      menuItem: dish,
      quantity: 1,
      unitPriceSatang: dish.priceSatang || dish.price * 100,
    };

    if (currentCartStoreId && currentCartStoreId !== dish.storeId) {
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
      {/* Back Button & Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-white/10 h-44 sm:h-56">
        <img
          src={shopInfo.bannerUrl}
          alt={shopInfo.name}
          loading="lazy"
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#16100C] via-transparent to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 p-2 rounded-full bg-black/60 backdrop-blur text-white hover:bg-black/80 transition-colors"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Store Info Card */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 relative -mt-10 mx-2 sm:mx-4 shadow-xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-lg sm:text-xl font-kanit text-white">
                {shopInfo.name}
              </h1>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-orange-400" /> {shopInfo.location}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ร้านเปิดอยู่
          </span>
        </div>

        {/* Quick Highlights */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-slate-300">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="font-semibold text-white">{shopInfo.rating}</span>
            <span className="text-slate-400">({shopInfo.reviewsCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-orange-400" />
            <span>เวลารอ ~{shopInfo.estimatedPrepMinutes} นาที</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>{shopInfo.activeQueueCount} คิวในครัว</span>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="space-y-3">
        <h2 className="font-bold text-base font-kanit text-white px-2">รายการอาหารทั้งหมด</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {storeMenu.map((dish) => (
            <div
              key={dish.id}
              className="p-3 rounded-2xl bg-[#241C16] border border-white/10 hover:border-orange-500/30 flex gap-3 transition-all"
            >
              <div
                onClick={() => navigate(`/app/products/${dish.id}`)}
                className="w-20 h-20 rounded-xl bg-slate-800 overflow-hidden shrink-0 cursor-pointer"
              >
                {dish.imageUrl ? (
                  <img src={dish.imageUrl} alt={dish.name} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500">
                    รูปภาพ
                  </div>
                )}
              </div>

              <div className="flex-1 flex flex-col justify-between min-w-0">
                <div>
                  <h3
                    onClick={() => navigate(`/app/products/${dish.id}`)}
                    className="font-bold text-sm text-white hover:text-orange-300 transition-colors cursor-pointer line-clamp-1"
                  >
                    {dish.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    สั่งไปแล้ว {dish.salesCount} จาน
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5">
                  <span className="font-bold text-sm text-white font-jetbrains">฿{dish.price}</span>
                  <button
                    type="button"
                    onClick={() => handleQuickAdd(dish)}
                    className="p-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition-all shadow"
                    aria-label={`เพิ่ม ${dish.name} ลงตะกร้า`}
                    title="เพิ่มลงตะกร้า"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cross Store Modal */}
      <CrossStoreCartModal
        isOpen={!!crossStorePendingItem}
        existingStoreName="ร้านเดิมในตะกร้า"
        newStoreName={shopInfo.name}
        onConfirm={handleConfirmCrossStore}
        onCancel={() => setCrossStorePendingItem(null)}
      />
    </div>
  );
};

export default ShopStorefrontPage;
