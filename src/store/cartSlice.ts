import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CartItem, SelectedModifierOption } from '../types';

export interface CartState {
  items: CartItem[];
}

const CART_STORAGE_KEY = 'queueup_cart';

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Failed to load cart from localStorage:', err);
    return [];
  }
};

const saveCartToStorage = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.warn('Failed to save cart to localStorage:', err);
  }
};

const areModifiersEqual = (
  modA?: SelectedModifierOption[] | Record<string, string | string[]>,
  modB?: SelectedModifierOption[] | Record<string, string | string[]>
): boolean => {
  if (!modA && !modB) return true;
  if (!modA || !modB) return false;
  return JSON.stringify(modA) === JSON.stringify(modB);
};

const initialState: CartState = {
  items: loadCartFromStorage(),
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (state, action: PayloadAction<CartItem>) => {
      const newItem = action.payload;
      const existingIdx = state.items.findIndex(
        (item) =>
          item.menuItem?.id === newItem.menuItem?.id &&
          (item.customNotes || '') === (newItem.customNotes || '') &&
          areModifiersEqual(item.selectedModifiers, newItem.selectedModifiers)
      );

      if (existingIdx !== -1) {
        state.items[existingIdx].quantity += newItem.quantity || 1;
      } else {
        state.items.push({
          ...newItem,
          quantity: newItem.quantity || 1,
        });
      }
      saveCartToStorage(state.items);
    },

    updateQuantity: (state, action: PayloadAction<{ index: number; delta: number }>) => {
      const { index, delta } = action.payload;
      if (index >= 0 && index < state.items.length) {
        const newQty = state.items[index].quantity + delta;
        if (newQty <= 0) {
          state.items.splice(index, 1);
        } else {
          state.items[index].quantity = newQty;
        }
        saveCartToStorage(state.items);
      }
    },

    removeItem: (state, action: PayloadAction<number>) => {
      const index = action.payload;
      if (index >= 0 && index < state.items.length) {
        state.items.splice(index, 1);
        saveCartToStorage(state.items);
      }
    },

    clearCart: (state) => {
      state.items = [];
      saveCartToStorage([]);
    },

    hydrateCart: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload || [];
      saveCartToStorage(state.items);
    },
  },
});

export const { addItem, updateQuantity, removeItem, clearCart, hydrateCart } = cartSlice.actions;

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;

export const selectCartTotalCount = (state: { cart: CartState }) =>
  state.cart.items.reduce((sum, item) => sum + (item.quantity || 1), 0);

export const calculateCartItemUnitPrice = (item: CartItem): number => {
  const basePrice = item.menuItem?.price || 0;
  let modifierTotal = 0;
  if (Array.isArray(item.selectedModifiers)) {
    modifierTotal = item.selectedModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
  }
  return basePrice + modifierTotal;
};

export const selectCartTotalAmount = (state: { cart: CartState }) =>
  state.cart.items.reduce((sum, item) => sum + calculateCartItemUnitPrice(item) * (item.quantity || 1), 0);

export const selectCartTotalAmountSatang = (state: { cart: CartState }) =>
  Math.round(selectCartTotalAmount(state) * 100);

export const selectCartStoreId = (state: { cart: CartState }) =>
  state.cart.items.length > 0 ? state.cart.items[0].menuItem?.storeId || '' : '';

export default cartSlice.reducer;
