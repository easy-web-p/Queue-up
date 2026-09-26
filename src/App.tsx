import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { QueueProvider, useQueue, AppView } from './context/QueueContext';
import { Navbar } from './components/layout/Navbar';
import { MobileNavigation } from './components/layout/MobileNavigation';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/customer/HomePage';
import { LandingPage } from './pages/customer/LandingPage';

// Route-level code splitting. Every screen below is reachable only after a
// deliberate navigation, so shipping it in the first chunk makes the initial
// load slower for the canteen's mobile users without ever being used by most
// of them. Each lazy() call becomes its own chunk.
const Queueup = lazy(() => import('./pages/Queueup'));
const SearchPage = lazy(() => import('./pages/customer/SearchPage').then(m => ({ default: m.SearchPage })));
const StoreDetailPage = lazy(() => import('./pages/customer/StoreDetailPage').then(m => ({ default: m.StoreDetailPage })));
const FoodDetailPage = lazy(() => import('./pages/customer/FoodDetailPage').then(m => ({ default: m.FoodDetailPage })));
const UserProfilePage = lazy(() => import('./pages/customer/UserProfilePage').then(m => ({ default: m.UserProfilePage })));
const QueueTrackingPage = lazy(() => import('./pages/customer/QueueTrackingPage').then(m => ({ default: m.QueueTrackingPage })));
const KitchenDisplaySystem = lazy(() => import('./pages/merchant/KitchenDisplaySystem').then(m => ({ default: m.KitchenDisplaySystem })));
const MerchantDashboard = lazy(() => import('./pages/merchant/MerchantDashboard').then(m => ({ default: m.MerchantDashboard })));
const CreateStorePage = lazy(() => import('./pages/merchant/CreateStorePage').then(m => ({ default: m.CreateStorePage })));
const StoreAdminPage = lazy(() => import('./pages/merchant/StoreAdminPage').then(m => ({ default: m.StoreAdminPage })));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ChatPage = lazy(() => import('./pages/customer/ChatPage').then(m => ({ default: m.ChatPage })));
const RegisterSchoolPage = lazy(() => import('./pages/school/RegisterSchoolPage').then(m => ({ default: m.RegisterSchoolPage })));
import { FoodDetailModal } from './components/food/FoodDetailModal';
import { CartDrawer } from './components/cart/CartDrawer';
import { ToastContainer } from './components/ui/ToastContainer';
import { RegisterModal } from './components/auth/RegisterModal';
import { CookieConsent } from './components/ui/CookieConsent';
import { CreateStoreModal } from './components/modals/CreateStoreModal';
import { HelpSupportModal } from './components/modals/HelpSupportModal';
import { AccountSettingsModal } from './components/modals/AccountSettingsModal';
import { StoreContactAndTermsModal } from './components/modals/StoreContactAndTermsModal';
import { StoreChatModal } from './components/modals/StoreChatModal';
import { ProximityComparisonModal } from './components/location/ProximityComparisonModal';
import { PushChatPanel } from './components/chat/PushChatPanel';
import { AppSidebar } from './components/layout/AppSidebar';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ScrollToTop } from './components/common/ScrollToTop';
import { PageRouteLoaderView } from './components/common/PageRouteLoader';
import { RequireRole } from './components/common/RequireRole';

// Maps AppView in state to URL pathname
const VIEW_TO_PATH_MAP: Record<AppView, string> = {
  'landing': '/',
  'about': '/about',
  'register-school': '/register-school',
  'home': '/home',
  'search': '/search',
  'store-detail': '/store',
  'food-detail': '/food',
  'user-profile': '/profile',
  'queue-tracking': '/queue-tracking',
  'order-history': '/order-history',
  'merchant-dashboard': '/merchant',
  'kds': '/kds',
  'admin-dashboard': '/admin',
  'create-store': '/create-store',
  'store-admin': '/store-admin',
  'chat': '/chat',
  'store-chat': '/store-chat'
};

const isPublicPath = (pathname: string): boolean => {
  return pathname === '/' || pathname === '/landing' || pathname === '/about' || pathname === '/queueup' || pathname === '/register-school';
};

