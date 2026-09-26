/**
 * LocalStorage Service for QueueUp
 * Enforces production persistence policy:
 * - Only non-sensitive client state is allowed in LocalStorage (Cart draft, theme, locale, canteen).
 * - SENSITIVE DATA (Auth tokens, full profiles, payment states, orders) IS STRICTLY FORBIDDEN.
 */

export interface CartDraftItem {
  menuItemId: string;
  storeId: string;
  name: string; // for UI display while drafting
  image?: string;
  quantity: number;
  selectedOptions: {
    groupName: string;
    choiceName: string;
    priceDelta: number;
  }[];
  specialNote?: string;
  addedAt: number; // timestamp ms
}

export interface CartDraft {
  storeId: string | null;
  items: CartDraftItem[];
  updatedAt: number; // timestamp ms
}

const CART_STORAGE_KEY = 'queueup_cart_v2';
const CART_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const cartStorage = {
  /**
   * Load draft cart from LocalStorage, automatically purging if expired (> 7 days)
   */
  getCart(): CartDraft {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return { storeId: null, items: [], updatedAt: Date.now() };

      const parsed: CartDraft = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) {
        this.clearCart();
        return { storeId: null, items: [], updatedAt: Date.now() };
      }

      // Check 7-day TTL expiry
      if (Date.now() - (parsed.updatedAt || 0) > CART_TTL_MS) {
        console.info('[CartStorage] Draft cart expired (> 7 days), clearing cache.');
        this.clearCart();
        return { storeId: null, items: [], updatedAt: Date.now() };
      }

      return parsed;
    } catch (err) {
      console.warn('[CartStorage] Failed to parse cart draft:', err);
      this.clearCart();
      return { storeId: null, items: [], updatedAt: Date.now() };
    }
  },

  /**
   * Save draft cart to LocalStorage
   */
  saveCart(storeId: string | null, items: CartDraftItem[]): void {
    try {
      const draft: CartDraft = {
        storeId,
        items,
        updatedAt: Date.now()
      };
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(draft));
    } catch (err) {
      console.warn('[CartStorage] Failed to save cart draft:', err);
    }
  },

  /**
   * Clear draft cart
   */
  clearCart(): void {
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {
      // ignore
    }
  },

  /**
   * Prepare order payload for API
   * Strips any untrusted client-side price or calculations.
   */
  toOrderPayload(items: CartDraftItem[]) {
    return items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      selectedOptions: item.selectedOptions,
      specialNote: item.specialNote || ''
    }));
  }
};
