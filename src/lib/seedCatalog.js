/**
 * ============================================================================
 * 🌱 SEEDING A CANTEEN'S FIRST MENU
 * ============================================================================
 *
 * The products collection starts empty, and until it has rows the app has no
 * menu — which is now shown honestly, rather than papered over with a hardcoded
 * catalogue that looked like a stocked canteen but could not be ordered.
 *
 * This turns those sample dishes into real, orderable products. Two things have
 * to happen for that to be true rather than just look true:
 *
 *  1. Every product needs a storeId. The templates carry none, and the ordering
 *     Cloud Function refuses an item without one ("STORE_ID_REQUIRED"), while the
 *     product page refuses even earlier. Seeding them as they are would put the
 *     same unorderable food on the screen, only this time saved to the database.
 *
 *  2. The fabricated social proof has to go. The templates ship
 *     `sales: "4.5k ครั้ง"`, `salesCount: "1.2k ขายแล้ว"`, `rating: 4.9` and an
 *     `originalPrice` that invents a discount. Those are placeholder decoration
 *     in a mock file; written to the database they become claims the canteen is
 *     making about dishes it has never sold.
 *
 * Pure and dependency-free so the shaping can be exercised directly.
 */

/**
 * Fields that exist to make a mock look busy. A real product earns these by being
 * sold, so a seeded one starts without them.
 */
export const FABRICATED_FIELDS = ["sales", "salesCount", "rating", "reviewCount", "originalPrice"];

/**
 * @param {Array<object>} templates - the sample dishes
 * @param {string} storeId - the store these products will belong to
 * @returns {Array<object>} products ready to write
 * @throws when there is no store to attach them to
 */
export function buildSeedProducts(templates, storeId) {
  const cleanStoreId = typeof storeId === "string" ? storeId.trim() : "";
  if (!cleanStoreId) {
    throw new Error("SEED_STORE_REQUIRED: ต้องมีร้านค้าก่อนจึงจะเพิ่มเมนูได้");
  }
  if (!Array.isArray(templates) || templates.length === 0) {
    throw new Error("SEED_TEMPLATES_EMPTY: ไม่มีเมนูตัวอย่างให้เพิ่ม");
  }

  return templates.map((template) => {
    const product = { ...template };
    for (const field of FABRICATED_FIELDS) delete product[field];

    const price = Number(product.price);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`SEED_INVALID_PRICE: "${product.name || product.id}" ราคาไม่ถูกต้อง`);
    }

    return {
      ...product,
      // Namespaced by store, so seeding two canteens does not have the second
      // overwrite the first's menu at products/m1.
      id: `${cleanStoreId}_${template.id}`,
      storeId: cleanStoreId,
      price,
      // Satang is what the ordering function actually charges against.
      priceSatang: Math.round(price * 100),
      availability: true,
      stock: typeof product.stock === "number" && product.stock >= 0 ? product.stock : 20,
      seeded: true,
    };
  });
}
