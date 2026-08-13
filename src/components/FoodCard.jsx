import "./FoodCard.css";

function FoodCard({
  item,
  isFavorite = false,
  onToggleFavorite,
  onClick,
}) {
  const {
    id,
    name,
    title,
    price,
    originalPrice,
    image,
    categoryLabel,
    shopName = "ร้านป้าแดง ตามสั่ง",
    shopLogo = "/logo.png",
    shopLocation = "โรงอาหาร 1 (อาคารเรียน 2)",
    rating = 4.9,
    salesCount = "1.2k ขายแล้ว",
    promoTag = "ลด 45%",
  } = item || {};

  const foodTitle = name || title || "เมนูอาหารน่าทาน";

  return (
    <div className="shopee-food-card" onClick={onClick}>
      {/* 1. Image Wrapper with Badges & Floating Heart Button */}
      <div className="shopee-food-img-wrapper">
        <img src={image} alt={foodTitle} className="shopee-food-img" />

        {/* Mall / Recommended Tag (Top-Left) */}
        <span className="shopee-food-badge-mall">ร้านเด็ด</span>

        {/* Canteen Queue Reservation Tag (Bottom-Left Image) */}
        <span className="shopee-food-badge-freeship">จองคิวฟรี*</span>

        {/* Floating Heart Favorite Button */}
        <button
          className="shopee-food-heart-btn"
          onClick={(e) => {
            e.stopPropagation();
            if (onToggleFavorite) onToggleFavorite(id);
          }}
          title="บันทึกเป็นเมนูโปรด"
        >
          <i
            className={`bi ${
              isFavorite ? "bi-heart-fill text-danger" : "bi-heart text-muted"
            }`}
          />
        </button>
      </div>

      {/* 2. Info Content Area */}
      <div className="shopee-food-info">
        {/* Category Tag Pill */}
        {categoryLabel && (
          <div className="shopee-food-category-pill">
            <i className="bi bi-tag-fill me-1" /> {categoryLabel}
          </div>
        )}

        {/* Food Title (Bold & 2-Line Clamp) */}
        <h4 className="shopee-food-title" title={foodTitle}>
          {foodTitle}
        </h4>

        {/* Small Circular Shop Logo & Shop Name */}
        <div className="shopee-food-shop-row">
          <img
            src={shopLogo}
            alt={shopName}
            className="shopee-food-shop-logo"
          />
          <span className="shopee-food-shop-name">{shopName}</span>
        </div>

        {/* Shop Location / Counter Location */}
        <div className="shopee-food-location-row">
          <i className="bi bi-geo-alt-fill text-danger me-1" />
          <span>{shopLocation}</span>
        </div>

        {/* Promo Badges (ลด %, สั่งล่วงหน้า) */}
        <div className="shopee-food-tags-row">
          {promoTag && <span className="shopee-food-tag-promo">{promoTag}</span>}
          <span className="shopee-food-tag-promo">สั่งล่วงหน้า</span>
        </div>

        {/* Rating & Sales Stats */}
        <div className="shopee-food-meta-row">
          <div className="shopee-food-rating">
            <i className="bi bi-star-fill me-1" />
            <span>{rating}</span>
          </div>
          <span>{salesCount}</span>
        </div>

        {/* Price & Plus Add Action Button */}
        <div className="shopee-food-footer-row">
          <div className="shopee-food-price-box">
            {originalPrice && (
              <span className="shopee-food-price-old">฿{originalPrice}</span>
            )}
            <span className="shopee-food-price-current">฿{price}</span>
          </div>

          <button
            className="shopee-food-add-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (onClick) onClick();
            }}
            title="สั่งซื้อ / เพิ่มไปยังคิวทันที"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export default FoodCard;
