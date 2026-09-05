import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { addItem } from "../store/cartSlice";
import { detectMatchedAllergens } from "../utils/allergenMatcher";
import { db, doc, getDoc } from "../firebase/config.js";
import ShopeeSearchBar from "../components/ShopeeSearchBar.jsx";
import ChatModal from "../components/ChatModal.jsx";
import Footer from "../components/Footer.jsx";
import { PRODUCTS_BY_ID, SHARED_PRODUCTS, SHARED_SHOPS } from "../data/mockProducts.js";
import {
  fetchProductByIdFromFirestore,
  fetchStoreByIdFromFirestore,
  checkUserFavoriteInFirestore,
  toggleUserFavoriteInFirestore,
  fetchLiveSlotCapacities,
} from "../lib/firebase.js";
import "./ProductDetail.css";

// 📅 CALENDAR DAYS GENERATOR (Generates 7 upcoming days with availability status)
const DAYS_OF_WEEK_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const MONTHS_TH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."
];

function generateUpcomingCalendarDays() {
  const days = [];
  const now = new Date();
  
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + i);
    
    const dayOfWeek = DAYS_OF_WEEK_TH[targetDate.getDay()];
    const dateNum = targetDate.getDate();
    const month = MONTHS_TH[targetDate.getMonth()];
    const fullDateStr = `${dateNum} ${month}`;
    const isoDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;

    days.push({
      id: isoDateStr,
      dayOfWeek,
      dateNum,
      month,
      fullDateStr,
      isoDateStr,
      isToday: i === 0,
      isTomorrow: i === 1,
      status: "AVAILABLE",
      statusLabel: "เปิดจอง",
      capacityPercent: 100,
    });
  }
  return days;
}

// ⏰ TIME SLOTS DATA FOR CALENDAR SELECTION
const BASE_TIME_SLOTS = [
  { time: "11:00", discount: "-50%", status: "AVAILABLE" },
  { time: "11:30", discount: "-50%", status: "AVAILABLE" },
  { time: "12:00", discount: "-50%", status: "AVAILABLE" },
  { time: "12:30", discount: "-20%", status: "AVAILABLE" },
  { time: "13:00", discount: "-10%", status: "AVAILABLE" },
  { time: "13:30", discount: "-10%", status: "AVAILABLE" },
  { time: "14:00", discount: "-10%", status: "AVAILABLE" },
  { time: "14:30", discount: "-10%", status: "AVAILABLE" },
];

// 🍜 CATEGORY-AWARE DYNAMIC MODIFIER CONFIGURATIONS (Zero fake bypass defaults for required groups)
const CATEGORY_MODIFIER_CONFIGS = {
  noodle: [
    {
      id: "spicy_level",
      title: "ระดับความเผ็ด",
      subtitle: "พริกคั่วเตาถ่าน",
      icon: "bi-fire text-danger",
      required: true,
      selectionType: "single",
      options: [
        { id: "none", name: "ไม่เผ็ด", desc: "ไม่ใส่พริก", price: 0 },
        { id: "normal", name: "เผ็ดปกติ", desc: "พริกคั่วเตาถ่าน 1 ช้อน", price: 0 },
        { id: "hot", name: "เผ็ดมาก 3x", desc: "พริกคั่วเข้มข้นพิเศษ", price: 0 },
      ],
    },
    {
      id: "noodle_type",
      title: "เลือกเส้น",
      icon: "bi-egg-fried text-primary",
      required: true,
      selectionType: "single",
      options: [
        { id: "thin", name: "เส้นเล็ก", price: 0 },
        { id: "vermicelli", name: "หมี่ขาว", price: 0 },
        { id: "egg_noodle", name: "บะหมี่หยก", price: 0 },
        { id: "glass_noodle", name: "วุ้นเส้น", price: 0 },
        { id: "no_noodle", name: "เกาเหลา", price: 0 },
      ],
    },
    {
      id: "soup_type",
      title: "เลือกน้ำซุป",
      icon: "bi-cup-hot text-primary",
      required: true,
      selectionType: "single",
      options: [
        { id: "namtok", name: "น้ำตกสูตรเข้ม", price: 0 },
        { id: "clear", name: "น้ำใสพะโล้", price: 0 },
        { id: "tomyum", name: "ต้มยำน้ำตก", price: 0 },
      ],
    },
    {
      id: "toppings",
      title: "เพิ่ม Topping",
      subtitle: "เลือกได้หลายรายการ",
      icon: "bi-plus-circle-fill text-success",
      required: false,
      selectionType: "multiple",
      options: [
        { id: "egg", name: "ไข่ต้มยางมะตูม", price: 10 },
        { id: "crackling", name: "กากหมูเจียวสด", price: 15 },
        { id: "meatball", name: "ลูกชิ้นหมู (3 ลูก)", price: 15 },
        { id: "veggie", name: "ผักบุ้งพิเศษ", price: 5 },
      ],
      defaultSelected: [],
    },
  ],
  beverage: [
    {
      id: "sweet_level",
      title: "ระดับความหวาน",
      icon: "bi-droplet-half text-primary",
      required: true,
      selectionType: "single",
      options: [
        { id: "sweet_0", name: "ไม่หวาน (0%)", price: 0 },
        { id: "sweet_25", name: "หวานน้อย (25%)", price: 0 },
        { id: "sweet_50", name: "หวานปกติ (50%)", price: 0 },
        { id: "sweet_100", name: "หวาน 100%", price: 0 },
      ],
    },
    {
      id: "ice_level",
      title: "ระดับน้ำแข็ง",
      icon: "bi-snow text-info",
      required: true,
      selectionType: "single",
      options: [
        { id: "ice_normal", name: "น้ำแข็งปกติ", price: 0 },
        { id: "ice_less", name: "น้ำแข็งน้อย", price: 0 },
        { id: "ice_none", name: "ไม่ใส่น้ำแข็ง", price: 0 },
      ],
    },
    {
      id: "bev_toppings",
      title: "เพิ่ม Topping เครื่องดื่ม",
      subtitle: "เลือกได้หลายรายการ",
      icon: "bi-plus-circle-fill text-success",
      required: false,
      selectionType: "multiple",
      options: [
        { id: "boba", name: "ไข่มุกบราวน์ชูการ์", price: 10 },
        { id: "pudding", name: "พุดดิ้งนมสด", price: 10 },
        { id: "aloe", name: "ว่านหางจระเข้", price: 10 },
        { id: "jelly", name: "เจลลี่บุกคอลลาเจน", price: 15 },
      ],
      defaultSelected: [],
    },
  ],
  single_dish: [
    {
      id: "spicy_level",
      title: "ระดับความเผ็ด",
      subtitle: "ความจัดจ้าน",
      icon: "bi-fire text-danger",
      required: true,
      selectionType: "single",
      options: [
        { id: "none", name: "ไม่เผ็ด", price: 0 },
        { id: "normal", name: "เผ็ดปกติ", price: 0 },
        { id: "hot", name: "เผ็ดจัดจ้าน", price: 0 },
      ],
    },
    {
      id: "egg_option",
      title: "ตัวเลือกไข่",
      icon: "bi-egg text-warning",
      required: false,
      selectionType: "single",
      options: [
        { id: "no_egg", name: "ไม่รับไข่", price: 0 },
        { id: "fried_egg", name: "ไข่ดาวกรอบ", price: 10 },
        { id: "omelet", name: "ไข่เจียวฟู", price: 12 },
        { id: "boiled_egg", name: "ไข่ต้มยางมะตูม", price: 10 },
      ],
      defaultSelected: "no_egg",
    },
    {
      id: "dish_toppings",
      title: "เพิ่มเครื่องเคียงพิเศษ",
      subtitle: "เลือกได้หลายรายการ",
      icon: "bi-plus-circle-fill text-success",
      required: false,
      selectionType: "multiple",
      options: [
        { id: "extra_meat", name: "เพิ่มเนื้อสัตว์พิเศษ", price: 20 },
        { id: "crispy_pork", name: "กากหมูเจียว", price: 10 },
        { id: "chinese_sausage", name: "กุนเชียงทอด", price: 15 },
      ],
      defaultSelected: [],
    },
  ],
  western: [
    {
      id: "sauce_flavor",
      title: "รสชาติซอส",
      subtitle: "สูตรพิเศษประจำร้าน",
      icon: "bi-palette text-danger",
      required: true,
      selectionType: "single",
      options: [
        { id: "korean_spicy", name: "ซอสเกาหลีเผ็ดหวาน", price: 0 },
        { id: "honey_garlic", name: "ซอสฮันนี่การ์ลิค", price: 0 },
        { id: "cheese_lava", name: "ซอสชีสลาวา", price: 10 },
        { id: "original", name: "ซอสบาร์บีคิวดั้งเดิม", price: 0 },
      ],
    },
    {
      id: "side_dish",
      title: "เพิ่มเครื่องเคียง",
      subtitle: "เลือกได้หลายรายการ",
      icon: "bi-plus-circle-fill text-success",
      required: false,
      selectionType: "multiple",
      options: [
        { id: "french_fries", name: "เฟรนช์ฟรายส์กรอบ", price: 20 },
        { id: "sticky_rice", name: "ข้าวเหนียวนุ่ม", price: 10 },
        { id: "coleslaw", name: "สลัดโคลสลอว์สด", price: 15 },
        { id: "nuggets", name: "นักเก็ตไก่ (4 ชิ้น)", price: 25 },
      ],
      defaultSelected: [],
    },
  ],
  curry_soup: [
    {
      id: "spicy_level",
      title: "ระดับความเผ็ด",
      subtitle: "ความจัดจ้าน",
      icon: "bi-fire text-danger",
      required: true,
      selectionType: "single",
      options: [
        { id: "mild", name: "เผ็ดน้อย", price: 0 },
        { id: "normal", name: "เผ็ดปกติ", price: 0 },
        { id: "extra", name: "เผ็ดจัดจ้าน 3x", price: 0 },
      ],
    },
    {
      id: "rice_option",
      title: "ตัวเลือกข้าว",
      icon: "bi-box-seam text-primary",
      required: false,
      selectionType: "single",
      options: [
        { id: "with_rice", name: "รับข้าวสวยหอมมะลิ", price: 10 },
        { id: "no_rice", name: "ไม่รับข้าว (เฉพาะกับข้าว)", price: 0 },
      ],
      defaultSelected: "with_rice",
    },
    {
      id: "curry_toppings",
      title: "เพิ่มเครื่องเคียง",
      subtitle: "เลือกได้หลายรายการ",
      icon: "bi-plus-circle-fill text-success",
      required: false,
      selectionType: "multiple",
      options: [
        { id: "omelet", name: "ไข่เจียวสมุนไพร", price: 15 },
        { id: "salted_egg", name: "ไข่เค็มไชยา", price: 12 },
        { id: "shrimp_extra", name: "เพิ่มกุ้งแม่น้ำ (1 ตัว)", price: 35 },
      ],
      defaultSelected: [],
    },
  ],
};

