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
    <div className="shopee-food-card bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-[#ee4d2d]/50 transition-all overflow-hidden flex flex-col cursor-pointer group" onClick={onClick}>
      {/* 1. Image Wrapper with Badges & Floating Heart Button */}
      <div className="shopee-food-img-wrapper relative aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        <img
          src={image}
          alt={foodTitle}
          className="shopee-food-img w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/crispy_fried_chicken.jpg";
          }}
        />

        {/* Mall / Recommended Tag (Top-Left) */}
        <span className="shopee-food-badge-mall absolute top-2 left-2 bg-[#ee4d2d] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">ร้านเด็ด</span>

        {/* Canteen Queue Reservation Tag (Bottom-Left Image) */}
        <span className="shopee-food-badge-freeship absolute bottom-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-10">จองคิวฟรี*</span>

        {/* Floating Heart Favorite Button */}
        <button
          className="shopee-food-heart-btn absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-xs shadow-sm hover:scale-110 transition-all z-10 border-0 cursor-pointer"
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
      <div className="shopee-food-info p-3 flex flex-col flex-1 justify-between">
        {/* Category Tag Pill */}
        {categoryLabel && (
          <div className="shopee-food-category-pill text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
            <i className="bi bi-tag-fill me-1" /> {categoryLabel}
          </div>
        )}

        {/* Food Title (Bold & 2-Line Clamp) */}
        <h4 className="shopee-food-title font-bold text-sm text-slate-900 dark:text-white line-clamp-2 mb-1 group-hover:text-[#ee4d2d] transition-colors" title={foodTitle}>
          {foodTitle}
        </h4>

        {/* Small Circular Shop Logo & Shop Name */}
        <div className="shopee-food-shop-row flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mb-1">
          <img
            src={shopLogo}
            alt={shopName}
            className="shopee-food-shop-logo w-4 h-4 rounded-full object-cover"
          />
          <span className="shopee-food-shop-name truncate max-w-[140px]">{shopName}</span>
        </div>

        {/* Shop Location / Counter Location */}
        <div className="shopee-food-location-row text-[11px] text-slate-400 flex items-center gap-1 mb-2">
          <i className="bi bi-geo-alt-fill text-[#ee4d2d]" />
          <span className="truncate">{shopLocation}</span>
        </div>

        {/* Promo Badges (ลด %, สั่งล่วงหน้า) */}
        <div className="shopee-food-tags-row flex items-center gap-1 flex-wrap mb-2">
          {promoTag && <span className="shopee-food-tag-promo text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-[#ee4d2d] dark:text-orange-400 border border-orange-200 dark:border-orange-900/60">{promoTag}</span>}
          <span className="shopee-food-tag-promo text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950/60 text-[#ee4d2d] dark:text-orange-400 border border-orange-200 dark:border-orange-900/60">สั่งล่วงหน้า</span>
        </div>

        {/* Rating & Sales Stats */}
        <div className="shopee-food-meta-row flex items-center justify-between text-xs text-slate-400 mb-2">
          <div className="shopee-food-rating flex items-center gap-1 text-amber-500 font-bold">
            <i className="bi bi-star-fill text-xs" />
            <span>{rating}</span>
          </div>
          <span>{salesCount}</span>
        </div>

        {/* Price Box */}
        <div className="shopee-food-footer-row pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between mt-auto">
          <div className="shopee-food-price-box flex items-baseline">
            {originalPrice && (
              <span className="shopee-food-price-old text-xs text-slate-400 line-through mr-1">฿{originalPrice}</span>
            )}
            <span className="shopee-food-price-current text-base font-black text-[#ee4d2d]">฿{price}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FoodCard;
