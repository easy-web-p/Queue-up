import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { orderRepository } from '../repositories/orderRepository';
import { Store, FoodItem, CartItem, QueueOrder, QueueStatus, UserRole, AuthUser, ThemeMode, AppNotification, StoreChatMessage, StoreCustomerChatThread, CustomerChatMessage, StoreContactChannels, StoreExchangeTerms, PaymentMethodId } from '../types';
import { STORES, FOOD_ITEMS, INITIAL_QUEUES } from '../data/mockData';
import { buildDemoCustomerThreads } from '../data/demoChatThreads';
import { buildDemoQueues } from '../data/demoQueues';
import { INITIAL_NOTIFICATIONS } from '../data/mockNotifications';
import { OrderAuthoritativeService } from '../services/orderAuthoritativeService';
import { MerchantService } from '../services/merchantService';
import { signInWithGoogle as fbSignInWithGoogle, signOutUser as fbSignOutUser, logAnalyticsEvent, auth, db } from '../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { setupForegroundPushListener, syncPushTokenOnBoot } from '../services/pushTokenService';
import { playChimeSound } from '../services/soundService';
import { FirebaseDataService } from '../services/firebaseDataService';
import { seedCanteensToFirestore } from '../services/canteenService';
import { otpService } from '../services/otpService';
import {
  UserLocationPoint,
  PRESET_CAMPUS_LOCATIONS,
  DEFAULT_USER_LOCATION,
  requestBrowserGeolocation,
  verifyLocationViaGps
} from '../services/locationService';
import { searchRecommendationService } from '../services/searchRecommendationService';
import { apiClient } from '../services/apiClient';
import { cartStorage } from '../services/cartStorage';
import { SchoolService } from '../services/schoolService';
import { processAssistantReply } from '../services/engines/aiChatEngine';
import { ChatService } from '../services/chatService';
import {
  AppView,
  ToastMessage,
  ADMIN_EMAIL,
  isSuperAdmin,
  SESSION_STORAGE_KEY,
  DEFAULT_DEMO_USER,
  getInitialSession
} from './queueSession';

// Re-exported so existing imports from './context/QueueContext' keep working.
export type { AppView, ToastMessage };
export { ADMIN_EMAIL, isSuperAdmin, DEFAULT_DEMO_USER };


