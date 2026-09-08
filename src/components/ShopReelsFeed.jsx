import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../components/ToastProvider.jsx";
import {
  fetchReelsFromFirestore,
  createReelInFirestore,
  toggleLikeReelInFirestore,
} from "../services/communityService.js";
import "./ShopReelsFeed.css";

const MOCK_REELS = [
  {
    id: "reel-1",
    shopName: "ร้านป้าแดง ตามสั่ง & ไก่ทอด",
    shopAvatar: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=100&auto=format&fit=crop&q=60",
    videoPoster: "/crispy_fried_chicken.jpg",
    title: "เบื้องหลังความแซ่บ! ไก่ทอดกรอบซอสน้ำปลาทำสดใหม่ทุกมื้อเที่ยง",
    likes: 342,
    comments: 48,
    menuLinked: "ข้าวไก่แซ่บกรอบพิเศษ",
    menuPrice: 55,
    productId: "prod-chicken-bucket",
    authorType: "MERCHANT", // MERCHANT or STUDENT
  },
  {
    id: "reel-2",
    shopName: "รีวิวโดย น้องพีท (วิศวะ ปี 2)",
    shopAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=60",
    videoPoster: "https://images.unsplash.com/photo-1559847844-5315695dadae?w=600&auto=format&fit=crop&q=60",
    title: "รีวิวก๋วยเตี๋ยวเรือเสือร้องไห้ จองล่วงหน้า 10 นาที มาถึงได้กินเลย ไม่ต้องยืนรอคิว!",
    likes: 512,
    comments: 89,
    menuLinked: "ก๋วยเตี๋ยวเรือเนื้อหมกเส้นเล็ก",
    menuPrice: 60,
    productId: "prod-noodle-boat",
    authorType: "STUDENT",
  },
  {
    id: "reel-3",
    shopName: "ร้านสเต็กพี่ตั้ม School Food",
    shopAvatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=60",
    videoPoster: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=60",
    title: "วิธีหมักสเต็กสูตรเข้มข้น นุ่ม ละมุนลิ้น พร้อมเปิดสั่งจองสำหรับวันพรุ่งนี้แล้วครับ",
    likes: 278,
    comments: 31,
    menuLinked: "สเต็กไก่พริกไทยดำ",
    menuPrice: 79,
    productId: "prod-steak",
    authorType: "MERCHANT",
  },
];

