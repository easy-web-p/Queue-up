/**
 * Store menu catalogue.
 *
 * Menu writes belong to the store that owns the items. Previously the client
 * wrote the entire catalogue — every store's items — straight to Firestore from
 * any visitor's browser, and it wrote them to `food_items`, which is not the
 * collection order pricing reads.
 */

import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { authenticate, requireStoreOwnership } from '../middleware/authenticate.js';
import { CANONICAL_MENU_COLLECTION, listStoreMenu } from '../services/menuCatalog.js';

export const catalogRouter = Router();

const BATCH_LIMIT = 500;
const MAX_ITEMS_PER_REQUEST = 2000;

/**
 * Normalises one incoming menu item. storeId is stamped from the authorised
 * route rather than read from the payload, so a merchant cannot write an item
 * into another store's menu by relabelling it.
 */
function toMenuItemDoc(storeId, raw, now) {
  const id = String(raw?.id ?? '').trim();
  const name = String(raw?.name ?? '').trim();
  const price = Number(raw?.price);

  if (!id || !name) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  return {
    ...raw,
    id,
    storeId,
    name,
    price,
    isAvailable: raw?.isAvailable !== false,
    updatedAt: now
  };
}

/**
 * GET /api/catalog/stores/:storeId/menu
 * Public: the merged canonical + legacy menu for one store.
 */
catalogRouter.get('/stores/:storeId/menu', async (req, res) => {
  try {
    const items = await listStoreMenu(adminDb, req.params.storeId);
    return res.status(200).json({ success: true, storeId: req.params.storeId, items });
  } catch (err) {
    console.error('[Catalog API] Menu read error:', err);
    return res.status(500).json({ success: false, error: 'MENU_READ_FAILED', message: err.message });
  }
});

/**
 * PUT /api/catalog/stores/:storeId/menu
 * Upserts this store's menu items, and optionally removes ids the merchant
 * deleted. Only items of the authorised store are ever touched.
 */
catalogRouter.put('/stores/:storeId/menu', authenticate, requireStoreOwnership(), async (req, res) => {
  try {
    const storeId = req.storeId;
    const { items, removedIds } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PAYLOAD',
        message: 'items must be an array.'
      });
    }

    if (items.length > MAX_ITEMS_PER_REQUEST) {
      return res.status(413).json({
        success: false,
        error: 'TOO_MANY_ITEMS',
        message: `Send at most ${MAX_ITEMS_PER_REQUEST} items per request.`
      });
    }

    const now = new Date().toISOString();
    const docs = items.map((raw) => toMenuItemDoc(storeId, raw, now)).filter(Boolean);
    const skipped = items.length - docs.length;

    for (let offset = 0; offset < docs.length; offset += BATCH_LIMIT) {
      const batch = adminDb.batch();
      for (const doc of docs.slice(offset, offset + BATCH_LIMIT)) {
        batch.set(adminDb.collection(CANONICAL_MENU_COLLECTION).doc(doc.id), doc, { merge: true });
      }
      await batch.commit();
    }

    // Deletions are verified one by one: an id that belongs to another store
    // must not be removable from here.
    let removed = 0;
    if (Array.isArray(removedIds) && removedIds.length > 0) {
      for (const rawId of removedIds.slice(0, MAX_ITEMS_PER_REQUEST)) {
        const ref = adminDb.collection(CANONICAL_MENU_COLLECTION).doc(String(rawId));
        const snap = await ref.get();
        if (snap.exists && snap.data().storeId === storeId) {
          await ref.delete();
          removed += 1;
        }
      }
    }

    return res.status(200).json({
      success: true,
      storeId,
      upsertedCount: docs.length,
      skippedCount: skipped,
      removedCount: removed
    });
  } catch (err) {
    console.error('[Catalog API] Menu write error:', err);
    return res.status(500).json({ success: false, error: 'MENU_WRITE_FAILED', message: err.message });
  }
});
