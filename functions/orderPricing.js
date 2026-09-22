/**
 * ============================================================================
 * 💵 ORDER PRICING & MODIFIER INTEGRITY
 * ============================================================================
 *
 * The price of an order, computed from the store's own product documents.
 *
 * Nothing the client sends about money is used. The caller supplies product ids,
 * quantities and which options were chosen; every price, every option price,
 * every constraint on how many options a group allows comes from Firestore. A
 * cart that says the dish costs ฿1 is simply ignored.
 *
 * Extracted from createOrderAuthoritative so it can be tested without the
 * emulator: this is where an oversell, a cross-store product, or a required
 * option silently skipped would happen, and none of it had a direct test.
 *
 * Documents are passed in already read — this file never touches Firestore, so
 * the transaction's read phase stays exactly where it was.
 */

const refuse = (status, code, message) => ({ ok: false, status, code, message });

/**
 * Stock and availability, checked against the aggregated cart.
 *
 * Quantities are aggregated per product first, so two cart lines for the same
 * dish are checked together. Checked separately, each passes on its own and the
 * pair oversells the last portion.
 *
 * @param {Map<string, number>} productTotalQuantityMap
 * @param {Map<string, object>} productDataMap - productId → product document
 * @param {string} storeId
 */
export function checkProductAvailability(productTotalQuantityMap, productDataMap, storeId) {
  for (const [prodId, requiredTotalQty] of productTotalQuantityMap.entries()) {
    const prodData = productDataMap.get(prodId);
    if (!prodData) {
      return refuse("not-found", "PRODUCT_NOT_FOUND", `PRODUCT_NOT_FOUND: ไม่พบสินค้า ${prodId}`);
    }
    // A product belonging to another store would be charged at that store's
    // price and cooked by a kitchen that never received the order.
    if (prodData.storeId !== storeId) {
      return refuse(
        "invalid-argument",
        "CROSS_STORE_PRODUCT_VIOLATION",
        `CROSS_STORE_PRODUCT_VIOLATION: สินค้า ${prodData.name} ไม่ได้เป็นของร้าน ${storeId}`
      );
    }
    if (prodData.isAvailable === false) {
      return refuse(
        "failed-precondition",
        "PRODUCT_UNAVAILABLE",
        `PRODUCT_UNAVAILABLE: สินค้า ${prodData.name} ปิดรับออเดอร์ชั่วคราว`
      );
    }
    const currentStock = typeof prodData.stock === "number" ? prodData.stock : 0;
    if (currentStock < requiredTotalQty) {
      return refuse(
        "failed-precondition",
        "INSUFFICIENT_STOCK",
        `INSUFFICIENT_STOCK: สินค้า "${prodData.name}" คงเหลือเพียง ${currentStock} ชุด (ต้องการ ${requiredTotalQty})`
      );
    }
  }
  return { ok: true };
}

/**
 * Checks the option groups attached to one product.
 *
 * The group's own document decides how many selections it requires and allows.
 * The several shapes read here (minSelections / minSelect / required, and the
 * matching maximums) are the field names that exist across documents written by
 * different versions of the merchant editor; honouring only the newest would
 * silently drop the constraint on every older group.
 */
function checkModifierGroups(prodData, selectedModifiers, modifierGroupDataMap, storeId) {
  if (!Array.isArray(prodData.modifierGroupIds)) return { ok: true };

  for (const mgId of prodData.modifierGroupIds) {
    const modData = modifierGroupDataMap.get(mgId);
    if (!modData) {
      return refuse(
        "not-found",
        "MODIFIER_GROUP_NOT_FOUND",
        `MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${mgId} สำหรับเมนู "${prodData.name}"`
      );
    }
    if (modData.storeId !== storeId) {
      return refuse(
        "invalid-argument",
        "CROSS_STORE_MODIFIER_VIOLATION",
        `CROSS_STORE_MODIFIER_VIOLATION: กลุ่มตัวเลือก ${mgId} ไม่ได้เป็นของร้าน ${storeId}`
      );
    }

    const groupSelections = selectedModifiers.filter((m) => m.modifierGroupId === mgId);
    const minSelections = modData.minSelections ?? modData.minSelect ?? (modData.required || modData.isRequired ? 1 : 0);
    const maxSelections = modData.maxSelections ?? modData.maxSelect ?? (modData.selectionType === "single" ? 1 : null);
    const isSingle = modData.selectionType === "single" || modData.type === "single";

    // The same option twice would be charged twice and cooked once.
    const optionIdsInGroup = groupSelections.map((m) => m.optionId);
    if (new Set(optionIdsInGroup).size !== optionIdsInGroup.length) {
      return refuse(
        "invalid-argument",
        "DUPLICATE_MODIFIER_OPTION",
        `DUPLICATE_MODIFIER_OPTION: กลุ่มตัวเลือก "${modData.name || mgId}" มีตัวเลือกซ้ำกัน`
      );
    }
    if (groupSelections.length < minSelections) {
      return refuse(
        "invalid-argument",
        "REQUIRED_MODIFIER_MISSING",
        `REQUIRED_MODIFIER_MISSING: กรุณาเลือก ${modData.name || "ตัวเลือกที่จำเป็น"} อย่างน้อย ${minSelections} รายการ สำหรับเมนู "${prodData.name}"`
      );
    }
    if (maxSelections !== null && groupSelections.length > maxSelections) {
      return refuse(
        "invalid-argument",
        "MAX_SELECTIONS_EXCEEDED",
        `MAX_SELECTIONS_EXCEEDED: กลุ่มตัวเลือก "${modData.name}" เลือกได้สูงสุดไม่เกิน ${maxSelections} รายการ`
      );
    }
    if (isSingle && groupSelections.length > 1) {
      return refuse(
        "invalid-argument",
        "SINGLE_SELECTION_VIOLATED",
        `SINGLE_SELECTION_VIOLATED: กลุ่มตัวเลือก "${modData.name}" สามารถเลือกได้เพียง 1 ตัวเลือกเท่านั้น`
      );
    }
  }

  return { ok: true };
}

