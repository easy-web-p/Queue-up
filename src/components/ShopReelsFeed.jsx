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
    <div className="reels-feed-wrapper">
      <div className="reels-feed-header">
        <div className="d-flex align-items-center gap-3">
          <div className="reels-icon-box">
            <i className="bi bi-camera-reels-fill" />
          </div>
          <div>
            <h5 className="reels-title">คลิปวิดีโอสร้างฐานลูกค้า & รีวิวจากผู้ใช้จริง</h5>
            <p className="reels-subtitle">
              ชมคลิปวิดีโอแนะนำเมนูจากร้านค้า และรีวิวประสบการณ์สั่งจองล่วงหน้าจากนักศึกษา
            </p>
          </div>
        </div>
      </div>

      <div className="reels-cards-grid">
        {MOCK_REELS.map((reel) => {
          const isLiked = likesMap[reel.id];
          const currentLikes = isLiked ? reel.likes + 1 : reel.likes;

          return (
            <div key={reel.id} className="reel-card">
              <div className="reel-video-container">
                <img src={reel.videoPoster} alt={reel.title} className="reel-poster-img" />
                <div className="reel-overlay-play">
                  <i className="bi bi-play-circle-fill reel-play-icon" />
                </div>
                <div className="reel-author-badge">
                  {reel.authorType === "MERCHANT" ? (
                    <span className="badge bg-primary">
                      <i className="bi bi-shop me-1" /> คลิปโปรโมตร้าน
                    </span>
                  ) : (
                    <span className="badge bg-success">
                      <i className="bi bi-person-check-fill me-1" /> รีวิวจากผู้ใช้
                    </span>
                  )}
                </div>
              </div>

              <div className="reel-card-content">
                <div className="reel-author-row">
                  <img src={reel.shopAvatar} alt="" className="reel-avatar" />
                  <span className="reel-author-name">{reel.shopName}</span>
                </div>

                <p className="reel-title-text">{reel.title}</p>

                <div className="reel-meta-actions">
                  <button
                    className={`reel-action-btn ${isLiked ? "liked" : ""}`}
                    onClick={() => toggleLike(reel.id)}
                  >
                    <i className={`bi ${isLiked ? "bi-heart-fill text-danger" : "bi-heart"} me-1`} />
                    {currentLikes}
                  </button>
                  <span className="reel-meta-stat">
                    <i className="bi bi-chat-text me-1" /> {reel.comments}
                  </span>
                </div>

                {/* Direct Booking from Reel Card */}
                <div className="reel-direct-order-box">
                  <div>
                    <span className="reel-menu-name">{reel.menuLinked}</span>
                    <div className="reel-menu-price">฿{reel.menuPrice}</div>
                  </div>
                  <button
                    className="btn btn-sm btn-primary fw-bold"
                    onClick={() => onOrderFromReel && onOrderFromReel(reel.productId)}
                  >
                    <i className="bi bi-bag-plus-fill me-1" />
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
