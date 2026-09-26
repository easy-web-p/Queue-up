import { Store, FoodItem, ReviewItem, CreatorVideoReview, FoodVideoPreview } from '../types';

export const STORE_DETAILS_MAP: Record<string, Partial<Store>> = {
  'store-1': {
    addressDetail: 'เลขที่ 45/2 ซอยอารีย์สัมพันธ์ 3 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กรุงเทพฯ 10400',
    landmark: 'ใกล้ BTS อารีย์ (ทางออก 3) เดินเข้าซอยอารีย์สัมพันธ์ 3 ประมาณ 400 เมตร อยู่ตรงข้ามธนาคารกสิกรไทย',
    nearestStation: 'BTS อารีย์ (เดิน 400 ม. / 5 นาที)',
    openingHours: 'เปิดบริการทุกวัน 08:30 - 20:30 น. (เปิดรับออเดอร์สุดท้าย 20:00 น.)',
    coordinates: {
      lat: 13.7797,
      lng: 100.5401,
      googleMapUrl: 'https://maps.google.com/?q=13.7797,100.5401'
    },
    creatorReviews: [
      {
        id: 'cr-101',
        title: 'ตามรอยก๋วยเตี๋ยวเรือคิวยาวอารีย์! เนื้อริบอายแน่นชาม กากหมูระเบิดปาก',
        creatorName: 'กินเที่ยวกับหมิว',
        creatorHandle: '@KinTiewKabMew',
        creatorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        views: '189.4K',
        likes: '14.2K',
        thumbnail: 'https://images.unsplash.com/photo-1552611052-33e04de081de?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-dish-with-herbs-42994-large.mp4',
        duration: '1:12',
        tag: '#รีวิวของอร่อย #ก๋วยเตี๋ยวเรือแม่นงค์'
      },
      {
        id: 'cr-102',
        title: 'ก๋วยเตี๋ยวเรือที่คิวยาวที่สุดในซอยอารีย์ จองคิวก่อนมาดีที่สุด ไม่ต้องยืนรอ!',
        creatorName: 'Foodie Bangkok Walker',
        creatorHandle: '@FoodieBangkok',
        creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        views: '92.1K',
        likes: '8.7K',
        thumbnail: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fresh-pasta-in-a-pan-43003-large.mp4',
        duration: '0:58',
        tag: '#อร่อยบอกต่อ #BTSอารีย์'
      },
      {
        id: 'cr-103',
        title: 'กินแหลกไม่อั้น กากหมูเจียวสดใหม่ชามต่อชาม เผ็ดแซ่บสะท้านลิ้น',
        creatorName: 'สายกินฟินเว่อร์',
        creatorHandle: '@SaiKinFinVer',
        creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        views: '145.0K',
        likes: '11.5K',
        thumbnail: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-frying-diced-vegetables-in-a-pan-43001-large.mp4',
        duration: '1:35',
        tag: '#กากหมูโบราณ #ของกินเล่น'
      }
    ],
    reviews: [
      {
        id: 'rev-s1-1',
        authorName: 'คุณภานุวัฒน์ วรเกียรติ',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: 'เมื่อวานนี้',
        comment: 'เนื้อริบอายนุ่มละลายจริงๆ น้ำซุปน้ำตกเข้มข้นรสชาติกลมกล่อมโดยไม่ต้องปรุงเพิ่มเลย กากหมูกรอบสนั่น สั่งจองคิวผ่าน QueueUp สะดวกมาก มาถึงได้โต๊ะทันที ไม่ต้องยืนตากแดดรอหน้าร้าน!',
        likes: 38,
        isVerifiedBuyer: true,
        foodName: 'ก๋วยเตี๋ยวเรือเนื้อริบอายสไลด์ น้ำตกพิเศษ'
      },
      {
        id: 'rev-s1-2',
        authorName: 'คุณพัชริดา ชวนชิม',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: '3 วันที่แล้ว',
        comment: 'เผ็ดสะใจมากสำหรับคนชอบรสจัดจ้าน ซดหมดเกลี้ยงชาม คุ้มค่าราคามาก แนะนำสั่งเกี๊ยวหมูเด้งกับกากหมูมาทานคู่กันคือที่สุด',
        likes: 21,
        isVerifiedBuyer: true,
        foodName: 'ก๋วยเตี๋ยวเรือเนื้อริบอายสไลด์ น้ำตกพิเศษ'
      },
      {
        id: 'rev-s1-3',
        authorName: 'คุณเอกชัย สมบูรณ์ดี',
        avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=120&auto=format&fit=crop&q=80',
        rating: 4.8,
        date: 'สัปดาห์ที่แล้ว',
        comment: 'ร้านสะอาด บริการดี แม่ครัวทำตามคิวเป๊ะ คิวรันไวมาก น้ำซุปหอมเครื่องเทศยาจีนแท้ๆ ใครชอบก๋วยเตี๋ยวเรือต้องมาลอง',
        likes: 15,
        isVerifiedBuyer: true
      }
    ],
    similarStoreIds: ['store-2', 'store-4', 'store-3']
  },

  'store-2': {
    addressDetail: 'เลขที่ 112/8 ถนนงามวงศ์วาน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900 (ติดประตู 1 ม.เกษตร)',
    landmark: 'ตรงข้ามประตู 1 มหาวิทยาลัยเกษตรศาสตร์ บางเขน ใกล้สถานีรถไฟฟ้า BTS มหาวิทยาลัยเกษตรศาสตร์ (ทางออก 1)',
    nearestStation: 'BTS มหาวิทยาลัยเกษตรศาสตร์ (เดิน 350 ม. / 4 นาที)',
    openingHours: 'เปิดบริการทุกวัน 10:00 - 21:30 น. (เปิดรับออเดอร์สุดท้าย 21:00 น.)',
    coordinates: {
      lat: 13.8476,
      lng: 100.5701,
      googleMapUrl: 'https://maps.google.com/?q=13.8476,100.5701'
    },
    creatorReviews: [
      {
        id: 'cr-201',
        title: 'กะเพราพริกแห้งเตาถ่านไฟลุก! ไข่ดาวเป็ดเยิ้มทะลัก พริก 15 เม็ดสะท้านลิ้น',
        creatorName: 'อร่อยชวนชิม Official',
        creatorHandle: '@AroiChuanChimm',
        creatorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
        views: '245.8K',
        likes: '22.1K',
        thumbnail: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-stirring-vegetables-in-a-pan-43002-large.mp4',
        duration: '1:20',
        tag: '#กะเพราพริกแห้ง #เตาถ่าน1990'
      },
      {
        id: 'cr-202',
        title: 'เด็ก ม.เกษตร แนะนำ! กะเพราถาดเตาถ่าน 1990 ข้าวหอมมะลิเนื้อโคขุนฉ่ำๆ',
        creatorName: 'เด็กมหาลัยพากิน',
        creatorHandle: '@CampusFoodGuide',
        creatorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80',
        views: '88.5K',
        likes: '7.9K',
        thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-dish-with-herbs-42994-large.mp4',
        duration: '0:52',
        tag: '#เด็กเกษตร #ของกินมเกษตร'
      }
    ],
    reviews: [
      {
        id: 'rev-s2-1',
        authorName: 'คุณกิตติพงศ์ ธนสิริ',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: '2 วันที่แล้ว',
        comment: 'กะเพราคั่วแห้งไร้น้ำมัน กลิ่นกระทะเตาถ่านหอมเตะจมูก เนื้อโคขุนนุ่มไม่เหนียวเลย ไข่ดาวเป็ดลาวาคือสมบูรณ์แบบที่สุด!',
        likes: 29,
        isVerifiedBuyer: true,
        foodName: 'ข้าวกะเพราเนื้อโคขุนคั่วพริกแห้ง + ไข่ดาวเป็ดลาวา'
      },
      {
        id: 'rev-s2-2',
        authorName: 'คุณพิมพ์มาดา สุวรรณฉัตร',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        rating: 4.8,
        date: '5 วันที่แล้ว',
        comment: 'สั่งเผ็ดไฟลุกคือเผ็ดสะใจเหงื่อตกเลย ชอบที่ผัดแห้งและพริกแห้งคั่วใหม่หอมมาก มีระบบกดคิวล่วงหน้าทำให้ตอนพักเที่ยงไม่ต้องรอเลย',
        likes: 18,
        isVerifiedBuyer: true
      }
    ],
    similarStoreIds: ['store-1', 'store-4', 'store-3']
  },

  'store-3': {
    addressDetail: 'เลขที่ 28/4 พหลโยธิน ซอย 7 (ซอยอารีย์) แขวงพญาไท เขตพญาไท กรุงเทพฯ 10400',
    landmark: 'พหลโยธิน ซอย 7 ห่างจาก BTS อารีย์ 300 เมตร ใกล้โครงการ Gump Ari และคาเฟ่ย่านอารีย์',
    nearestStation: 'BTS อารีย์ (เดิน 300 ม. / 4 นาที)',
    openingHours: 'เปิดบริการทุกวัน 07:30 - 18:30 น.',
    coordinates: {
      lat: 13.7802,
      lng: 100.5445,
      googleMapUrl: 'https://maps.google.com/?q=13.7802,100.5445'
    },
    creatorReviews: [
      {
        id: 'cr-301',
        title: 'มัทฉะเกรดพิธีการ Uji Cold Whisk ตีสดแก้วต่อแก้ว ละมุนมากก สายมัทฉะห้ามพลาด!',
        creatorName: 'Matcha Lover BKK',
        creatorHandle: '@MatchaLoverBKK',
        creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        views: '134.2K',
        likes: '16.8K',
        thumbnail: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fresh-pasta-in-a-pan-43003-large.mp4',
        duration: '1:05',
        tag: '#MatchaBar #UjiCeremonial'
      },
      {
        id: 'cr-302',
        title: 'สโลว์บาร์ชาไทยเข้มสะใจ หอมใบชาใต้แท้ ไม่หวานเลี่ยน',
        creatorName: 'Cafe Hopper Thailand',
        creatorHandle: '@CafeHopperTH',
        creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        views: '76.4K',
        likes: '6.2K',
        thumbnail: 'https://images.unsplash.com/photo-1558857563-b371b6fb6e02?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-dish-with-herbs-42994-large.mp4',
        duration: '0:48',
        tag: '#ชาไทยใต้ #CafeAri'
      }
    ],
    reviews: [
      {
        id: 'rev-s3-1',
        authorName: 'คุณศิรินทร์ พงศ์พิสุทธิ์',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: '3 วันที่แล้ว',
        comment: 'มัทฉะเกรดพิธีการอูจิหอมอูมามิมาก ไม่ขมเลย ครีมมี่ละมุนลิ้นสุดๆ นมโอ๊ตเข้ากันดีมากค่ะ',
        likes: 31,
        isVerifiedBuyer: true,
        foodName: 'Uji Ceremonial Matcha Cold Whisk Latte'
      },
      {
        id: 'rev-s3-2',
        authorName: 'คุณธนภัทร เจริญยนต์',
        avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
        rating: 4.7,
        date: 'สัปดาห์ที่แล้ว',
        comment: 'ชาไทยเข้มข้นถึงใจ สั่งหวาน 25% กำลังพอดี มีกลิ่นคั่วชาใต้ชัดเจน กดรับคิวก่อนเดินมาจากบีทีเอส มาถึงรับแก้วได้เลย ดีงาม',
        likes: 14,
        isVerifiedBuyer: true
      }
    ],
    similarStoreIds: ['store-1', 'store-2', 'store-4']
  },

  'store-4': {
    addressDetail: 'เลขที่ 98 ถนนแปลงนาม แขวงสัมพันธวงศ์ เขตสัมพันธวงศ์ กรุงเทพฯ 10100',
    landmark: 'ถนนแปลงนาม เยาวราช ใกล้สถานี MRT วัดมังกร ทางออก 1 เดินเพียง 150 เมตร เข้าซอยเยื้องศาลเจ้ากวางตุ้ง',
    nearestStation: 'MRT วัดมังกร (เดิน 150 ม. / 2 นาที)',
    openingHours: 'อังคาร - อาทิตย์ 10:00 - 20:00 น. (หยุดทุกวันจันทร์)',
    coordinates: {
      lat: 13.7412,
      lng: 100.5098,
      googleMapUrl: 'https://maps.google.com/?q=13.7412,100.5098'
    },
    creatorReviews: [
      {
        id: 'cr-401',
        title: 'หมูกรอบหนังแก้วเสียงเคี้ยวดังลั่นเยาวราช ย่างเตาถ่าน 6 ชั่วโมง!',
        creatorName: 'เฮียพาแดก เยาวราช',
        creatorHandle: '@HerePaaDaek',
        creatorAvatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&auto=format&fit=crop&q=80',
        views: '320.5K',
        likes: '35.4K',
        thumbnail: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-frying-diced-vegetables-in-a-pan-43001-large.mp4',
        duration: '1:18',
        tag: '#หมูกรอบเยาวราช #MichelinGuide'
      },
      {
        id: 'cr-402',
        title: 'รวมมิตรหมูกรอบ+หมูแดงน้ำผึ้งฉ่ำๆ ร้านลับในตำนานถนนแปลงนาม',
        creatorName: 'Street Food Hunter TH',
        creatorHandle: '@StreetFoodHunterTH',
        creatorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        views: '110.2K',
        likes: '9.8K',
        thumbnail: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
        videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-dish-with-herbs-42994-large.mp4',
        duration: '1:02',
        tag: '#เยาวราช #StreetFood'
      }
    ],
    reviews: [
      {
        id: 'rev-s4-1',
        authorName: 'คุณเจริญ พานิชย์กุล',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: 'เมื่อวานนี้',
        comment: 'หมูกรอบหนังแก้วกรอบสนั่นข้ามวัน มันแทรกกำลังดีไม่เลี่ยน น้ำราดหอมเครื่องยาจีนสไตล์ฮ่องกงแท้ๆ ใครมาเยาวราชห้ามพลาดเด็ดขาด',
        likes: 45,
        isVerifiedBuyer: true,
        foodName: 'ข้าวรวมมิตร หมูกรอบหนังแก้ว + หมูแดงย่างน้ำผึ้ง'
      },
      {
        id: 'rev-s4-2',
        authorName: 'คุณวราภรณ์ ทวีสุข',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        rating: 4.9,
        date: '4 วันที่แล้ว',
        comment: 'ปกติคิวหน้าร้านยาวเหยียดครึ่งชั่วโมง สั่งผ่านบัตรคิว QueueUp สะดวกมาก มาถึงแสกนรับกล่องกลับบ้านได้ทันที',
        likes: 26,
        isVerifiedBuyer: true
      }
    ],
    similarStoreIds: ['store-2', 'store-1', 'store-3']
  }
};

