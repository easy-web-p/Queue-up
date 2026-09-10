import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Plus,
  Edit2,
  Archive,
  Layers,
  Sliders,
  UtensilsCrossed,
  Clock,
  ShieldAlert,
  Search,
  X,
} from "lucide-react";
import { MenuItem, ModifierGroup } from "../../../types";
import { useToast } from "../../../components/ToastProvider.jsx";

type ProductState = "ACTIVE" | "DRAFT" | "SOLD_OUT" | "SCHEDULED" | "ARCHIVED" | "SUSPENDED";

interface ExtendedMenuItem extends MenuItem {
  state: ProductState;
  modifierGroups?: ModifierGroup[];
}

export const StoreCatalogManager: React.FC = () => {
  const { shopId = "store-kku-01" } = useParams<{ shopId: string }>();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"products" | "categories" | "modifiers">("products");
  const [searchQuery, setSearchQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("ALL");
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingDish, setEditingDish] = useState<ExtendedMenuItem | null>(null);

  // Form State for Add / Edit
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("ข้าวจานเดียว");
  const [formPrice, setFormPrice] = useState(55);
  const [formPrepTime, setFormPrepTime] = useState(5);
  const [formState, setFormState] = useState<ProductState>("ACTIVE");
  const [formAllergens, setFormAllergens] = useState<string[]>([]);

  const [dishes, setDishes] = useState<ExtendedMenuItem[]>([
    {
      id: "dish-1",
      name: "ข้าวกะเพราหมูกรอบไข่ดาว",
      category: "ข้าวจานเดียว",
      price: 55,
      priceSatang: 5500,
      state: "ACTIVE",
      isAvailable: true,
      stockMode: "daily_tracked",
      stock: 45,
      prepTimeMinutes: 5,
      allergens: ["ถั่วเหลือง", "ไข่ไก่"],
    },
    {
      id: "dish-2",
      name: "บะหมี่ต้มยำทะเลน้ำข้น",
      category: "ก๋วยเตี๋ยว",
      price: 65,
      priceSatang: 6500,
      state: "ACTIVE",
      isAvailable: true,
      stockMode: "daily_tracked",
      stock: 30,
      prepTimeMinutes: 7,
      allergens: ["อาหารทะเล", "ถั่วลิสง"],
    },
    {
      id: "dish-3",
      name: "ต้มจืดเต้าหู้หมูสับสาหร่าย",
      category: "ต้มจืด/ซุป",
      price: 45,
      priceSatang: 4500,
      state: "SOLD_OUT",
      isAvailable: false,
      stockMode: "daily_tracked",
      stock: 0,
      prepTimeMinutes: 6,
      allergens: ["ถั่วเหลือง"],
    },
    {
      id: "dish-4",
      name: "ชาไทยเย็นเข้มข้นโบราณ",
      category: "เครื่องดื่ม",
      price: 35,
      priceSatang: 3500,
      state: "DRAFT",
      isAvailable: false,
      prepTimeMinutes: 3,
      allergens: ["นมวัว"],
    },
    {
      id: "dish-5",
      name: "ข้าวผัดสับปะรดกุ้งสด",
      category: "ข้าวจานเดียว",
      price: 70,
      priceSatang: 7000,
      state: "ARCHIVED",
      isAvailable: false,
      prepTimeMinutes: 8,
      allergens: ["อาหารทะเล"],
    },
  ]);

  const [categories] = useState([
    { id: "cat-1", name: "ข้าวจานเดียว", count: 2, displayOrder: 1 },
    { id: "cat-2", name: "ก๋วยเตี๋ยว", count: 1, displayOrder: 2 },
    { id: "cat-3", name: "ต้มจืด/ซุป", count: 1, displayOrder: 3 },
    { id: "cat-4", name: "เครื่องดื่ม", count: 1, displayOrder: 4 },
  ]);

  const [modifiers] = useState<ModifierGroup[]>([
    {
      id: "mod-spicy",
      storeId: shopId,
      name: "ระดับความเผ็ด (Spiciness)",
      isRequired: true,
      selectionType: "single",
      options: [
        { id: "opt-1", name: "ไม่เผ็ดเลย (0%)", priceModifier: 0, priceModifierSatang: 0 },
        { id: "opt-2", name: "เผ็ดน้อย (25%)", priceModifier: 0, priceModifierSatang: 0 },
        { id: "opt-3", name: "เผ็ดกลาง (50%)", priceModifier: 0, priceModifierSatang: 0 },
        { id: "opt-4", name: "เผ็ดจัดจ้าน (100%)", priceModifier: 0, priceModifierSatang: 0 },
      ],
    },
    {
      id: "mod-egg",
      storeId: shopId,
      name: "ไข่และท็อปปิ้งเสริม",
      isRequired: false,
      selectionType: "multiple",
      options: [
        { id: "opt-egg-1", name: "ไข่ดาวสุกกรอบ", priceModifier: 10, priceModifierSatang: 1000 },
        { id: "opt-egg-2", name: "ไข่ดาวเยิ้ม (ยางมะตูม)", priceModifier: 10, priceModifierSatang: 1000 },
        { id: "opt-egg-3", name: "ไข่เจียวหมูสับเสริม", priceModifier: 15, priceModifierSatang: 1500 },
      ],
    },
  ]);

  const getStateBadge = (state: ProductState) => {
    switch (state) {
      case "ACTIVE":
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            ACTIVE (เปิดขาย)
          </span>
        );
      case "DRAFT":
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300 border border-zinc-600">
            DRAFT (ฉบับร่าง)
          </span>
        );
      case "SOLD_OUT":
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            SOLD OUT (หมด)
          </span>
        );
      case "SCHEDULED":
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
            SCHEDULED (ตั้งเวลา)
          </span>
        );
      case "ARCHIVED":
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500 border border-zinc-700">
            ARCHIVED (เก็บถาวร)
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            SUSPENDED (ระงับชั่วคราว)
          </span>
        );
    }
  };

  const handleOpenAddModal = () => {
    setEditingDish(null);
    setFormName("");
    setFormCategory("ข้าวจานเดียว");
    setFormPrice(50);
    setFormPrepTime(5);
    setFormState("ACTIVE");
    setFormAllergens([]);
    setShowProductModal(true);
  };

  const handleOpenEditModal = (dish: ExtendedMenuItem) => {
    setEditingDish(dish);
    setFormName(dish.name);
    setFormCategory(dish.category);
    setFormPrice(dish.price);
    setFormPrepTime(dish.prepTimeMinutes || 5);
    setFormState(dish.state);
    setFormAllergens(dish.allergens || []);
    setShowProductModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingDish) {
      setDishes((prev) =>
        prev.map((d) =>
          d.id === editingDish.id
            ? {
                ...d,
                name: formName.trim(),
                category: formCategory,
                price: formPrice,
                priceSatang: formPrice * 100,
                prepTimeMinutes: formPrepTime,
                state: formState,
                isAvailable: formState === "ACTIVE",
                allergens: formAllergens,
              }
            : d
        )
      );
      toast.success(`อัปเดตเมนู ${formName} เรียบร้อย`);
    } else {
      const newDish: ExtendedMenuItem = {
        id: `dish-${Date.now()}`,
        name: formName.trim(),
        category: formCategory,
        price: formPrice,
        priceSatang: formPrice * 100,
        prepTimeMinutes: formPrepTime,
        state: formState,
        isAvailable: formState === "ACTIVE",
        allergens: formAllergens,
      };
      setDishes((prev) => [newDish, ...prev]);
      toast.success(`สร้างเมนูใหม่ ${newDish.name} สำเร็จ`);
    }

    setShowProductModal(false);
  };

  const handleArchiveDish = (dishId: string) => {
    setDishes((prev) =>
      prev.map((d) =>
        d.id === dishId ? { ...d, state: "ARCHIVED" as ProductState, isAvailable: false } : d
      )
    );
    toast.info("ย้ายเมนูเข้าสู่หมวด ARCHIVED เรียบร้อย (ไม่ลบออกจากประวัติออเดอร์)");
  };

  const toggleAllergen = (allergen: string) => {
    setFormAllergens((prev) =>
      prev.includes(allergen) ? prev.filter((a) => a !== allergen) : [...prev, allergen]
    );
  };

  const filteredDishes = dishes.filter((d) => {
    const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesState = stateFilter === "ALL" || d.state === stateFilter;
    return matchesSearch && matchesState;
  });

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white font-kanit flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-orange-400" />
            <span>จัดการแคตตาล็อกเมนู (Catalog Management)</span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            ร้านค้า: <span className="text-orange-400 font-mono font-medium">{shopId}</span> • จัดการสินค้า หมวดหมู่ ตัวเลือกเสริม และสถานะการวางขาย
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs transition-colors shadow-md shadow-orange-950/40"
        >
          <Plus className="w-4 h-4" />
          <span>เพิ่มเมนูอาหารใหม่</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-zinc-900 border border-zinc-800 rounded-xl w-fit text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "products"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <UtensilsCrossed className="w-3.5 h-3.5" />
          <span>รายการอาหาร ({dishes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "categories"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>หมวดหมู่ ({categories.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("modifiers")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
            activeTab === "modifiers"
              ? "bg-orange-600 text-white shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>กลุ่มตัวเลือกเสริม ({modifiers.length})</span>
        </button>
      </div>

      {/* Tab 1: Products */}
      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Search & State Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาชื่อเมนูอาหาร..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#18181B] border border-zinc-800 text-white text-xs placeholder-zinc-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-[#18181B] border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-orange-500"
            >
              <option value="ALL">สถานะทั้งหมด</option>
              <option value="ACTIVE">ACTIVE (เปิดขาย)</option>
              <option value="DRAFT">DRAFT (ฉบับร่าง)</option>
              <option value="SOLD_OUT">SOLD_OUT (หมด)</option>
              <option value="ARCHIVED">ARCHIVED (เก็บถาวร)</option>
            </select>
          </div>

          {/* Products List */}
          <div className="bg-[#18181B] border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800">
            {filteredDishes.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                ไม่พบเมนูตามเงื่อนไขการค้นหา
              </div>
            ) : (
              filteredDishes.map((dish) => (
                <div
                  key={dish.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-800/40 transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-sm text-white">{dish.name}</h3>
                      {getStateBadge(dish.state)}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400 flex-wrap">
                      <span>หมวด: <strong className="text-zinc-300">{dish.category}</strong></span>
                      <span>•</span>
                      <span>
                        ราคา:{" "}
                        <strong className="text-white font-mono">฿{dish.price}</strong>{" "}
                        <span className="text-[11px] text-zinc-500">({dish.priceSatang} satang)</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-orange-400" />
                        <span>~{dish.prepTimeMinutes || 5} นาที</span>
                      </span>
                    </div>

                    {dish.allergens && dish.allergens.length > 0 && (
                      <div className="flex items-center gap-1 text-[11px] text-amber-400 pt-0.5">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>สารก่อภูมิแพ้: {dish.allergens.join(", ")}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(dish)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors border border-zinc-700"
                      title="แก้ไขข้อมูลเมนู"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {dish.state !== "ARCHIVED" && (
                      <button
                        type="button"
                        onClick={() => handleArchiveDish(dish.id)}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 transition-colors border border-zinc-700"
                        title="จัดเก็บเข้าคลังถาวร (Archive)"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Categories */}
      {activeTab === "categories" && (
        <div className="p-6 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <h3 className="font-bold text-sm text-white font-kanit">หมวดหมู่อาหารประจำร้าน</h3>
            <button
              type="button"
              onClick={() => toast.info("เพิ่มหมวดหมู่ใหม่")}
              className="text-xs font-bold text-orange-400 hover:text-orange-300"
            >
              + เพิ่มหมวดหมู่
            </button>
          </div>

          <div className="space-y-2">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-500 font-bold">#{cat.displayOrder}</span>
                  <span className="font-bold text-white text-sm">{cat.name}</span>
                </div>
                <span className="text-zinc-400">{cat.count} เมนู</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Modifiers */}
      {activeTab === "modifiers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400">
              กลุ่มตัวเลือกเสริมสำหรับให้ลูกค้าเลือก เช่น ระดับความเผ็ด เพิ่มไข่ดาว หรือระดับความหวาน
            </p>
            <button
              type="button"
              onClick={() => toast.info("สร้างกลุ่มตัวเลือกใหม่")}
              className="px-3 py-1.5 rounded-xl bg-orange-600 text-white font-bold text-xs"
            >
              + สร้างกลุ่มตัวเลือก
            </button>
          </div>

          <div className="space-y-3">
            {modifiers.map((mod) => (
              <div
                key={mod.id}
                className="p-5 rounded-2xl bg-[#18181B] border border-zinc-800 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">{mod.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {mod.selectionType === "single" ? "เลือกได้ 1 อย่าง" : "เลือกได้หลายอย่าง"}
                    </span>
                    {mod.isRequired && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                        จำเป็นต้องเลือก
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {mod.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between"
                    >
                      <span className="text-zinc-300">{opt.name}</span>
                      <span className="font-mono text-orange-400 font-bold">
                        {opt.priceModifier > 0 ? `+฿${opt.priceModifier}` : "ฟรี"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-[#18181B] border border-zinc-800 rounded-2xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white font-kanit">
                {editingDish ? `แก้ไขเมนู: ${editingDish.name}` : "เพิ่มเมนูอาหารใหม่"}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              <div>
                <label className="text-zinc-300 font-medium">ชื่อเมนูอาหาร</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น ข้าวกะเพราหมูกรอบไข่ดาว"
                  className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-medium">หมวดหมู่อาหาร</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-zinc-300 font-medium">สถานะการวางขาย (State)</label>
                  <select
                    value={formState}
                    onChange={(e) => setFormState(e.target.value as ProductState)}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-orange-500"
                  >
                    <option value="ACTIVE">ACTIVE (เปิดขาย)</option>
                    <option value="DRAFT">DRAFT (ฉบับร่าง)</option>
                    <option value="SOLD_OUT">SOLD_OUT (สินค้าหมด)</option>
                    <option value="SCHEDULED">SCHEDULED (ตั้งเวลา)</option>
                    <option value="ARCHIVED">ARCHIVED (เก็บถาวร)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-medium">ราคาขาย (บาท)</label>
                  <input
                    type="number"
                    min={1}
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-zinc-500 mt-0.5 block">
                    = {formPrice * 100} สตางค์ (Satang Invariant)
                  </span>
                </div>

                <div>
                  <label className="text-zinc-300 font-medium">เวลาปรุงเฉลี่ย (นาที)</label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={formPrepTime}
                    onChange={(e) => setFormPrepTime(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-medium">
                  สารก่อภูมิแพ้ที่อาจมีในอาหาร (Allergen Tags)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                  {["ถั่วลิสง", "อาหารทะเล", "ถั่วเหลือง", "ไข่ไก่", "นมวัว", "แป้งสาลี"].map(
                    (alg) => (
                      <label
                        key={alg}
                        className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-colors ${
                          formAllergens.includes(alg)
                            ? "bg-amber-500/20 border-amber-500 text-amber-300 font-semibold"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formAllergens.includes(alg)}
                          onChange={() => toggleAllergen(alg)}
                          className="rounded border-zinc-700 text-orange-600 focus:ring-0"
                        />
                        <span>{alg}</span>
                      </label>
                    )
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-colors font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold transition-colors shadow"
                >
                  บันทึกเมนูอาหาร
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreCatalogManager;
