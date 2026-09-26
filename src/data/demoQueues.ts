import { FoodItem, QueueOrder, Store } from '../types';

/**
 * Sample kitchen-display orders.
 *
 * A merchant opening the KDS for a brand new store would otherwise see an empty
 * board with nothing to try the workflow against. Pure demo data: it lived
 * inline in QueueProvider and accounted for roughly 100 lines of it.
 */
export function buildDemoQueues(
  targetStore: Store,
  storeFoodList: FoodItem[],
  storeId: string
): QueueOrder[] {
    return [
    {
      id: `demo-q-${Date.now()}-1`,
      queueNumber: `Q-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(10 + Math.random() * 90)}`,
      storeId: targetStore.id,
      storeName: targetStore.name,
      storeLogo: targetStore.logo,
      customerName: 'สมชาย ใจดี (นักศึกษา)',
      customerPhone: '081-234-5678',
      pickupTime: '12:15 น.',
      estimatedCompletionTime: '12:15',
      paymentMethod: 'promptpay',
      paymentStatus: 'PENDING',
      status: 'PAYMENT_PENDING',
      exchangePin: '4192',
      specialNote: 'ขอเผ็ดน้อย ไม่ใส่ชูรสครับ',
      createdAt: new Date(Date.now() - 3 * 60000).toISOString(),
      items: [
        {
          cartItemId: `item-${Date.now()}-1`,
          food: storeFoodList[0],
          quantity: 1,
          selectedOptions: [],
          specialNote: 'ขอเผ็ดน้อย ไม่ใส่ชูรสครับ',
          subtotal: storeFoodList[0].price
        }
      ],
      subtotal: storeFoodList[0].price,
      discount: 0,
      total: storeFoodList[0].price
    },
    {
      id: `demo-q-${Date.now()}-2`,
      queueNumber: `Q-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(10 + Math.random() * 90)}`,
      storeId: targetStore.id,
      storeName: targetStore.name,
      storeLogo: targetStore.logo,
      customerName: 'นริศรา มีสุข (อาจารย์)',
      customerPhone: '089-765-4321',
      pickupTime: '12:20 น.',
      estimatedCompletionTime: '12:20',
      paymentMethod: 'promptpay',
      paymentStatus: 'PAID',
      status: 'PREPARING',
      exchangePin: '8210',
      specialNote: 'แยกน้ำซุปให้ด้วยนะคะ ขอบคุณค่ะ',
      createdAt: new Date(Date.now() - 8 * 60000).toISOString(),
      items: [
        {
          cartItemId: `item-${Date.now()}-2`,
          food: storeFoodList[0],
          quantity: 2,
          selectedOptions: [],
          specialNote: '',
          subtotal: storeFoodList[0].price * 2
        },
        ...(storeFoodList[1] ? [{
          cartItemId: `item-${Date.now()}-3`,
          food: storeFoodList[1],
          quantity: 1,
          selectedOptions: [],
          specialNote: '',
          subtotal: storeFoodList[1].price
        }] : [])
      ],
      subtotal: storeFoodList[0].price * 2 + (storeFoodList[1]?.price || 0),
      discount: 0,
      total: storeFoodList[0].price * 2 + (storeFoodList[1]?.price || 0)
    },
    {
      id: `demo-q-${Date.now()}-3`,
      queueNumber: `Q-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${Math.floor(10 + Math.random() * 90)}`,
      storeId: targetStore.id,
      storeName: targetStore.name,
      storeLogo: targetStore.logo,
      customerName: 'ธนวัฒน์ พัฒนกิจ',
      customerPhone: '086-555-1234',
      pickupTime: '12:05 น.',
      estimatedCompletionTime: '12:05',
      paymentMethod: 'credit_card',
      paymentStatus: 'PAID',
      status: 'READY',
      exchangePin: '1904',
      createdAt: new Date(Date.now() - 14 * 60000).toISOString(),
      items: [
        {
          cartItemId: `item-${Date.now()}-4`,
          food: storeFoodList[0],
          quantity: 1,
          selectedOptions: [],
          specialNote: '',
          subtotal: storeFoodList[0].price
        }
      ],
      subtotal: storeFoodList[0].price,
      discount: 0,
      total: storeFoodList[0].price
    }
  ];
}
