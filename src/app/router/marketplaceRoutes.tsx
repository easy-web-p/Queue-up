/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from "react";
import { Route } from "react-router-dom";
import MarketplaceLayout from "../layouts/MarketplaceLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

const MarketplaceHomePage = lazy(() => import("../../features/marketplace/home/MarketplaceHomePage"));
const MarketplaceSearchPage = lazy(() => import("../../features/marketplace/search/MarketplaceSearchPage"));
const ShopStorefrontPage = lazy(() => import("../../features/marketplace/shops/ShopStorefrontPage"));
const ProductDetailPage = lazy(() => import("../../features/marketplace/products/ProductDetailPage"));
const MarketplaceCartPage = lazy(() => import("../../features/marketplace/cart/MarketplaceCartPage"));
const MarketplaceCheckoutPage = lazy(() => import("../../features/marketplace/checkout/MarketplaceCheckoutPage"));
const LiveOrderTicketPage = lazy(() => import("../../features/marketplace/orders/LiveOrderTicketPage"));
const CustomerAccountHub = lazy(() => import("../../features/marketplace/account/CustomerAccountHub"));
const CustomerFavoritesPage = lazy(() => import("../../features/marketplace/favorites/CustomerFavoritesPage"));
const CustomerOrderHistoryPage = lazy(() => import("../../features/marketplace/orders/CustomerOrderHistoryPage"));

export const marketplaceRoutes = (
  <Route
    path="/app"
    element={
      <ProtectedRoute>
        <MarketplaceLayout />
      </ProtectedRoute>
    }
  >
    <Route index element={<MarketplaceHomePage />} />
    <Route path="search" element={<MarketplaceSearchPage />} />
    <Route path="shops/:shopId" element={<ShopStorefrontPage />} />
    <Route path="products/:productId" element={<ProductDetailPage />} />
    <Route path="cart" element={<MarketplaceCartPage />} />
    <Route path="checkout" element={<MarketplaceCheckoutPage />} />
    <Route path="orders" element={<CustomerOrderHistoryPage />} />
    <Route path="orders/:orderId" element={<LiveOrderTicketPage />} />
    <Route path="favorites" element={<CustomerFavoritesPage />} />
    <Route path="account/*" element={<CustomerAccountHub />} />
  </Route>
);

export default marketplaceRoutes;
