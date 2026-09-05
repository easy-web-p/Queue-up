import { AuthProvider } from "./context/AuthContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import Queueup from "./pages/Queueup.jsx";
import UserPurchase from "./pages/UserPurchase.jsx";
import MerchantDashboard from "./pages/MerchantDashboard.jsx";
import MerchantOnboarding from "./pages/MerchantOnboarding.jsx";
import NotFound from "./pages/NotFound.jsx";
import PdpaPolicy from "./pages/PdpaPolicy.jsx";
import StoreAdminPage from "./pages/StoreAdminPage.tsx";
import FoodBooking from "./pages/FoodBooking.tsx";
import PageRouteLoader from "./components/PageRouteLoader.jsx";
import CookieConsentBanner from "./components/CookieConsentBanner.jsx";
import CookieSessionTracker from "./components/CookieSessionTracker.jsx";

import StudentVendorOnboarding from "./pages/StudentVendorOnboarding.tsx";
import StudentVendorEarnings from "./pages/StudentVendorEarnings.tsx";
import VendorApprovalPanel from "./pages/VendorApprovalPanel.tsx";
import GuardianDashboard from "./pages/GuardianDashboard.tsx";
import SpendingLimitSetting from "./pages/SpendingLimitSetting.tsx";
import AllergyAlertSetting from "./pages/AllergyAlertSetting.tsx";
import ChildOrderHistory from "./pages/ChildOrderHistory.tsx";
import EmergencyLookup from "./pages/EmergencyLookup.tsx";
import CampusQueueMonitor from "./pages/CampusQueueMonitor.tsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

function App() {
  return (
    <PreferencesProvider>
      <AuthProvider>
        <BrowserRouter>
          {/* Global Page Route Transition Loading Animation Overlay */}
          <PageRouteLoader />
          {/* Global Cookie Session Tracker on Every Page */}
          <CookieSessionTracker />
          {/* Global PDPA Cookie Consent Banner */}
          <CookieConsentBanner />
          <ErrorBoundary>
            <Routes>
            <Route path="/" element={<Queueup />} />
            <Route path="/queueup" element={<Queueup />} />
            <Route path="/Queueup" element={<Queueup />} />
            <Route path="/about" element={<Queueup />} />
            <Route path="/About" element={<Queueup />} />
            <Route path="/contact" element={<Queueup />} />
            <Route path="/Contact" element={<Queueup />} />
            <Route path="/team" element={<Queueup />} />
            <Route path="/pricing" element={<Queueup />} />

            {/* Standalone Legal & PDPA Policy Routes */}
            <Route path="/pdpa" element={<PdpaPolicy />} />
            <Route path="/privacy" element={<PdpaPolicy />} />
            <Route path="/terms" element={<PdpaPolicy />} />

            <Route path="/login" element={<Login />} />
            <Route path="/Login" element={<Login />} />
            <Route path="/LOGIN" element={<Login />} />

            {/* Home Routes (Supports /home, /Home, /HOME) */}
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/Home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/HOME" element={<ProtectedRoute><Home /></ProtectedRoute>} />

            {/* User Orders & Profile Routes */}
            <Route path="/user/purchase" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/User/Purchase" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/purchase" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/user/orders" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
            <Route path="/user/account/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/User/Account/Profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/user/account/profile/" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/user/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

            {/* Search & Product Routes */}
            <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
            <Route path="/Search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
            <Route path="/product" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/Product" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/Product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/booking" element={<ProtectedRoute><FoodBooking /></ProtectedRoute>} />
            <Route path="/food-booking" element={<ProtectedRoute><FoodBooking /></ProtectedRoute>} />

            {/* Merchant Dashboard & Onboarding Routes */}
            <Route path="/merchant/dashboard" element={<ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/Merchant/Dashboard" element={<ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/Merchant/dashboard" element={<ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/portal/th-onboarding" element={<ProtectedRoute allowedRoles={["customer", "merchant", "student_vendor", "admin"]}><MerchantOnboarding /></ProtectedRoute>} />
            <Route path="/portal/onboarding" element={<ProtectedRoute allowedRoles={["customer", "merchant", "student_vendor", "admin"]}><MerchantOnboarding /></ProtectedRoute>} />

            {/* QueueUp for Campus Routes */}
            <Route path="/campus/onboarding" element={<ProtectedRoute><StudentVendorOnboarding /></ProtectedRoute>} />
            <Route path="/campus/earnings" element={<ProtectedRoute allowedRoles={["student_vendor", "merchant", "admin"]}><StudentVendorEarnings /></ProtectedRoute>} />
            <Route path="/campus/approvals" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><VendorApprovalPanel /></ProtectedRoute>} />
            <Route path="/campus/guardian" element={<ProtectedRoute><GuardianDashboard /></ProtectedRoute>} />
            <Route path="/campus/emergency" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><EmergencyLookup /></ProtectedRoute>} />
            <Route path="/campus/monitor" element={<CampusQueueMonitor />} />

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
            <Route path="/campus/queue-monitor" element={<CampusQueueMonitor />} />
            <Route path="/admin/vendor-approvals" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><VendorApprovalPanel /></ProtectedRoute>} />
            <Route path="/emergency" element={<ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}><EmergencyLookup /></ProtectedRoute>} />
            <Route path="/merchant/kds" element={<ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}><MerchantDashboard /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><StoreAdminPage /></ProtectedRoute>} />
            <Route path="/Admin" element={<ProtectedRoute allowedRoles={["admin"]}><StoreAdminPage /></ProtectedRoute>} />

            {/* Wildcard 404 Page Not Found Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </PreferencesProvider>
  );
}

export default App;
