import { lazy, Suspense } from "react";
import { AuthProvider } from "./context/AuthContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import PageRouteLoader, { PageRouteLoaderView } from "./components/PageRouteLoader.jsx";
import CookieConsentBanner from "./components/CookieConsentBanner.jsx";
import CookieSessionTracker from "./components/CookieSessionTracker.jsx";
import InAppBrowserBanner from "./components/InAppBrowserBanner.jsx";

import NotFound from "./pages/NotFound.jsx"; // eager: ProtectedRoute imports it synchronously
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// Route components are code-split: the entry bundle carried every page, so a
// student opening the queue board also downloaded the merchant dashboard, the
// admin console and every guardian screen. Each now arrives only when routed to.
const LandingPage = lazy(() => import("./pages/LandingPage.tsx"));
const Login = lazy(() => import("./pages/Login.jsx"));
const Home = lazy(() => import("./pages/Home.jsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.jsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.jsx"));
const UserProfile = lazy(() => import("./pages/UserProfile.jsx"));
const Queueup = lazy(() => import("./pages/Queueup.jsx"));
const UserPurchase = lazy(() => import("./pages/UserPurchase.jsx"));
const MerchantDashboard = lazy(() => import("./pages/MerchantDashboard.jsx"));
const MerchantOnboarding = lazy(() => import("./pages/MerchantOnboarding.jsx"));
const PdpaPolicy = lazy(() => import("./pages/PdpaPolicy.jsx"));
const StoreAdminPage = lazy(() => import("./pages/StoreAdminPage.tsx"));
const FoodBooking = lazy(() => import("./pages/FoodBooking.tsx"));
const StudentVendorOnboarding = lazy(() => import("./pages/StudentVendorOnboarding.tsx"));
const StudentVendorEarnings = lazy(() => import("./pages/StudentVendorEarnings.tsx"));
const VendorApprovalPanel = lazy(() => import("./pages/VendorApprovalPanel.tsx"));
const GuardianDashboard = lazy(() => import("./pages/GuardianDashboard.tsx"));
const GuardianLinkApproval = lazy(() => import("./pages/GuardianLinkApproval.tsx"));
const SpendingLimitSetting = lazy(() => import("./pages/SpendingLimitSetting.tsx"));
const AllergyAlertSetting = lazy(() => import("./pages/AllergyAlertSetting.tsx"));
const ChildOrderHistory = lazy(() => import("./pages/ChildOrderHistory.tsx"));
const EmergencyLookup = lazy(() => import("./pages/EmergencyLookup.tsx"));
const CampusQueueMonitor = lazy(() => import("./pages/CampusQueueMonitor.tsx"));

