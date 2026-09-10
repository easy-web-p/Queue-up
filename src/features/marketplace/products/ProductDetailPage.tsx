import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import {
  ArrowLeft,
  Clock,
  Star,
  ShieldAlert,
  Minus,
  Plus,
  ShoppingBag,
  Check,
} from "lucide-react";
import { MenuItem, CartItem, SelectedModifierOption } from "../../../types";
import { addItem, selectCartStoreId, clearCart } from "../../../store/cartSlice";
import CrossStoreCartModal from "../cart/CrossStoreCartModal";

export const ProductDetailPage: React.FC = () => {
  const { productId = "dish-1" } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const currentCartStoreId = useSelector(selectCartStoreId);

  const [quantity, setQuantity] = useState(1);
  const [selectedSpice, setSelectedSpice] = useState("medium");
  const [selectedToppings, setSelectedToppings] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState("");
  const [crossStorePendingItem, setCrossStorePendingItem] = useState<CartItem | null>(null);

  const product: MenuItem = {
    id: productId,
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
    allergens: ["ถั่วเหลือง", "ไข่ไก่"],
    description: "กะเพราหมูกรอบคั่วพริกแห้งสูตรโบราณ รสจัดจ้าน เสิร์ฟพร้อมไข่ดาวกรอบไข่แดงเยิ้ม",
  };

  const spiceOptions = [
    { id: "mild", name: "เผ็ดน้อย (พริก 1 เม็ด)", price: 0 },
    { id: "medium", name: "เผ็ดปานกลาง (พริก 3 เม็ด)", price: 0 },
    { id: "spicy", name: "เผ็ดมาก (พริก 5 เม็ด)", price: 0 },
  ];

  const toppings = [
    { id: "extra_egg", name: "เพิ่มไข่ดาวกรอบ", price: 10, priceSatang: 1000 },
    { id: "extra_pork", name: "เพิ่มหมูกรอบพิเศษ", price: 20, priceSatang: 2000 },
    { id: "extra_rice", name: "เพิ่มข้าวสวย", price: 5, priceSatang: 500 },
  ];

  const toggleTopping = (id: string) => {
    setSelectedToppings((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  // Calculate estimated total
  const toppingsPrice = selectedToppings.reduce((sum, tid) => {
    const t = toppings.find((item) => item.id === tid);
    return sum + (t ? t.price : 0);
  }, 0);
  const unitPrice = product.price + toppingsPrice;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    const selectedMods: SelectedModifierOption[] = [
      {
        modifierGroupId: "spice",
        optionId: selectedSpice,
        name: spiceOptions.find((s) => s.id === selectedSpice)?.name,
        priceModifier: 0,
        priceModifierSatang: 0,
      },
      ...selectedToppings.map((tid) => {
        const top = toppings.find((t) => t.id === tid);
        return {
          modifierGroupId: "toppings",
          optionId: tid,
          name: top?.name,
          priceModifier: top?.price || 0,
          priceModifierSatang: top?.priceSatang || 0,
        };
      }),
    ];

    const itemToAdd: CartItem = {
      menuItem: product,
      quantity,
      customNotes: customNotes.trim() || undefined,
      selectedModifiers: selectedMods,
      unitPriceSatang: unitPrice * 100,
    };

    if (currentCartStoreId && product.storeId && currentCartStoreId !== product.storeId) {
      setCrossStorePendingItem(itemToAdd);
    } else {
      dispatch(addItem(itemToAdd));
      navigate("/app/cart");
    }
  };

  const handleConfirmCrossStore = () => {
    if (crossStorePendingItem) {
      dispatch(clearCart());
      dispatch(addItem(crossStorePendingItem));
      setCrossStorePendingItem(null);
      navigate("/app/cart");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-24">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-[#241C16] border border-white/10 text-slate-300 hover:text-white"
          aria-label="ย้อนกลับ"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm text-slate-200 line-clamp-1">
          {product.shopName}
        </span>
      </div>

      {/* Product Image Gallery */}
      <div className="h-60 sm:h-72 w-full rounded-2xl overflow-hidden bg-slate-800 border border-white/10 relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500">
            รูปภาพอาหาร
          </div>
        )}
      </div>

      {/* Title & Price Info */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-extrabold text-lg sm:text-xl font-kanit text-white">
            {product.name}
          </h1>
          <span className="text-xl font-extrabold text-orange-400 font-jetbrains shrink-0">
            ฿{product.price}
          </span>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">{product.description}</p>

        <div className="flex items-center gap-4 pt-2 border-t border-white/5 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-orange-400" /> ทำเร็ว ~{product.prepTimeMinutes} นาที
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <Star className="w-3.5 h-3.5 fill-amber-400" /> {product.rating} (1.4k+ รีวิว)
          </span>
        </div>
      </div>

      {/* Allergen Warning Banner */}
      {product.allergens && product.allergens.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-300">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
          <div>
            <span className="font-bold">ข้อมูลสารก่อภูมิแพ้:</span> เมนูนี้มีส่วนผสมของ{" "}
            <span className="font-semibold text-white">{product.allergens.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Required Modifier: ระดับความเผ็ด */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-kanit">ระดับความเผ็ด</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
            จำเป็นต้องเลือก 1 ข้อ
          </span>
        </div>
        <div className="space-y-2">
          {spiceOptions.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                selectedSpice === opt.id
                  ? "bg-orange-500/15 border-orange-500 text-white font-semibold"
                  : "bg-[#1A1410] border-white/5 text-slate-300 hover:border-white/20"
              }`}
            >
              <span className="text-xs">{opt.name}</span>
              <input
                type="radio"
                name="spice"
                value={opt.id}
                checked={selectedSpice === opt.id}
                onChange={() => setSelectedSpice(opt.id)}
                className="text-orange-600 focus:ring-0"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Optional Additions: ท็อปปิ้งเพิ่มเติม */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white font-kanit">ท็อปปิ้งเพิ่มเติม (เลือกได้หลายข้อ)</h3>
          <span className="text-[10px] text-slate-400">ตัวเลือกเสริม</span>
        </div>
        <div className="space-y-2">
          {toppings.map((top) => {
            const isChecked = selectedToppings.includes(top.id);
            return (
              <div
                key={top.id}
                onClick={() => toggleTopping(top.id)}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                  isChecked
                    ? "bg-orange-500/15 border-orange-500 text-white font-semibold"
                    : "bg-[#1A1410] border-white/5 text-slate-300 hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2.5 text-xs">
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center border ${
                      isChecked ? "bg-orange-600 border-orange-500 text-white" : "border-slate-500"
                    }`}
                  >
                    {isChecked && <Check className="w-3 h-3" />}
                  </div>
                  <span>{top.name}</span>
                </div>
                <span className="text-xs font-bold text-orange-400 font-jetbrains">+฿{top.price}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="p-4 rounded-2xl bg-[#241C16] border border-white/10 space-y-2">
        <label htmlFor="custom-notes" className="text-sm font-bold text-white font-kanit">
          ข้อความระบุถึงร้านค้า (ถ้ามี)
        </label>
        <textarea
          id="custom-notes"
          value={customNotes}
          onChange={(e) => setCustomNotes(e.target.value)}
          placeholder="เช่น ไม่ใส่ผักชี, แยกพริกน้ำปลา..."
          rows={2}
          className="w-full bg-[#1A1410] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1A1410]/95 backdrop-blur-md border-t border-white/10 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          {/* Quantity Controls */}
          <div className="flex items-center gap-3 bg-[#241C16] border border-white/10 rounded-xl p-1 px-2">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="p-1 rounded-lg text-slate-400 hover:text-white disabled:opacity-30"
              aria-label="ลดจำนวน"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm text-white font-jetbrains w-6 text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="p-1 rounded-lg text-slate-400 hover:text-white"
              aria-label="เพิ่มจำนวน"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart Action */}
          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 py-3 px-5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-between transition-all shadow-lg shadow-orange-950/40"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              เพิ่มลงตะกร้า
            </span>
            <span className="font-jetbrains">฿{totalPrice}</span>
          </button>
        </div>
      </div>

      {/* Decision 3 Modal */}
      <CrossStoreCartModal
        isOpen={!!crossStorePendingItem}
        existingStoreName="ร้านค้าเดิมในตะกร้า"
        newStoreName={product.shopName}
        onConfirm={handleConfirmCrossStore}
        onCancel={() => setCrossStorePendingItem(null)}
      />
    </div>
  );
};

export default ProductDetailPage;
