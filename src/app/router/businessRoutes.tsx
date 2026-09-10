/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import BusinessLayout from "../layouts/BusinessLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

const StoreSelectorPage = lazy(() => import("../../features/business/StoreSelectorPage"));
const StoreOperationalOverview = lazy(() => import("../../features/business/operations/StoreOperationalOverview"));
const LiveKdsKanbanView = lazy(() => import("../../features/business/operations/LiveKdsKanbanView"));
const StoreOrderManagement = lazy(() => import("../../features/business/orders/StoreOrderManagement"));
const StoreOrderDetailView = lazy(() => import("../../features/business/orders/StoreOrderDetailView"));
const StoreCatalogManager = lazy(() => import("../../features/business/catalog/StoreCatalogManager"));
const StoreInventoryManager = lazy(() => import("../../features/business/inventory/StoreInventoryManager"));
const StoreSettingsPage = lazy(() => import("../../features/business/settings/StoreSettingsPage"));
const StoreStaffManager = lazy(() => import("../../features/business/staff/StoreStaffManager"));
const StorePromotionsCrm = lazy(() => import("../../features/business/promotions/StorePromotionsCrm"));
const StoreFinanceReports = lazy(() => import("../../features/business/finance/StoreFinanceReports"));

export const businessRoutes = (
  <>
    <Route
      path="/business"
      element={
        <ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}>
          <StoreSelectorPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/business/select-store"
      element={
        <ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}>
          <StoreSelectorPage />
        </ProtectedRoute>
      }
    />
    <Route
      path="/business/:shopId"
      element={
        <ProtectedRoute allowedRoles={["merchant", "student_vendor", "admin"]}>
          <BusinessLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<StoreOperationalOverview />} />
      <Route path="operations" element={<LiveKdsKanbanView />} />
      <Route path="orders" element={<StoreOrderManagement />} />
      <Route path="orders/:orderId" element={<StoreOrderDetailView />} />
      <Route path="catalog/*" element={<StoreCatalogManager />} />
      <Route path="inventory" element={<StoreInventoryManager />} />
      <Route path="staff/*" element={<StoreStaffManager />} />
      <Route path="promotions/*" element={<StorePromotionsCrm />} />
      <Route path="finance/*" element={<StoreFinanceReports />} />
      <Route path="settings/store" element={<StoreSettingsPage />} />
    </Route>
  </>
);

export default businessRoutes;
