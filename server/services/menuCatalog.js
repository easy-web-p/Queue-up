/**
 * Menu catalogue lookup.
 *
 * The codebase grew two collections for the same thing: the client wrote menus
 * to `food_items`, while authoritative order pricing read `menu_items` — the
 * only one covered by firestore.rules and the composite indexes. Because
 * nothing ever wrote `menu_items`, the pricing lookup always missed.
 *
 * `menu_items` is the canonical name. `food_items` stays readable so data
 * already written under the old name keeps resolving.
 */

export const CANONICAL_MENU_COLLECTION = 'menu_items';
export const LEGACY_MENU_COLLECTION = 'food_items';

/**
 * Resolves one menu item by id, preferring the canonical collection.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} menuItemId
 * @param {object} [transaction] Firestore transaction, when called inside one
 * @returns {Promise<{ id: string, data: object } | null>}
 */
export async function findMenuItem(db, menuItemId, transaction = null) {
  if (!menuItemId) return null;

  for (const collectionName of [CANONICAL_MENU_COLLECTION, LEGACY_MENU_COLLECTION]) {
    const ref = db.collection(collectionName).doc(menuItemId);
    const snap = transaction ? await transaction.get(ref) : await ref.get();
    if (snap.exists) return { id: snap.id, data: snap.data() };
  }

  return null;
}

/**
 * Lists a store's menu, merging both collections. The canonical entry wins
 * when the same id exists in each.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} storeId
 * @returns {Promise<Array<object>>}
 */
export async function listStoreMenu(db, storeId) {
  if (!storeId) return [];

  const byId = new Map();

  // Legacy first so the canonical collection overwrites it.
  for (const collectionName of [LEGACY_MENU_COLLECTION, CANONICAL_MENU_COLLECTION]) {
    try {
      const snap = await db.collection(collectionName).where('storeId', '==', storeId).get();
      snap.docs.forEach((doc) => byId.set(doc.id, { id: doc.id, ...doc.data() }));
    } catch (err) {
      console.warn(`[MenuCatalog] ${collectionName} lookup note:`, err.message);
    }
  }

  return Array.from(byId.values());
}