/** Prices the chosen options, from the group documents. */
function priceSelectedModifiers(prodData, selectedModifiers, modifierGroupDataMap) {
  const allowedGroupIds = new Set(prodData.modifierGroupIds || []);
  const selectedModifierNames = [];
  let itemModifierSatang = 0;

  for (const selMod of selectedModifiers) {
    // An option from a group this product does not carry.
    if (!allowedGroupIds.has(selMod.modifierGroupId)) {
      return refuse(
        "invalid-argument",
        "INVALID_PRODUCT_MODIFIER",
        `INVALID_PRODUCT_MODIFIER: กลุ่มตัวเลือก ${selMod.modifierGroupId} ไม่ได้เป็นของสินค้า "${prodData.name}"`
      );
    }
    const modData = modifierGroupDataMap.get(selMod.modifierGroupId);
    if (!modData) {
      return refuse(
        "not-found",
        "MODIFIER_GROUP_NOT_FOUND",
        `MODIFIER_GROUP_NOT_FOUND: ไม่พบกลุ่มตัวเลือก ${selMod.modifierGroupId}`
      );
    }
    const opt = (modData.options || []).find((o) => o.id === selMod.optionId);
    if (!opt) {
      return refuse("not-found", "OPTION_NOT_FOUND", `OPTION_NOT_FOUND: ไม่พบตัวเลือก ${selMod.optionId}`);
    }
    if (opt.isOutOfStock) {
      return refuse(
        "failed-precondition",
        "OPTION_OUT_OF_STOCK",
        `OPTION_OUT_OF_STOCK: ตัวเลือก "${opt.name}" หมดชั่วคราว`
      );
    }

    // Satang is authoritative where present; the baht field is the older shape
    // and rounds here rather than accumulating a fraction per option.
    const optPriceSatang = opt.priceModifierSatang ?? Math.round((Number(opt.priceModifier) || 0) * 100);
    itemModifierSatang += optPriceSatang;
    if (opt.name) selectedModifierNames.push(String(opt.name));
  }

  return { ok: true, itemModifierSatang, selectedModifierNames };
}

/**
 * Prices the whole order.
 *
 * @param {Array} items - the requested cart lines
 * @param {Map<string, object>} productDataMap
 * @param {Map<string, object>} modifierGroupDataMap
 * @param {string} storeId
 * @returns {{ok: true, calculatedTotalSatang, validatedOrderItems, itemCategories, allergenScanItems}
 *          |{ok: false, status, code, message}}
 */
export function priceOrder(items, productDataMap, modifierGroupDataMap, storeId) {
  let calculatedTotalSatang = 0;
  const validatedOrderItems = [];
  const itemCategories = new Set();
  const allergenScanItems = [];

  for (const itemReq of items) {
    const prodData = productDataMap.get(itemReq.productId);
    if (!prodData) {
      return refuse("not-found", "PRODUCT_NOT_FOUND", `PRODUCT_NOT_FOUND: ไม่พบสินค้า ${itemReq.productId}`);
    }
    if (prodData.category) itemCategories.add(prodData.category);

    const basePriceSatang = prodData.priceSatang ?? Math.round((Number(prodData.price) || 0) * 100);
    const selectedModifiers = itemReq.selectedModifiers || [];

    const groupCheck = checkModifierGroups(prodData, selectedModifiers, modifierGroupDataMap, storeId);
    if (!groupCheck.ok) return groupCheck;

    const priced = priceSelectedModifiers(prodData, selectedModifiers, modifierGroupDataMap);
    if (!priced.ok) return priced;

    allergenScanItems.push({
      productId: itemReq.productId,
      name: prodData.name || "",
      category: prodData.category || "",
      description: prodData.description || "",
      modifierNames: priced.selectedModifierNames,
      // Ingredients the store declared on the product. Read from Firestore, not
      // from the request, so a caller cannot clear the tags to dodge the check.
      declaredAllergens: Array.isArray(prodData.allergens) ? prodData.allergens : [],
    });

    const unitPriceSatang = basePriceSatang + priced.itemModifierSatang;
    const subtotalSatang = unitPriceSatang * Number(itemReq.quantity);
    calculatedTotalSatang += subtotalSatang;

    validatedOrderItems.push({
      productId: itemReq.productId,
      name: prodData.name,
      category: prodData.category || "General",
      quantity: Number(itemReq.quantity),
      unitPriceSatang,
      unitPrice: unitPriceSatang / 100,
      subtotalSatang,
      subtotal: subtotalSatang / 100,
      customNotes: itemReq.customNotes || "",
      selectedModifiers,
    });
  }

  return { ok: true, calculatedTotalSatang, validatedOrderItems, itemCategories, allergenScanItems };
}