export const FOOD_DETAILS_MAP: Record<string, Partial<FoodItem>> = {
  'food-1': {
    availableDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
    availableHours: '08:30 - 20:00 น.',
    bookingNotice: 'สามารถสั่งรับทันทีหน้าร้าน หรือสั่งจองคิวล่วงหน้าได้ 1-7 วันตามช่วงเวลาที่คุณสะดวก',
    videoPreview: {
      title: 'วิดีโอสาธิตการปรุง & ความสดใหม่: ก๋วยเตี๋ยวเรือเนื้อริบอายน้ำตกพิเศษ',
      duration: '0:48',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fresh-pasta-in-a-pan-43003-large.mp4',
      poster: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=800&auto=format&fit=crop&q=80',
      description: 'เนื้อริบอายสไลด์สด ลวกในน้ำซุปสมุนไพรเดือดพล่าน 8 วินาทีจนนุ่มฉ่ำ ราดน้ำตกเข้มข้นสูตรเฉพาะของแม่นงค์'
    },
    reviews: [
      {
        id: 'rf-1-1',
        authorName: 'คุณภานุวัฒน์ วรเกียรติ',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: 'เมื่อวานนี้',
        comment: 'เนื้อริบอายนุ่มละลายในปากจริงๆ น้ำตกเข้มข้นกลมกล่อมมาก ระดับความเผ็ดกลางกำลังดี ไม่แสบคอ กากหมูชิ้นโตกรอบฟินมากครับ!',
        likes: 42,
        isVerifiedBuyer: true
      },
      {
        id: 'rf-1-2',
        authorName: 'คุณนันทนา สายกิน',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: '3 วันที่แล้ว',
        comment: 'สั่งเส้นเล็กเหนียวนุ่มเข้ากับน้ำซุปได้ดีมาก ลูกชิ้นเนื้อแท้เด้งสู้ฟัน ตับลวกมาหวานพอดี ไม่มีกลิ่นคาวเลย 10/10 จ้า',
        likes: 18,
        isVerifiedBuyer: true
      },
      {
        id: 'rf-1-3',
        authorName: 'คุณชัยวัฒน์ มงคล',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
        rating: 4.8,
        date: '5 วันที่แล้ว',
        comment: 'คุณภาพเนื้อพรีเมียมเกินราคา 89 บาทมาก คุ้มค่าสุดๆ ระบบคิวแม่นยำมาก มาถึงตามเวลาที่แจ้งในบัตรคิวพอดีเป๊ะ',
        likes: 12,
        isVerifiedBuyer: true
      }
    ]
  },

  'food-2': {
    availableDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
    availableHours: '08:30 - 20:00 น.',
    bookingNotice: 'เจียวสดใหม่กระทะต่อกระทะ สามารถสั่งเพิ่มคู่กับก๋วยเตี๋ยวเรือ หรือสั่งแยกทานเล่นได้ตลอดวัน',
    videoPreview: {
      title: 'คลิปสาธิตความกรอบ: กากหมูโบราณคลุกเกลือหิมาลายัน',
      duration: '0:35',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-frying-diced-vegetables-in-a-pan-43001-large.mp4',
      poster: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&auto=format&fit=crop&q=80',
      description: 'เจียวสดใหม่ด้วยเทคนิคโบราณ รีดน้ำมันออกจนหมด คลุกเกลือชมพูหิมาลายัน กรอบสนั่นเคี้ยวเพลิน'
    },
    reviews: [
      {
        id: 'rf-2-1',
        authorName: 'คุณศศิธร',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: '2 วันที่แล้ว',
        comment: 'กากหมูคือดีมากกก กรอบไม่อมน้ำมันเลย เค็มเบาๆ กำลังดี กินคู่กับก๋วยเตี๋ยวเรือคือนิพพาน สั่งเบิ้ล 2 ถุงตลอด',
        likes: 25,
        isVerifiedBuyer: true
      }
    ]
  },

  'food-3': {
    availableDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
    availableHours: '10:00 - 21:00 น.',
    bookingNotice: 'ปรุงสุกร้อนชามต่อชามด้วยเตาถ่านไฟแรง สั่งจองคิวล่วงหน้าเพื่อไม่ต้องรอคั่วกระทะหน้าร้าน',
    videoPreview: {
      title: 'วิดีโอกลิ่นกระทะเตาถ่าน: ข้าวกะเพราเนื้อโคขุนคั่วพริกแห้งโบราณ',
      duration: '1:02',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-stirring-vegetables-in-a-pan-43002-large.mp4',
      poster: 'https://images.unsplash.com/photo-1562967914-608f82629710?w=800&auto=format&fit=crop&q=80',
      description: 'เนื้อโคขุนสับคั่วพริกขี้หนูสวนและพริกแห้งจินดาในกระทะเหล็กเตาถ่าน กลิ่นควันหอมฟุ้ง โปะไข่ดาวเป็ดลาวา'
    },
    reviews: [
      {
        id: 'rf-3-1',
        authorName: 'คุณกิตติพงศ์',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: '1 วันที่แล้ว',
        comment: 'กะเพราที่จริงใจ ผัดแห้งไม่มีถั่วฝักยาวหรือข้าวโพดอ่อน มีแต่ใบกะเพรากับพริกแห้งหอมๆ ไข่ดาวเป็ดกรอบขอบเยิ้มตรงกลาง ฟินมาก',
        likes: 36,
        isVerifiedBuyer: true
      },
      {
        id: 'rf-3-2',
        authorName: 'คุณพิมพ์ใจ',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
        rating: 4.8,
        date: '4 วันที่แล้ว',
        comment: 'ระดับเผ็ดไฟลุกคือเผ็ดสะใจมาก ข้าวหอมมะลินุ่มเม็ดสวย จองคิวล่วงหน้าตอน 11 โมง เที่ยงเดินไปรับได้เลย ไม่ต้องแย่งคิว',
        likes: 19,
        isVerifiedBuyer: true
      }
    ]
  },

  'food-4': {
    availableDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
    availableHours: '10:00 - 21:00 น.',
    bookingNotice: 'หมูกรอบทำสดใหม่วันต่อวัน คั่วพริกเกลือร้อนๆ เสิร์ฟพร้อมข้าวสวยหอมมะลิร้อนๆ',
    videoPreview: {
      title: 'วิดีโอคั่วพริกเกลือ: ข้าวกะเพราหมูกรอบคั่วพริกเกลือกระเทียมโทน',
      duration: '0:42',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-frying-diced-vegetables-in-a-pan-43001-large.mp4',
      poster: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
      description: 'หมูกรอบเต๋าหนังฟูกรอบ คั่วกับกระเทียมไทยและเกลือสมุทร พริกขี้หนูสด กลิ่นหอมเย้ายวนใจ'
    },
    reviews: [
      {
        id: 'rf-4-1',
        authorName: 'คุณวรเชษฐ์',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
        rating: 4.9,
        date: '3 วันที่แล้ว',
        comment: 'หมูกรอบคือกรอบสนั่นฟัน กระเทียมคั่วหอมมาก รสชาติเค็มเผ็ดกลมกล่อมกำลังดี',
        likes: 17,
        isVerifiedBuyer: true
      }
    ]
  },

  'food-6': {
    availableDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
    availableHours: '07:30 - 18:00 น.',
    bookingNotice: 'มัทฉะเกรดพิธีการ ตีสดแก้วต่อแก้ว สามารถระบุระดับความหวานและชนิดนมได้ตามชอบ',
    videoPreview: {
      title: 'วิดีโอชงสด Cold Whisk: Uji Ceremonial Matcha Latte',
      duration: '0:50',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-fresh-pasta-in-a-pan-43003-large.mp4',
      poster: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=800&auto=format&fit=crop&q=80',
      description: 'ผงมัทฉะแท้เกรดพิธีการจากเมืองอุจิ เกียวโต ตีด้วยแปรงชงชา Chasen จนขึ้นฟองเนียน ผสมนมฮอกไกโด'
    },
    reviews: [
      {
        id: 'rf-6-1',
        authorName: 'คุณศิรินทร์',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: '2 วันที่แล้ว',
        comment: 'สายมัทฉะห้ามพลาดเลย เขียวมรกตสวยงาม ไม่ขมฝาด หอมกลิ่นถั่วและสาหร่ายบางๆ สั่งหวาน 0% สัมผัสรสชาแท้',
        likes: 28,
        isVerifiedBuyer: true
      }
    ]
  },

  'food-8': {
    availableDays: ['อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
    availableHours: '10:00 - 19:30 น. (หยุดวันจันทร์)',
    bookingNotice: 'หมูกรอบหนังแก้วและหมูแดงน้ำผึ้งย่างเตาถ่าน 6 ชั่วโมง มีจำนวนจำกัดวันละ 100 จาน แนะนำสั่งจองคิวล่วงหน้า',
    videoPreview: {
      title: 'วิดีโอหั่นหมูกรอบหนังแก้วเยาวราช: ข้าวรวมมิตรนายช่าง',
      duration: '0:55',
      videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-chef-preparing-a-dish-with-herbs-42994-large.mp4',
      poster: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&auto=format&fit=crop&q=80',
      description: 'เสียงมีดกระทบหนังหมูกรอบฟูกรอบสะท้านลิ้น เสิร์ฟคู่กับหมูแดงย่างน้ำผึ้งฉ่ำนุ่มและน้ำราดกวางตุ้งโบราณ'
    },
    reviews: [
      {
        id: 'rf-8-1',
        authorName: 'คุณเจริญ พานิชย์กุล',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
        rating: 5,
        date: 'เมื่อวานนี้',
        comment: 'หมูกรอบหนังแก้วอันดับหนึ่งในใจ หนังกรอบบางเหมือนกระจก เนื้อนุ่มฉ่ำ น้ำซอสหวานเค็มกลมกล่อมมาก',
        likes: 39,
        isVerifiedBuyer: true
      }
    ]
  }
};
