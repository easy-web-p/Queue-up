/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import CampusLayout from "../layouts/CampusLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

const CampusOverviewDashboard = lazy(() => import("../../features/campus/shops/CampusOverviewDashboard"));
const CampusMonitoringView = lazy(() => import("../../features/campus/monitoring/CampusMonitoringView"));
const CampusSafetyPortal = lazy(() => import("../../features/campus/safety/CampusSafetyPortal"));
const VendorApprovalPanel = lazy(() => import("../../pages/VendorApprovalPanel.tsx"));
const GuardianLinkApproval = lazy(() => import("../../pages/GuardianLinkApproval.tsx"));

export const campusRoutes = (
  <>
    <Route
      path="/campus"
      element={<Navigate to="/campus/campus-kku-main/overview" replace />}
    />
    <Route
      path="/campus/:campusId"
      element={
        <ProtectedRoute allowedRoles={["staff_supervisor", "admin"]}>
          <CampusLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<Navigate to="overview" replace />} />
      <Route path="overview" element={<CampusOverviewDashboard />} />
      <Route path="shops" element={<CampusOverviewDashboard />} />
      <Route path="approvals" element={<VendorApprovalPanel />} />
      <Route path="monitoring" element={<CampusMonitoringView />} />
      <Route path="safety" element={<CampusSafetyPortal />} />
      <Route path="guardians" element={<GuardianLinkApproval />} />
    </Route>
  </>
);

export default campusRoutes;
