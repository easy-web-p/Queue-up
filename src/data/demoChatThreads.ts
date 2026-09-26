import { StoreCustomerChatThread } from '../types';

/**
 * Sample merchant inbox conversations.
 *
 * Shown in the merchant chat views for a store that has no real threads yet, so
 * the inbox demonstrates what it will look like rather than opening empty. Pure
 * presentation data: it lived inline in QueueProvider and accounted for roughly
 * 240 lines of it.
 */
export function buildDemoCustomerThreads(
  storeId: string,
  storeName?: string
): StoreCustomerChatThread[] {
  return [
      {
        id: `th-${storeId}-1`,
        storeId,
        customerId: 'cust-101',
        customerName: 'คุณธนพล ศรีวิชัย',
        customerPhone: '081-234-5678',
        customerAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        queueNumber: 'A01',
        orderSummary: 'ข้าวกะเพราถาดเนื้อโคขุน 1 จาน + ไข่ดาวกรอบ',
        orderTotal: 119,
        orderStatus: 'กำลังปรุง',
        lastMessage: 'ขอพริกน้ำปลาถ้วยเล็กเพิ่มด้วยนะครับ ขอบคุณครับ',
        lastTimestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        unreadCount: 1,
        messages: [
          {
            id: `m-${storeId}-1`,
            senderRole: 'customer',
            senderName: 'คุณธนพล ศรีวิชัย',
            message: 'สวัสดีครับ สั่งออเดอร์คิว #A01 ไปแล้วครับ',
            timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-2`,
            senderRole: 'customer',
            senderName: 'คุณธนพล ศรีวิชัย',
            message: 'ขอพริกน้ำปลาถ้วยเล็กเพิ่มด้วยนะครับ ขอบคุณครับ',
            timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            read: false
          }
        ]
      },
      {
        id: `th-${storeId}-2`,
        storeId,
        customerId: 'cust-102',
        customerName: 'คุณสุดารัตน์ พรหมมา',
        customerPhone: '089-876-5432',
        customerAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        queueNumber: 'A03',
        orderSummary: 'ข้าวหมูกรอบคั่วพริกเกลือ 2 กล่อง',
        orderTotal: 178,
        orderStatus: 'รอคิว',
        lastMessage: 'ขอบคุณมากครับ เดี๋ยวรีบเดินไปรับครับ',
        lastTimestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        unreadCount: 0,
        messages: [
          {
            id: `m-${storeId}-3`,
            senderRole: 'customer',
            senderName: 'คุณสุดารัตน์ พรหมมา',
            message: 'สอบถามครับ คิว #A03 ใช้เวลาปรุงประมาณกี่นาทีครับ พอดีกำลังเดินมาจากตึกเรียน',
            timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-4`,
            senderRole: 'merchant',
            senderName: storeName || 'ร้านค้า',
            message: 'สวัสดีครับคุณสุดารัตน์ ประมาณ 8-10 นาทีพร้อมรับครับผม เดี๋ยวพอเสร็จแล้วระบบจะแจ้งเตือนให้ครับ',
            timestamp: new Date(Date.now() - 37 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-5`,
            senderRole: 'customer',
            senderName: 'คุณสุดารัตน์ พรหมมา',
            message: 'ขอบคุณมากครับ เดี๋ยวรีบเดินไปรับครับ',
            timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
            read: true
          }
        ]
      },
      {
        id: `th-${storeId}-3`,
        storeId,
        customerId: 'cust-103',
        customerName: 'คุณเอกภพ ดิลก (จองอาหารล่วงหน้า)',
        customerPhone: '092-445-1234',
        customerAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
        orderSummary: 'แจ้งจองอาหาร 5 กล่อง นัดรับ 12:30 น.',
        orderTotal: 450,
        orderStatus: 'รอการยืนยัน',
        lastMessage: 'สวัสดีครับคุณเจ้าของร้าน อยากสั่งจองอาหารล่วงหน้า 5 กล่อง ไปรับช่วง 12:30 น. วันนี้ครับ รบกวนยืนยันให้หน่อยครับ',
        lastTimestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
        unreadCount: 1,
        messages: [
          {
            id: `m-${storeId}-6`,
            senderRole: 'customer',
            senderName: 'คุณเอกภพ ดิลก',
            message: 'สวัสดีครับคุณเจ้าของร้าน อยากสั่งจองอาหารล่วงหน้า 5 กล่อง ไปรับช่วง 12:30 น. วันนี้ครับ รบกวนยืนยันให้หน่อยครับ',
            timestamp: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
            read: false
          }
        ]
      },
      {
        id: `th-${storeId}-4`,
        storeId,
        customerId: 'cust-104',
        customerName: 'คุณเมทินี ชัยเรือง',
        customerPhone: '086-112-8899',
        customerAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        queueNumber: 'A07',
        orderSummary: 'ต้มยำกุ้งน้ำข้น 1 ชาม + ข้าวสวย',
        orderTotal: 145,
        orderStatus: 'พร้อมรับ',
        lastMessage: 'ขอบคุณมากเลยค่ะ บริการดีมาก',
        lastTimestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
        unreadCount: 0,
        messages: [
          {
            id: `m-${storeId}-7`,
            senderRole: 'customer',
            senderName: 'คุณเมทินี ชัยเรือง',
            message: 'ขอไม่ใส่ผักชีและเห็ดฟางนะคะ พอดีแพ้เห็ดค่ะ รบกวนด้วยนะคะ',
            timestamp: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-8`,
            senderRole: 'merchant',
            senderName: storeName || 'ร้านค้า',
            message: 'รับทราบครับ ทางร้านแยกภาชนะและไม่ใส่เห็ดให้เรียบร้อยครับผม ปรุงสดสะอาดปลอดภัยแน่นอนครับ',
            timestamp: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-9`,
            senderRole: 'customer',
            senderName: 'คุณเมทินี ชัยเรือง',
            message: 'ขอบคุณมากเลยค่ะ บริการดีมาก',
            timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
            read: true
          }
        ]
      },
      {
        id: `th-${storeId}-5`,
        storeId,
        customerId: 'cust-105',
        customerName: 'คุณกิตติศักดิ์ เจริญกิจ',
        customerPhone: '095-778-9900',
        customerAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        orderSummary: 'สอบถามข้อมูลทั่วไป',
        orderStatus: 'ลูกค้าทั่วไป',
        lastMessage: 'วันนี้ที่ร้านมีเมนูพิเศษไหมครับ หรือร้านเปิดถึงกี่โมงครับ พอดีจะแวะไปช่วงเย็น',
        lastTimestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
        unreadCount: 1,
        messages: [
          {
            id: `m-${storeId}-10`,
            senderRole: 'customer',
            senderName: 'คุณกิตติศักดิ์ เจริญกิจ',
            message: 'วันนี้ที่ร้านมีเมนูพิเศษไหมครับ หรือร้านเปิดถึงกี่โมงครับ พอดีจะแวะไปช่วงเย็น',
            timestamp: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
            read: false
          }
        ]
      },
      {
        id: `th-${storeId}-6`,
        storeId,
        customerId: 'cust-106',
        customerName: 'คุณกรกต สิทธิโชค',
        customerPhone: '082-990-1122',
        customerAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        queueNumber: 'A09',
        orderSummary: 'ข้าวหมูกรอบคั่วพริกเกลือพิเศษ 1 กล่อง + น้ำเก๊กฮวย',
        orderTotal: 125,
        orderStatus: 'รอคิว',
        lastMessage: 'แจ้งโอนเงินเรียบร้อยแล้วครับ ขอบคุณครับ',
        lastTimestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
        unreadCount: 1,
        messages: [
          {
            id: `m-${storeId}-11`,
            senderRole: 'customer',
            senderName: 'คุณกรกต สิทธิโชค',
            message: 'สวัสดีครับ ออเดอร์คิว #A09 ชำระผ่านพร้อมเพย์แล้วนะครับ',
            timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-12`,
            senderRole: 'customer',
            senderName: 'คุณกรกต สิทธิโชค',
            message: 'แจ้งโอนเงินเรียบร้อยแล้วครับ ขอบคุณครับ',
            timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
            read: false
          }
        ]
      },
      {
        id: `th-${storeId}-7`,
        storeId,
        customerId: 'cust-107',
        customerName: 'คุณนภัสวรรณ รัตนวิจิตร',
        customerPhone: '083-456-7890',
        customerAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        queueNumber: 'A12',
        orderSummary: 'ข้าวกะเพราเป็ดย่างพริกแห้ง 2 กล่อง (เผ็ดน้อย)',
        orderTotal: 190,
        orderStatus: 'กำลังปรุง',
        lastMessage: 'เผ็ดน้อย ไม่ใส่น้ำตาลนะคะ ขอบคุณค่ะ',
        lastTimestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        unreadCount: 0,
        messages: [
          {
            id: `m-${storeId}-13`,
            senderRole: 'customer',
            senderName: 'คุณนภัสวรรณ รัตนวิจิตร',
            message: 'สั่งคิว #A12 ไปเรียบร้อยค่ะ',
            timestamp: new Date(Date.now() - 200 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-14`,
            senderRole: 'merchant',
            senderName: storeName || 'ร้านค้า',
            message: 'ทางร้านได้รับรายการแล้วครับ กำลังเตรียมปรุงเป็ดย่างให้ครับผม',
            timestamp: new Date(Date.now() - 190 * 60 * 1000).toISOString(),
            read: true
          },
          {
            id: `m-${storeId}-15`,
            senderRole: 'customer',
            senderName: 'คุณนภัสวรรณ รัตนวิจิตร',
            message: 'เผ็ดน้อย ไม่ใส่น้ำตาลนะคะ ขอบคุณค่ะ',
            timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
            read: true
          }
        ]
      }
  ];
}