export default function ShopReelsFeed({ onOrderFromReel }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [reels, setReels] = useState(MOCK_REELS);
  const [likesMap, setLikesMap] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Reel Form State
  const [newTitle, setNewTitle] = useState("");
  const [newMenuLinked, setNewMenuLinked] = useState("");
  const [newMenuPrice, setNewMenuPrice] = useState("");
  const [newPosterUrl, setNewPosterUrl] = useState("");
  const [newAuthorType, setNewAuthorType] = useState("MERCHANT");

  useEffect(() => {
    let isCancelled = false;
    async function loadReels() {
      try {
        const remoteReels = await fetchReelsFromFirestore();
        if (!isCancelled && remoteReels && remoteReels.length > 0) {
          // Merge remote reels with mock reels to guarantee rich feed
          setReels([...remoteReels, ...MOCK_REELS]);
        }
      } catch (err) {
        console.warn("Could not load reels from Firestore:", err);
      }
    }
    loadReels();
    return () => {
      isCancelled = true;
    };
  }, []);

  const toggleLike = async (reelId) => {
    if (!user) {
      toast.warning("กรุณาเข้าสู่ระบบก่อนกดถูกใจคลิป");
      return;
    }

    const currentlyLiked = !!likesMap[reelId];
    setLikesMap((prev) => ({
      ...prev,
      [reelId]: !currentlyLiked,
    }));

    // Update state count optimistically
    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId
          ? { ...r, likes: currentlyLiked ? Math.max(0, (r.likes || 0) - 1) : (r.likes || 0) + 1 }
          : r
      )
    );

    try {
      await toggleLikeReelInFirestore(reelId, user.uid, currentlyLiked);
    } catch (err) {
      console.warn("Toggle like error:", err);
    }
  };

  const handleCreateReel = async (e) => {
    e.preventDefault();
    if (!user) {
      toast.warning("กรุณาเข้าสู่ระบบก่อนโพสต์คลิป");
      return;
    }
    if (!newTitle.trim()) {
      toast.warning("กรุณากรอกหัวข้อคลิปหรือคำอธิบาย");
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createReelInFirestore({
        title: newTitle.trim(),
        menuLinked: newMenuLinked.trim() || "เมนูพิเศษ",
        menuPrice: Number(newMenuPrice) || 50,
        videoPoster: newPosterUrl.trim() || "/crispy_fried_chicken.jpg",
        shopName: user.displayName || user.name || (newAuthorType === "MERCHANT" ? "ร้านค้าโรงเรียน" : "นักเรียนรีวิว"),
        shopAvatar: user.photoURL || "/yeti_mascot.jpg",
        authorType: newAuthorType,
        authorUid: user.uid,
      });

      setReels((prev) => [created, ...prev]);
      setIsModalOpen(false);
      setNewTitle("");
      setNewMenuLinked("");
      setNewMenuPrice("");
      setNewPosterUrl("");
      toast.success("โพสต์คลิปวิดีโอแนะนำอาหารเรียบร้อยแล้ว!");
    } catch (err) {
      console.error("Failed to post reel:", err);
      toast.error("ไม่สามารถโพสต์คลิปได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOrder = (productId) => {
    if (onOrderFromReel) {
      onOrderFromReel(productId);
    } else if (productId) {
      navigate(`/product/${productId}`);
    } else {
      navigate("/canteen");
    }
  };

  return (
    <div className="reels-feed-wrapper bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 transition-all">
      <div className="reels-feed-header pb-4 mb-5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="reels-icon-box w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center text-xl shadow-md shadow-rose-500/20">
            <i className="bi bi-camera-reels-fill" aria-hidden="true" />
          </div>
          <div>
            <h5 className="reels-title font-bold text-lg text-slate-900 dark:text-white mb-0">คลิปวิดีโอสร้างฐานลูกค้า & รีวิวจากผู้ใช้จริง</h5>
            <p className="reels-subtitle text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
              ชมคลิปวิดีโอแนะนำเมนูจากร้านค้า และรีวิวประสบการณ์สั่งจองล่วงหน้าจากนักศึกษา
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (!user) {
              toast.warning("กรุณาเข้าสู่ระบบก่อนโพสต์คลิป");
              return;
            }
            setIsModalOpen(true);
          }}
          className="btn btn-sm rounded-full px-4 py-2 text-xs font-bold bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md hover:opacity-90 flex items-center gap-2 cursor-pointer transition-all border-0"
        >
          <i className="bi bi-plus-circle-fill" aria-hidden="true" />
          <span>โพสต์คลิป / รีวิวใหม่</span>
        </button>
      </div>

      <div className="reels-cards-grid grid grid-cols-1 md:grid-cols-3 gap-6">
        {reels.map((reel) => {
          const isLiked = !!likesMap[reel.id];
          const currentLikes = reel.likes || 0;

          return (
            <div key={reel.id} className="reel-card bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="reel-video-container relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                <img loading="lazy" decoding="async" src={reel.videoPoster || "/crispy_fried_chicken.jpg"} alt={reel.title} className="reel-poster-img w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                <div className="reel-overlay-play absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px] cursor-pointer">
                  <i className="bi bi-play-circle-fill reel-play-icon text-4xl text-white/90 drop-shadow-md" aria-hidden="true" />
                </div>
                <div className="reel-author-badge absolute top-3 left-3">
                  {reel.authorType === "MERCHANT" ? (
                    <span className="badge bg-[#FF7A1A] text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md flex items-center gap-1">
                      <i className="bi bi-shop" aria-hidden="true" /> คลิปโปรโมตร้าน
                    </span>
                  ) : (
                    <span className="badge bg-emerald-600 text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md flex items-center gap-1">
                      <i className="bi bi-person-check-fill" aria-hidden="true" /> รีวิวจากผู้ใช้
                    </span>
                  )}
                </div>
              </div>

              <div className="reel-card-content p-4 flex flex-col justify-between flex-1">
                <div className="reel-author-row flex items-center gap-2 mb-2">
                  <img loading="lazy" decoding="async" src={reel.shopAvatar || "/yeti_mascot.jpg"} alt="" className="reel-avatar w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                  <span className="reel-author-name text-xs font-semibold text-slate-600 dark:text-slate-300">{reel.shopName}</span>
                </div>

                <p className="reel-title-text font-bold text-sm text-slate-900 dark:text-white mb-3 line-clamp-2">{reel.title}</p>

                <div className="reel-meta-actions flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                  <button
                    className={`reel-action-btn flex items-center gap-1 font-bold cursor-pointer transition-transform active:scale-90 ${isLiked ? "liked text-rose-600" : ""}`}
                    onClick={() => toggleLike(reel.id)}
                    aria-label={`ถูกใจคลิป ${reel.title}`}
                  >
                    <i className={`bi ${isLiked ? "bi-heart-fill text-danger" : "bi-heart"}`} aria-hidden="true" />
                    {currentLikes}
                  </button>
                  <span className="reel-meta-stat flex items-center gap-1">
                    <i className="bi bi-chat-text" aria-hidden="true" /> {reel.comments || 0}
                  </span>
                </div>

                {/* Direct Booking from Reel Card */}
                <div className="reel-direct-order-box flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-auto">
                  <div>
                    <span className="reel-menu-name text-xs font-bold text-slate-700 dark:text-slate-200 block truncate max-w-[140px]">{reel.menuLinked}</span>
                    <div className="reel-menu-price text-sm font-black text-[#FF7A1A]">฿{reel.menuPrice}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary fw-bold rounded-full px-3 py-1 text-xs bg-[#FF7A1A] hover:bg-[#FF7A1A] border-0 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                    onClick={() => handleOrder(reel.productId)}
                  >
                    <i className="bi bi-bag-plus-fill" aria-hidden="true" />
                    สั่งจองเมนูนี้
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* New Reel Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h5 className="font-bold text-slate-900 dark:text-white text-base mb-0 flex items-center gap-2">
                <i className="bi bi-camera-reels-fill text-rose-500" aria-hidden="true" />
                โพสต์คลิปแนะนำอาหาร & รีวิว
              </h5>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-full text-lg cursor-pointer"
                aria-label="ปิด"
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleCreateReel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ประเภทผู้โพสต์
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      newAuthorType === "MERCHANT"
                        ? "bg-[#FF7A1A] text-white border-[#FF7A1A]"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => setNewAuthorType("MERCHANT")}
                  >
                    🏪 ร้านค้าโปรโมต
                  </button>
                  <button
                    type="button"
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      newAuthorType === "STUDENT"
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                    onClick={() => setNewAuthorType("STUDENT")}
                  >
                    🎓 นักเรียนรีวิว
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  หัวข้อคลิป / คำอธิบายสั้น
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="เช่น ข้าวไก่ทอดกรอบซอสน้ำปลาทำสดใหม่ทุกเที่ยง"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อเมนูอาหาร
                  </label>
                  <input
                    type="text"
                    value={newMenuLinked}
                    onChange={(e) => setNewMenuLinked(e.target.value)}
                    placeholder="เช่น ข้าวไก่กรอบ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ราคา (บาท)
                  </label>
                  <input
                    type="number"
                    value={newMenuPrice}
                    onChange={(e) => setNewMenuPrice(e.target.value)}
                    placeholder="55"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  URL รูปภาพหน้าปกคลิป (หรือเลือกใช้ค่าเริ่มต้น)
                </label>
                <input
                  type="text"
                  value={newPosterUrl}
                  onChange={(e) => setNewPosterUrl(e.target.value)}
                  placeholder="/crispy_fried_chicken.jpg หรือ https://..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-90 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "กำลังบันทึก..." : "โพสต์คลิป"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