function App() {
  return (
    <PreferencesProvider>
      <ToastProvider>
        <AuthProvider>
        <BrowserRouter>
          {/* First tab stop on every page: lets keyboard and switch users reach the
              page content without tabbing through the whole navigation. Invisible
              until focused. */}
          <a href="#main-content" className="skip-to-content">ข้ามไปยังเนื้อหาหลัก</a>
          {/* Global Page Route Transition Loading Animation Overlay */}
          <PageRouteLoader />
          {/* Global In-App Browser Guidance Banner (Instagram / LINE / Facebook WebView) */}
          <InAppBrowserBanner />
          {/* Global Cookie Session Tracker on Every Page */}
          <CookieSessionTracker />
          {/* Global PDPA Cookie Consent Banner */}
          <CookieConsentBanner />
          <ErrorBoundary>
            {/* PageRouteLoader already renders a transition overlay; this is the
                boundary for a chunk that has not arrived yet. */}
            <Suspense fallback={<PageRouteLoaderView message="กำลังโหลดหน้าที่คุณเลือก..." progress={70} />}>
            {/* Skip-link target. Mirrors #root's own flex column so pages keep the
                exact box they had before this wrapper existed. */}
            <div id="main-content" tabIndex={-1} className="flex flex-col flex-1 min-w-0">
            <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/queueup" element={<Queueup />} />
            <Route path="/about" element={<LandingPage />} />
            <Route path="/contact" element={<LandingPage />} />
            <Route path="/team" element={<LandingPage />} />
            <Route path="/pricing" element={<LandingPage />} />

            {/* Standalone Legal & PDPA Policy Routes */}
            <Route path="/pdpa" element={<PdpaPolicy />} />
            <Route path="/privacy" element={<PdpaPolicy />} />
            <Route path="/terms" element={<PdpaPolicy />} />

            <Route path="/login" element={<Login />} />

            {/* Home Routes (Supports /home, /Home, /HOME) */}
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />

            {/* User Orders & Profile Routes */}
            <Route path="/user/purchase" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/purchase" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/user/orders" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/user/account/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/user/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

            {/* Search & Product Routes */}
            <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
            <Route path="/product" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/booking" element={<ProtectedRoute><FoodBooking /></ProtectedRoute>} />
            <Route path="/food-booking" element={<ProtectedRoute><FoodBooking /></ProtectedRoute>} />

            {/* Merchant Dashboard & Onboarding Routes */}
            <Route path="/merchant/dashboard" element={<ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/portal/th-onboarding" element={<ProtectedRoute><MerchantOnboarding /></ProtectedRoute>} />
            <Route path="/portal/onboarding" element={<ProtectedRoute><MerchantOnboarding /></ProtectedRoute>} />

            {/* QueueUp for Campus Routes */}
            <Route path="/campus/onboarding" element={<ProtectedRoute><StudentVendorOnboarding /></ProtectedRoute>} />
            <Route path="/campus/earnings" element={<ProtectedRoute allowedRoles={["student_vendor", "merchant", "admin"]}><StudentVendorEarnings /></ProtectedRoute>} />
            <Route path="/campus/approvals" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><VendorApprovalPanel /></ProtectedRoute>} />
            <Route path="/campus/guardian-links" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><GuardianLinkApproval /></ProtectedRoute>} />
            <Route path="/campus/guardian" element={<ProtectedRoute><GuardianDashboard /></ProtectedRoute>} />
            <Route path="/campus/emergency" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><EmergencyLookup /></ProtectedRoute>} />
            <Route path="/campus/monitor" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><CampusQueueMonitor /></ProtectedRoute>} />

            {/* Spec-Defined Route Aliases */}
            <Route path="/student-vendor/apply" element={<ProtectedRoute><StudentVendorOnboarding /></ProtectedRoute>} />
            <Route path="/student-vendor/earnings" element={<ProtectedRoute allowedRoles={["student_vendor", "merchant", "admin"]}><StudentVendorEarnings /></ProtectedRoute>} />
            <Route path="/guardian" element={<ProtectedRoute><GuardianDashboard /></ProtectedRoute>} />
            <Route path="/guardian/dashboard" element={<ProtectedRoute><GuardianDashboard /></ProtectedRoute>} />
            <Route path="/guardian/spending-limits" element={<ProtectedRoute><SpendingLimitSetting /></ProtectedRoute>} />
            <Route path="/guardian/limits" element={<ProtectedRoute><SpendingLimitSetting /></ProtectedRoute>} />
            <Route path="/guardian/allergy-alert" element={<ProtectedRoute><AllergyAlertSetting /></ProtectedRoute>} />
            <Route path="/guardian/allergies" element={<ProtectedRoute><AllergyAlertSetting /></ProtectedRoute>} />
            <Route path="/guardian/order-history" element={<ProtectedRoute><ChildOrderHistory /></ProtectedRoute>} />
            <Route path="/guardian/history" element={<ProtectedRoute><ChildOrderHistory /></ProtectedRoute>} />
            <Route path="/campus/queue-monitor" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><CampusQueueMonitor /></ProtectedRoute>} />
            <Route path="/admin/vendor-approvals" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><VendorApprovalPanel /></ProtectedRoute>} />
            <Route path="/admin/guardian-links" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><GuardianLinkApproval /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><EmergencyLookup /></ProtectedRoute>} />
            <Route path="/merchant/kds" element={<ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}><MerchantDashboard /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><StoreAdminPage /></ProtectedRoute>} />

            {/* Wildcard 404 Page Not Found Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
            </div>
            </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </PreferencesProvider>
  );
}

export default App;
