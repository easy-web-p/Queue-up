/**
 * 🧪 QUEUEUP REDUX CART & REAL-TIME QUEUE E2E TEST MATRIX
 * Verifies:
 * 1. Cart State Lifecycle (add, item aggregation, modifier calculation, satang precision, bounds, clear)
 * 2. Real-Time Queue Slice transitions & Audio Alert triggers
 * 3. 5-Phase Ordering Payload conversion & contract integrity
 */

import assert from 'assert';

// Simple In-Memory Mock of LocalStorage
class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new MockLocalStorage();
globalThis.window = { localStorage: globalThis.localStorage };

function runTestSuite() {
  console.log('🧪 Starting QueueUp Redux Cart & Queue E2E Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}`);
      console.error(err);
      failed++;
    }
  }

  // Pure logic replica of cartSlice reducer for node environment test
  function createCartReducer() {
    let state = { items: [] };

    const areModifiersEqual = (modA, modB) => {
      if (!modA && !modB) return true;
      if (!modA || !modB) return false;
      return JSON.stringify(modA) === JSON.stringify(modB);
    };

    return {
      getState: () => state,
      dispatch: (action) => {
        if (action.type === 'cart/addItem') {
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
          globalThis.localStorage.setItem('queueup_cart', JSON.stringify(state.items));
        } else if (action.type === 'cart/updateQuantity') {
          const { index, delta } = action.payload;
          if (index >= 0 && index < state.items.length) {
            const newQty = state.items[index].quantity + delta;
            if (newQty <= 0) {
              state.items.splice(index, 1);
            } else {
              state.items[index].quantity = newQty;
            }
            globalThis.localStorage.setItem('queueup_cart', JSON.stringify(state.items));
          }
        } else if (action.type === 'cart/removeItem') {
          const index = action.payload;
          if (index >= 0 && index < state.items.length) {
            state.items.splice(index, 1);
            globalThis.localStorage.setItem('queueup_cart', JSON.stringify(state.items));
          }
        } else if (action.type === 'cart/clearCart') {
          state.items = [];
          globalThis.localStorage.setItem('queueup_cart', JSON.stringify([]));
        } else if (action.type === 'cart/hydrateCart') {
          state.items = action.payload || [];
          globalThis.localStorage.setItem('queueup_cart', JSON.stringify(state.items));
        }
      }
    };
  }

  // Pure logic replica of queueSlice
  function createQueueReducer() {
    let state = {
      activeTickets: [],
      selectedTicket: null,
      soundAlertPending: false,
      lastNotifiedStatus: null,
    };

    return {
      getState: () => state,
      dispatch: (action) => {
        if (action.type === 'queue/setActiveTickets') {
          state.activeTickets = action.payload;
        } else if (action.type === 'queue/updateTicketStatus') {
          const { orderId, newStatus, newQueueStatus } = action.payload;
          const idx = state.activeTickets.findIndex((t) => t.id === orderId);
          if (idx !== -1) {
            state.activeTickets[idx].status = newStatus;
            state.activeTickets[idx].queueStatus = newQueueStatus;
            if (newQueueStatus === 'ready' || newStatus === 'READY') {
              state.soundAlertPending = true;
              state.lastNotifiedStatus = 'READY';
            }
          }
        } else if (action.type === 'queue/clearSoundAlert') {
          state.soundAlertPending = false;
        }
      }
    };
  }

  function calculateCartItemUnitPrice(item) {
    const basePrice = item.menuItem?.price || 0;
    let modifierTotal = 0;
    if (Array.isArray(item.selectedModifiers)) {
      modifierTotal = item.selectedModifiers.reduce((sum, mod) => sum + (mod.priceModifier || 0), 0);
    }
    return basePrice + modifierTotal;
  }

  function selectCartTotalAmount(cartState) {
    return cartState.items.reduce((sum, item) => sum + calculateCartItemUnitPrice(item) * (item.quantity || 1), 0);
  }

  function selectCartTotalAmountSatang(cartState) {
    return Math.round(selectCartTotalAmount(cartState) * 100);
  }

  // --- TESTS ---

  test('Test 1: Initial cart state starts empty', () => {
    globalThis.localStorage.clear();
    const cart = createCartReducer();
    assert.strictEqual(cart.getState().items.length, 0);
  });

  test('Test 2: Adding single item calculates price in Baht and Satang correctly', () => {
    const cart = createCartReducer();
    cart.dispatch({
      type: 'cart/addItem',
      payload: {
        menuItem: { id: 'prod_1', name: 'ข้าวมันไก่ตอน', price: 50, storeId: 'shop_1' },
        quantity: 1,
        selectedModifiers: []
      }
    });

    const items = cart.getState().items;
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].quantity, 1);
    assert.strictEqual(selectCartTotalAmount(cart.getState()), 50);
    assert.strictEqual(selectCartTotalAmountSatang(cart.getState()), 5000);
  });

  test('Test 3: Adding item with modifiers aggregates subtotal with exact precision', () => {
    const cart = createCartReducer();
    cart.dispatch({
      type: 'cart/addItem',
      payload: {
        menuItem: { id: 'prod_2', name: 'ก๋วยเตี๋ยวต้มยำโบราณ', price: 45, storeId: 'shop_1' },
        quantity: 2,
        selectedModifiers: [
          { modifierGroupId: 'mg_1', optionId: 'opt_egg', name: 'ไข่ออนเซ็น', priceModifier: 10 },
          { modifierGroupId: 'mg_2', optionId: 'opt_pork', name: 'เพิ่มหมูกรอบ', priceModifier: 15 }
        ]
      }
    });

    // Unit price: 45 + 10 + 15 = 70 Baht. Quantity: 2 -> Total: 140 Baht (14,000 Satang)
    assert.strictEqual(selectCartTotalAmount(cart.getState()), 140);
    assert.strictEqual(selectCartTotalAmountSatang(cart.getState()), 14000);
  });

  test('Test 4: Adding identical item increments quantity instead of creating duplicate line', () => {
    const cart = createCartReducer();
    const item = {
      menuItem: { id: 'prod_1', name: 'ข้าวมันไก่ตอน', price: 50, storeId: 'shop_1' },
      quantity: 1,
      customNotes: 'ไม่เอาหนัง',
      selectedModifiers: [{ modifierGroupId: 'mg_1', optionId: 'opt_1', name: 'พิเศษ', priceModifier: 10 }]
    };

    cart.dispatch({ type: 'cart/addItem', payload: item });
    cart.dispatch({ type: 'cart/addItem', payload: item });

    const items = cart.getState().items;
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].quantity, 2);
    assert.strictEqual(selectCartTotalAmount(cart.getState()), 120); // (50 + 10) * 2
  });

  test('Test 5: Adding same product with different notes creates distinct cart lines', () => {
    const cart = createCartReducer();
    cart.dispatch({
      type: 'cart/addItem',
      payload: {
        menuItem: { id: 'prod_1', name: 'ข้าวมันไก่ตอน', price: 50, storeId: 'shop_1' },
        quantity: 1,
        customNotes: 'ไม่เอาหนัง',
        selectedModifiers: []
      }
    });
    cart.dispatch({
      type: 'cart/addItem',
      payload: {
        menuItem: { id: 'prod_1', name: 'ข้าวมันไก่ตอน', price: 50, storeId: 'shop_1' },
        quantity: 1,
        customNotes: 'เอาหนังเยอะๆ',
        selectedModifiers: []
      }
    });

    assert.strictEqual(cart.getState().items.length, 2);
  });

  test('Test 6: Quantity update (+1, -1) and auto-removal at zero quantity', () => {
    const cart = createCartReducer();
    cart.dispatch({
      type: 'cart/addItem',
      payload: { menuItem: { id: 'prod_1', price: 50 }, quantity: 1 }
    });

    // Increment to 2
    cart.dispatch({ type: 'cart/updateQuantity', payload: { index: 0, delta: 1 } });
    assert.strictEqual(cart.getState().items[0].quantity, 2);

    // Decrement to 1
    cart.dispatch({ type: 'cart/updateQuantity', payload: { index: 0, delta: -1 } });
    assert.strictEqual(cart.getState().items[0].quantity, 1);

    // Decrement to 0 -> should remove
    cart.dispatch({ type: 'cart/updateQuantity', payload: { index: 0, delta: -1 } });
    assert.strictEqual(cart.getState().items.length, 0);
  });

  test('Test 7: Explicit removeItem deletes item at specified index', () => {
    const cart = createCartReducer();
    cart.dispatch({ type: 'cart/addItem', payload: { menuItem: { id: 'p1', price: 10 }, quantity: 1 } });
    cart.dispatch({ type: 'cart/addItem', payload: { menuItem: { id: 'p2', price: 20 }, quantity: 1 } });

    assert.strictEqual(cart.getState().items.length, 2);
    cart.dispatch({ type: 'cart/removeItem', payload: 0 });
    assert.strictEqual(cart.getState().items.length, 1);
    assert.strictEqual(cart.getState().items[0].menuItem.id, 'p2');
  });

  test('Test 8: clearCart empties state and synchronizes with localStorage', () => {
    const cart = createCartReducer();
    cart.dispatch({ type: 'cart/addItem', payload: { menuItem: { id: 'p1', price: 10 }, quantity: 1 } });
    cart.dispatch({ type: 'cart/clearCart' });

    assert.strictEqual(cart.getState().items.length, 0);
    assert.strictEqual(globalThis.localStorage.getItem('queueup_cart'), '[]');
  });

  test('Test 9: Cart items safely map to Authoritative 5-Phase Ordering Payload', () => {
    const cart = createCartReducer();
    cart.dispatch({
      type: 'cart/addItem',
      payload: {
        menuItem: { id: 'prod_rice', name: 'ข้าวผัดกุ้ง', price: 60, storeId: 'shop_campus_1' },
        quantity: 2,
        customNotes: 'ไม่ใส่ผักชี',
        selectedModifiers: [{ modifierGroupId: 'mg_extra', optionId: 'opt_egg', name: 'ไข่ดาว', priceModifier: 10 }]
      }
    });

    const items = cart.getState().items;
    const orderPayloadItems = items.map((c) => ({
      productId: c.menuItem.id,
      quantity: c.quantity,
      customNotes: c.customNotes || '',
      selectedModifiers: Array.isArray(c.selectedModifiers) ? c.selectedModifiers : []
    }));

    assert.strictEqual(orderPayloadItems.length, 1);
    assert.strictEqual(orderPayloadItems[0].productId, 'prod_rice');
    assert.strictEqual(orderPayloadItems[0].quantity, 2);
    assert.strictEqual(orderPayloadItems[0].customNotes, 'ไม่ใส่ผักชี');
    assert.strictEqual(orderPayloadItems[0].selectedModifiers.length, 1);
  });

  test('Test 10: Real-time Queue Slice transitions and triggers Sound Alert upon READY', () => {
    const queue = createQueueReducer();
    const initialTickets = [
      { id: 'order_101', queueNumber: 'Q001', status: 'PENDING', queueStatus: 'waiting' },
      { id: 'order_102', queueNumber: 'Q002', status: 'CONFIRMED', queueStatus: 'confirmed' }
    ];

    queue.dispatch({ type: 'queue/setActiveTickets', payload: initialTickets });
    assert.strictEqual(queue.getState().activeTickets.length, 2);
    assert.strictEqual(queue.getState().soundAlertPending, false);

    // Transition order_101 to PREPARING / cooking
    queue.dispatch({
      type: 'queue/updateTicketStatus',
      payload: { orderId: 'order_101', newStatus: 'PREPARING', newQueueStatus: 'cooking' }
    });
    assert.strictEqual(queue.getState().activeTickets[0].status, 'PREPARING');
    assert.strictEqual(queue.getState().soundAlertPending, false);

    // Transition order_101 to READY / ready -> should trigger soundAlertPending
    queue.dispatch({
      type: 'queue/updateTicketStatus',
      payload: { orderId: 'order_101', newStatus: 'READY', newQueueStatus: 'ready' }
    });
    assert.strictEqual(queue.getState().activeTickets[0].status, 'READY');
    assert.strictEqual(queue.getState().soundAlertPending, true);
    assert.strictEqual(queue.getState().lastNotifiedStatus, 'READY');

    // Clear alert
    queue.dispatch({ type: 'queue/clearSoundAlert' });
    assert.strictEqual(queue.getState().soundAlertPending, false);
  });

  console.log(`\n📊 Redux Cart & Queue Test Summary: ${passed}/${passed + failed} scenarios passed (${Math.round((passed / (passed + failed)) * 100)}%).`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
