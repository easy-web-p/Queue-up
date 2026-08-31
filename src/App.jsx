import { AuthProvider } from "./context/AuthContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Loading from "./pages/Loading.jsx";
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
import PageRouteLoader from "./components/PageRouteLoader.jsx";
import CookieConsentBanner from "./components/CookieConsentBanner.jsx";
import CookieSessionTracker from "./components/CookieSessionTracker.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";

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
          <Routes>
            <Route path="/" element={<Loading />} />
            <Route path="/queueup" element={<Queueup />} />
            <Route path="/Queueup" element={<Queueup />} />
            <Route path="/about" element={<Queueup />} />
            <Route path="/About" element={<Queueup />} />

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
            <Route path="/user/account/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/User/Account/Profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
            <Route path="/user/account/profile/" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

            {/* Search & Product Routes */}
            <Route path="/search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
            <Route path="/Search" element={<ProtectedRoute><SearchResults /></ProtectedRoute>} />
            <Route path="/product" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/Product" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/Product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />

            {/* Merchant Dashboard & Onboarding Routes */}
            <Route path="/merchant/dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/Merchant/Dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/Merchant/dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/portal/th-onboarding" element={<ProtectedRoute><MerchantOnboarding /></ProtectedRoute>} />
            <Route path="/portal/onboarding" element={<ProtectedRoute><MerchantOnboarding /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute><StoreAdminPage /></ProtectedRoute>} />
            <Route path="/Admin" element={<ProtectedRoute><StoreAdminPage /></ProtectedRoute>} />

            {/* Wildcard 404 Page Not Found Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </PreferencesProvider>
  );
}

export default App;
