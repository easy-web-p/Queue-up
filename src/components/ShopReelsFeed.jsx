import { useState } from "react";
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
  const [likesMap, setLikesMap] = useState({});

  const toggleLike = (reelId) => {
    setLikesMap((prev) => ({
      ...prev,
      [reelId]: !prev[reelId],
    }));
  };

  return (
    <div className="reels-feed-wrapper bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm mb-6 transition-all">
      <div className="reels-feed-header pb-4 mb-5 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="reels-icon-box w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white flex items-center justify-center text-xl shadow-md shadow-rose-500/20">
            <i className="bi bi-camera-reels-fill" />
          </div>
          <div>
            <h5 className="reels-title font-bold text-lg text-slate-900 dark:text-white mb-0">คลิปวิดีโอสร้างฐานลูกค้า & รีวิวจากผู้ใช้จริง</h5>
            <p className="reels-subtitle text-xs text-slate-500 dark:text-slate-400 mt-0.5 mb-0">
              ชมคลิปวิดีโอแนะนำเมนูจากร้านค้า และรีวิวประสบการณ์สั่งจองล่วงหน้าจากนักศึกษา
            </p>
          </div>
        </div>
      </div>

      <div className="reels-cards-grid grid grid-cols-1 md:grid-cols-3 gap-6">
        {MOCK_REELS.map((reel) => {
          const isLiked = likesMap[reel.id];
          const currentLikes = isLiked ? reel.likes + 1 : reel.likes;

          return (
            <div key={reel.id} className="reel-card bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between">
              <div className="reel-video-container relative aspect-[4/3] w-full overflow-hidden bg-slate-900">
                <img src={reel.videoPoster} alt={reel.title} className="reel-poster-img w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                <div className="reel-overlay-play absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px] cursor-pointer">
                  <i className="bi bi-play-circle-fill reel-play-icon text-4xl text-white/90 drop-shadow-md" />
                </div>
                <div className="reel-author-badge absolute top-3 left-3">
                  {reel.authorType === "MERCHANT" ? (
                    <span className="badge bg-[#ee4d2d] text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md flex items-center gap-1">
                      <i className="bi bi-shop" /> คลิปโปรโมตร้าน
                    </span>
                  ) : (
                    <span className="badge bg-emerald-600 text-white px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md flex items-center gap-1">
                      <i className="bi bi-person-check-fill" /> รีวิวจากผู้ใช้
                    </span>
                  )}
                </div>
              </div>

              <div className="reel-card-content p-4 flex flex-col justify-between flex-1">
                <div className="reel-author-row flex items-center gap-2 mb-2">
                  <img src={reel.shopAvatar} alt="" className="reel-avatar w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700" />
                  <span className="reel-author-name text-xs font-semibold text-slate-600 dark:text-slate-300">{reel.shopName}</span>
                </div>

                <p className="reel-title-text font-bold text-sm text-slate-900 dark:text-white mb-3 line-clamp-2">{reel.title}</p>

                <div className="reel-meta-actions flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-3">
                  <button
                    className={`reel-action-btn flex items-center gap-1 font-bold cursor-pointer transition-transform active:scale-90 ${isLiked ? "liked text-rose-600" : ""}`}
                    onClick={() => toggleLike(reel.id)}
                  >
                    <i className={`bi ${isLiked ? "bi-heart-fill text-danger" : "bi-heart"}`} />
                    {currentLikes}
                  </button>
                  <span className="reel-meta-stat flex items-center gap-1">
                    <i className="bi bi-chat-text" /> {reel.comments}
                  </span>
                </div>

                {/* Direct Booking from Reel Card */}
                <div className="reel-direct-order-box flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-auto">
                  <div>
                    <span className="reel-menu-name text-xs font-bold text-slate-700 dark:text-slate-200 block truncate max-w-[140px]">{reel.menuLinked}</span>
                    <div className="reel-menu-price text-sm font-black text-[#ee4d2d]">฿{reel.menuPrice}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary fw-bold rounded-full px-3 py-1 text-xs bg-[#ee4d2d] hover:bg-[#ff7337] border-0 text-white shadow-sm flex items-center gap-1 cursor-pointer"
                    onClick={() => onOrderFromReel && onOrderFromReel(reel.productId)}
                  >
                    <i className="bi bi-bag-plus-fill" />
                    สั่งจองเมนูนี้
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