function getCategoryModifiers(category, productTitle = "") {
  const cat = (category || "").toLowerCase();
  const title = (productTitle || "").toLowerCase();
  if (cat.includes("noodle") || title.includes("ก๋วยเตี๋ยว") || title.includes("บะหมี่") || title.includes("วุ้นเส้น") || title.includes("น้ำตก")) {
    return CATEGORY_MODIFIER_CONFIGS.noodle;
  }
  if (cat.includes("curry") || cat.includes("soup") || title.includes("ต้มยำ") || title.includes("แกง") || title.includes("น้ำข้น") || title.includes("ซุป")) {
    return CATEGORY_MODIFIER_CONFIGS.curry_soup;
  }
  if (cat.includes("western") || cat.includes("burger") || title.includes("เบอร์เกอร์") || title.includes("ไก่") || title.includes("สเต็ก") || title.includes("ทอด")) {
    return CATEGORY_MODIFIER_CONFIGS.western;
  }
  if (cat.includes("beverage") || cat.includes("drink") || title.includes("ชา") || title.includes("กาแฟ") || title.includes("นม") || title.includes("น้ำสมุนไพร") || title.includes("น้ำผลไม้") || title.includes("โอเลี้ยง") || title.includes("ชานม")) {
    return CATEGORY_MODIFIER_CONFIGS.beverage;
  }
  return CATEGORY_MODIFIER_CONFIGS.single_dish;
}


// 🎬 VIDEO REELS MOCK DATA
const VIDEO_REVIEWS = [
  {
    id: "v1",
    author: "@FoodieCampus",
    title: "ชิมน้ำตกเข้มข้นป้าแดง กระดูกหมูตุ๋นเปื่อยละลายในปาก!",
    views: "48.2k",
    duration: "0:45",
    tags: "#ก๋วยเตี๋ยวเรือหมูน้ำตก #โรงอาหาร2",
    thumbnail: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "v2",
    author: "@เด็กหอพาชิม",
    title: "ASMR กากหมูเจียวสดใหม่ กรอบสนั่น ชามละ 30 บาทคุ้มเว่อร์",
    views: "32.5k",
    duration: "0:38",
    tags: "#กากหมูเจียว #อร่อยบอกต่อ",
    thumbnail: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "v3",
    author: "@KinRaiDeeTU",
    title: "วิธีกดจองคิว QueueUp ไม่ต้องต่อแถวพักเที่ยง ได้กินตรงเวลาเป๊ะ!",
    views: "29.1k",
    duration: "0:52",
    tags: "#QueueUpLife #กินไรดี",
    thumbnail: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80",
  },
  {
    id: "v4",
    author: "@AuntyDaengFan",
    title: "บุกหลังครัวป้าแดง ชมหม้อน้ำซุปสมุนไพรเคี่ยว 4 ชั่วโมงของจริง",
    views: "19.8k",
    duration: "1:12",
    tags: "#สูตรลับป้าแดง #ก๋วยเตี๋ยวเรือ",
    thumbnail: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop&q=80",
  },
];

// ⭐ CUSTOMER REVIEWS MOCK DATA
const CUSTOMER_REVIEWS = [
  {
    id: "r1",
    author: "ธนภัทร น. (คณะวิศวกรรมศาสตร์)",
    avatarLetter: "TN",
    avatarBg: "#065f46",
    role: "ผู้สั่งจริงผ่านแอป",
    date: "16 ส.ค. 2026",
    dishInfo: "สั่ง: เส้นเล็กน้ำตกเนื้อหมู + กากหมูกรอบ",
    rating: 5,
    comment: "ชอบระบบสั่งล่วงหน้าแบบนี้มากกก ปกติพักเที่ยงคิวยาวจนหมดเวลาพัก วันนี้กดรอบ 12:00 น. เดินมาถึงป้าแดงตักใส่ชามให้ทันที น้ำตกหอมพะโล้จัดจ้านไม่ต้องปรุงเพิ่มเลย กากหมูก็กรอบสนั่น 10/10 ครับ",
  },
  {
    id: "r2",
    author: "พรรณวษา (เจ้าหน้าที่คณะพาณิชย์ฯ)",
    avatarLetter: "PW",
    avatarBg: "#fd5837",
    role: "ผู้สั่งจริงผ่านแอป",
    date: "15 ส.ค. 2026",
    dishInfo: "สั่ง: เกาเหลาน้ำตก + ไข่ต้มยางมะตูม",
    rating: 5,
    comment: "หมูนุ่มมาก ตับลวกมาไม่สุกเกินไป ไข่ต้มยางมะตูมเยิ้มกำลังดี ที่สำคัญร้านสะอาดถูกสุขอนามัยและคุณป้าคนขายน่ารักมากค่ะ ลด 50% แล้วคุ้มจนสั่งทานซ้ำแทบทุกวัน",
  },
  {
    id: "r3",
    author: "กิตติศักดิ์ ส. (นักศึกษาปี 3)",
    avatarLetter: "KS",
    avatarBg: "#3b82f6",
    role: "ผู้สั่งจริงผ่านแอป",
    date: "14 ส.ค. 2026",
    dishInfo: "สั่ง: บะหมี่หยกน้ำตก + ลูกชิ้นหมู",
    rating: 5,
    comment: "ระบบบอกสล็อตคิวแม่นยำมากครับ ไม่ต้องมายืนรอท่ามกลางคนเยอะๆ เหมาะกับช่วงพักสั้นๆ มาก แนะนำเลยครับ",
  },
];

function resolveProductByParam(rawParam) {
  if (!rawParam) return PRODUCTS_BY_ID.m1;

  const decoded = decodeURIComponent(rawParam).trim();

  // 1. Direct match by ID (e.g. m1, m2)
  if (PRODUCTS_BY_ID[decoded]) return PRODUCTS_BY_ID[decoded];
  if (PRODUCTS_BY_ID[rawParam]) return PRODUCTS_BY_ID[rawParam];

  // 2. Match by exact product name or title or encoded name
  const foundByName = SHARED_PRODUCTS.find((p) => {
    if (!p) return false;
    const pName = (p.name || "").trim();
    const pTitle = (p.title || "").trim();
    return (
      pName === decoded ||
      pTitle === decoded ||
      encodeURIComponent(pName) === rawParam ||
      encodeURIComponent(pTitle) === rawParam ||
      pName.includes(decoded) ||
      decoded.includes(pName)
    );
  });

  return foundByName || PRODUCTS_BY_ID.m1;
}

