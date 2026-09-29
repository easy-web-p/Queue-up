/**
 * Opening a shop.
 *
 * The create-store form built the store in the browser, put it in React state
 * and localStorage, and asked the client SDK to write it to Firestore. Rules
 * reserve store creation for the server, and the client swallowed the refusal
 * with a console.warn — so the form reported success while the shop existed
 * only in that one browser. It never reached the API, so no order could be
 * placed against it and no menu item could be created for it either.
 *
 * Creation belongs here, where the owner comes from the verified identity rather
 * than from the form.
 */

import { Router } from 'express';
import { adminDb } from '../firebaseAdmin.js';
import { authenticate } from '../middleware/authenticate.js';

export const storeRouter = Router();

/** A shop cannot be opened in somebody else's canteen, nor have no name. */
const MAX_NAME = 80;
const MAX_TEXT = 500;
const MAX_MENU_ITEMS = 20;
const MAX_STORES_PER_OWNER = 5;

const CATEGORIES = new Set(['rice', 'noodles', 'beverages', 'desserts', 'fastfood']);

function text(value, max, fallback = '') {
  const cleaned = String(value ?? '').trim().replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, max) : fallback;
}

/** Only https URLs, so a store image cannot carry a javascript: payload. */
function httpsUrl(value, fallback = null) {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? raw.slice(0, 600) : fallback;
  } catch {
    return fallback;
  }
}

function priceInSatang(value) {
  const baht = Number(value);
  if (!Number.isFinite(baht) || baht <= 0) return null;
  return Math.round(baht * 100);
}

/**
 * POST /api/stores
 * Opens a shop owned by the caller.
 *
 * Open to any signed-in account: opening a shop is how a customer becomes a
 * merchant. The owner and the institution come from the verified identity, never
 * from the body — otherwise a shop could be planted in another campus or
 * registered under somebody else's name.
 */
storeRouter.post('/', authenticate, async (req, res) => {
  try {
    const body = req.body || {};

    const name = text(body.name, MAX_NAME);
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'STORE_NAME_REQUIRED',
        message: 'กรุณาตั้งชื่อร้านค้า'
      });
    }

    const category = CATEGORIES.has(body.category) ? body.category : 'rice';

    const ownedSnap = await adminDb.collection('stores')
      .where('ownerId', '==', req.user.uid)
      .get();
    if (ownedSnap.size >= MAX_STORES_PER_OWNER) {
      return res.status(409).json({
        success: false,
        error: 'STORE_LIMIT_REACHED',
        message: `หนึ่งบัญชีเปิดร้านได้ไม่เกิน ${MAX_STORES_PER_OWNER} ร้าน กรุณาติดต่อผู้ดูแลระบบ`
      });
    }

    const rawMenu = Array.isArray(body.initialMenuItems) ? body.initialMenuItems : [];
    if (rawMenu.length > MAX_MENU_ITEMS) {
      return res.status(400).json({
        success: false,
        error: 'TOO_MANY_MENU_ITEMS',
        message: `เพิ่มเมนูเริ่มต้นได้ไม่เกิน ${MAX_MENU_ITEMS} รายการ`
      });
    }

    const now = new Date().toISOString();
    const storeId = `store-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logo = httpsUrl(body.logo);
    const coverImage = httpsUrl(body.coverImage);
    const image = httpsUrl(body.image, coverImage || logo);

    const store = {
      id: storeId,
      ownerId: req.user.uid,
      // The caller's own institution. A shop planted in another campus would be
      // orderable by students who can never collect from it.
      schoolId: req.user.schoolId || null,
      name,
      nameEn: text(body.nameEn, MAX_NAME, name),
      description: text(body.description, MAX_TEXT, 'ร้านอาหารในโรงอาหาร ปรุงสดใหม่ทุกจาน'),
      category,
      ownerName: text(body.ownerName, MAX_NAME, req.user.name || 'เจ้าของร้าน'),
      ownerPhone: text(body.ownerPhone, 32),
      promptPayNumber: text(body.promptPayNumber, 32),
      address: text(body.address, MAX_TEXT, 'ศูนย์อาหาร'),
      priceRange: ['฿', '฿฿', '฿฿฿'].includes(body.priceRange) ? body.priceRange : '฿',
      averageWaitMinutes: Math.min(Math.max(Number(body.averageWaitMinutes) || 10, 1), 180),
      tags: (Array.isArray(body.tags) ? body.tags : [])
        .map((tag) => text(tag, 40))
        .filter(Boolean)
        .slice(0, 8),
      logo,
      coverImage,
      image,
      rating: 5,
      reviewCount: 0,
      currentQueueCount: 0,
      isOpen: true,
      featuredMenuIds: [],
      createdAt: now,
      updatedAt: now
    };

    const menuItems = [];
    for (const [index, item] of rawMenu.entries()) {
      const itemName = text(item?.name, MAX_NAME);
      const satang = priceInSatang(item?.price);
      if (!itemName || satang === null) continue;

      const menuId = `menu-${storeId}-${index}`;
      menuItems.push({
        id: menuId,
        storeId,
        storeName: store.name,
        name: itemName,
        nameEn: text(item?.nameEn, MAX_NAME, itemName),
        description: text(item?.description, MAX_TEXT, 'เมนูแนะนำของร้าน'),
        category,
        price: satang / 100,
        priceSatang: satang,
        image: httpsUrl(item?.image, store.image),
        isAvailable: true,
        preparationMinutes: Math.min(Math.max(Number(item?.preparationMinutes) || 10, 1), 180),
        rating: 5,
        orderCount: 0,
        tags: ['เมนูแนะนำ'],
        createdAt: now,
        updatedAt: now
      });
    }
    store.featuredMenuIds = menuItems.map((item) => item.id);

    const batch = adminDb.batch();
    batch.set(adminDb.collection('stores').doc(storeId), store);
    for (const item of menuItems) {
      batch.set(adminDb.collection('menu_items').doc(item.id), item);
    }
    await batch.commit();

    console.log(`[Store API] ${req.user.uid} opened ${storeId} with ${menuItems.length} menu item(s).`);

    return res.status(201).json({ success: true, store, menuItems });
  } catch (err) {
    console.error('[Store API] Create store error:', err);
    return res.status(500).json({
      success: false,
      error: 'STORE_CREATE_FAILED',
      message: err.message
    });
  }
});

/**
 * GET /api/stores/mine
 * The shops this account owns, so a returning merchant lands somewhere real
 * rather than on whatever the browser happened to keep.
 */
storeRouter.get('/mine', authenticate, async (req, res) => {
  try {
    const snap = await adminDb.collection('stores')
      .where('ownerId', '==', req.user.uid)
      .get();
    const stores = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.status(200).json({ success: true, stores });
  } catch (err) {
    console.error('[Store API] List own stores error:', err);
    return res.status(500).json({ success: false, error: 'STORE_LIST_FAILED', message: err.message });
  }
});
