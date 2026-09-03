/**
 * 📦 QueueUp Catalog Service (Wave 4.2.1)
 * Store-Isolated Catalog & Profile Management adhering strictly to Firestore Rules.
 */

import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  type Firestore
} from 'firebase/firestore';
import type { MenuItem, MenuCategory, ModifierGroup } from '../types';

/**
 * 🏪 1. STORE PROFILE & OPERATING HOURS
 */

export interface UpdateShopOperationalData {
  name?: string;
  description?: string;
  location?: string;
  hours?: string;
  isOpen?: boolean;
  contactPhone?: string;
  logoUrl?: string;
  bannerUrl?: string;
  operatingHours?: Record<string, { open: string; close: string; isOpen: boolean }>;
  operationalOverride?: {
    isPaused: boolean;
    pausedReason?: string;
    pauseUntil?: number;
    isRushMode: boolean;
    rushBufferMinutes: number;
  };
  capacityConfig?: {
    defaultSlotDurationMinutes: number;
    maxOrdersPerSlot: number;
    autoCloseWhenCapacityFull: boolean;
  };
  slotCapacity?: number;
  maxOrdersPerSlot?: number;
  pickupSlots?: string[];
}

/**
 * Update shop operational profile adhering strictly to allowed fields.
 * Admin-controlled fields (status, rating, reviewsCount, ownerUid) are strictly excluded.
 */
export async function updateStoreOperationalProfile(
  db: Firestore,
  storeId: string,
  updateData: UpdateShopOperationalData
) {
  if (!storeId) throw new Error('storeId is required');

  const cleanData: Record<string, unknown> = {
    updatedAt: serverTimestamp()
  };

  const ALLOWED_KEYS: (keyof UpdateShopOperationalData)[] = [
    'name',
    'description',
    'location',
    'hours',
    'isOpen',
    'contactPhone',
    'logoUrl',
    'bannerUrl',
    'operatingHours',
    'operationalOverride',
    'capacityConfig',
    'slotCapacity',
    'maxOrdersPerSlot',
    'pickupSlots'
  ];

  for (const key of ALLOWED_KEYS) {
    if (updateData[key] !== undefined) {
      cleanData[key] = updateData[key];
    }
  }

  const shopRef = doc(db, 'shops', storeId);
  await updateDoc(shopRef, cleanData);
  return { success: true, storeId };
}

/**
 * 🏷️ 2. FOOD CATEGORIES (Store Isolated)
 */

export async function fetchStoreCategories(db: Firestore, storeId: string): Promise<MenuCategory[]> {
  const categoriesRef = collection(db, 'food_categories');
  const q = query(categoriesRef, where('storeId', '==', storeId));
  const snap = await getDocs(q);

  const categories: MenuCategory[] = [];
  snap.forEach((d) => {
    categories.push({ id: d.id, ...d.data() } as MenuCategory);
  });
  return categories;
}

