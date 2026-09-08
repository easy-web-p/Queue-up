/**
 * ============================================================================
 * 💵 WHAT A CART LINE COSTS
 * ============================================================================
 *
 * The single implementation of the cart's unit price, kept free of Redux and of
 * TypeScript's type imports so it can be exercised directly by tests.
 *
 * It exists as its own module because there used to be two copies: the cart modal
 * totalled `menuItem.price * quantity` while the booking page added the paid
 * options on top. A customer who chose extra toppings saw one price in the cart
 * and a higher one at checkout — the two screens disagreed because the rule lived
 * in two places.
 */

/**
 * One unit of a cart line: the menu price plus every paid option chosen on it.
 *
 * A modifier's price may be recorded in baht (`priceModifier`) or in satang
 * (`priceModifierSatang`) depending on where the line was built, so both are read.
 * Satang is only consulted when baht is absent — never added on top of it.
 *
 * @param {{menuItem?: {price?: number}, selectedModifiers?: unknown}} item
 * @returns {number} the price in baht
 */
export function calculateCartItemUnitPrice(item) {
  const basePrice = item?.menuItem?.price || 0;
  if (!Array.isArray(item?.selectedModifiers)) return basePrice;

  const modifierTotal = item.selectedModifiers.reduce((sum, mod) => {
    if (typeof mod?.priceModifier === "number") return sum + mod.priceModifier;
    if (typeof mod?.priceModifierSatang === "number") return sum + mod.priceModifierSatang / 100;
    return sum;
  }, 0);

  return basePrice + modifierTotal;
}

/** The whole cart, in baht. */
export function calculateCartTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + calculateCartItemUnitPrice(item) * (item?.quantity || 1), 0);
}
