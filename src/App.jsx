import { AuthProvider } from "./context/AuthContext.jsx";
import { PreferencesProvider } from "./context/PreferencesContext.jsx";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Loading from "./pages/Loading.jsx";
import Login from "./pages/Login.jsx";
import Home from "./pages/Home.jsx";
import SearchResults from "./pages/SearchResults.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import UserProfile from "./pages/UserProfile.jsx";
import Queueup from "./pages/Queueup.jsx";
import UserPurchase from "./pages/UserPurchase.jsx";
import MerchantDashboard from "./pages/MerchantDashboard.jsx";
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

            {/* Merchant Dashboard Routes */}
            <Route path="/merchant/dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/Merchant/Dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />
            <Route path="/Merchant/dashboard" element={<ProtectedRoute><MerchantDashboard /></ProtectedRoute>} />

            {/* Wildcard Fallback Route: Redirects any unknown URL to /home */}
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </PreferencesProvider>
  );
}

export default App;