function resolveStoreByStoreId(storeId) {
  if (!storeId) return SHARED_SHOPS[0];
  const found = SHARED_SHOPS.find((s) => s.id === storeId);
  return (
    found || {
      id: storeId,
      name: "ร้านป้าแดง ตามสั่ง & ไก่ทอด",
      location: "โรงอาหาร 2 (โรงอาหารกลาง 1) ชั้น 1 • ช่อง 04",
      hours: "07:00 - 14:30 น.",
      rating: 4.8,
      reviewsCount: 1840,
      isOpen: true,
      status: "open",
    }
  );
}

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const initialProduct = resolveProductByParam(id);
  const [product, setProduct] = useState(initialProduct);

  const initialStore = resolveStoreByStoreId(initialProduct.storeId);
  const [store, setStore] = useState(initialStore);

  const [selectedImg, setSelectedImg] = useState(initialProduct.mainImg || initialProduct.image);
  const [quantity, setQuantity] = useState(1);
  
  // 📅 Calendar Date Selection State
  const calendarDays = useMemo(() => generateUpcomingCalendarDays(), []);
  const [selectedDay, setSelectedDay] = useState(calendarDays[0]);
  const [timeSlots, setTimeSlots] = useState(BASE_TIME_SLOTS);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(BASE_TIME_SLOTS[1]);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);

  // 🗺️ Canteen Walking Guide Modal State
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  // 🎬 Video Player Modal State
  const [activeVideo, setActiveVideo] = useState(null);

  // 💬 Chat & Favorite States
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  // 🍜 Category-Aware Dynamic Modifiers State
  const productCategory = product?.category || "";
  const productTitle = product?.name || product?.title || "";
  const activeModifierGroups = useMemo(() => {
    return getCategoryModifiers(productCategory, productTitle);
  }, [productCategory, productTitle]);

  const [selectedModifiersMap, setSelectedModifiersMap] = useState({});
  const [customerNote, setCustomerNote] = useState("");

  const [isIncompleteProfileModalOpen, setIsIncompleteProfileModalOpen] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState([]);

  // 🚨 Student Allergy Safety Profile Loader
  const [studentAllergies, setStudentAllergies] = useState([]);
  useEffect(() => {
    if (!user?.uid) return;
    async function loadStudentAllergyProfile() {
      try {
        const studentDoc = await getDoc(doc(db, "students", user.uid));
        if (studentDoc.exists() && Array.isArray(studentDoc.data().allergyInfo)) {
          setStudentAllergies(studentDoc.data().allergyInfo);
        }
      } catch (err) {
        console.warn("[ProductDetail] Could not load allergy profile:", err);
      }
    }
    loadStudentAllergyProfile();
  }, [user?.uid]);

  // 🔎 Extract currently selected modifier names to detect topping/variant allergens
  const selectedModifierNames = useMemo(() => {
    const names = [];
    activeModifierGroups.forEach((grp) => {
      const val = selectedModifiersMap[grp.id];
      if (grp.selectionType === "single" && val) {
        const opt = grp.options.find((o) => o.id === val);
        if (opt) names.push(opt.name);
      } else if (Array.isArray(val)) {
        val.forEach((optId) => {
          const opt = grp.options.find((o) => o.id === optId);
          if (opt) names.push(opt.name);
        });
      }
    });
    return names;
  }, [activeModifierGroups, selectedModifiersMap]);

  // 🛡️ Intelligent Allergen Cross-Check (Menu + Category + Desc + Chosen Modifiers)
  const allergenResult = useMemo(() => {
    return detectMatchedAllergens({
      studentAllergies,
      productTitle,
      productCategory,
      productDescription: product?.description || "",
      selectedModifierNames,
    });
  }, [studentAllergies, productTitle, productCategory, product?.description, selectedModifierNames]);

  const matchedAllergens = allergenResult.matchedAllergenNames;

  // Load Product & Store from Firestore database service layer
  useEffect(() => {
    let isMounted = true;
    async function loadProductAndStoreData() {
      const decoded = decodeURIComponent(id || "").trim();
      let docData = await fetchProductByIdFromFirestore(id);
      if (!docData && decoded !== id) {
        docData = await fetchProductByIdFromFirestore(decoded);
      }

      if (isMounted) {
        const resolvedProd = docData || resolveProductByParam(id);
        setProduct(resolvedProd);
        setSelectedImg(resolvedProd.mainImg || resolvedProd.image);

        // Load Store Data from Database / Service Layer
        const storeData = await fetchStoreByIdFromFirestore(resolvedProd.storeId);
        setStore(storeData || resolveStoreByStoreId(resolvedProd.storeId));

        // Check Favorite Status if user logged in
        if (user && user.uid && resolvedProd.id) {
          const favStatus = await checkUserFavoriteInFirestore(user.uid, resolvedProd.id);
          if (isMounted) setIsFavorite(favStatus);
        }
      }
    }
    loadProductAndStoreData();
    return () => {
      isMounted = false;
    };
  }, [id, user]);

  // ⏰ Real-time Slot Capacity Loader for selected Store & Date
  useEffect(() => {
    let isMounted = true;
    async function updateSlotCapacities() {
      const storeId = product?.storeId || store?.id || store?.storeId;
      if (!storeId) return;
      const isoDate = selectedDay?.isoDateStr || calendarDays[0]?.isoDateStr;
      const defaultCap = store?.maxOrdersPerSlot || 20;
      if (storeId && isoDate) {
        const liveSlots = await fetchLiveSlotCapacities(storeId, isoDate, BASE_TIME_SLOTS, defaultCap);
        if (isMounted) {
          setTimeSlots(liveSlots);
          setSelectedTimeSlot((prev) => {
            const matched = liveSlots.find((s) => s.time === prev?.time);
            return matched || liveSlots[1] || liveSlots[0];
          });
        }
      }
    }
    updateSlotCapacities();
    return () => {
      isMounted = false;
    };
  }, [product?.storeId, store?.id, store?.storeId, store?.maxOrdersPerSlot, selectedDay?.isoDateStr, calendarDays]);

  // 4. Favorite Toggle Handler
  const handleToggleFavorite = async () => {
    if (!user || !user.uid) {
      setIsFavorite(!isFavorite);
      return;
    }
    const newStatus = await toggleUserFavoriteInFirestore(user.uid, product.id);
    setIsFavorite(newStatus);
  };

  // Helper to get selected value for a group with default fallback
  const getValForGroup = (grp) => {
    if (selectedModifiersMap[grp.id] !== undefined) {
      return selectedModifiersMap[grp.id];
    }
    return grp.selectionType === "single" ? grp.defaultSelected : (grp.defaultSelected || []);
  };

  // 5. Dynamic Price Calculation Formula
  const dynamicModifiersPrice = useMemo(() => {
    let extra = 0;
    activeModifierGroups.forEach((grp) => {
      const val = selectedModifiersMap[grp.id] !== undefined
        ? selectedModifiersMap[grp.id]
        : (grp.selectionType === "single" ? grp.defaultSelected : (grp.defaultSelected || []));
      if (grp.selectionType === "single" && val) {
        const opt = grp.options.find((o) => o.id === val);
        if (opt && opt.price) extra += opt.price;
      } else if (grp.selectionType === "multiple" && Array.isArray(val)) {
        val.forEach((optId) => {
          const opt = grp.options.find((o) => o.id === optId);
          if (opt && opt.price) extra += opt.price;
        });
      }
    });
    return extra;
  }, [activeModifierGroups, selectedModifiersMap]);

  const discountPercent = parseInt((selectedTimeSlot?.discount || "0").replace("-", "").replace("%", "")) / 100;
  const basePrice = Number(product?.price) || 30;
  const discountedUnitPrice = Math.max(0, Math.round((basePrice + dynamicModifiersPrice) * (1 - discountPercent)));
  const totalCalculatedPrice = discountedUnitPrice * quantity;

  // 15. Store Menu Recommendations
  const recommendedProducts = useMemo(() => {
    const storeId = product?.storeId || store?.id || store?.storeId;
    if (!storeId) return [];
    return SHARED_PRODUCTS.filter(
      (p) => p.storeId === storeId && p.id !== product.id
    ).slice(0, 4);
  }, [product, store]);

  // 11. Profile Completeness Check
  const checkProfileCompleteness = async () => {
    let profileData = null;

    if (user && user.uid) {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          profileData = docSnap.data();
        }
      } catch (err) {
        console.warn("Fetch user profile check error:", err);
      }
    }

    if (!profileData) {
      const saved = localStorage.getItem("queueup_user");
      if (saved) {
        try {
          profileData = JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }

    const missing = [];
    const hasName = Boolean(profileData?.name || profileData?.displayName || profileData?.fullName || user?.name || user?.displayName || user?.email);
    const hasPhone = Boolean(profileData?.phone || profileData?.phoneNumber || user?.phone);

    if (!hasName) missing.push("ชื่อ-นามสกุล");
    if (!hasPhone) missing.push("เบอร์โทรศัพท์สำหรับรับแจ้งเตือนคิว");

    return {
      isComplete: missing.length === 0,
      missing,
    };
  };

  // Helper to validate required modifiers dynamically
  const validateRequiredModifiers = () => {
    const missing = [];
    activeModifierGroups.forEach((grp) => {
      if (grp.required) {
        const val = getValForGroup(grp);
        if (!val || (Array.isArray(val) && val.length === 0)) {
          missing.push(grp.title);
        }
      }
    });
    return missing;
  };

  const createCurrentCartItem = () => {
    const noteParts = [];
    const structuredModifiers = [];

    activeModifierGroups.forEach((grp) => {
      const val = getValForGroup(grp);
      if (grp.selectionType === "single" && val) {
        const opt = grp.options.find((o) => o.id === val);
        if (opt) {
          noteParts.push(`${grp.title}: ${opt.name}`);
          structuredModifiers.push({
            modifierGroupId: grp.id,
            optionId: opt.id,
            name: opt.name,
            priceModifier: opt.price || 0,
            priceModifierSatang: (opt.price || 0) * 100,
          });
        }
      } else if (grp.selectionType === "multiple" && Array.isArray(val) && val.length > 0) {
        const chosenNames = [];
        val.forEach((optId) => {
          const opt = grp.options.find((o) => o.id === optId);
          if (opt) {
            chosenNames.push(opt.name);
            structuredModifiers.push({
              modifierGroupId: grp.id,
              optionId: opt.id,
              name: opt.name,
              priceModifier: opt.price || 0,
              priceModifierSatang: (opt.price || 0) * 100,
            });
          }
        });
        if (chosenNames.length > 0) {
          noteParts.push(`${grp.title}: ${chosenNames.join(", ")}`);
        }
      }
    });

    if (customerNote && customerNote.trim()) {
      noteParts.push(`โน้ต: ${customerNote.trim()}`);
    }

    const realStoreId = product?.storeId || store?.id || store?.storeId || "";

    return {
      menuItem: {
        id: product.id,
        name: product.name || product.title,
        price: basePrice, // 🔒 Base Price only, modifiers will be added by canonical calculation
        storeId: realStoreId,
        storeName: store?.name || product.shopName || "",
        image: selectedImg || product.mainImg || product.image || "/crispy_fried_chicken.jpg",
      },
      quantity: quantity,
      selectedModifiers: structuredModifiers,
      customNotes: noteParts.join(" | "),
    };
  };

  const handleAddToCart = () => {
    const missing = validateRequiredModifiers();
    if (missing.length > 0) {
      alert(`⚠️ กรุณาเลือกรายละเอียดอาหารให้ครบถ้วนก่อนใส่ตะกร้า:\n• ${missing.join("\n• ")}`);
      return;
    }

    // 🚨 Allergen Safety Confirmation Guard
    if (allergenResult.hasAllergens) {
      const warningDetails = allergenResult.details.map((d) => `• ${d.allergenName}: ${d.details}`).join("\n");
      const confirmProceed = window.confirm(
        `🚨 คำเตือนความปลอดภัยด้านสุขภาพ (Health & Allergy Alert)!\n\nเมนูหรือตัวเลือกที่คุณเลือก มีส่วนผสมที่ตรงกับประวัติการแพ้อาหารของคุณ:\n${warningDetails}\n\nคุณแน่ใจหรือไม่ว่าต้องการเพิ่มลงในตะกร้า?`
      );
      if (!confirmProceed) return;
    }

    const newItem = createCurrentCartItem();
    dispatch(addItem(newItem));
    alert(`🛒 เพิ่ม "${newItem.menuItem.name}" (จำนวน ${newItem.quantity} ชาม) พร้อมตัวเลือกที่ระบุ ลงในตะกร้าเรียบร้อยแล้ว!`);
  };

  // 8. ORDER VALIDATION BEFORE CHECKOUT
  const handleNextBooking = async () => {
    // 1. Store Open Guard
    if (store?.isOpen === false || store?.status === "closed") {
      alert("⚠️ ขออภัย ร้านค้าปิดบริการชั่วคราว ไม่สามารถทำการสั่งซื้อคิวอาหารได้ในขณะนี้");
      return;
    }

    // 2. Product Availability & Stock Guard
    if (product?.availability === false || product?.stockStatus === "out_of_stock") {
      alert("⚠️ ขออภัย เมนูอาหารนี้หมดชั่วคราว ไม่สามารถทำการสั่งซื้อได้ในขณะนี้");
      return;
    }

    // 3. Time Slot Full Guard
    if (selectedTimeSlot?.status === "FULL" || selectedTimeSlot?.status === "CLOSED") {
      alert("⚠️ ขออภัย คิวรับอาหารช่วงเวลานี้เต็มแล้ว กรุณาเลือกช่วงเวลาอื่น");
      return;
    }

    // 4. Required Modifier Validation
    const missingMods = validateRequiredModifiers();
    if (missingMods.length > 0) {
      alert(`⚠️ กรุณาเลือกรายละเอียดอาหารให้ครบถ้วน:\n• ${missingMods.join("\n• ")}`);
      return;
    }

    // 5. Profile Completeness Check
    const { isComplete, missing } = await checkProfileCompleteness();
    if (!isComplete) {
      setMissingProfileFields(missing);
      setIsIncompleteProfileModalOpen(true);
      return;
    }

    // 5.5 Allergen Safety Confirmation Guard
    if (allergenResult.hasAllergens) {
      const warningDetails = allergenResult.details.map((d) => `• ${d.allergenName}: ${d.details}`).join("\n");
      const confirmProceed = window.confirm(
        `🚨 คำเตือนความปลอดภัยด้านสุขภาพ (Health & Allergy Alert)!\n\nเมนูหรือตัวเลือกที่คุณเลือก มีส่วนผสมที่ตรงกับประวัติการแพ้อาหารของคุณ:\n${warningDetails}\n\nคุณแน่ใจหรือไม่ว่าต้องการดำเนินการสั่งซื้อต่อไป?`
      );
      if (!confirmProceed) return;
    }

    const resolvedStoreId = product?.storeId || store?.id || store?.storeId;
    if (!resolvedStoreId) {
      alert("⚠️ ไม่พบรหัสร้านค้าของเมนูนี้ กรุณาเลือกร้านค้าใหม่อีกครั้ง");
      return;
    }

    const cartItem = createCurrentCartItem();

    // 6. Seamless Navigation to Authoritative Booking Flow (Strict ISO date format YYYY-MM-DD)
    navigate("/booking", {
      state: {
        cartItems: [cartItem],
        pickupTime: selectedTimeSlot?.time || "12:00",
        bookingDate: selectedDay.isoDateStr,
        bookingDateLabel: selectedDay.fullDateStr,
        storeId: resolvedStoreId,
        storeName: store?.name || product.shopName || `ร้านค้า (${resolvedStoreId})`,
        storeLocation: store?.location || product.shopLocation || "จุดรับอาหารของร้านค้า",
      },
    });
  };


  return (
    <div className="queue-pd-container">
      <ShopeeSearchBar />

      <div className="queue-pd-wrapper">
        {/* 1. BREADCRUMB NAVIGATION */}
        <div className="queue-pd-breadcrumb">
          <span className="text-muted cursor-pointer" onClick={() => navigate("/home")}>
            <i className="bi bi-house-door-fill me-1 text-primary" /> หน้าหลัก
          </span>
          <span className="text-muted">/</span>
          <span className="text-muted cursor-pointer" onClick={() => navigate("/search?keyword=ทั้งหมด")}>
            โรงอาหารกลาง (โรงอาหาร 2)
          </span>
          <span className="text-muted">/</span>
          <span className="text-muted">{store.name || product.shopName}</span>
          <span className="text-muted">/</span>
          <span className="fw-bold text-dark">{product.name}</span>
        </div>

        {/* 2. MAIN TWO-COLUMN SHOWCASE & FORM */}
        <div className="queue-pd-main-grid">
          {/* LEFT COLUMN: Gallery & Terms */}
          <div className="queue-pd-left-col">
            <div className="queue-pd-main-img-box">
              <img
                src={selectedImg}
                alt={product.name}
                className="queue-pd-main-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/crispy_fried_chicken.jpg";
                }}
              />
              {/* Badges Overlay */}
              <div className="queue-pd-img-badges">
                <span className="queue-pd-badge-hot">
                  <i className="bi bi-fire me-1" /> ยอดสั่งสูงสุดอันดับ 1
                </span>
                <span className="queue-pd-badge-halal">
                  ฮาลาล / ครัวแยก
                </span>
              </div>
              <div className="queue-pd-photo-count">
                <i className="bi bi-camera-fill me-1" /> 4 รูปภาพ
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="queue-pd-thumb-grid">
              {[product.mainImg || product.image, ...(product.gallery || product.images || [])].slice(0, 4).map((img, idx) => (
                <div
                  key={idx}
                  className={`queue-pd-thumb-box ${selectedImg === img ? "active" : ""}`}
                  onClick={() => setSelectedImg(img)}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx}`}
                    className="queue-pd-thumb-img"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/crispy_fried_chicken.jpg";
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Special Terms & Discount Notice */}
            <div className="queue-pd-recommend-box">
              <div className="queue-pd-recommend-header">
                <h3 className="queue-pd-recommend-title">
                  <i className="bi bi-info-circle-fill me-1 text-primary" />
                  เงื่อนไขการสั่งจองและรับส่วนลด
                </h3>
                <span className="queue-pd-discount-badge-pink">-50% QueueUp Early Bird</span>
              </div>
              <p className="queue-pd-recommend-desc">
                ส่วนลดพิเศษระบบ QueueUp Food CRM สั่งจองคิวล่วงหน้ารับแต้มสะสมฟรี 2 เท่า และสามารถระบุสล็อตเวลารับอาหารที่สะดวก โดยระบบจะแจ้งเตือนเมื่อเตาเริ่มปรุงเสร็จ
              </p>
              <div className="queue-pd-terms-footer">
                <span><i className="bi bi-shield-check text-success me-1" /> ไม่ต้องตัดบัตรเครดิต</span>
                <span><i className="bi bi-clock-history text-primary me-1" /> รับอาหารตามรอบคิว 100%</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Store Header, Modifiers, & Calendar Slots */}
          <div className="queue-pd-right-card">
            {/* Store Banner & Mini Header */}
            <div className="queue-pd-shop-banner-box">
              <img
                src={product.shopBanner || store.banner}
                alt={store.name || product.shopName}
                className="queue-pd-shop-banner-img"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/crispy_fried_chicken.jpg";
                }}
              />
              <div className="queue-pd-shop-banner-overlay">
                <div className="d-flex justify-content-between align-items-center w-100">
                  <div className="text-white small">
                    <span className="badge bg-success me-2">เปิดบริการ</span>
                    <span>โรงอาหาร 2 • ช่อง 04</span>
                  </div>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-light fw-bold text-danger py-0 px-2"
                      onClick={() => setIsChatOpen(true)}
                    >
                      <i className="bi bi-chat-dots-fill me-1" /> แชทร้านค้า
                    </button>
                    <button
                      className="btn btn-sm btn-light py-0 px-2 text-dark"
                      onClick={handleToggleFavorite}
                    >
                      <i className={`bi ${isFavorite ? "bi-heart-fill text-danger" : "bi-heart"}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Store Meta */}
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="queue-pd-shop-title mb-0">{store.name || product.shopName}</h1>
                <div className="queue-pd-shop-hours small text-muted">
                  <i className="bi bi-clock me-1 text-primary" /> เวลาทำการ: {store.hours || "07:00 - 14:30 น."}
                </div>
              </div>
              <div className="queue-pd-shop-rating">
                <i className="bi bi-star-fill text-warning me-1" /> {store.rating || 4.8}
                <span className="text-muted small fw-normal ms-1">({store.reviewsCount || "1.8k"})</span>
              </div>
            </div>

            {/* Product Title & Price */}
            <div className="d-flex justify-content-between align-items-center bg-light p-2.5 rounded-3">
              <div>
                <span className="badge bg-danger-subtle text-danger text-xs fw-bold mb-1">เมนูแนะนำ</span>
                <h2 className="fs-5 fw-bold text-dark mb-0">{product.name}</h2>
              </div>
              <div className="text-end">
                <div className="text-muted small text-decoration-line-through">฿{basePrice + 40}</div>
                <div className="text-danger fw-black fs-4">฿{discountedUnitPrice}</div>
              </div>
            </div>

            {/* ⚠️ Student Allergy Safety Warning Banner */}
            {allergenResult.hasAllergens && (
              <div className="p-3 my-2 rounded-3 bg-danger-subtle border border-danger text-danger small shadow-sm">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <span className="fs-4">🚨</span>
                  <div>
                    <strong className="d-block text-danger fw-bold fs-6">แจ้งเตือนสารก่อภูมิแพ้ประจำตัวนักเรียน! (Allergy Shield)</strong>
                    <span className="text-dark">เมนูนี้มีสารก่อภูมิแพ้ที่ตรงกับประวัติสุขภาพของคุณ: <b>{matchedAllergens.join(", ")}</b></span>
                  </div>
                </div>
                {allergenResult.details && allergenResult.details.length > 0 && (
                  <div className="mt-2 pt-2 border-top border-danger-subtle d-flex flex-wrap gap-1">
                    {allergenResult.details.map((detail, dIdx) => (
                      <span key={dIdx} className="badge bg-danger text-white fw-normal px-2 py-1">
                        ⚠️ {detail.details || detail.allergenName}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-danger-emphasis text-xs mt-1">
                  * หากมีอาการแพ้รุนแรง กรุณาแจ้งร้านค้าเพิ่มเติม หรือหลีกเลี่ยงการสั่งซื้อเมนู/ตัวเลือกนี้
                </div>
              </div>
            )}

            {/* 🍜 DYNAMIC CATEGORY-AWARE MODIFIERS SELECTION */}
            <div className="queue-pd-modifiers-container">
              {activeModifierGroups.map((grp) => {
                const isSingle = grp.selectionType === "single";
                const currentVal = getValForGroup(grp);

                return (
                  <div key={grp.id} className="queue-pd-mod-group">
                    <div className="queue-pd-mod-title">
                      <span>
                        {grp.icon && <i className={`bi ${grp.icon} me-1`} />}
                        {grp.title} {grp.required && <span className="text-danger">*</span>}
                      </span>
                      {grp.subtitle && <span className="queue-pd-mod-subtitle">{grp.subtitle}</span>}
                    </div>

                    <div className={`queue-pd-options-grid cols-${Math.min(grp.options.length, 5)}`}>
                      {grp.options.map((opt) => {
                        if (isSingle) {
                          const isSelected = currentVal === opt.id;
                          return (
                            <label
                              key={opt.id}
                              className={`queue-pd-option-chip ${isSelected ? "active" : ""}`}
                            >
                              <span>{opt.name}</span>
                              {opt.price ? <span className="text-danger fw-bold ms-1">+฿{opt.price}</span> : null}
                              <input
                                type="radio"
                                name={`grp_${grp.id}`}
                                value={opt.id}
                                checked={isSelected}
                                onChange={() => {
                                  setSelectedModifiersMap((prev) => ({
                                    ...prev,
                                    [grp.id]: opt.id,
                                  }));
                                }}
                              />
                            </label>
                          );
                        } else {
                          const arr = Array.isArray(currentVal) ? currentVal : [];
                          const isChecked = arr.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              className={`queue-pd-option-chip justify-content-between ${isChecked ? "active" : ""}`}
                            >
                              <div className="d-flex align-items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const nextChecked = e.target.checked;
                                    setSelectedModifiersMap((prev) => {
                                      const existingArr = Array.isArray(prev[grp.id]) ? prev[grp.id] : [];
                                      const nextArr = nextChecked
                                        ? [...existingArr, opt.id]
                                        : existingArr.filter((id) => id !== opt.id);
                                      return { ...prev, [grp.id]: nextArr };
                                    });
                                  }}
                                />
                                <span>{opt.name}</span>
                              </div>
                              {opt.price ? <span className="text-danger fw-bold">+฿{opt.price}</span> : null}
                            </label>
                          );
                        }
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Note & Quantity Stepper */}
              <div className="row g-2 align-items-center">
                <div className="col-12 col-sm-7">
                  <input
                    type="text"
                    className="form-control form-control-sm text-xs"
                    placeholder="หมายเหตุ: เช่น แยกพริก, ไม่ใส่ผักบุ้ง"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                  />
                </div>
                <div className="col-12 col-sm-5">
                  <div className="queue-pd-qty-stepper">
                    <span className="text-muted small px-2">จำนวน:</span>
                    <button
                      type="button"
                      className="queue-pd-qty-btn"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                      <i className="bi bi-dash" />
                    </button>
                    <span className="fw-bold px-2">{quantity} ชาม</span>
                    <button
                      type="button"
                      className="queue-pd-qty-btn"
                      onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                    >
                      <i className="bi bi-plus" />
                    </button>
                  </div>
                </div>
              </div>

              {/* 📅 CALENDAR PICKUP SLOT SELECTION (STATUS VIEW) */}
              <div className="queue-pd-calendar-box">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <div className="d-flex align-items-center gap-1.5">
                    <i className="bi bi-calendar3 text-primary" />
                    <span className="fw-bold text-dark small">ปฏิทินรอบเวลารับ (Pickup Schedule)</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-primary text-decoration-none fw-bold small"
                    onClick={() => setIsCalendarModalOpen(true)}
                  >
                    <i className="bi bi-calendar-range me-1" /> ดูปฏิทินเต็มเดือน
                  </button>
                </div>

                {/* Date Ribbon */}
                <div className="queue-pd-date-ribbon">
                  {calendarDays.map((day) => (
                    <button
                      key={day.id}
                      type="button"
                      disabled={day.status === "CLOSED"}
                      className={`queue-pd-date-card ${selectedDay.id === day.id ? "active" : ""} ${
                        day.status === "FULL" ? "full" : ""
                      }`}
                      onClick={() => setSelectedDay(day)}
                    >
                      <span className="queue-pd-date-day">{day.dayOfWeek}</span>
                      <span className="queue-pd-date-num">{day.dateNum}</span>
                      <span className={`queue-pd-date-badge ${day.status.toLowerCase()}`}>
                        {day.statusLabel}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Time Slot Grid for Selected Date */}
                <div className="mt-2.5">
                  <div className="d-flex justify-content-between align-items-center small text-muted mb-1.5">
                    <span>
                      เลือกรอบเวลารับ ({selectedDay.fullDateStr}):
                    </span>
                    <span className="badge bg-success-subtle text-success">
                      รอบละ {store?.maxOrdersPerSlot || 10} คิว
                    </span>
                  </div>
                  <div className="queue-pd-time-slots-grid">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={slot.status === "FULL" || slot.remaining === 0}
                        className={`queue-pd-slot-pill ${
                          selectedTimeSlot.time === slot.time ? "active" : ""
                        } ${slot.status === "FULL" ? "full" : ""}`}
                        onClick={() => setSelectedTimeSlot(slot)}
                      >
                        <span className="fw-bold">{slot.time}</span>
                        <span className="small text-danger fw-bold">{slot.discount}</span>
                        <span className="queue-pd-slot-cap">
                          {slot.status === "FULL" ? "เต็ม" : (slot.remaining !== undefined && slot.remaining !== null ? `ว่าง ${slot.remaining}` : "เปิดจอง")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="queue-pd-booking-footer">
              <div>
                <div className="queue-pd-booking-summary-text">
                  {quantity} ชาม · {selectedDay.fullDateStr}, {selectedTimeSlot.time} น. ({selectedTimeSlot.discount})
                </div>
                <div className="text-danger fw-bold fs-5">
                  ยอดรวม: ฿{totalCalculatedPrice.toFixed(2)}
                </div>
              </div>

              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-outline-danger fw-bold px-3 py-2 rounded-3 d-flex align-items-center gap-1"
                  onClick={handleAddToCart}
                  disabled={store?.isOpen === false || store?.status === "closed" || product?.availability === false}
                >
                  <i className="bi bi-cart-plus-fill" />
                  เพิ่มลงตะกร้า
                </button>

                <button
                  type="button"
                  className="queue-pd-btn-next"
                  onClick={handleNextBooking}
                  disabled={store?.isOpen === false || store?.status === "closed" || product?.availability === false}
                >
                  <i className="bi bi-bag-check-fill me-1" />
                  สั่งซื้อ / ไปที่ตะกร้า
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 🗺️ SECTION: CANTEEN INDOOR MAP & WAYFINDING */}
        <section className="queue-pd-canteen-map-section mt-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <div>
              <h2 className="fs-5 fw-bold text-dark d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-geo-alt-fill text-primary" /> แผนที่เดินทางไปร้าน &amp; ผังจุดรับอาหาร
              </h2>
              <p className="text-muted small mb-0">
                โรงอาหาร 2 (โรงอาหารกลาง 1) ชั้น 1 • ช่องจำหน่าย 04 ใกล้ประตูทางเข้าทิศเหนือ
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm rounded-pill fw-bold"
              onClick={() => setIsMapModalOpen(true)}
            >
              <i className="bi bi-compass me-1" /> เปิดแผนที่นำทาง (Walking Guide)
            </button>
          </div>

          <div className="row g-3 items-center">
            {/* Left: Interactive Simulated Canteen Blueprint Floor Plan */}
            <div className="col-12 col-lg-8">
              <div className="queue-pd-blueprint-card">
                <div className="queue-pd-blueprint-header">
                  <span><i className="bi bi-door-open text-primary me-1" /> ทางเข้าทิศเหนือ (North Gate)</span>
                  <span className="badge bg-secondary-subtle text-secondary">โรงอาหาร 2 ชั้น 1 (Zone A)</span>
                  <span><i className="bi bi-layers me-1" /> บันไดขึ้นชั้น 2</span>
                </div>

                {/* Stalls Grid */}
                <div className="queue-pd-stalls-grid">
                  <div className="queue-pd-stall-box">
                    <span className="stall-num">ล็อค 01</span>
                    <span className="stall-name">ข้าวมันไก่</span>
                  </div>
                  <div className="queue-pd-stall-box">
                    <span className="stall-num">ล็อค 02</span>
                    <span className="stall-name">ข้าวแกงใต้</span>
                  </div>
                  <div className="queue-pd-stall-box">
                    <span className="stall-num">ล็อค 03</span>
                    <span className="stall-name">เครื่องดื่ม/ผลไม้</span>
                  </div>
                  <div className="queue-pd-stall-box target">
                    <span className="target-badge">ปลายทาง</span>
                    <i className="bi bi-shop fs-4 text-warning" />
                    <span className="stall-name fw-bold">ล็อค 04: ป้าแดง</span>
                  </div>
                </div>

                {/* Walking Path */}
                <div className="queue-pd-walking-path">
                  <div className="d-flex align-items-center gap-2">
                    <div className="queue-pd-pin-icon">
                      <i className="bi bi-person-walking" />
                    </div>
                    <div>
                      <div className="fw-bold small text-dark">จุดเริ่มต้น: ทางเข้าลานกิจกรรมหน้าโรงอาหาร</div>
                      <div className="text-muted text-xs">เดินตรงผ่านเสา C3 เข้ามาประมาณ 25 เมตร • ร้านอยู่ทางขวามือ</div>
                    </div>
                  </div>
                  <span className="badge bg-success-subtle text-success fw-bold">เดิน 40 วินาที</span>
                </div>
              </div>
            </div>

            {/* Right: Landmarks & Spotting Helpers */}
            <div className="col-12 col-lg-4">
              <div className="queue-pd-landmarks-box">
                <div className="fw-bold text-dark small mb-2">
                  <i className="bi bi-flag-fill text-primary me-1" /> จุดสังเกตสำคัญในบริเวณร้าน
                </div>
                <div className="queue-pd-landmark-item">
                  <i className="bi bi-geo-fill text-danger fs-5" />
                  <div>
                    <div className="fw-bold small">เสาอาคาร C3 (ป้ายไฟเขียว QueueUp)</div>
                    <div className="text-muted text-xs">ตรงข้ามตู้กดน้ำดื่มสะอาด และจุดเติมเงินบัตรโรงอาหาร</div>
                  </div>
                </div>
                <div className="queue-pd-landmark-item">
                  <i className="bi bi-box-seam-fill text-primary fs-5" />
                  <div>
                    <div className="fw-bold small">ตู้สแกนรับคิวด่วน (QueueUp Locker)</div>
                    <div className="text-muted text-xs">หยิบกล่องออเดอร์พร้อมทานได้ทันที ไม่ต้องเบียดคิวหน้าร้าน</div>
                  </div>
                </div>
                <div className="queue-pd-landmark-item">
                  <i className="bi bi-arrow-return-left text-success fs-5" />
                  <div>
                    <div className="fw-bold small">ใกล้จุดส่งคืนภาชนะ Zone A</div>
                    <div className="text-muted text-xs">ทานเสร็จสามารถเดินนำชามไปคืนได้สะดวก ห่างเพียง 10 ก้าว</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. 🎬 SECTION: FOOD VIBE & VIDEO REVIEWS (SHORTS/REELS STYLE) */}
        <section className="queue-pd-video-section mt-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h2 className="fs-5 fw-bold text-dark d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-camera-reels-fill text-danger" /> วิดีโอรีวิวความอร่อย (Food Vibe &amp; Video Reviews)
              </h2>
              <p className="text-muted small mb-0">ชมความเข้มข้นของน้ำตกและเสียงกรุบกรอบของกากหมูเจียวสด</p>
            </div>
            <span className="badge bg-danger-subtle text-danger fw-bold d-none d-sm-inline-block">
              <i className="bi bi-fire me-1" /> ไวรัลสัปดาห์นี้
            </span>
          </div>

          <div className="row g-3">
            {VIDEO_REVIEWS.map((vid) => (
              <div key={vid.id} className="col-6 col-md-3">
                <div
                  className="queue-pd-video-card"
                  onClick={() => setActiveVideo(vid)}
                >
                  <img src={vid.thumbnail} alt={vid.title} className="queue-pd-video-thumb" />
                  <div className="queue-pd-video-overlay" />
                  <div className="queue-pd-video-top">
                    <span className="badge bg-dark bg-opacity-75 text-white">
                      <i className="bi bi-play-fill" /> {vid.duration}
                    </span>
                    <span className="badge bg-dark bg-opacity-75 text-white">
                      <i className="bi bi-eye" /> {vid.views}
                    </span>
                  </div>
                  <div className="queue-pd-video-play-btn">
                    <i className="bi bi-play-fill fs-3" />
                  </div>
                  <div className="queue-pd-video-bottom">
                    <div className="queue-pd-video-author">{vid.author}</div>
                    <div className="queue-pd-video-title">{vid.title}</div>
                    <div className="queue-pd-video-tags">{vid.tags}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. ⭐ SECTION: RATINGS & REVIEWS ANALYTICS */}
        <section className="queue-pd-reviews-section mt-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pb-3 border-bottom mb-3">
            <div>
              <h2 className="fs-5 fw-bold text-dark d-flex align-items-center gap-2 mb-1">
                <i className="bi bi-chat-square-quote-fill text-warning" /> รีวิวและคะแนนความพึงพอใจ
              </h2>
              <p className="text-muted small mb-0">จากนักศึกษาและบุคลากรกว่า 1,840 ออเดอร์จริง</p>
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm rounded-pill fw-bold"
              onClick={() => alert("ระบบจะเปิดให้เขียนรีวิวหลังท่านรับอาหารเสร็จสิ้นเรียบร้อยแล้ว")}
            >
              <i className="bi bi-pencil-square me-1" /> เขียนรีวิวอาหาร / ให้คะแนน
            </button>
          </div>

          {/* Rating Breakdown Bars */}
          <div className="queue-pd-rating-analytics-card">
            <div className="row g-3 align-items-center">
              <div className="col-12 col-md-4 text-center border-end-md">
                <div className="display-4 fw-black text-danger mb-0">4.8</div>
                <div className="text-warning mb-1">
                  <i className="bi bi-star-fill me-1" />
                  <i className="bi bi-star-fill me-1" />
                  <i className="bi bi-star-fill me-1" />
                  <i className="bi bi-star-fill me-1" />
                  <i className="bi bi-star-half" />
                </div>
                <div className="small text-muted">คะแนนรวม 4.8 จากเต็ม 5.0 ดาว</div>
                <div className="badge bg-success-subtle text-success mt-1">98% ของผู้ทานแนะนำร้านนี้</div>
              </div>

              <div className="col-12 col-md-8">
                <div className="d-flex flex-column gap-2">
                  <div className="d-flex align-items-center gap-2 small">
                    <span style={{ width: "90px" }}>รสชาติอาหาร</span>
                    <div className="progress flex-grow-1" style={{ height: "8px" }}>
                      <div className="progress-bar bg-danger" style={{ width: "98%" }} />
                    </div>
                    <span className="fw-bold">4.9</span>
                  </div>
                  <div className="d-flex align-items-center gap-2 small">
                    <span style={{ width: "90px" }}>ความสะอาด</span>
                    <div className="progress flex-grow-1" style={{ height: "8px" }}>
                      <div className="progress-bar bg-success" style={{ width: "98%" }} />
                    </div>
                    <span className="fw-bold">4.9</span>
                  </div>
                  <div className="d-flex align-items-center gap-2 small">
                    <span style={{ width: "90px" }}>ความรวดเร็ว</span>
                    <div className="progress flex-grow-1" style={{ height: "8px" }}>
                      <div className="progress-bar bg-primary" style={{ width: "94%" }} />
                    </div>
                    <span className="fw-bold">4.7</span>
                  </div>
                  <div className="d-flex align-items-center gap-2 small">
                    <span style={{ width: "90px" }}>ความคุ้มค่า</span>
                    <div className="progress flex-grow-1" style={{ height: "8px" }}>
                      <div className="progress-bar bg-warning" style={{ width: "96%" }} />
                    </div>
                    <span className="fw-bold">4.8</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Highlight Filter Chips */}
          <div className="d-flex align-items-center flex-wrap gap-2 my-3">
            <span className="text-muted small fw-bold">ประเด็นที่พูดถึงบ่อย:</span>
            <span className="badge bg-light text-dark border p-2 cursor-pointer">
              <i className="bi bi-hand-thumbs-up text-primary me-1" /> น้ำซุปเข้มข้นสะใจ (512)
            </span>
            <span className="badge bg-light text-dark border p-2 cursor-pointer">
              <i className="bi bi-hand-thumbs-up text-primary me-1" /> กากหมูกรอบใหม่ไม่อมน้ำมัน (384)
            </span>
            <span className="badge bg-light text-dark border p-2 cursor-pointer">
              <i className="bi bi-hand-thumbs-up text-primary me-1" /> ได้คิวไว ไม่ต้องรอนาน (295)
            </span>
            <span className="badge bg-light text-dark border p-2 cursor-pointer">
              <i className="bi bi-hand-thumbs-up text-primary me-1" /> ปริมาณคุ้มราคา 30 บ. (260)
            </span>
          </div>

          {/* Diner Reviews List */}
          <div className="d-flex flex-column gap-3 mt-2">
            {CUSTOMER_REVIEWS.map((rev) => (
              <div key={rev.id} className="queue-pd-review-card">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <div className="d-flex align-items-center gap-2">
                    <div
                      className="queue-pd-reviewer-avatar"
                      style={{ backgroundColor: rev.avatarBg }}
                    >
                      {rev.avatarLetter}
                    </div>
                    <div>
                      <div className="fw-bold text-dark small d-flex align-items-center gap-1.5">
                        {rev.author}
                        <span className="badge bg-success-subtle text-success text-xs">
                          <i className="bi bi-patch-check-fill" /> {rev.role}
                        </span>
                      </div>
                      <div className="text-muted text-xs">{rev.dishInfo} • {rev.date}</div>
                    </div>
                  </div>
                  <div className="text-warning small">
                    {[...Array(rev.rating)].map((_, i) => (
                      <i key={i} className="bi bi-star-fill me-0.5" />
                    ))}
                  </div>
                </div>
                <p className="text-muted small mb-0">{rev.comment}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. 🍲 SECTION: MORE MENUS FROM THIS STORE */}
        {recommendedProducts.length > 0 && (
          <section className="mt-4 pt-3 border-top">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="fs-5 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                <i className="bi bi-shop text-primary" /> เมนูอื่นจากร้านนี้ ({store.name || product.shopName})
              </h2>
              <span className="text-primary small fw-bold cursor-pointer" onClick={() => navigate("/search?keyword=ทั้งหมด")}>
                ดูเมนูทั้งหมด ({store.name}) <i className="bi bi-arrow-right" />
              </span>
            </div>

            <div className="row g-3">
              {recommendedProducts.map((rec) => (
                <div key={rec.id} className="col-6 col-md-3">
                  <div
                    className="queue-pd-rec-menu-card"
                    onClick={() => {
                      navigate(`/product/${rec.id}`);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <div className="queue-pd-rec-img-box">
                      <img
                        src={rec.image || rec.mainImg}
                        alt={rec.name}
                        className="queue-pd-rec-img"
                      />
                      <span className="queue-pd-rec-badge">ขายดี</span>
                    </div>
                    <div className="p-2.5 d-flex flex-column justify-content-between flex-grow-1">
                      <div>
                        <div className="fw-bold text-dark small text-truncate">{rec.name}</div>
                        <div className="text-muted text-xs text-truncate mt-0.5">รสชาติอร่อยกลมกล่อม</div>
                      </div>
                      <div className="d-flex justify-content-between align-items-center pt-2">
                        <span className="text-danger fw-bold">฿{rec.price}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary rounded-circle d-flex align-items-center justify-content-center"
                          style={{ width: "28px", height: "28px" }}
                        >
                          <i className="bi bi-plus" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 7. CALENDAR FULL MONTH MODAL (Full 28-31 Day Monthly Grid) */}
      {isCalendarModalOpen && (() => {
        const today = new Date();
        const curYear = today.getFullYear();
        const curMonth = today.getMonth();
        const firstDayOfWeek = new Date(curYear, curMonth, 1).getDay();
        const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        const cells = [];
        for (let i = 0; i < firstDayOfWeek; i++) {
          cells.push({ type: "empty", key: `empty-${i}` });
        }
        for (let d = 1; d <= daysInMonth; d++) {
          const targetDate = new Date(curYear, curMonth, d);
          const dayOfWeek = DAYS_OF_WEEK_TH[targetDate.getDay()];
          const monthName = MONTHS_TH[curMonth];
          const fullDateStr = `${d} ${monthName}`;
          const isoDateStr = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isPast = targetDate < todayDateOnly;
          const isToday = targetDate.getTime() === todayDateOnly.getTime();
          const isSelected = selectedDay?.isoDateStr === isoDateStr;

          cells.push({
            type: "day",
            key: isoDateStr,
            dateNum: d,
            dayOfWeek,
            fullDateStr,
            isoDateStr,
            isPast,
            isToday,
            isSelected,
            isBookable: !isPast,
          });
        }

        return (
          <div
            className="modal fade show d-block"
            style={{ backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", zIndex: 100000 }}
            tabIndex="-1"
          >
            <div className="modal-dialog modal-dialog-centered modal-md">
              <div className="modal-content rounded-4 border-0 shadow-lg p-3">
                <div className="modal-header border-0 pb-1">
                  <div>
                    <h5 className="modal-title fw-bold text-dark mb-0">
                      <i className="bi bi-calendar-event text-primary me-2" />
                      ปฏิทินเลือกรอบวันที่สั่งอาหาร
                    </h5>
                    <p className="text-xs text-muted mb-0 mt-1">
                      {MONTHS_TH[curMonth]} {curYear + 543} (สั่งล่วงหน้าได้ตลอดทั้งเดือน)
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setIsCalendarModalOpen(false)}
                  />
                </div>
                <div className="modal-body py-2">
                  {/* Weekday Header */}
                  <div className="d-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", textAlign: "center", marginBottom: "8px" }}>
                    {DAYS_OF_WEEK_TH.map((dw, idx) => (
                      <div key={idx} className="small fw-bold text-muted py-1" style={{ fontSize: "0.75rem" }}>
                        {dw}
                      </div>
                    ))}
                  </div>

                  {/* Day Grid */}
                  <div className="d-grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
                    {cells.map((cell) => {
                      if (cell.type === "empty") {
                        return <div key={cell.key} style={{ minHeight: "44px" }} />;
                      }
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          disabled={!cell.isBookable}
                          onClick={() => {
                            setSelectedDay({
                              id: cell.isoDateStr,
                              dayOfWeek: cell.dayOfWeek,
                              dateNum: cell.dateNum,
                              month: MONTHS_TH[curMonth],
                              fullDateStr: cell.fullDateStr,
                              isoDateStr: cell.isoDateStr,
                              isToday: cell.isToday,
                              isTomorrow: false,
                              status: "AVAILABLE",
                              statusLabel: "เปิดจอง",
                              capacityPercent: 100,
                            });
                            setIsCalendarModalOpen(false);
                          }}
                          className={`btn p-1 d-flex flex-column align-items-center justify-content-center rounded-3 position-relative ${
                            cell.isSelected
                              ? "btn-primary shadow-sm text-white fw-bold"
                              : cell.isToday
                              ? "btn-outline-primary fw-bold"
                              : cell.isBookable
                              ? "btn-light border hover-bg-primary-subtle text-dark"
                              : "btn-light border-0 text-muted opacity-25"
                          }`}
                          style={{ minHeight: "44px", fontSize: "0.85rem" }}
                        >
                          <span>{cell.dateNum}</span>
                          {cell.isToday && (
                            <span style={{ fontSize: "0.6rem", lineHeight: 1 }} className={cell.isSelected ? "text-white" : "text-primary"}>
                              วันนี้
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="modal-footer border-0 pt-2 pb-0 d-flex justify-content-between">
                  <div className="small text-muted" style={{ fontSize: "0.75rem" }}>
                    <span className="badge bg-primary me-1"> </span> วันที่เลือก: {selectedDay.dayOfWeek} {selectedDay.fullDateStr}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm px-4 rounded-pill"
                    onClick={() => setIsCalendarModalOpen(false)}
                  >
                    ปิด
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}


      {/* 8. WALKING GUIDE MAP MODAL */}
      {isMapModalOpen && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", zIndex: 100000 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg p-2">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="bi bi-compass text-primary me-1.5" /> แผนที่นำทางไปยัง {store.name}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setIsMapModalOpen(false)}
                />
              </div>
              <div className="modal-body py-3">
                <div className="p-3 bg-light rounded-3 border mb-3">
                  <div className="fw-bold text-primary small mb-1">📍 ตำแหน่งที่ตั้ง:</div>
                  <div className="small text-dark">{store.location || "โรงอาหาร 2 (โรงอาหารกลาง 1) ชั้น 1 • ช่อง 04"}</div>
                </div>
                <div className="d-flex flex-column gap-2 small">
                  <div className="d-flex gap-2">
                    <span className="badge bg-primary rounded-circle" style={{ width: "22px", height: "22px" }}>1</span>
                    <span>เข้าประตูโรงอาหารทิศเหนือ (ลานกิจกรรม)</span>
                  </div>
                  <div className="d-flex gap-2">
                    <span className="badge bg-primary rounded-circle" style={{ width: "22px", height: "22px" }}>2</span>
                    <span>เดินตรงผ่านเสา C3 และจุดเติมเงินบัตร</span>
                  </div>
                  <div className="d-flex gap-2">
                    <span className="badge bg-primary rounded-circle" style={{ width: "22px", height: "22px" }}>3</span>
                    <span>ร้านป้าแดง (ล็อค 04) อยู่ทางขวามือ ติดกับตู้ QueueUp Locker</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0">
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-4 rounded-pill fw-bold"
                  onClick={() => setIsMapModalOpen(false)}
                >
                  เข้าใจแล้ว
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. VIDEO MODAL PLAYER */}
      {activeVideo && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: "rgba(15, 23, 42, 0.85)", backdropFilter: "blur(10px)", zIndex: 100002 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content rounded-4 border-0 shadow-lg p-0 overflow-hidden bg-dark text-white">
              <div className="position-relative" style={{ height: "360px" }}>
                <img
                  src={activeVideo.thumbnail}
                  alt={activeVideo.title}
                  className="w-100 h-100 object-fit-cover opacity-75"
                />
                <div className="position-absolute top-0 end-0 p-3">
                  <button
                    type="button"
                    className="btn btn-sm btn-dark rounded-circle"
                    onClick={() => setActiveVideo(null)}
                  >
                    <i className="bi bi-x-lg" />
                  </button>
                </div>
                <div className="position-absolute top-50 start-50 translate-middle">
                  <div className="btn btn-light btn-lg rounded-circle shadow-lg p-3">
                    <i className="bi bi-play-fill fs-2 text-danger" />
                  </div>
                </div>
                <div className="position-absolute bottom-0 start-0 end-0 p-3" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
                  <div className="fw-bold small text-warning">{activeVideo.author}</div>
                  <div className="fw-bold">{activeVideo.title}</div>
                  <div className="text-xs text-slate-300">{activeVideo.tags}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. CHAT MODAL */}
      <button
        className="queue-floating-chat-btn"
        onClick={() => setIsChatOpen(true)}
        title="เปิดแชทผู้ช่วย QueueUp"
      >
        <i className="bi bi-chat-dots-fill" />
        <span>Chat</span>
        <span className="queue-chat-badge">3</span>
      </button>

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        storeId={product.storeId}
        productId={product.id}
      />

      {/* 11. INCOMPLETE PROFILE MODAL */}
      {isIncompleteProfileModalOpen && (
        <div
          className="modal fade show d-block"
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(10px)",
            zIndex: 100005,
          }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div
              className="modal-content text-white p-2"
              style={{
                background: "linear-gradient(145deg, #1e293b 0%, #0f172a 100%)",
                border: "2px solid #f59e0b",
                borderRadius: "24px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.6)",
              }}
            >
              <div className="modal-header border-bottom border-secondary pb-3">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="bg-warning text-dark p-3 rounded-circle d-flex align-items-center justify-content-center"
                    style={{ width: "48px", height: "48px" }}
                  >
                    <i className="bi bi-exclamation-triangle-fill fs-4" />
                  </div>
                  <div>
                    <h5 className="modal-title fw-bold text-warning mb-0">
                      ไม่สามารถทำการสั่งจองคิวอาหารได้
                    </h5>
                    <span className="text-slate-300 small">
                      มาตรการความปลอดภัยและแจ้งเตือนคิวโรงอาหาร
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setIsIncompleteProfileModalOpen(false)}
                />
              </div>

              <div className="modal-body py-4">
                <p className="mb-3 text-slate-200">
                  กรุณากรอกข้อมูลส่วนตัวในโปรไฟล์ให้ครบถ้วนก่อนสั่งอาหาร เพื่อให้ร้านค้าและระบบแจ้งเตือนคิวสามารถติดต่อคุณได้ตามนัดหมาย:
                </p>
                <div className="bg-dark p-3 rounded-3 border border-secondary mb-3">
                  <div className="text-warning fw-bold small mb-2">ข้อมูลที่ยังไม่สมบูรณ์:</div>
                  <ul className="mb-0 text-danger-subtle small ps-3">
                    {missingProfileFields.map((field, idx) => (
                      <li key={idx} className="mb-1">{field}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="modal-footer border-top border-secondary pt-3">
                <button
                  className="btn btn-secondary px-4 me-2"
                  onClick={() => setIsIncompleteProfileModalOpen(false)}
                >
                  ยกเลิก
                </button>
                <button
                  className="btn btn-warning fw-bold text-dark px-4"
                  onClick={() => {
                    setIsIncompleteProfileModalOpen(false);
                    navigate("/user/account/profile");
                  }}
                >
                  <i className="bi bi-pencil-square me-1" />
                  ไปที่หน้าโปรไฟล์เพื่อกรอกข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export default ProductDetail;