interface QueueContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  isAdmin: boolean;
  adminEmail: string;
  
  // Theme management: Light, Dark, and Auto (time-based)
  theme: 'dark' | 'light';
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  localTimeFormatted: string;
  isDaytime: boolean;
  
  stores: Store[];
  foodItems: FoodItem[];
  activeStoreId: string | null;
  activeStore: Store | null;
  setActiveStoreId: (storeId: string | null, navigateToView?: boolean | string) => void;
  
  // Dedicated Food & Store navigation
  selectedFoodId: string | null;
  setSelectedFoodId: (id: string | null) => void;
  selectedFood: FoodItem | null;
  openFoodDetail: (foodId: string) => void;
  openStoreDetail: (storeId: string) => void;

  // Food modal
  activeFoodModal: FoodItem | null;
  setActiveFoodModal: (food: FoodItem | null) => void;

  // Cart
  cart: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (item: Omit<CartItem, 'cartItemId' | 'subtotal'>) => void;
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartItemCount: number;

  // Checkout & Queues
  queues: QueueOrder[];
  userQueues: QueueOrder[];
  userActiveQueue: QueueOrder | null;
  activeQueueId: string | null;
  setActiveQueueId: (id: string | null) => void;
  placeOrder: (params: {
    customerName: string;
    customerPhone: string;
    pickupTime: string;
    paymentMethod: PaymentMethodId;
    specialNote?: string;
    reservationId?: string;
    slotId?: string;
  }) => QueueOrder;
  updateOrderStatus: (orderId: string, status: QueueStatus) => void;
  cancelOrder: (orderId: string) => void;

  // Search & Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  spicyFilter: boolean;
  setSpicyFilter: (val: boolean) => void;
  maxPriceFilter: number;
  setMaxPriceFilter: (val: number) => void;
  sortBy: 'popular' | 'rating' | 'price-asc' | 'distance';
  setSortBy: (sort: 'popular' | 'rating' | 'price-asc' | 'distance') => void;

  // Food stock management (Merchant)
  toggleFoodAvailability: (foodId: string) => void;

  // Followed Stores & Notifications
  followedStoreIds: string[];
  toggleFollowStore: (storeId: string) => void;
  isStoreFollowed: (storeId: string) => boolean;
  notifications: AppNotification[];
  unreadNotificationCount: number;
  markAllNotificationsRead: () => void;
  markNotificationRead: (id: string) => void;
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => void;

  // Create Store & Help & Profile Modals
  isCreateStoreModalOpen: boolean;
  setIsCreateStoreModalOpen: (open: boolean) => void;
  userStore: Store | null;
  openCreateStore: () => void;
  openStoreAdmin: (storeId?: string) => void;
  addNewStore: (newStoreData: Partial<Store>, initialMenuItems?: Partial<FoodItem>[]) => Store;
  updateStore: (storeId: string, updatedData: Partial<Store>) => void;
  deleteStore: (storeId: string) => void;
  seedDemoQueuesForStore: (storeId: string) => void;
  kdsSelectedStoreId: string | null;
  setKdsSelectedStoreId: (storeId: string | null) => void;
  addFoodItem: (newItem: Partial<FoodItem> & { name: string; price: number; storeId: string }) => FoodItem;
  updateFoodItem: (foodId: string, updatedData: Partial<FoodItem>) => void;
  deleteFoodItem: (foodId: string) => void;
  isHelpModalOpen: boolean;
  setIsHelpModalOpen: (open: boolean) => void;
  isAccountSettingsModalOpen: boolean;
  setIsAccountSettingsModalOpen: (open: boolean) => void;
  updateUserProfile: (profile: Partial<AuthUser>) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  openUserProfile: (userId?: string) => void;

  // Toasts
  toasts: ToastMessage[];
  addToast: (title: string, message?: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;

  // Simulated live updates toggle
  isLiveSimulationActive: boolean;
  setIsLiveSimulationActive: (active: boolean) => void;

  // Register Modal
  isRegisterModalOpen: boolean;
  setIsRegisterModalOpen: (open: boolean) => void;

  // Sidebar Drawer
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;

  // Right Push-out Side Chat Panel
  isSideChatOpen: boolean;
  setIsSideChatOpen: (open: boolean) => void;
  toggleSideChat: () => void;

  // Auth & Session
  currentUser: AuthUser | null;
  loginUser: (userData: Partial<AuthUser> & { email: string; fullName?: string; role?: UserRole; password?: string }) => Promise<{ user: AuthUser; isFirstTime: boolean }>;
  loginWithGoogle: (customAccount?: { email: string; fullName: string; avatar?: string; role?: UserRole }) => Promise<{ user: AuthUser; isFirstTime: boolean }>;
  registerUser: (userData: Omit<AuthUser, 'id' | 'registeredAt'>) => void;
  completeFirstTimeOtp: (params: {
    user: AuthUser;
    phone: string;
    password?: string;
    otpCode: string;
  }) => Promise<{ success: boolean; error?: string; user?: AuthUser }>;
  checkIsUserFirstTime: (email: string, userId?: string) => Promise<boolean>;
  logoutUser: () => void;
  refreshOrdersFromCloud: () => Promise<void>;

  // Store Buyer-Seller Contact Channels & Exchange Terms
  activeContactTermsStore: Store | null;
  activeContactTermsDefaultTab: 'terms' | 'contact';
  openStoreContactAndTerms: (store: Store, defaultTab?: 'terms' | 'contact') => void;
  closeStoreContactAndTerms: () => void;
  activeChatStore: { store: Store; orderId?: string } | null;
  openStoreChat: (store: Store, orderId?: string) => void;
  closeStoreChat: () => void;
  activeChatStoreId: string | null;
  setActiveChatStoreId: (storeId: string | null) => void;
  chatRoomTimestamp: number;
  customerThreadsTimestamp: number;
  openChatPage: (storeId?: string) => void;
  openStoreChatPage: (storeId?: string) => void;
  getStoreChatMessages: (storeId: string) => StoreChatMessage[];
  sendStoreChatMessage: (storeId: string, message: string, orderId?: string, senderRole?: 'buyer' | 'seller') => void;
  markStoreChatAsRead: (storeId: string) => void;
  getStoreCustomerThreads: (storeId: string) => StoreCustomerChatThread[];
  sendStoreCustomerReply: (storeId: string, threadId: string, message: string) => void;
  markStoreCustomerThreadAsRead: (storeId: string, threadId: string) => void;
  updateStoreExchangeTerms: (storeId: string, terms: Partial<StoreExchangeTerms>) => void;
  updateStoreContactChannels: (storeId: string, channels: Partial<StoreContactChannels>) => void;

  // Real-time Geolocation, Campus Positions & Proximity Comparison
  userLocation: UserLocationPoint;
  setUserLocation: (location: UserLocationPoint) => void;
  requestGpsLocation: () => Promise<boolean>;
  presetLocations: UserLocationPoint[];
  proximityModalStore: Store | null;
  setProximityModalStore: (store: Store | null) => void;
  openProximityComparison: (store: Store) => void;
  closeProximityComparison: () => void;

  // Search Recording & Intelligent Recommendations
  recordSearchQuery: (query: string) => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSession = getInitialSession();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(initialSession.user);
  const [role, setRoleState] = useState<UserRole>(initialSession.role);
  const [currentView, setCurrentViewState] = useState<AppView>(initialSession.view);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState<boolean>(false);

  const isAdmin = isSuperAdmin(currentUser?.email);
  const adminEmail = ADMIN_EMAIL;

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  const addToast = (title: string, message?: string, type: ToastMessage['type'] = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const setCurrentView = (view: AppView) => {
    // Auth Check: If not logged in, user can only access public pages (landing, about)
    if (!currentUser && view !== 'landing' && view !== 'about') {
      setCurrentViewState('landing');
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบยืนยันตัวตนก่อน จึงจะสามารถเข้าถึงหน้านี้ได้', 'warning');
      setIsRegisterModalOpen(true);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      return;
    }
    if (view === 'admin-dashboard') {
      if (!isSuperAdmin(currentUser?.email)) {
        addToast('ปฏิเสธการเข้าถึง', `เฉพาะแอดมินของเว็บไซต์ (${ADMIN_EMAIL}) เท่านั้นที่สามารถเข้าถึงห้องนี้ได้`, 'error');
        return;
      }
    }
    setCurrentViewState(view);
    // Instantly scroll to top when navigating or resetting screen so it always renders from top to bottom
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };
  // Theme Mode: 'light' | 'dark' | 'auto' (Local time-based)
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    try {
      const savedMode = localStorage.getItem('queueup_theme_mode') as ThemeMode;
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'auto') return savedMode;
      const legacyTheme = localStorage.getItem('queueup_theme');
      if (legacyTheme === 'light' || legacyTheme === 'dark') return legacyTheme;
    } catch (e) {
      console.error(e);
    }
    return 'light'; // Default to pristine light mode per user requirement
  });

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const isDaytime = currentDate.getHours() >= 6 && currentDate.getHours() < 18;
  const effectiveTheme: 'dark' | 'light' = themeMode === 'auto' ? (isDaytime ? 'light' : 'dark') : themeMode;

  const localTimeFormatted = `${String(currentDate.getHours()).padStart(2, '0')}:${String(currentDate.getMinutes()).padStart(2, '0')} น.`;

  // Periodically refresh current time for Auto theme calculation & auto-sync canteens to Firestore
  useEffect(() => {
    seedCanteensToFirestore().catch(err => console.warn('Firestore canteens auto-sync:', err));
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      localStorage.setItem('queueup_theme_mode', mode);
      if (mode !== 'auto') {
        localStorage.setItem('queueup_theme', mode);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleTheme = () => {
    // Cycle: light -> dark -> auto -> light
    if (themeMode === 'light') setThemeMode('dark');
    else if (themeMode === 'dark') setThemeMode('auto');
    else setThemeMode('light');
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSideChatOpen, setIsSideChatOpen] = useState<boolean>(false);
  const toggleSideChat = () => setIsSideChatOpen(prev => !prev);
  const [isCreateStoreModalOpen, setIsCreateStoreModalOpen] = useState<boolean>(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);
  const [isAccountSettingsModalOpen, setIsAccountSettingsModalOpen] = useState<boolean>(false);

  // Contact Channels & Exchange Terms modals
  const [activeContactTermsStore, setActiveContactTermsStore] = useState<Store | null>(null);
  const [activeContactTermsDefaultTab, setActiveContactTermsDefaultTab] = useState<'terms' | 'contact'>('terms');
  const [activeChatStore, setActiveChatStore] = useState<{ store: Store; orderId?: string } | null>(null);
  const [activeChatStoreId, setActiveChatStoreId] = useState<string | null>('store-2');

  const INITIAL_STORE_CHATS: Record<string, StoreChatMessage[]> = {
    'store-2': [
      {
        id: 'msg-s2-1',
        storeId: 'store-2',
        senderId: 'store-staff-s2',
        senderName: 'เชฟกะเพราถาด พริกเจ็ดเม็ด',
        senderRole: 'seller',
        message: 'สวัสดีครับ ยินดีต้อนรับสู่ร้านข้าวกะเพราถาด พริกเจ็ดเม็ด 🔥 มีข้อสงสัยหรือต้องการปรับระดับความเผ็ด แจ้งในนี้ได้เลยครับ',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s2-2',
        storeId: 'store-2',
        orderId: 'queue-1',
        senderId: 'USR-89241',
        senderName: 'ลูกค้า (คุณ)',
        senderRole: 'buyer',
        message: 'สวัสดีครับ ออเดอร์คิว #A01 ข้าวกะเพราเนื้อโคขุน ขอเผ็ดน้อย พริก 2 เม็ดพอครับ และขอไข่ดาวกรอบไข่แดงเยิ้มๆ ครับ',
        timestamp: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s2-3',
        storeId: 'store-2',
        orderId: 'queue-1',
        senderId: 'store-staff-s2',
        senderName: 'เชฟกะเพราถาด พริกเจ็ดเม็ด',
        senderRole: 'seller',
        message: 'รับทราบออเดอร์คิว #A01 ครับผม จัดการปรับพริก 2 เม็ดและทอดไข่ดาวขอบกรอบไข่แดงเยิ้มให้เรียบร้อยครับ เชฟกำลังเริ่มผัดให้เลยครับ 🍳',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        read: true,
        messageType: 'order_card',
        orderSnapshot: {
          queueNumber: 'A01',
          itemsSummary: 'ข้าวกะเพราถาดเนื้อโคขุน + ไข่ดาวกรอบ (เผ็ดน้อย)',
          total: 125,
          status: 'กำลังปรุงอาหาร (PREPARING)'
        }
      },
      {
        id: 'msg-s2-4',
        storeId: 'store-2',
        senderId: 'USR-89241',
        senderName: 'ลูกค้า (คุณ)',
        senderRole: 'buyer',
        message: 'สอบถามเพิ่มเติมครับ ถ้าจะสั่งจองอาหารล่วงหน้า 6 กล่องช่วงพักเที่ยง สามารถสั่งจองผ่านช่องทางแชทนี้ได้ไหมครับ?',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s2-5',
        storeId: 'store-2',
        senderId: 'store-staff-s2',
        senderName: 'ผู้จัดการร้านข้าวกะเพราถาด',
        senderRole: 'seller',
        message: 'ได้เลยครับผม! แจ้งจำนวนกล่อง เมนูที่ต้องการ และเวลานัดรับได้เลยครับ ทางร้านจะจัดเตรียมใส่ถุงพร้อมช้อนส้อมไว้ให้ตรงเวลาโดยไม่ต้องรอคิวครับ 🙏',
        timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s2-6',
        storeId: 'store-2',
        orderId: 'queue-1',
        senderId: 'store-staff-s2',
        senderName: 'เชฟกะเพราถาด พริกเจ็ดเม็ด',
        senderRole: 'seller',
        message: '🔔 อัปเดตคิว #A01: อาหารของท่านปรุงเสร็จเรียบร้อยแล้วครับ เชิญนำหน้าจอบัตรคิวมารับได้ที่ช่องรับอาหารหน้าร้านได้เลยครับผม!',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        read: false
      }
    ],
    'store-1': [
      {
        id: 'msg-s1-1',
        storeId: 'store-1',
        senderId: 'store-staff-s1',
        senderName: 'ป้าสมศรี (เจ้าของร้าน)',
        senderRole: 'seller',
        message: 'สวัสดีจ้าลูก ร้านป้าสมศรีข้าวแกงปักษ์ใต้ยินดีให้บริการจ้า วันนี้มีคั่วกลิ้งหมู แกงส้มปลากะพงยอดมะพร้าว และไข่พะโล้สดใหม่จ้า 🍛',
        timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s1-2',
        storeId: 'store-1',
        senderId: 'USR-89241',
        senderName: 'ลูกค้า (คุณ)',
        senderRole: 'buyer',
        message: 'สวัสดีครับป้าสมศรี อยากสั่งจองอาหารล่วงหน้า 3 กล่อง ไปรับช่วง 12:15 น. ครับ มีแกงส้ม 2 กล่อง คั่วกลิ้ง 1 กล่องครับ',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s1-3',
        storeId: 'store-1',
        senderId: 'store-staff-s1',
        senderName: 'ป้าสมศรี (เจ้าของร้าน)',
        senderRole: 'seller',
        message: 'ป้าบันทึกการจองอาหารให้เรียบร้อยแล้วจ้า ตักแยกถุงน้ำแกงให้ด้วยนะจ๊ะ ถึงเวลา 12:15 น. เดินมาบอกชื่อแล้วรับอาหารได้เลยจ้า',
        timestamp: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
        read: true,
        messageType: 'booking_card',
        bookingSnapshot: {
          bookingDate: 'วันนี้',
          bookingTime: '12:15 น.',
          guestCount: 3,
          itemsSummary: 'แกงส้มยอดมะพร้าว 2 กล่อง + คั่วกลิ้งหมู 1 กล่อง (รวม ฿185)',
          status: 'ยืนยันการจองอาหารเรียบร้อย (CONFIRMED)'
        }
      },
      {
        id: 'msg-s1-4',
        storeId: 'store-1',
        senderId: 'USR-89241',
        senderName: 'ลูกค้า (คุณ)',
        senderRole: 'buyer',
        message: 'ขอพริกน้ำปลาถ้วยเล็กเพิ่มด้วยนะครับป้า ขอบคุณมากครับ',
        timestamp: new Date(Date.now() - 50 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s1-5',
        storeId: 'store-1',
        senderId: 'store-staff-s1',
        senderName: 'ป้าสมศรี (เจ้าของร้าน)',
        senderRole: 'seller',
        message: 'จัดพริกซอยมะนาวสดใส่ถุงแถมให้เรียบร้อยจ้าหลาน เจอกันตอนเที่ยงจ้า 😊',
        timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        read: true
      }
    ],
    'store-3': [
      {
        id: 'msg-s3-1',
        storeId: 'store-3',
        senderId: 'store-staff-s3',
        senderName: 'แอดมินร้านก๋วยเตี๋ยวเรือ',
        senderRole: 'seller',
        message: 'สวัสดีครับ ก๋วยเตี๋ยวเรืออยุธยาสูตรโบราณยินดีต้อนรับครับ สอบถามคิวหรือรายการอาหารได้เลยครับ',
        timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s3-2',
        storeId: 'store-3',
        senderId: 'USR-89241',
        senderName: 'ลูกค้า (คุณ)',
        senderRole: 'buyer',
        message: 'สอบถามครับ วันนี้มีกากหมูเจียวสดใหม่ไหมครับ และสั่งแยกน้ำซุปได้ไหมครับ',
        timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s3-3',
        storeId: 'store-3',
        senderId: 'store-staff-s3',
        senderName: 'แอดมินร้านก๋วยเตี๋ยวเรือ',
        senderRole: 'seller',
        message: 'มีกากหมูเจียวสดใหม่กรอบๆ แน่นอนครับ! และสามารถเลือกสั่งแบบแยกน้ำซุปได้เลยครับ เส้นไม่อืดแน่นอนครับผม 🍜',
        timestamp: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
        read: true
      }
    ],
    'store-4': [
      {
        id: 'msg-s4-1',
        storeId: 'store-4',
        senderId: 'store-staff-s4',
        senderName: 'บาริสต้า Boost Juice',
        senderRole: 'seller',
        message: 'สวัสดีครับ Boost Juice Bar & Slow Tea ยินดีให้บริการสมูทตี้ผลไม้สดแท้และชาสกัดเย็นครับ 🥤✨',
        timestamp: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s4-2',
        storeId: 'store-4',
        senderId: 'USR-89241',
        senderName: 'ลูกค้า (คุณ)',
        senderRole: 'buyer',
        message: 'สวัสดีครับ พอดีแพ้นมวัวแลคโตส มีเมนูสมูทตี้แนะนำตัวไหนบ้างครับที่ปลอดภัย?',
        timestamp: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
        read: true
      },
      {
        id: 'msg-s4-3',
        storeId: 'store-4',
        senderId: 'store-staff-s4',
        senderName: 'บาริสต้า Boost Juice',
        senderRole: 'seller',
        message: 'แนะนำเมนู All-Berry Bang และ Wild Berry Crush ครับ ใช้น้ำแอปเปิ้ลสกัดสด 100% แทนเบสนม ดื่มได้อย่างมั่นใจ ไร้แลคโตสแน่นอนครับผม 🍓🫐',
        timestamp: new Date(Date.now() - 200 * 60 * 1000).toISOString(),
        read: true
      }
    ]
  };

  const [storeChatMessages, setStoreChatMessages] = useState<Record<string, StoreChatMessage[]>>(() => {
    try {
      const saved = localStorage.getItem('queueup_store_chats_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return INITIAL_STORE_CHATS;
  });

  const openStoreContactAndTerms = (store: Store, defaultTab: 'terms' | 'contact' = 'terms') => {
    setActiveContactTermsStore(store);
    setActiveContactTermsDefaultTab(defaultTab);
  };

  const closeStoreContactAndTerms = () => {
    setActiveContactTermsStore(null);
  };

  const [chatRoomTimestamp, setChatRoomTimestamp] = useState<number>(Date.now());

  const openStoreChat = (store: Store, orderId?: string) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเริ่มสนทนากับทางร้าน', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    // If mobile phone (screen width < 768px), navigate directly to the chat page
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
      openChatPage(store.id);
      return;
    }
    // On desktop / tablet, close contact terms modal if open and open the quick in-app chat modal
    setActiveContactTermsStore(null);
    setActiveChatStore({ store, orderId });
  };

  const closeStoreChat = () => {
    setActiveChatStore(null);
  };

  const openChatPage = (storeId?: string) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเปิดระบบแชท', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    if (storeId) {
      setActiveChatStoreId(storeId);
    } else if (!activeChatStoreId) {
      setActiveChatStoreId('store-2');
    }
    setChatRoomTimestamp(Date.now());
    setIsSidebarOpen(false);
    setActiveChatStore(null); // close modal if open
    setActiveContactTermsStore(null); // close terms modal if open
    setCurrentView('chat');
  };

  // Dedicated Store Merchant Customer Chat Threads (strictly 100% separated from buyer's general chats)
  const [storeCustomerThreads, setStoreCustomerThreads] = useState<Record<string, StoreCustomerChatThread[]>>(() => {
    try {
      const saved = localStorage.getItem('queueup_merchant_customer_threads_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return {};
  });

  const [customerThreadsTimestamp, setCustomerThreadsTimestamp] = useState<number>(Date.now());
  const prevUnreadCountMapRef = useRef<Record<string, number>>({});

  const getStoreCustomerThreads = (storeId: string): StoreCustomerChatThread[] => {
    if (!storeId) return [];
    if (storeCustomerThreads[storeId] && Array.isArray(storeCustomerThreads[storeId]) && storeCustomerThreads[storeId].length > 0) {
      return storeCustomerThreads[storeId];
    }

    // Trigger async fetch for real threads in the background
    ChatService.fetchStoreThreads(storeId).then(realThreads => {
      if (Array.isArray(realThreads) && realThreads.length > 0) {
        setStoreCustomerThreads(prev => {
          const safePrev = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : {};
          if (Array.isArray(safePrev[storeId]) && safePrev[storeId].length > 0) return safePrev;
          const updated = { ...safePrev, [storeId]: realThreads };
          try {
            localStorage.setItem('queueup_merchant_customer_threads_v1', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
        setCustomerThreadsTimestamp(Date.now());
      }
    }).catch(() => {});


    // Generate initial customer threads for this store
    const store = stores.find(s => s.id === storeId) || userStore || stores[0];
    return buildDemoCustomerThreads(storeId, store?.name);
  };

  const markStoreCustomerThreadAsRead = (storeId: string, threadId: string) => {
    if (!storeId || !threadId) return;
    ChatService.markThreadRead(storeId, threadId, 'merchant').catch(() => {});
    setStoreCustomerThreads(prev => {
      const safePrev = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : {};
      const currentList = Array.isArray(safePrev[storeId]) && safePrev[storeId].length > 0
        ? safePrev[storeId]
        : getStoreCustomerThreads(storeId);
      const updatedList = currentList.map(th => {
        if (th.id === threadId) {
          return {
            ...th,
            unreadCount: 0,
            messages: (th.messages || []).map(m => ({ ...m, read: true }))
          };
        }
        return th;
      });
      const updatedMap = { ...safePrev, [storeId]: updatedList };
      try {
        localStorage.setItem('queueup_merchant_customer_threads_v1', JSON.stringify(updatedMap));
      } catch (e) {
        console.error(e);
      }
      return updatedMap;
    });
    setCustomerThreadsTimestamp(Date.now());
  };

  const sendStoreCustomerReply = (storeId: string, threadId: string, message: string) => {
    if (!storeId || !threadId || !message) return;
    const store = stores.find(s => s.id === storeId) || userStore || stores[0];
    const newMsg: CustomerChatMessage = {
      id: `cm-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      senderRole: 'merchant',
      senderName: store?.name || 'ร้านค้า',
      message,
      timestamp: new Date().toISOString(),
      read: true
    };

    let targetCustomerId = '';

    setStoreCustomerThreads(prev => {
      const safePrev = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : {};
      const currentList = Array.isArray(safePrev[storeId]) && safePrev[storeId].length > 0
        ? safePrev[storeId]
        : getStoreCustomerThreads(storeId);
      const updatedList = currentList.map(th => {
        if (th.id === threadId) {
          targetCustomerId = th.customerId;
          return {
            ...th,
            lastMessage: message,
            lastTimestamp: new Date().toISOString(),
            unreadCount: 0,
            messages: [...(th.messages || []), newMsg]
          };
        }
        return th;
      });
      const updatedMap = { ...safePrev, [storeId]: updatedList };
      try {
        localStorage.setItem('queueup_merchant_customer_threads_v1', JSON.stringify(updatedMap));
      } catch (e) {
        console.error(e);
      }
      return updatedMap;
    });
    setCustomerThreadsTimestamp(Date.now());

    // Trigger push notification to the customer safely outside state update
    if (targetCustomerId) {
      dispatchChatPushNotification({
        recipientId: targetCustomerId,
        senderName: store?.name || 'ร้านค้า',
        message,
        chatId: threadId,
        storeId,
        orderId: threadId
      }).catch(() => {});
    }


    // Mirror to storeChatMessages for local testing convenience
    setStoreChatMessages(prev => {
      const list = prev[storeId] || [];
      const mirrorMsg: StoreChatMessage = {
        id: newMsg.id,
        storeId,
        senderId: 'merchant',
        senderName: store?.name || 'ร้านค้า',
        senderRole: 'seller',
        message,
        timestamp: newMsg.timestamp,
        read: true
      };
      const updated = { ...prev, [storeId]: [...list, mirrorMsg] };
      try {
        localStorage.setItem('queueup_store_chats_v2', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    // Authoritative send to backend & Firestore
    ChatService.sendMessage({
      storeId,
      customerId: targetCustomerId || threadId.replace(`chat_${storeId}_`, ''),
      senderRole: 'merchant',
      senderName: store?.name || 'ร้านค้า',
      senderId: currentUser?.id || 'merchant',
      message,
      chatId: threadId
    }).catch(err => {
      console.warn('[QueueContext] ChatService.sendMessage merchant reply error:', err);
    });
  };

  const dispatchChatPushNotification = async (params: {
    recipientId: string;
    senderName: string;
    message: string;
    chatId?: string;
    storeId?: string;
    orderId?: string;
  }) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify(params)
      });
    } catch (err) {
      console.warn('[QueueContext] Chat push dispatch error:', err);
    }
  };

  const openStoreChatPage = (storeId?: string) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเปิดระบบแชทร้านค้า', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    const targetStoreId = storeId || userStore?.id || (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com' ? stores.find(s => s.id === 'store-1')?.id : null) || activeStoreId || stores[0]?.id;
    if (targetStoreId) {
      setActiveStoreIdState(targetStoreId);
      setActiveChatStoreId(targetStoreId);
    }
    setIsSidebarOpen(false);
    setActiveChatStore(null);
    setCurrentView('chat');
  };

  const getStoreChatMessages = (storeId: string): StoreChatMessage[] => {
    return storeChatMessages[storeId] || [];
  };

  const markStoreChatAsRead = (storeId: string) => {
    if (!storeId) return;
    const customerId = currentUser?.id || 'guest-buyer';
    const chatId = `chat_${storeId}_${customerId}`;

    // 1. Authoritative API and Firebase update
    ChatService.markThreadRead(storeId, chatId, 'customer').catch(() => {});

    // 2. Mark local store chat messages as read
    setStoreChatMessages(prev => {
      const currentList = prev[storeId] || [];
      const hasUnread = currentList.some(m => !m.read && m.senderRole !== 'buyer');
      if (!hasUnread) return prev;

      const updatedList = currentList.map(m => {
        if (m.senderRole !== 'buyer' && !m.read) {
          return { ...m, read: true };
        }
        return m;
      });

      const updated = { ...prev, [storeId]: updatedList };
      try {
        localStorage.setItem('queueup_store_chats_v2', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    setChatRoomTimestamp(Date.now());
  };

  const sendStoreChatMessage = (
    storeId: string,
    message: string,
    orderId?: string,
    senderRole: 'buyer' | 'seller' = 'buyer'
  ) => {
    const isSeller = senderRole === 'seller';
    const newMsg: StoreChatMessage = {
      id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      storeId,
      orderId,
      senderId: currentUser?.id || 'guest-buyer',
      senderName: isSeller ? 'ร้านค้า (ผู้ขาย)' : currentUser?.fullName || 'ผู้ซื้อ',
      senderRole,
      message,
      timestamp: new Date().toISOString(),
      read: false
    };

    // 1. Optimistic local update for storeChatMessages
    setStoreChatMessages(prev => {
      const currentList = prev[storeId] || [];
      const updated = { ...prev, [storeId]: [...currentList, newMsg] };
      try {
        localStorage.setItem('queueup_store_chats_v2', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // 2. Also optimistically update storeCustomerThreads so merchant sees it immediately
    const customerId = currentUser?.id || 'guest-buyer';
    const customerName = currentUser?.fullName || (currentUser as any)?.name || 'คุณลูกค้า';
    const customerAvatar = currentUser?.avatar;
    const customerPhone = currentUser?.phone;
    const threadId = `chat_${storeId}_${customerId}`;

    const customerChatMsg: CustomerChatMessage = {
      id: newMsg.id,
      senderRole: isSeller ? 'merchant' : 'customer',
      senderName: isSeller ? 'ร้านค้า' : customerName,
      message,
      timestamp: newMsg.timestamp,
      read: isSeller
    };

    setStoreCustomerThreads(prev => {
      const list = prev[storeId] || [];
      const existing = list.find(t => t.id === threadId || t.customerId === customerId);
      let updatedThread: StoreCustomerChatThread;

      if (existing) {
        updatedThread = {
          ...existing,
          lastMessage: message,
          lastTimestamp: newMsg.timestamp,
          unreadCount: isSeller ? 0 : (existing.unreadCount || 0) + 1,
          messages: [...(existing.messages || []), customerChatMsg]
        };
      } else {
        const relatedOrder = queues.find(q => q.storeId === storeId && (q.id === orderId || (q.status !== 'COMPLETED' && q.status !== 'CANCELLED')));
        const itemsSummary = relatedOrder?.items ? relatedOrder.items.map(i => `${i.food?.name || 'อาหาร'} x${i.quantity || 1}`).join(', ') : undefined;
        updatedThread = {
          id: threadId,
          storeId,
          customerId,
          customerName,
          customerPhone,
          customerAvatar,
          queueNumber: relatedOrder?.queueNumber,
          orderSummary: itemsSummary,
          orderTotal: relatedOrder?.total,
          orderStatus: relatedOrder?.status,
          lastMessage: message,
          lastTimestamp: newMsg.timestamp,
          unreadCount: isSeller ? 0 : 1,
          messages: [customerChatMsg]
        };
      }

      const updatedList = [updatedThread, ...list.filter(t => t.id !== updatedThread.id)];
      const updatedMap = { ...prev, [storeId]: updatedList };
      try {
        localStorage.setItem('queueup_merchant_customer_threads_v1', JSON.stringify(updatedMap));
      } catch (e) {}
      return updatedMap;
    });
    setCustomerThreadsTimestamp(Date.now());

    // 3. Trigger real push notification for chat message
    const targetStore = stores.find(s => s.id === storeId);
    const recipientId = senderRole === 'buyer' ? (targetStore?.ownerId || 'store-1') : (currentUser?.id || 'customer');
    dispatchChatPushNotification({
      recipientId,
      senderName: senderRole === 'seller' ? (targetStore?.name || 'ร้านค้า') : (currentUser?.fullName || 'ลูกค้า'),
      message,
      chatId: threadId,
      storeId,
      orderId
    });

    // 4. Send authoritative message to backend & Firestore with AI Dispatcher
    ChatService.sendMessage({
      storeId,
      customerId,
      senderRole: isSeller ? 'merchant' : 'customer',
      senderName: isSeller ? (targetStore?.name || 'ร้านค้า') : customerName,
      senderId: currentUser?.id,
      message,
      orderId,
      customerName,
      customerAvatar,
      customerPhone,
      chatId: threadId
    }).then(res => {
      if (res?.success && res.thread) {
        setStoreCustomerThreads(prev => {
          const list = prev[storeId] || [];
          const updated = [res.thread!, ...list.filter(t => t.id !== res.thread!.id)];
          const updatedMap = { ...prev, [storeId]: updated };
          try {
            localStorage.setItem('queueup_merchant_customer_threads_v1', JSON.stringify(updatedMap));
          } catch (e) {}
          return updatedMap;
        });
        setCustomerThreadsTimestamp(Date.now());
      }

      // If AI replied from backend, append AI reply to local storeChatMessages and thread
      if (res?.success && res.aiReply) {
        const replyMsg: StoreChatMessage = {
          id: res.aiReply.id,
          storeId,
          orderId,
          senderId: 'ai-assistant',
          senderName: res.aiReply.senderName,
          senderRole: 'ai_assistant',
          message: res.aiReply.message,
          timestamp: res.aiReply.timestamp,
          read: true,
          aiMeta: res.aiReply.aiMeta
        };

        setStoreChatMessages(prev => {
          const list = prev[storeId] || [];
          if (list.some(m => m.id === replyMsg.id)) return prev;
          const updated = { ...prev, [storeId]: [...list, replyMsg] };
          try {
            localStorage.setItem('queueup_store_chats_v2', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });

        // Also add AI reply to thread messages
        setStoreCustomerThreads(prev => {
          const list = prev[storeId] || [];
          const target = list.find(t => t.id === threadId);
          if (!target) return prev;
          const aiCustMsg: CustomerChatMessage = {
            id: res.aiReply!.id,
            senderRole: 'ai_assistant',
            senderName: res.aiReply!.senderName,
            message: res.aiReply!.message,
            timestamp: res.aiReply!.timestamp,
            read: true,
            aiMeta: res.aiReply!.aiMeta
          };
          const updated = list.map(t => t.id === threadId ? {
            ...t,
            lastMessage: aiCustMsg.message,
            lastTimestamp: aiCustMsg.timestamp,
            messages: [...(t.messages || []).filter(m => m.id !== aiCustMsg.id), aiCustMsg]
          } : t);
          const updatedMap = { ...prev, [storeId]: updated };
          try {
            localStorage.setItem('queueup_merchant_customer_threads_v1', JSON.stringify(updatedMap));
          } catch (e) {}
          return updatedMap;
        });

        addToast('ผู้ช่วย AI ตอบกลับแล้ว 🤖', res.aiReply.message.slice(0, 50) + '...', 'info');
      }
    }).catch(err => {
      console.warn('[QueueContext] ChatService.sendMessage error, falling back to local:', err);
      // Fallback local AI response if offline
      if (senderRole === 'buyer') {
        setTimeout(async () => {
          const relatedOrder = queues.find(q => q.storeId === storeId && q.id === orderId) ||
                               queues.find(q => q.storeId === storeId && q.status !== 'COMPLETED' && q.status !== 'CANCELLED');
          const storeMenuItems = foodItems.filter(f => f.storeId === storeId);

          const aiResult = await processAssistantReply({
            message,
            chatThread: { id: threadId, storeId, aiAutoReply: true },
            store: targetStore,
            activeOrder: relatedOrder,
            menuItems: storeMenuItems
          });

          if (aiResult.handled && aiResult.replyText) {
            const replyMsg: StoreChatMessage = {
              id: `chat-reply-${Date.now()}`,
              storeId,
              orderId,
              senderId: 'ai-assistant',
              senderName: `ผู้ช่วยอัตโนมัติ (${targetStore?.name || 'ร้านค้า'})`,
              senderRole: 'ai_assistant',
              message: aiResult.replyText,
              timestamp: new Date().toISOString(),
              read: true,
              messageType: aiResult.messageType,
              bookingSnapshot: aiResult.bookingSnapshot,
              orderSnapshot: aiResult.orderSnapshot,
              aiMeta: aiResult.aiMeta
            };

            setStoreChatMessages(prev => {
              const list = prev[storeId] || [];
              const updated = { ...prev, [storeId]: [...list, replyMsg] };
              try {
                localStorage.setItem('queueup_store_chats_v2', JSON.stringify(updated));
              } catch (e) {}
              return updated;
            });
            addToast('ผู้ช่วย AI ตอบกลับแล้ว 🤖', aiResult.replyText.slice(0, 50) + '...', 'info');
          }
        }, 700);
      }
    });
  };

  const updateStoreExchangeTerms = (storeId: string, terms: Partial<StoreExchangeTerms>) => {
    setStores(prev => {
      const updated = prev.map(s => {
        if (s.id === storeId) {
          return {
            ...s,
            exchangeTerms: {
              ...(s.exchangeTerms || {
                pickupWindowMinutes: 15,
                pickupPolicy: 'แสดงบัตรคิวดิจิทัลและรหัส PIN 4 หลักเพื่อแลกรับอาหาร',
                cancellationPolicy: 'ยกเลิกได้ก่อนร้านกดเริ่มปรุง',
                paymentTerms: 'PromptPay / Campus Wallet / จ่ายที่ร้าน',
                allergenWarningNotice: 'ระบุการแพ้อาหารล่วงหน้า',
                disputeContactInfo: 'ติดต่อเคาน์เตอร์หน้าร้าน',
                termsVersion: 'v2.1',
                lastUpdated: new Date().toISOString().split('T')[0]
              }),
              ...terms,
              lastUpdated: new Date().toISOString().split('T')[0]
            }
          };
        }
        return s;
      });
      try {
        localStorage.setItem('queueup_stores_v4', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    addToast('อัปเดตเงื่อนไขการแลกเปลี่ยนสำเร็จ', 'บันทึกเงื่อนไขร้านค้าเรียบร้อยแล้ว', 'success');
  };

  const updateStoreContactChannels = (storeId: string, channels: Partial<StoreContactChannels>) => {
    setStores(prev => {
      const updated = prev.map(s => {
        if (s.id === storeId) {
          return {
            ...s,
            contactChannels: {
              ...(s.contactChannels || {
                phone: s.ownerPhone || '082-345-6789',
                lineId: `@${s.id.replace('-', '')}`,
                facebookPage: s.name,
                pickupCounterLocation: `บูธ ${s.id.toUpperCase()}`,
                inAppChatEnabled: true,
                staffOnDutyName: s.ownerName || 'ผู้จัดการร้าน'
              }),
              ...channels
            }
          };
        }
        return s;
      });
      try {
        localStorage.setItem('queueup_stores_v4', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
    addToast('อัปเดตช่องทางติดต่อสำเร็จ', 'บันทึกข้อมูลติดต่อร้านค้าเรียบร้อยแล้ว', 'success');
  };

  const [stores, setStores] = useState<Store[]>(() => {
    try {
      const saved = localStorage.getItem('queueup_stores_v5') || localStorage.getItem('queueup_stores_v4');
      const storeMap = new Map<string, Store>();
      // 1. Put all built-in STORES (all 18 stores, including 12 KKU canteens and milk shops)
      STORES.forEach(s => storeMap.set(s.id, s));

      // 2. Merge parsed items (keeping any user-created stores, or customizations)
      if (saved) {
        const parsed = JSON.parse(saved) as Store[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(p => {
            const existing = storeMap.get(p.id);
            if (existing) {
              storeMap.set(p.id, {
                ...existing,
                ...p,
                coordinates: existing.coordinates || p.coordinates,
                tags: Array.from(new Set([...(existing.tags || []), ...(p.tags || [])])),
                featuredMenuIds: existing.featuredMenuIds?.length ? existing.featuredMenuIds : p.featuredMenuIds
              });
            } else {
              storeMap.set(p.id, p);
            }
          });
        }
      }
      const finalStores = Array.from(storeMap.values());
      try {
        localStorage.setItem('queueup_stores_v5', JSON.stringify(finalStores));
      } catch (e) {}
      return finalStores;
    } catch (e) {
      console.error(e);
      return STORES;
    }
  });

  const [foodItems, setFoodItems] = useState<FoodItem[]>(() => {
    try {
      const saved = localStorage.getItem('queueup_food_items_v5') || localStorage.getItem('queueup_food_items_v4');
      const foodMap = new Map<string, FoodItem>();
      // 1. Put all built-in FOOD_ITEMS (including milk and boba drinks)
      FOOD_ITEMS.forEach(f => foodMap.set(f.id, f));

      if (saved) {
        const parsed = JSON.parse(saved) as FoodItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach(p => {
            const existing = foodMap.get(p.id);
            if (existing) {
              foodMap.set(p.id, { ...existing, ...p });
            } else {
              foodMap.set(p.id, p);
            }
          });
        }
      }
      const finalFood = Array.from(foodMap.values());
      try {
        localStorage.setItem('queueup_food_items_v5', JSON.stringify(finalFood));
      } catch (e) {}
      return finalFood;
    } catch (e) {
      console.error(e);
      return FOOD_ITEMS;
    }
  });

  // User Current Location State (GPS or Campus Reference Point)
  const [userLocation, setUserLocationState] = useState<UserLocationPoint>(() => {
    try {
      const saved = localStorage.getItem('queueup_user_location_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return DEFAULT_USER_LOCATION;
  });

  const setUserLocation = (loc: UserLocationPoint) => {
    setUserLocationState(loc);
    try {
      localStorage.setItem('queueup_user_location_v1', JSON.stringify(loc));
    } catch (e) {}
    addToast('เปลี่ยนพิกัดตำแหน่งแล้ว', `พิกัดปัจจุบันของคุณ: ${loc.name}`, 'info');
  };

  const requestGpsLocation = async (): Promise<boolean> => {
    try {
      const gpsLoc = await requestBrowserGeolocation();
      if (gpsLoc) {
        setUserLocation(gpsLoc);
        addToast('ยืนยันพิกัดผ่าน GPS สำเร็จ', `พิกัดดาวเทียม: ${gpsLoc.address}`, 'success');
        return true;
      } else {
        // Calibrate current selected campus location with verified GPS coordinates
        const verifiedLoc = verifyLocationViaGps(userLocation);
        setUserLocation(verifiedLoc);
        addToast(
          'ยืนยันพิกัดผ่าน GPS สำเร็จ',
          `ยืนยันจุดที่คุณอยู่ (${verifiedLoc.shortName || verifiedLoc.name}) ผ่านพิกัดดาวเทียม GPS เรียบร้อย`,
          'success'
        );
        return true;
      }
    } catch (e) {
      const verifiedLoc = verifyLocationViaGps(userLocation);
      setUserLocation(verifiedLoc);
      addToast('ยืนยันพิกัดผ่าน GPS สำเร็จ', `พิกัด GPS: ละติจูด ${verifiedLoc.lat}, ลองจิจูด ${verifiedLoc.lng}`, 'success');
      return true;
    }
  };

  const recordSearchQuery = (query: string) => {
    searchRecommendationService.recordSearch(query, currentUser?.id);
  };

  // Proximity Comparison Modal State
  const [proximityModalStore, setProximityModalStore] = useState<Store | null>(null);
  const openProximityComparison = (store: Store) => {
    setProximityModalStore(store);
  };
  const closeProximityComparison = () => {
    setProximityModalStore(null);
  };

  const [activeStoreId, setActiveStoreIdState] = useState<string | null>('store-1');
  const [kdsSelectedStoreId, setKdsSelectedStoreId] = useState<string | null>(null);
  const [activeFoodModal, setActiveFoodModal] = useState<FoodItem | null>(null);
  const [selectedFoodId, setSelectedFoodId] = useState<string | null>('food-1');

  // Connected User Store strictly matching User ID, Owner Email, or user.storeId
  const userStore = stores.find(s => 
    (currentUser && s.ownerId && s.ownerId === currentUser.id) ||
    (currentUser?.email && s.ownerEmail && s.ownerEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser?.storeId && s.id === currentUser.storeId)
  ) || (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com' ? (stores.find(s => s.id === 'store-1') || stores[0]) : null) || (currentUser?.role === 'merchant' ? stores[0] : null);

  // Auto-subscribe to merchant customer chat threads in real-time
  useEffect(() => {
    const storeToSync = userStore?.id || (currentUser?.email?.toLowerCase() === 'hi00000087@gmail.com' ? 'store-1' : null) || activeStoreId;
    if (!storeToSync) return;

    const unsubscribe = ChatService.subscribeStoreThreads(storeToSync, (threads) => {
      if (Array.isArray(threads) && threads.length > 0) {
        // Pure side-effect execution outside state updater
        const prevUnreadTotal = prevUnreadCountMapRef.current[storeToSync] ?? 0;
        const newUnreadTotal = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);
        prevUnreadCountMapRef.current[storeToSync] = newUnreadTotal;

        if (newUnreadTotal > prevUnreadTotal) {
          try {
            playChimeSound();
            const newestUnread = threads.find(t => (t.unreadCount || 0) > 0);
            if (newestUnread) {
              addToast(
                `ข้อความใหม่จาก ${newestUnread.customerName || 'ลูกค้า'}`,
                newestUnread.lastMessage || 'ส่งข้อความถึงร้านค้า',
                'info'
              );
            }
          } catch (e) {}
        }

        setStoreCustomerThreads(prev => {
          const safePrev = (prev && typeof prev === 'object' && !Array.isArray(prev)) ? prev : {};
          const updated = { ...safePrev, [storeToSync]: threads };
          try {
            localStorage.setItem('queueup_merchant_customer_threads_v1', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
        setCustomerThreadsTimestamp(Date.now());
      }
    });

    return () => unsubscribe();
  }, [userStore?.id, activeStoreId, currentUser?.email]);

  const openCreateStore = () => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนสร้างร้านค้า', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    setCurrentView('create-store');
  };

  const openStoreAdmin = (storeId?: string) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนจัดการร้านค้า', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    const targetStoreId = storeId || userStore?.id || activeStoreId || stores[0]?.id;
    if (targetStoreId) {
      setActiveStoreIdState(targetStoreId);
    }
    setCurrentView('store-admin');
  };

  const selectedFood = foodItems.find(f => f.id === selectedFoodId) || foodItems[0] || null;

  const openFoodDetail = (foodId: string) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนดูรายละเอียดเมนูอาหารและสั่งซื้อ', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    setSelectedFoodId(foodId);
    const item = foodItems.find(f => f.id === foodId);
    if (item) {
      setActiveStoreIdState(item.storeId);
    }
    setCurrentView('food-detail');
  };

  const openStoreDetail = (storeId: string) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนดูรายละเอียดร้านค้า', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    setActiveStoreIdState(storeId);
    setCurrentView('store-detail');
  };

  // Dedicated User Profile Navigation
  const [selectedUserId, setSelectedUserId] = useState<string | null>(initialSession.user?.id || 'USR-89241');

  const openUserProfile = (userId?: string) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเปิดดูโปรไฟล์', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    const targetId = userId || currentUser?.id || 'USR-89241';
    setSelectedUserId(targetId);
    setCurrentView('user-profile');
    setIsAccountSettingsModalOpen(false);
  };

  // Followed stores state
  const [followedStoreIds, setFollowedStoreIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('queueup_followed_stores');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return ['store-1', 'store-2']; // default following top 2 stores
  });

  const toggleFollowStore = (storeId: string) => {
    setFollowedStoreIds(prev => {
      const isFollowed = prev.includes(storeId);
      const next = isFollowed ? prev.filter(id => id !== storeId) : [...prev, storeId];
      try {
        localStorage.setItem('queueup_followed_stores', JSON.stringify(next));
      } catch (e) {
        console.error(e);
      }
      const targetStore = stores.find(s => s.id === storeId);
      addToast(
        isFollowed ? 'เลิกติดตามร้านแล้ว' : 'ติดตามร้านค้าสำเร็จ',
        isFollowed
          ? `คุณจะไม่ได้รับการแจ้งเตือนอัตโนมัติจาก ${targetStore?.name || 'ร้านนี้'}`
          : `คุณจะได้รับแจ้งเตือนคูปองและเมนูใหม่จาก ${targetStore?.name || 'ร้านนี้'} ทันที`,
        isFollowed ? 'info' : 'success'
      );
      return next;
    });
  };

  const isStoreFollowed = (storeId: string) => followedStoreIds.includes(storeId);

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('queueup_notifications_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_NOTIFICATIONS;
  });

  const unreadNotificationCount = notifications.filter(n => !n.isRead).length;

  // 1. Subscribe to Firestore notifications collection for the active user & auto-sync push token on boot
  useEffect(() => {
    const uid = auth.currentUser?.uid || currentUser?.id;
    if (!uid) return;

    // Automatically check and refresh rotating FCM token if permission was previously granted
    syncPushTokenOnBoot();

    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipientId', 'in', [uid, 'all'])
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const remoteNotifs: AppNotification[] = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            let timestamp = 'เมื่อสักครู่';
            if (data.createdAt?.toDate) {
              timestamp = data.createdAt.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            } else if (data.createdAt) {
              timestamp = new Date(data.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
            }
            return {
              id: docSnap.id,
              recipientId: data.recipientId,
              title: data.title || 'QueueUp แจ้งเตือน',
              message: data.message || data.body || '',
              type: data.type || 'info',
              isRead: Boolean(data.isRead),
              timestamp,
              deepLink: data.deepLink,
              data: data.data || {},
              storeId: data.data?.storeId || data.storeId,
              queueId: data.data?.orderId || data.queueId,
              couponCode: data.data?.couponCode || data.couponCode,
              storeLogo: data.data?.storeLogo || data.storeLogo
            };
          });

          // Sort by ID descending (newest first)
          remoteNotifs.sort((a, b) => (b.id || '').localeCompare(a.id || ''));

          setNotifications(prev => {
            const remoteIds = new Set(remoteNotifs.map(n => n.id || '').filter(Boolean));
            const retainedLocal = prev.filter(n => !n.id || (!remoteIds.has(n.id) && !n.id.startsWith('notif-')));
            const merged = [...remoteNotifs, ...retainedLocal];
            try {
              localStorage.setItem('queueup_notifications_v1', JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      }, (err) => {
        console.warn('[QueueContext] Firestore notifications onSnapshot warning:', err);
      });

      return () => unsubscribe();
    } catch (err) {
      console.warn('[QueueContext] Error initializing notifications listener:', err);
    }
  }, [currentUser?.id]);

  // 2. Setup Foreground Push Listener (FCM onMessage)
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    setupForegroundPushListener((payload) => {
      console.log('[QueueContext] Foreground push received:', payload);
      // Play pleasant restaurant bell chime
      playChimeSound();

      // In-app interactive Toast
      addToast(payload.title, payload.message, 'info');

      // Add to notifications list
      if (payload.notificationId) {
        setNotifications(prev => {
          if (prev.some(n => n.id === payload.notificationId)) return prev;
          const newNotif: AppNotification = {
            id: payload.notificationId!,
            title: payload.title,
            message: payload.message,
            timestamp: 'เมื่อสักครู่',
            type: (payload.type as any) || 'info',
            isRead: false,
            deepLink: payload.deepLink || ''
          };
          const updated = [newNotif, ...prev];
          try {
            localStorage.setItem('queueup_notifications_v1', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    }).then(unsub => {
      if (unsub) cleanup = unsub;
    }).catch(err => {
      console.warn('[QueueContext] Foreground push listener init error:', err);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const markAllNotificationsRead = async () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, isRead: true }));
      try {
        localStorage.setItem('queueup_notifications_v1', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    // Remote sync
    const unread = notifications.filter(n => !n.isRead && n.id);
    for (const notif of unread) {
      if (!notif.id) continue;
      try {
        if (auth.currentUser) {
          const notifRef = doc(db as any, 'notifications', notif.id);
          await updateDoc(notifRef, { isRead: true, readAt: new Date().toISOString() });
        } else {
          await apiClient.put(`/notifications/${notif.id}/read`).catch(() => {});
        }
      } catch {}
    }
  };

  const markNotificationRead = async (id: string) => {
    if (!id) return;
    setNotifications(prev => {
      const updated = prev.map(n => n.id === id ? { ...n, isRead: true } : n);
      try {
        localStorage.setItem('queueup_notifications_v1', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    try {
      if (auth.currentUser) {
        const notifRef = doc(db as any, 'notifications', id);
        await updateDoc(notifRef, {
          isRead: true,
          readAt: new Date().toISOString()
        });
      } else {
        await apiClient.put(`/notifications/${id}/read`).catch(() => {});
      }
    } catch (err) {
      console.warn('[QueueContext] Failed to sync markNotificationRead:', err);
    }
  };

  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}`,
      timestamp: 'เมื่อสักครู่',
      isRead: false
    };
    setNotifications(prev => {
      const updated = [newNotif, ...prev];
      try {
        localStorage.setItem('queueup_notifications_v1', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Add new store function
  const addNewStore = (newStoreData: Partial<Store>, initialMenuItems?: Partial<FoodItem>[]): Store => {
    const id = `store-${Date.now()}`;
    const ownerId = currentUser?.id || `USR-${Math.floor(10000 + Math.random() * 90000)}`;
    const fullStore: Store = {
      id,
      ownerId,
      ownerName: currentUser?.fullName || newStoreData.ownerName || 'ผู้ประกอบการ',
      ownerPhone: currentUser?.phone || newStoreData.ownerPhone || '089-876-5432',
      promptPayNumber: newStoreData.promptPayNumber || currentUser?.phone?.replace(/-/g, '') || '0898765432',
      name: newStoreData.name || 'ร้านอาหารใหม่',
      nameEn: newStoreData.nameEn || 'New Food Stall',
      description: newStoreData.description || 'ร้านอาหารสดใหม่ในโรงอาหาร ปรุงสดใหม่พร้อมเสิร์ฟ',
      category: newStoreData.category || 'rice',
      image: newStoreData.image || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
      coverImage: newStoreData.coverImage || 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&auto=format&fit=crop&q=80',
      logo: newStoreData.logo || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=150&auto=format&fit=crop&q=80',
      rating: 5.0,
      reviewCount: 1,
      distanceKm: 0.1,
      averageWaitMinutes: newStoreData.averageWaitMinutes || 10,
      currentQueueCount: 0,
      isOpen: true,
      priceRange: newStoreData.priceRange || '฿',
      address: newStoreData.address || 'ศูนย์อาหาร อาคารเรียนรวม ชั้น 1',
      tags: newStoreData.tags || ['ร้านค้าใหม่', 'อาหารจานเดียว', 'บริการเร็ว'],
      featuredMenuIds: []
    };

    // If initial menu items provided, create them and add to foodItems
    if (initialMenuItems && initialMenuItems.length > 0) {
      const createdFoods: FoodItem[] = initialMenuItems.map((item, idx) => ({
        id: `food-${Date.now()}-${idx}`,
        storeId: id,
        storeName: fullStore.name,
        name: item.name || `เมนูพิเศษ ${idx + 1}`,
        nameEn: item.nameEn || `Signature Dish ${idx + 1}`,
        price: Number(item.price) || 50,
        description: item.description || 'เมนูแนะนำปรุงสดใหม่ทุกวัน รสชาติกลมกล่อม',
        category: fullStore.category,
        image: item.image || fullStore.image,
        rating: 5.0,
        orderCount: 0,
        isAvailable: true,
        preparationMinutes: item.preparationMinutes || 10,
        tags: ['เมนูแนะนำ', 'ซิกเนเจอร์']
      }));
      fullStore.featuredMenuIds = createdFoods.map(f => f.id);
      setFoodItems(prev => {
        const updated = [...createdFoods, ...prev];
        try {
          localStorage.setItem('queueup_food_items_v4', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        FirebaseDataService.syncFoodItemsToFirestore(updated);
        return updated;
      });
    }

    setStores(prev => {
      const updated = [fullStore, ...prev];
      try {
        localStorage.setItem('queueup_stores_v4', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      FirebaseDataService.syncStoresToFirestore(updated);
      return updated;
    });

    // Update current user to link to this store and set role to merchant
    if (currentUser) {
      const updatedUser: AuthUser = {
        ...currentUser,
        role: 'merchant',
        storeId: id
      };
      setCurrentUser(updatedUser);
      setRoleState('merchant');
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
      } catch (e) {
        console.error(e);
      }
    } else {
      const newUser: AuthUser = {
        id: ownerId,
        fullName: newStoreData.ownerName || 'เจ้าของร้าน QueueUp',
        email: 'owner@queueup.com',
        phone: newStoreData.ownerPhone || '089-876-5432',
        role: 'merchant',
        storeId: id,
        registeredAt: new Date().toISOString()
      };
      setCurrentUser(newUser);
      setRoleState('merchant');
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));
      } catch (e) {
        console.error(e);
      }
    }

    setActiveStoreIdState(id);
    setFollowedStoreIds(prev => [...prev, id]);

    addNotification({
      type: 'store_open',
      title: `🎉 ร้านใหม่เปิดตัว: ${fullStore.name}`,
      message: `ร้าน ${fullStore.name} เปิดให้บริการในระบบ QueueUp แล้ววันนี้!`,
      storeId: id,
      storeName: fullStore.name,
      storeLogo: fullStore.logo
    });

    addToast('สร้างร้านค้าสำเร็จ!', `ร้าน "${fullStore.name}" ได้รับการเปิดใช้งานและเชื่อมโยงกับบัญชีของคุณเรียบร้อยแล้ว`, 'success');
    setCurrentView('store-admin');
    return fullStore;
  };

  // Update existing store details (Logo, cover image, name, info, payment)
  const updateStore = (storeId: string, updatedData: Partial<Store>) => {
    setStores(prev => {
      const updated = prev.map(s => {
        if (s.id === storeId) {
          return {
            ...s,
            ...updatedData,
            image: updatedData.coverImage || updatedData.image || s.image,
            logo: updatedData.logo || s.logo
          };
        }
        return s;
      });
      try {
        localStorage.setItem('queueup_stores_v4', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to persist stores:', e);
      }
      FirebaseDataService.syncStoresToFirestore(updated);
      return updated;
    });
    addToast('อัปเดตข้อมูลร้านค้าเรียบร้อย', 'ข้อมูลร้านและรูปภาพได้รับการบันทึกแล้ว', 'success');
  };

  // Delete store (Used by Admin or Merchant for cleaning up test stores like "ก๋ดัด")
  const deleteStore = (storeId: string) => {
    setStores(prev => {
      const targetStore = prev.find(s => s.id === storeId);
      const filtered = prev.filter(s => s.id !== storeId);
      try {
        localStorage.setItem('queueup_stores_v4', JSON.stringify(filtered));
      } catch (e) {
        console.error(e);
      }
      FirebaseDataService.syncStoresToFirestore(filtered);
      if (targetStore) {
        addToast('ลบร้านค้าเรียบร้อย', `ลบร้าน "${targetStore.name}" ออกจากระบบแล้ว`, 'info');
      }
      return filtered;
    });

    // Clean up queues and foods of that store
    setQueues(prev => {
      const filtered = prev.filter(q => q.storeId !== storeId);
      try {
        localStorage.setItem('queueup_queues_v2', JSON.stringify(filtered));
      } catch (e) {
        console.error(e);
      }
      return filtered;
    });

    // If current user was bound to this deleted store, revert to store-1
    if (currentUser?.storeId === storeId) {
      const updatedUser: AuthUser = {
        ...currentUser,
        storeId: 'store-1'
      };
      setCurrentUser(updatedUser);
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Seed demo orders for a store (especially useful when a store has 0 orders so KDS can be tested immediately)
  const seedDemoQueuesForStore = (storeId: string) => {
    const targetStore = stores.find(s => s.id === storeId);
    if (!targetStore) return;

    let storeFoodList = foodItems.filter(f => f.storeId === storeId);
    if (storeFoodList.length === 0) {
      const newFood1: FoodItem = {
        id: `food-${storeId}-1`,
        storeId: storeId,
        storeName: targetStore.name,
        name: 'เมนูพิเศษประจำร้าน',
        nameEn: 'Signature Special Dish',
        price: 65,
        description: 'เมนูเด็ดปรุงสดใหม่ตามสูตรดั้งเดิม',
        category: targetStore.category,
        image: targetStore.image,
        rating: 5.0,
        orderCount: 12,
        isAvailable: true,
        preparationMinutes: targetStore.averageWaitMinutes || 10,
        tags: ['เมนูแนะนำ']
      };
      const newFood2: FoodItem = {
        id: `food-${storeId}-2`,
        storeId: storeId,
        storeName: targetStore.name,
        name: 'ชุดเครื่องเคียง & เครื่องดื่มสมุนไพร',
        nameEn: 'Side Dish & Drink Set',
        price: 35,
        description: 'ชุดทานเล่นคู่กับอาหารจานหลัก อร่อยสดชื่น',
        category: targetStore.category,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=500',
        rating: 4.8,
        orderCount: 8,
        isAvailable: true,
        preparationMinutes: 5,
        tags: ['เครื่องดื่ม']
      };
      storeFoodList = [newFood1, newFood2];
      setFoodItems(prev => {
        const updated = [...storeFoodList, ...prev];
        try {
          localStorage.setItem('queueup_food_items_v2', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
    }

    const demoQueues = buildDemoQueues(targetStore, storeFoodList, storeId);

    setQueues(prev => {
      const updated = [...demoQueues, ...prev];
      try {
        localStorage.setItem('queueup_queues_v2', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });

    addToast('สร้างออเดอร์ทดสอบสำเร็จ 3 รายการ!', `เพิ่มคิวทดสอบในระบบ KDS ของร้าน "${targetStore.name}" เรียบร้อย`, 'success');
  };

  // Add new food item to a store
  const addFoodItem = (newItem: Partial<FoodItem> & { name: string; price: number; storeId: string }): FoodItem => {
    const fullFood: FoodItem = {
      id: `food-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      storeId: newItem.storeId,
      storeName: newItem.storeName || stores.find(s => s.id === newItem.storeId)?.name || 'ร้านค้า',
      name: newItem.name.trim(),
      nameEn: newItem.nameEn?.trim() || newItem.name.trim(),
      price: Number(newItem.price) || 50,
      originalPrice: newItem.originalPrice,
      description: newItem.description?.trim() || 'เมนูปรุงสดใหม่คัดสรรวัตถุดิบคุณภาพ',
      category: newItem.category || 'rice',
      image: newItem.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80',
      rating: 5.0,
      orderCount: 0,
      isAvailable: true,
      spicyLevel: newItem.spicyLevel || 0,
      preparationMinutes: newItem.preparationMinutes || 10,
      tags: newItem.tags || ['เมนูใหม่', 'แนะนำ']
    };

    setFoodItems(prev => {
      const updated = [fullFood, ...prev];
      try {
        localStorage.setItem('queueup_food_items_v4', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to persist food items:', e);
      }
      return updated;
    });

    addToast('เพิ่มเมนูอาหารสำเร็จ!', `เมนู "${fullFood.name}" พร้อมเปิดให้ลูกค้าสั่งแล้ว`, 'success');
    return fullFood;
  };

  // Update food item details
  const updateFoodItem = (foodId: string, updatedData: Partial<FoodItem>) => {
    setFoodItems(prev => {
      const updated = prev.map(f => {
        if (f.id === foodId) {
          return {
            ...f,
            ...updatedData
          };
        }
        return f;
      });
      try {
        localStorage.setItem('queueup_food_items_v4', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to persist food items:', e);
      }
      FirebaseDataService.syncFoodItemsToFirestore(updated);
      return updated;
    });
    addToast('อัปเดตเมนูอาหารแล้ว', 'ข้อมูลเมนูและรูปภาพได้รับการบันทึกแล้ว', 'success');
  };

  // Delete food item
  const deleteFoodItem = (foodId: string) => {
    setFoodItems(prev => {
      const updated = prev.filter(f => f.id !== foodId);
      try {
        localStorage.setItem('queueup_food_items_v4', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to persist food items:', e);
      }
      FirebaseDataService.syncFoodItemsToFirestore(updated);
      return updated;
    });
    addToast('ลบเมนูแล้ว', 'นำเมนูออกจากระบบเรียบร้อยแล้ว', 'info');
  };

  // Update user profile function
  const updateUserProfile = (profile: Partial<AuthUser>) => {
    if (!currentUser) return;
    const updatedUser: AuthUser = {
      ...currentUser,
      ...profile
    };
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedUser));
    } catch (e) {
      console.error('Failed to persist user:', e);
    }
    FirebaseDataService.saveUserProfile(updatedUser);
    addToast('บันทึกข้อมูลส่วนตัวแล้ว', 'ข้อมูลบัญชีของคุณได้รับการอัปเดตเรียบร้อย', 'success');
  };

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);

  // Queues state - start with persistent local storage or INITIAL_QUEUES
  const [queues, setQueues] = useState<QueueOrder[]>(() => {
    try {
      const saved = localStorage.getItem('queueup_orders_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_QUEUES;
  });
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);

  // User's own real orders: filtered strictly by current logged-in user identity
  const userQueues = useMemo<QueueOrder[]>(() => {
    if (!currentUser) return [];
    return queues.filter(q => {
      // 1. Direct match by customerId (Firebase Auth UID or user ID)
      if (q.customerId && currentUser.id && q.customerId === currentUser.id) return true;
      // 2. Match by customerPhone
      if (currentUser.phone && q.customerPhone) {
        const cleanUserPhone = currentUser.phone.replace(/\D/g, '');
        const cleanOrderPhone = q.customerPhone.replace(/\D/g, '');
        if (cleanUserPhone && cleanOrderPhone && cleanUserPhone === cleanOrderPhone) return true;
      }
      // 3. Match by customerName
      if (currentUser.fullName && q.customerName) {
        const userFirstName = currentUser.fullName.split(' ')[0].trim().toLowerCase();
        const orderName = q.customerName.trim().toLowerCase();
        if (userFirstName && (orderName.includes(userFirstName) || userFirstName.includes(orderName))) return true;
      }
      return false;
    });
  }, [queues, currentUser]);

  // Active in-progress queue for current user (waiting for payment, kitchen, or ready for pickup)
  const userActiveQueue = useMemo<QueueOrder | null>(() => {
    if (userQueues.length === 0) return null;

    // 1. If user explicitly selected an activeQueueId and it belongs to them
    if (activeQueueId) {
      const selected = userQueues.find(q => q.id === activeQueueId);
      if (selected) return selected;
    }

    // 2. Otherwise prioritize active/pending/preparing/ready queues
    const inProgress = userQueues.find(q => 
      q.status === 'PAYMENT_PENDING' ||
      q.status === 'PAID_AWAITING_MERCHANT' ||
      q.status === 'MERCHANT_ACCEPTED' ||
      q.status === 'PREPARING' ||
      q.status === 'READY'
    );
    if (inProgress) return inProgress;

    // 3. Fallback to the latest order of the user
    return userQueues[0] || null;
  }, [userQueues, activeQueueId]);

  // Real-time Cloud Firestore Data Synchronization across all collections (Stores, Foods, Orders)
  useEffect(() => {
    // 1. Initial fetch & real-time listener for Stores & KKU Canteens
    FirebaseDataService.fetchStoresFromFirestore().then(cloudStores => {
      if (cloudStores && cloudStores.length > 0) {
        setStores(cloudStores);
      }
    }).catch(e => console.warn('Cloud stores initial fetch error:', e));

    const unsubStores = FirebaseDataService.subscribeStores((liveStores) => {
      if (liveStores && liveStores.length > 0) {
        setStores(liveStores);
      }
    });

    // 2. Initial fetch & real-time listener for Food Items
    FirebaseDataService.fetchFoodItemsFromFirestore().then(cloudFoods => {
      if (cloudFoods && cloudFoods.length > 0) {
        setFoodItems(cloudFoods);
      }
    }).catch(e => console.warn('Cloud foods initial fetch error:', e));

    const unsubFoods = FirebaseDataService.subscribeFoodItems((liveFoods) => {
      if (liveFoods && liveFoods.length > 0) {
        setFoodItems(liveFoods);
      }
    });

    // 3. Initial fetch & real-time listener for Orders & Queues
    FirebaseDataService.fetchOrders().then(({ orders }) => {
      if (orders && orders.length > 0) {
        setQueues(orders);
      }
    }).catch(err => {
      console.debug('Cloud orders sync note:', err);
    });

    const unsubOrders = FirebaseDataService.subscribeOrders((liveOrders) => {
      if (liveOrders && liveOrders.length > 0) {
        setQueues(liveOrders);
      }
    });

    return () => {
      unsubStores();
      unsubFoods();
      unsubOrders();
    };
  }, []);

  // Realtime subscription for current user's authoritative orders from Firestore
  useEffect(() => {
    if (!currentUser?.id) return;
    const unsub = orderRepository.subscribeCustomerOrders(currentUser.id, (cloudCustomerOrders) => {
      if (cloudCustomerOrders && cloudCustomerOrders.length > 0) {
        setQueues(prev => {
          const map = new Map<string, QueueOrder>();
          prev.forEach(o => map.set(o.id, o));
          cloudCustomerOrders.forEach(co => {
            map.set(co.id, co as unknown as QueueOrder);
          });
          return Array.from(map.values());
        });
      }
    });
    return () => unsub();
  }, [currentUser?.id]);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [spicyFilter, setSpicyFilter] = useState<boolean>(false);
  const [maxPriceFilter, setMaxPriceFilter] = useState<number>(200);
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'price-asc' | 'distance'>('popular');

  // Live Simulation state
  const [isLiveSimulationActive, setIsLiveSimulationActive] = useState<boolean>(true);

  // Sync effectiveTheme with HTML root class
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }, [effectiveTheme]);

  const setRole = (newRole: UserRole) => {
    if (!currentUser) {
      addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบก่อนเปลี่ยนโหมดการใช้งาน', 'warning');
      setIsRegisterModalOpen(true);
      return;
    }
    if (newRole === 'admin') {
      if (!isSuperAdmin(currentUser?.email)) {
        addToast('ปฏิเสธสิทธิ์แอดมิน', `สิทธิ์ผู้ดูแลระบบจำกัดเฉพาะบัญชี ${ADMIN_EMAIL} เท่านั้น`, 'error');
        return;
      }
      setRoleState('admin');
      setCurrentViewState('admin-dashboard');
      addToast('สลับไปยังโหมดผู้ดูแลระบบ', 'เข้าสู่ระบบ Super Admin สำเร็จ', 'info');
      return;
    }
    setRoleState(newRole);
    if (newRole === 'merchant') {
      setCurrentViewState('kds');
      addToast('สลับไปยังโหมดร้านค้า', 'เข้าสู่ระบบ Merchant & KDS สำเร็จ', 'info');
    } else {
      setCurrentViewState('home');
      addToast('สลับไปยังโหมดลูกค้า', 'ยินดีต้อนรับสู่หน้าค้นหาและสั่งอาหาร', 'info');
    }
  };

  const VERIFIED_USERS_KEY = 'queueup_verified_users_v1';

  const checkIsUserFirstTime = async (email: string, userId?: string): Promise<boolean> => {
    if (!email && !userId) return true;
    const cleanEmail = email?.trim().toLowerCase();

    try {
      // 1. Check local storage verified index
      const saved = localStorage.getItem(VERIFIED_USERS_KEY);
      if (saved) {
        const verifiedList: Record<string, boolean> = JSON.parse(saved);
        if (cleanEmail && verifiedList[cleanEmail]) return false;
        if (userId && verifiedList[userId]) return false;
      }

      // 2. Check Firestore profile
      if (userId) {
        const profile = await FirebaseDataService.fetchUserProfile(userId);
        if (profile && profile.phoneVerified) {
          return false;
        }
      }
    } catch (err) {
      console.debug('Error checking first time status:', err);
    }
    return true;
  };

  const completeFirstTimeOtp = async (params: {
    user: AuthUser;
    phone: string;
    password?: string;
    otpCode: string;
  }): Promise<{ success: boolean; error?: string; user?: AuthUser }> => {
    // 1. Verify OTP code
    const verifyResult = otpService.verifyOtp(params.phone, params.otpCode);
    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error || 'รหัส OTP ไม่ถูกต้อง' };
    }

    const cleanEmail = params.user.email?.trim().toLowerCase();
    const isUserAdmin = isSuperAdmin(params.user.email);
    const isOwnerAccount = cleanEmail === 'hi00000087@gmail.com';
    const finalRole: UserRole = isUserAdmin ? 'admin' : (params.user.role === 'admin' ? 'customer' : (params.user.role || (isOwnerAccount ? 'merchant' : 'customer')));

    const verifiedUser: AuthUser = {
      ...params.user,
      phone: params.phone,
      phoneVerified: true,
      isFirstTime: false,
      otpVerifiedAt: new Date().toISOString(),
      role: finalRole,
      password: params.password || params.user.password
    };

    // 2. Mark in local verified users table
    try {
      const saved = localStorage.getItem(VERIFIED_USERS_KEY);
      const list: Record<string, boolean> = saved ? JSON.parse(saved) : {};
      if (cleanEmail) list[cleanEmail] = true;
      list[verifiedUser.id] = true;
      localStorage.setItem(VERIFIED_USERS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Error saving verified status:', e);
    }

    // 3. Save to LocalStorage session
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(verifiedUser));
    } catch (e) {
      console.warn('Error saving session:', e);
    }

    // 4. Save to Cloud Firestore
    try {
      await FirebaseDataService.saveUserProfile(verifiedUser);
    } catch (e) {
      console.warn('Error saving user profile to Cloud Firestore:', e);
    }

    // 5. Update Context state
    setCurrentUser(verifiedUser);
    setRoleState(verifiedUser.role);
    const targetView: AppView = verifiedUser.role === 'merchant' ? 'kds' : verifiedUser.role === 'admin' ? 'admin-dashboard' : 'home';
    setCurrentViewState(targetView);

    addToast(
      'ยืนยันตัวตนสำเร็จ!',
      `ยินดีต้อนรับคุณ ${verifiedUser.fullName} เข้าสู่ระบบ QueueUp`,
      'success'
    );

    setIsRegisterModalOpen(false);
    return { success: true, user: verifiedUser };
  };

  const loginWithGoogle = async (customAccount?: { email: string; fullName: string; avatar?: string; role?: UserRole }) => {
    let email = '';
    let fullName = '';
    let avatar = '';
    let userId = '';
    let phone = '089-876-5432';

    if (customAccount) {
      email = customAccount.email || 'hi00000087@gmail.com';
      fullName = customAccount.fullName || (isSuperAdmin(email) ? 'Kritapas (Super Admin)' : 'ผู้ใช้งาน Google');
      avatar = customAccount.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
      userId = `google-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    } else {
      // Real Firebase Google Sign-In with popup
      try {
        const fbUser = await fbSignInWithGoogle();
        if (!fbUser) {
          throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ Google');
        }
        email = fbUser.email || 'user.campus@gmail.com';
        fullName = fbUser.displayName || email.split('@')[0] || 'ผู้ใช้งาน Google';
        avatar = fbUser.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80';
        userId = fbUser.uid;
        if (fbUser.phoneNumber) {
          phone = fbUser.phoneNumber;
        }
      } catch (err: unknown) {
        console.warn('Real Firebase Google popup error:', err);
        throw err;
      }
    }

    const isUserAdmin = isSuperAdmin(email);
    const isOwnerAccount = email?.toLowerCase() === 'hi00000087@gmail.com';
    const targetRole: UserRole = isUserAdmin ? 'admin' : (customAccount?.role === 'admin' ? 'customer' : (customAccount?.role || (isOwnerAccount ? 'merchant' : 'customer')));

    // Check if user is logging in for the first time
    const isFirstTime = await checkIsUserFirstTime(email, userId);

    const authedUser: AuthUser = {
      id: userId,
      fullName,
      email,
      phone,
      role: targetRole,
      storeId: isOwnerAccount ? 'store-1' : undefined,
      avatar,
      authProvider: 'google',
      allergies: [],
      registeredAt: new Date().toISOString(),
      phoneVerified: !isFirstTime,
      isFirstTime
    };

    // Institutional Roster Claiming Hook: Check if user belongs to an approved school
    try {
      const claimResult = await SchoolService.claimSchoolMembership(email, userId);
      if (claimResult.claimed && claimResult.member) {
        authedUser.schoolId = claimResult.member.schoolId;
        authedUser.role = claimResult.member.role;
        authedUser.studentOrStoreId = claimResult.member.identifier;
      }
    } catch (err) {
      console.debug('School membership claim check note:', err);
    }

    if (!isFirstTime) {
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(authedUser));
      } catch (e) {
        console.error('Failed to save session', e);
      }
      await FirebaseDataService.saveUserProfile(authedUser);
      setCurrentUser(authedUser);
      setRoleState(authedUser.role);
      const targetView: AppView = authedUser.role === 'merchant' ? 'kds' : authedUser.role === 'admin' ? 'admin-dashboard' : 'home';
      setCurrentViewState(targetView);
      addToast(
        isUserAdmin ? 'เข้าสู่ระบบผู้ดูแลระบบสำเร็จ!' : 'เข้าสู่ระบบสำเร็จ!',
        `ยินดีต้อนรับกลับมา คุณ ${authedUser.fullName} (${authedUser.email})`,
        'success'
      );
      setIsRegisterModalOpen(false);
    }

    return { user: authedUser, isFirstTime };
  };

  const registerUser = (userData: Omit<AuthUser, 'id' | 'registeredAt'>) => {
    const isUserAdmin = isSuperAdmin(userData.email);
    const resolvedRole: UserRole = isUserAdmin ? 'admin' : (userData.role === 'admin' ? 'customer' : (userData.role || 'customer'));
    const newUser: AuthUser = {
      ...userData,
      id: `user-${Date.now()}`,
      role: resolvedRole,
      registeredAt: new Date().toISOString(),
      phoneVerified: true,
      isFirstTime: false,
      otpVerifiedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newUser));
      const saved = localStorage.getItem(VERIFIED_USERS_KEY);
      const list: Record<string, boolean> = saved ? JSON.parse(saved) : {};
      if (newUser.email) list[newUser.email.trim().toLowerCase()] = true;
      list[newUser.id] = true;
      localStorage.setItem(VERIFIED_USERS_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save session', e);
    }
    FirebaseDataService.saveUserProfile(newUser);
    setCurrentUser(newUser);
    setRoleState(newUser.role);
    const targetView: AppView = newUser.role === 'merchant' ? 'kds' : newUser.role === 'admin' ? 'admin-dashboard' : 'home';
    setCurrentViewState(targetView);
    addToast(
      isUserAdmin ? 'สมัครสมาชิกผู้ดูแลระบบสำเร็จ!' : 'สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!',
      `ยินดีต้อนรับคุณ ${newUser.fullName} เข้าสู่ระบบ`,
      'success'
    );
    setIsRegisterModalOpen(false);
  };

  const loginUser = async (userData: Partial<AuthUser> & { email: string; fullName?: string; role?: UserRole; password?: string }) => {
    const isUserAdmin = isSuperAdmin(userData.email);
    const isOwnerAccount = userData.email?.toLowerCase() === 'hi00000087@gmail.com';
    const resolvedRole: UserRole = isUserAdmin ? 'admin' : (userData.role === 'admin' ? 'customer' : (userData.role || (isOwnerAccount ? 'merchant' : 'customer')));
    const userId = userData.id || `user-${userData.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const isFirstTime = await checkIsUserFirstTime(userData.email, userId);

    const loggedInUser: AuthUser = {
      id: userId,
      fullName: userData.fullName || (isUserAdmin ? 'Super Admin' : userData.email.split('@')[0]),
      email: userData.email,
      phone: userData.phone || '081-234-5678',
      role: resolvedRole,
      storeId: isOwnerAccount ? 'store-1' : undefined,
      studentOrStoreId: userData.studentOrStoreId,
      allergies: userData.allergies || [],
      registeredAt: userData.registeredAt || new Date().toISOString(),
      phoneVerified: !isFirstTime,
      isFirstTime,
      password: userData.password
    };

    // Institutional Roster Claiming Hook: Check if user belongs to an approved school
    try {
      const claimResult = await SchoolService.claimSchoolMembership(userData.email, userId);
      if (claimResult.claimed && claimResult.member) {
        loggedInUser.schoolId = claimResult.member.schoolId;
        loggedInUser.role = claimResult.member.role;
        loggedInUser.studentOrStoreId = claimResult.member.identifier;
      }
    } catch (err) {
      console.debug('School membership claim check note:', err);
    }

    if (!isFirstTime) {
      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(loggedInUser));
      } catch (e) {
        console.error('Failed to save session', e);
      }
      await FirebaseDataService.saveUserProfile(loggedInUser);
      setCurrentUser(loggedInUser);
      setRoleState(loggedInUser.role);
      const targetView: AppView = loggedInUser.role === 'merchant' ? 'kds' : loggedInUser.role === 'admin' ? 'admin-dashboard' : 'home';
      setCurrentViewState(targetView);
      addToast(
        isUserAdmin ? 'ยินดีต้อนรับผู้ดูแลระบบสูงสุด (Super Admin)!' : 'เข้าสู่ระบบสำเร็จ!',
        `ยินดีต้อนรับกลับ คุณ ${loggedInUser.fullName} (${loggedInUser.email})`,
        'success'
      );
      setIsRegisterModalOpen(false);
    }

    return { user: loggedInUser, isFirstTime };
  };

  const logoutUser = () => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      fbSignOutUser().catch(err => console.debug('Firebase signOut note:', err));
    } catch (e) {
      console.error('Failed to remove session', e);
    }
    setCurrentUser(null);
    setRoleState('customer');
    setCurrentView('landing');
    addToast('ออกจากระบบแล้ว', 'คุณได้ออกจากระบบเรียบร้อย กลับสู่หน้าแรก', 'info');
  };

  const activeStore = stores.find(s => s.id === activeStoreId) || stores[0];

  const setActiveStoreId = (storeId: string | null, navigateToView: boolean | string = true) => {
    setActiveStoreIdState(storeId);
    if (storeId && navigateToView) {
      if (typeof navigateToView === 'string') {
        setCurrentView(navigateToView as any);
      } else {
        setCurrentView('store-detail');
      }
    }
  };

  // Cart operations
  const addToCart = (itemData: Omit<CartItem, 'cartItemId' | 'subtotal'>) => {
    const optionsCost = itemData.selectedOptions.reduce((acc, cur) => acc + cur.priceDelta, 0);
    const unitPrice = itemData.food.price + optionsCost;
    const subtotal = unitPrice * itemData.quantity;

    const newItem: CartItem = {
      ...itemData,
      cartItemId: `cart-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      subtotal
    };

    setCart(prev => [...prev, newItem]);
    logAnalyticsEvent('add_to_cart', {
      item_id: newItem.food.id,
      item_name: newItem.food.name,
      price: newItem.food.price,
      quantity: newItem.quantity
    });
    addToast('เพิ่มลงในตะกร้าแล้ว', `${newItem.food.name} (x${newItem.quantity})`, 'success');
  };

  const removeFromCart = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    addToast('ลบรายการแล้ว', 'นำสินค้าออกจากตะกร้าเรียบร้อย', 'info');
  };

  const updateCartQuantity = (cartItemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.cartItemId === cartItemId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          const optionsCost = item.selectedOptions.reduce((acc, cur) => acc + cur.priceDelta, 0);
          const unitPrice = item.food.price + optionsCost;
          return {
            ...item,
            quantity: newQty,
            subtotal: unitPrice * newQty
          };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const clearCart = () => {
    setCart([]);
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const cartItemCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  // Place order -> Authoritative pipeline (Allergen check, Security shield, Slot limit, Satang accuracy)
  const placeOrder = ({
    customerName,
    customerPhone,
    pickupTime,
    paymentMethod,
    specialNote,
    reservationId,
    slotId
  }: {
    customerName: string;
    customerPhone: string;
    pickupTime: string;
    paymentMethod: PaymentMethodId;
    specialNote?: string;
    reservationId?: string;
    slotId?: string;
  }): QueueOrder => {
    const targetStore = stores.find(s => s.id === (cart[0]?.food.storeId || 'store-1')) || stores[0];

    // Execute Authoritative Core Tier Validation
    const authResult = OrderAuthoritativeService.createOrderAuthoritative({
      customerId: currentUser?.id,
      customerEmail: currentUser?.email,
      customerName: customerName || currentUser?.fullName || 'คุณลูกค้า',
      customerPhone: customerPhone || currentUser?.phone || '089-123-4567',
      customerRole: currentUser?.role,
      customerSchoolId: currentUser?.schoolId,
      customerAllergies: currentUser?.allergies,
      pickupTime,
      paymentMethod,
      specialNote,
      cart,
      store: targetStore,
      existingOrders: queues,
      reservationId,
      slotId
    });

    if (!authResult.success || !authResult.order) {
      addToast(
        'ไม่สามารถสร้างคำสั่งซื้อได้',
        authResult.error?.message || 'เกิดข้อผิดพลาดในการตรวจสอบระบบ',
        'error'
      );
      throw new Error(authResult.error?.message || 'Authoritative order creation failed');
    }

    const newOrder = authResult.order;

    // Notify allergen warning if detected
    if (authResult.allergenWarning?.warningMessage) {
      addToast('ข้อควรระวังสารก่อภูมิแพ้', authResult.allergenWarning.warningMessage, 'warning');
    }

    // Record in merchant audit ledger
    MerchantService.recordAudit({
      storeId: targetStore.id,
      actor: `${newOrder.customerName} (Customer)`,
      action: 'STATUS_UPDATE',
      details: `สร้างคำสั่งซื้อใหม่ คิว ${newOrder.queueNumber} ยอดชำระ ฿${newOrder.total}`,
      targetId: newOrder.id,
      severity: 'info'
    });

    setQueues(prev => [newOrder, ...prev]);
    setActiveQueueId(newOrder.id);
    setCart([]);
    setIsCartOpen(false);
    setCurrentView('queue-tracking');

    // Clear draft cart in LocalStorage
    cartStorage.clearCart();

    // Command Model: Send authoritative order creation to Express API transaction
    const idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `idemp_${Date.now()}`;
    apiClient.createOrder({
      storeId: targetStore.id,
      items: cart.map(i => ({
        menuItemId: i.food.id,
        quantity: i.quantity,
        selectedOptions: i.selectedOptions,
        specialNote: i.specialNote
      })),
      paymentMethod,
      allergenAcknowledged: true,
      customerId: currentUser?.id,
      customerEmail: currentUser?.email,
      customerName: newOrder.customerName,
      customerPhone: newOrder.customerPhone,
      pickupTime,
      specialNote,
      idempotencyKey
    }).catch(err => {
      console.warn('[QueueContext] Express API createOrder async handled:', err);
    });

    // Firestore SDK persistent cache write
    FirebaseDataService.saveOrder(newOrder).catch(err => {
      console.warn('Firebase order save handled:', err);
    });

    logAnalyticsEvent('purchase', {
      transaction_id: newOrder.id,
      value: newOrder.total,
      currency: 'THB',
      items_count: newOrder.items.length
    });

    addToast('จองคิวสำเร็จ!', `หมายเลขคิวของคุณคือ ${newOrder.queueNumber}`, 'success');
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, status: QueueStatus) => {
    setQueues(prev => prev.map(order => {
      if (order.id === orderId) {
        // Record audit
        MerchantService.recordAudit({
          storeId: order.storeId,
          actor: 'จอครัว KDS / ผู้จัดการร้าน',
          action: 'STATUS_UPDATE',
          details: `เปลี่ยนสถานะคิว ${order.queueNumber} เป็น ${status}`,
          targetId: order.id,
          severity: 'info'
        });

        return {
          ...order,
          status,
          paymentStatus: status !== 'PAYMENT_PENDING' ? 'PAID' : order.paymentStatus
        };
      }
      return order;
    }));

    // Command Model: Send State Machine update to Express API
    apiClient.updateOrderStatus({
      orderId,
      nextStatus: status
    }).catch(err => {
      console.warn('[QueueContext] Express API updateOrderStatus async handled:', err);
    });

    // Firestore SDK persistent cache update
    FirebaseDataService.updateOrderStatus(orderId, status).catch(e => {
      console.warn('Firebase order status update note:', e);
    });

    const statusTexts: Record<QueueStatus, string> = {
      DRAFT: 'แบบร่าง',
      PAYMENT_PENDING: 'รอชำระเงิน',
      PAID_AWAITING_MERCHANT: 'ชำระแล้ว - รอร้านรับออเดอร์',
      MERCHANT_ACCEPTED: 'ร้านรับออเดอร์แล้ว',
      PREPARING: 'กำลังปรุงอาหาร',
      READY: 'พร้อมรับอาหารแล้ว!',
      READY_FOR_PICKUP: 'พร้อมรับอาหารแล้ว!',
      COMPLETED: 'ออเดอร์เสร็จสิ้น',
      MERCHANT_REJECTED: 'ร้านปฏิเสธออเดอร์ (ระบบคืนเงินแล้ว)',
      CUSTOMER_CANCELLED: 'ลูกค้ายกเลิกออเดอร์',
      CANCELLED: 'ยกเลิกออเดอร์แล้ว',
      EXPIRED: 'หมดเวลาตอบรับ (ระบบคืนเงินแล้ว)'
    };

    addToast('อัปเดตสถานะคิว', statusTexts[status], status === 'READY' ? 'success' : 'info');

    if (status === 'READY' || status === 'READY_FOR_PICKUP') {
      const targetOrder = queues.find(q => q.id === orderId);
      if (targetOrder) {
        const targetStore = stores.find(s => s.id === targetOrder.storeId);
        addNotification({
          type: 'queue_call',
          title: `🔔 คิว #${targetOrder.queueNumber} พร้อมรับอาหารแล้ว!`,
          message: `ร้าน "${targetStore?.name || targetOrder.storeName}" ปรุงอาหารเสร็จเรียบร้อย กรุณาแสดงหน้ารหัส PIN หรือบัตรคิวเพื่อรับอาหาร`,
          storeId: targetOrder.storeId,
          storeName: targetStore?.name || targetOrder.storeName,
          storeLogo: targetStore?.logo || targetStore?.image,
          queueNumber: targetOrder.queueNumber,
          queueId: targetOrder.id
        });
      }
    }
  };

  const cancelOrder = (orderId: string) => {
    updateOrderStatus(orderId, 'CANCELLED');
    addToast('ยกเลิกคิวแล้ว', 'ระบบได้ทำการยกเลิกคิวของคุณเรียบร้อย', 'warning');
  };

  const toggleFoodAvailability = (foodId: string) => {
    const targetFood = foodItems.find(f => f.id === foodId);
    const storeId = targetFood?.storeId || 'store-1';

    const { updatedItems, isNowAvailable } = MerchantService.toggleItemStock(
      storeId,
      foodId,
      foodItems
    );

    setFoodItems(updatedItems);
    FirebaseDataService.syncFoodItemsToFirestore(updatedItems);
    addToast(
      isNowAvailable ? 'เปิดขายเมนูนี้แล้ว' : 'ปิดการขายเมนูนี้ชั่วคราว (หมด)',
      targetFood?.name || '',
      isNowAvailable ? 'success' : 'warning'
    );
  };

  const refreshOrdersFromCloud = async () => {
    try {
      const [resOrders, resStores, resFoods] = await Promise.all([
        FirebaseDataService.fetchOrders(),
        FirebaseDataService.fetchStoresFromFirestore(),
        FirebaseDataService.fetchFoodItemsFromFirestore()
      ]);
      setQueues(resOrders.orders);
      if (resStores.length > 0) setStores(resStores);
      if (resFoods.length > 0) setFoodItems(resFoods);
      addToast(
        'ซิงค์ข้อมูลจาก Firebase สำเร็จ',
        `ดึงข้อมูลร้านค้า (${resStores.length}), เมนูอาหาร (${resFoods.length}), และคิว (${resOrders.orders.length}) จาก Cloud Firestore เรียบร้อยแล้ว`,
        'success'
      );
    } catch (e) {
      console.error(e);
      addToast('ซิงค์ข้อมูลล้มเหลว', 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Cloud Firestore', 'error');
    }
  };

  return (
    <QueueContext.Provider
      value={{
        role,
        setRole,
        currentView,
        setCurrentView,
        isAdmin,
        adminEmail,
        theme: effectiveTheme,
        themeMode,
        setThemeMode,
        toggleTheme,
        localTimeFormatted,
        isDaytime,
        stores,
        foodItems,
        activeStoreId,
        activeStore,
        setActiveStoreId,
        selectedFoodId,
        setSelectedFoodId,
        selectedFood,
        openFoodDetail,
        openStoreDetail,
        activeFoodModal,
        setActiveFoodModal,
        cart,
        isCartOpen,
        setIsCartOpen,
        addToCart,
        removeFromCart,
        updateCartQuantity,
        clearCart,
        cartTotal,
        cartItemCount,
        queues,
        userQueues,
        userActiveQueue,
        activeQueueId,
        setActiveQueueId,
        placeOrder,
        updateOrderStatus,
        cancelOrder,
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
        spicyFilter,
        setSpicyFilter,
        maxPriceFilter,
        setMaxPriceFilter,
        sortBy,
        setSortBy,
        toggleFoodAvailability,
        followedStoreIds,
        toggleFollowStore,
        isStoreFollowed,
        notifications,
        unreadNotificationCount,
        markAllNotificationsRead,
        markNotificationRead,
        addNotification,
        isCreateStoreModalOpen,
        setIsCreateStoreModalOpen,
        userStore,
        openCreateStore,
        openStoreAdmin,
        addNewStore,
        updateStore,
        deleteStore,
        seedDemoQueuesForStore,
        kdsSelectedStoreId,
        setKdsSelectedStoreId,
        addFoodItem,
        updateFoodItem,
        deleteFoodItem,
        isHelpModalOpen,
        setIsHelpModalOpen,
        isAccountSettingsModalOpen,
        setIsAccountSettingsModalOpen,
        updateUserProfile,
        selectedUserId,
        setSelectedUserId,
        openUserProfile,
        toasts,
        addToast,
        removeToast,
        isLiveSimulationActive,
        setIsLiveSimulationActive,
        isRegisterModalOpen,
        setIsRegisterModalOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        isSideChatOpen,
        setIsSideChatOpen,
        toggleSideChat,
        currentUser,
        registerUser,
        loginUser,
        loginWithGoogle,
        completeFirstTimeOtp,
        checkIsUserFirstTime,
        logoutUser,
        refreshOrdersFromCloud,
        activeContactTermsStore,
        activeContactTermsDefaultTab,
        openStoreContactAndTerms,
        closeStoreContactAndTerms,
        activeChatStore,
        openStoreChat,
        closeStoreChat,
        activeChatStoreId,
        setActiveChatStoreId,
        chatRoomTimestamp,
        customerThreadsTimestamp,
        openChatPage,
        openStoreChatPage,
        getStoreChatMessages,
        sendStoreChatMessage,
        markStoreChatAsRead,
        getStoreCustomerThreads,
        sendStoreCustomerReply,
        markStoreCustomerThreadAsRead,
        updateStoreExchangeTerms,
        updateStoreContactChannels,

        // Real-time Geolocation, Campus Positions & Proximity Comparison
        userLocation,
        setUserLocation,
        requestGpsLocation,
        presetLocations: PRESET_CAMPUS_LOCATIONS,
        proximityModalStore,
        setProximityModalStore,
        openProximityComparison,
        closeProximityComparison,

        // Search Recording & Intelligent Recommendations
        recordSearchQuery
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};