export async function createStoreCategory(
  db: Firestore,
  storeId: string,
  categoryData: { name: string; icon?: string; displayOrder?: number }
): Promise<MenuCategory> {
  if (!storeId) throw new Error('storeId is required');
  if (!categoryData.name || !categoryData.name.trim()) throw new Error('Category name is required');

  const catRef = doc(collection(db, 'food_categories'));
  const newCat: MenuCategory = {
    id: catRef.id,
    storeId,
    name: categoryData.name.trim(),
    icon: categoryData.icon || 'utensils',
    displayOrder: categoryData.displayOrder ?? 0,
    isActive: true
  };

  await setDoc(catRef, {
    ...newCat,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newCat;
}

/**
 * 🍲 3. PRODUCTS & MENU ITEMS (Store Isolated & Satang Integer)
 */

export async function fetchStoreProducts(db: Firestore, storeId: string): Promise<MenuItem[]> {
  const productsRef = collection(db, 'products');
  const q = query(productsRef, where('storeId', '==', storeId));
  const snap = await getDocs(q);

  const items: MenuItem[] = [];
  snap.forEach((d) => {
    items.push({ id: d.id, ...d.data() } as MenuItem);
  });
  return items;
}

export async function createStoreProduct(
  db: Firestore,
  storeId: string,
  productData: Omit<MenuItem, 'id' | 'storeId'>
): Promise<MenuItem> {
  if (!storeId) throw new Error('storeId is required');
  if (!productData.name || !productData.name.trim()) throw new Error('Product name is required');

  const priceBaht = Number(productData.price);
  if (!Number.isFinite(priceBaht) || priceBaht <= 0) {
    throw new Error('Price must be a positive number');
  }

  const priceSatang = productData.priceSatang ?? Math.round(priceBaht * 100);
  const stock = typeof productData.stock === 'number' ? Math.max(0, productData.stock) : 20;

  const prodRef = doc(collection(db, 'products'));
  const newProduct: MenuItem = {
    ...productData,
    id: prodRef.id,
    storeId,
    name: productData.name.trim(),
    price: priceBaht,
    priceSatang,
    stock,
    isAvailable: productData.isAvailable ?? true,
    modifierGroupIds: productData.modifierGroupIds || []
  };

  await setDoc(prodRef, {
    ...newProduct,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newProduct;
}

export async function updateStoreProduct(
  db: Firestore,
  storeId: string,
  productId: string,
  updates: Partial<Omit<MenuItem, 'id' | 'storeId'>>
) {
  if (!storeId || !productId) throw new Error('storeId and productId are required');

  const cleanUpdates: Record<string, unknown> = {
    updatedAt: serverTimestamp()
  };

  if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
  if (updates.category !== undefined) cleanUpdates.category = updates.category;
  if (updates.categoryId !== undefined) cleanUpdates.categoryId = updates.categoryId;
  if (updates.description !== undefined) cleanUpdates.description = updates.description;
  if (updates.imageUrl !== undefined || updates.image !== undefined) {
    cleanUpdates.imageUrl = updates.imageUrl || updates.image;
  }
  if (updates.isAvailable !== undefined) cleanUpdates.isAvailable = Boolean(updates.isAvailable);
  if (updates.stock !== undefined) {
    cleanUpdates.stock = Math.max(0, Number(updates.stock));
  }
  if (updates.price !== undefined) {
    const p = Number(updates.price);
    if (p <= 0) throw new Error('Price must be positive');
    cleanUpdates.price = p;
    cleanUpdates.priceSatang = Math.round(p * 100);
  }
  if (updates.modifierGroupIds !== undefined) {
    cleanUpdates.modifierGroupIds = updates.modifierGroupIds;
  }

  const prodRef = doc(db, 'products', productId);
  await updateDoc(prodRef, cleanUpdates);
  return { success: true, productId };
}

export async function deleteStoreProduct(db: Firestore, productId: string) {
  const prodRef = doc(db, 'products', productId);
  await deleteDoc(prodRef);
  return { success: true, productId };
}

/**
 * 🧩 4. MODIFIER GROUPS (Normalized Store Isolated Options)
 */

export async function fetchStoreModifierGroups(db: Firestore, storeId: string): Promise<ModifierGroup[]> {
  const modRef = collection(db, 'modifier_groups');
  const q = query(modRef, where('storeId', '==', storeId));
  const snap = await getDocs(q);

  const groups: ModifierGroup[] = [];
  snap.forEach((d) => {
    groups.push({ id: d.id, ...d.data() } as ModifierGroup);
  });
  return groups;
}

export async function createStoreModifierGroup(
  db: Firestore,
  storeId: string,
  modData: Omit<ModifierGroup, 'id' | 'storeId'>
): Promise<ModifierGroup> {
  if (!storeId) throw new Error('storeId is required');
  if (!modData.name || !modData.name.trim()) throw new Error('Modifier group name is required');

  const modRef = doc(collection(db, 'modifier_groups'));
  const newGroup: ModifierGroup = {
    ...modData,
    id: modRef.id,
    storeId,
    name: modData.name.trim(),
    isRequired: Boolean(modData.isRequired),
    selectionType: modData.selectionType || 'single',
    options: (modData.options || []).map((opt) => ({
      ...opt,
      priceModifier: Number(opt.priceModifier) || 0,
      priceModifierSatang: opt.priceModifierSatang ?? Math.round((Number(opt.priceModifier) || 0) * 100),
      isOutOfStock: Boolean(opt.isOutOfStock)
    }))
  };

  await setDoc(modRef, {
    ...newGroup,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newGroup;
}