const MainAppContent: React.FC = () => {
  const {
    currentUser,
    currentView,
    setCurrentView,
    addToast,
    activeFoodModal,
    setActiveFoodModal,
    isRegisterModalOpen,
    setIsRegisterModalOpen,
    activeContactTermsStore,
    activeContactTermsDefaultTab,
    closeStoreContactAndTerms,
    activeChatStore,
    closeStoreChat,
    role,
    isAdmin
  } = useQueue();

  const navigate = useNavigate();
  const location = useLocation();

  // 1. Sync URL changes to currentView with strict Authentication Guard
  useEffect(() => {
    const path = location.pathname;

    // Authentication Guard: If user is not logged in / verified, allow public pages (landing, about)
    if (!currentUser) {
      if (!isPublicPath(path)) {
        navigate('/landing', { replace: true });
        addToast('กรุณาเข้าสู่ระบบ', 'กรุณาเข้าสู่ระบบยืนยันตัวตนก่อนเข้าใช้งานระบบสั่งอาหารและบริการอื่นๆ', 'warning');
        setIsRegisterModalOpen(true);
        if (currentView !== 'landing') {
          setCurrentView('landing');
        }
      } else {
        if (path === '/about' || path === '/queueup') {
          if (currentView !== 'about') setCurrentView('about');
        } else {
          if (currentView !== 'landing') setCurrentView('landing');
        }
      }
      return;
    }

    if (path === '/about' || path === '/queueup') {
      if (currentView !== 'about') setCurrentView('about');
    } else if (path === '/home') {
      if (currentView !== 'home') setCurrentView('home');
    } else if (path === '/search') {
      if (currentView !== 'search') setCurrentView('search');
    } else if (path.startsWith('/store')) {
      if (currentView !== 'store-detail') setCurrentView('store-detail');
    } else if (path.startsWith('/food')) {
      if (currentView !== 'food-detail') setCurrentView('food-detail');
    } else if (path === '/profile' || path === '/user-profile') {
      if (currentView !== 'user-profile') setCurrentView('user-profile');
    } else if (path === '/order-history') {
      if (currentView !== 'user-profile') setCurrentView('user-profile');
    } else if (path === '/queue-tracking' || path === '/tracking') {
      if (currentView !== 'queue-tracking') setCurrentView('queue-tracking');
    } else if (path === '/kds') {
      if (currentView !== 'kds') setCurrentView('kds');
    } else if (path === '/merchant' || path === '/merchant-dashboard') {
      if (currentView !== 'merchant-dashboard') setCurrentView('merchant-dashboard');
    } else if (path === '/create-store') {
      if (currentView !== 'create-store') setCurrentView('create-store');
    } else if (path === '/store-admin') {
      if (currentView !== 'store-admin') setCurrentView('store-admin');
    } else if (path === '/admin' || path === '/admin-dashboard') {
      if (currentView !== 'admin-dashboard') setCurrentView('admin-dashboard');
    } else if (path === '/chat') {
      if (currentView !== 'chat') setCurrentView('chat');
    } else if (path === '/store-chat') {
      if (currentView !== 'store-chat') setCurrentView('store-chat');
    } else if (path === '/register-school') {
      if (currentView !== 'register-school') setCurrentView('register-school');
    } else if (path === '/' || path === '/landing') {
      if (currentView !== 'landing') setCurrentView('landing');
    }
  }, [location.pathname, currentUser]);

  // 2. Sync state changes to URL
  const prevViewRef = React.useRef<AppView>(currentView);
  useEffect(() => {
    // If the user is on /about or /queueup, never redirect them away
    if (location.pathname === '/about' || location.pathname === '/queueup') {
      prevViewRef.current = 'about';
      return;
    }

    if (!currentUser) {
      if (!isPublicPath(location.pathname)) {
        navigate('/landing', { replace: true });
      }
      return;
    }

    // Only navigate if currentView changed via intentional user action
    if (prevViewRef.current !== currentView) {
      prevViewRef.current = currentView;
      const expectedPath = VIEW_TO_PATH_MAP[currentView];
      if (expectedPath && location.pathname !== expectedPath && !location.pathname.startsWith(expectedPath + '/')) {
        navigate(expectedPath);
      }
    }
  }, [currentView, currentUser, location.pathname]);

  const isAboutPage = location.pathname === '/about' || location.pathname === '/queueup';

  if (isAboutPage) {
    return (
      <div className="min-h-screen bg-[#070b14] text-white">
        <ScrollToTop />
        <div key={location.pathname} className="screen-enter-top w-full">
          <Suspense fallback={<PageRouteLoaderView />}>
            <Routes>
              <Route path="/about" element={<Queueup />} />
              <Route path="/queueup" element={<Queueup />} />
            </Routes>
          </Suspense>
        </div>
        <ToastContainer />
        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
        />
        <CookieConsent />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors duration-200">
      <ScrollToTop />
      {/* Top Global Navigation */}
      <Navbar />

      {/* Main Page Layout with Right Push Chat Panel */}
      <div className="flex-1 flex w-full relative min-h-0">
        {/* Left Content Area (Pushed to the left when right chat panel expands) */}
        <div className="flex-1 min-w-0 flex flex-col transition-all duration-300 ease-in-out">
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 md:pb-10 transition-all duration-300">
            {/* Animated Screen Container - Displays gracefully from Top down to Bottom */}
            <div key={location.pathname + '-' + currentView} className="screen-enter-top w-full">
              {/* Complete Route Declarations with Strict Auth Guard */}
              <Suspense fallback={<PageRouteLoaderView />}>
                <Routes>
                  {/* Landing Page & Public Pages - Open to all */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/about" element={<Queueup />} />
                  <Route path="/queueup" element={<Queueup />} />
                  <Route path="/register-school" element={<RegisterSchoolPage />} />

                  {/* Customer Flow - Requires Login */}
                  <Route path="/home" element={currentUser ? <HomePage /> : <Navigate to="/landing" replace />} />
                  <Route path="/search" element={currentUser ? <SearchPage /> : <Navigate to="/landing" replace />} />
                  <Route path="/store/:storeId" element={currentUser ? <StoreDetailPage /> : <Navigate to="/landing" replace />} />
                  <Route path="/store" element={currentUser ? <StoreDetailPage /> : <Navigate to="/landing" replace />} />
                  <Route path="/food/:foodId" element={currentUser ? <FoodDetailPage /> : <Navigate to="/landing" replace />} />
                  <Route path="/food" element={currentUser ? <FoodDetailPage /> : <Navigate to="/landing" replace />} />
                  <Route path="/user-profile" element={currentUser ? <UserProfilePage /> : <Navigate to="/landing" replace />} />
                  <Route path="/profile" element={currentUser ? <UserProfilePage /> : <Navigate to="/landing" replace />} />
                  <Route path="/queue-tracking" element={currentUser ? <QueueTrackingPage /> : <Navigate to="/landing" replace />} />
                  <Route path="/tracking" element={currentUser ? <QueueTrackingPage /> : <Navigate to="/landing" replace />} />
                  <Route path="/order-history" element={currentUser ? <UserProfilePage /> : <Navigate to="/landing" replace />} />
                  <Route path="/chat" element={currentUser ? <ChatPage /> : <Navigate to="/landing" replace />} />

                  {/* Merchant & Kitchen Display Flow - Requires Login */}
                  <Route path="/kds" element={
                    <RequireRole allow={['merchant']}><KitchenDisplaySystem /></RequireRole>
                  } />
                  <Route path="/merchant-dashboard" element={
                    <RequireRole allow={['merchant']}><MerchantDashboard /></RequireRole>
                  } />
                  <Route path="/merchant" element={
                    <RequireRole allow={['merchant']}><MerchantDashboard /></RequireRole>
                  } />
                  <Route path="/create-store" element={currentUser ? <CreateStorePage /> : <Navigate to="/landing" replace />} />
                  <Route path="/store-admin" element={
                    <RequireRole allow={['merchant']}><StoreAdminPage /></RequireRole>
                  } />
                  <Route path="/store-chat" element={currentUser ? <ChatPage /> : <Navigate to="/landing" replace />} />

                  {/* System Admin - Requires Super Admin */}
                  <Route path="/admin-dashboard" element={
                    <RequireRole allow={['admin']}><AdminDashboard /></RequireRole>
                  } />
                  <Route path="/admin" element={
                    <RequireRole allow={['admin']}><AdminDashboard /></RequireRole>
                  } />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to={currentUser ? "/home" : "/landing"} replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>
          {/* Global Footer */}
          <Footer />
        </div>

        {/* Right Side Push Chat Panel (Docks in layout without overlay, pushing the left screen) */}
        <PushChatPanel />
      </div>

      {/* Modals & Overlays */}
      <FoodDetailModal
        food={activeFoodModal}
        onClose={() => setActiveFoodModal(null)}
      />

      <CartDrawer />

      <ToastContainer />

      <RegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
      />

      <CreateStoreModal />
      <HelpSupportModal />
      <AccountSettingsModal />
      
      <StoreContactAndTermsModal
        store={activeContactTermsStore}
        isOpen={!!activeContactTermsStore}
        onClose={closeStoreContactAndTerms}
        defaultTab={activeContactTermsDefaultTab}
      />

      <StoreChatModal
        store={activeChatStore?.store || null}
        orderId={activeChatStore?.orderId}
        isOpen={!!activeChatStore}
        onClose={closeStoreChat}
      />

      <ProximityComparisonModal />

      {/* Responsive Slide-out Sidebar Drawer */}
      <AppSidebar />

      <CookieConsent />

      {/* Mobile Bottom Navigation (Only visible on mobile for customer) */}
      <MobileNavigation />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <QueueProvider>
          <ErrorBoundary>
            <MainAppContent />
          </ErrorBoundary>
        </QueueProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

