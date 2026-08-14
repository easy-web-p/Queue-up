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
import PageRouteLoader from "./components/PageRouteLoader.jsx";
import CookieConsentBanner from "./components/CookieConsentBanner.jsx";
import CookieSessionTracker from "./components/CookieSessionTracker.jsx";

import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

function App() {
  return (
    <ErrorBoundary>
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
          <Route path="/about" element={<Queueup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/user/purchase" element={<ProtectedRoute><UserPurchase /></ProtectedRoute>} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/account/profile"
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user/account/profile/"
            element={
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchResults />
              </ProtectedRoute>
            }
          />
          <Route
            path="/product"
            element={
              <ProtectedRoute>
                <ProductDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/product/:id"
            element={
              <ProtectedRoute>
                <ProductDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/merchant/dashboard"
            element={
              <ProtectedRoute>
                <MerchantDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
          </BrowserRouter>
        </AuthProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}

export default App;
