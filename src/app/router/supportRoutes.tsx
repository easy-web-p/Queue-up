/* eslint-disable react-refresh/only-export-components */
import React, { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import SupportLayout from "../layouts/SupportLayout";
import ProtectedRoute from "../../components/ProtectedRoute";

const SupportTicketQueue = lazy(() => import("../../features/support/tickets/SupportTicketQueue"));
const SupportTicketDetail = lazy(() => import("../../features/support/tickets/SupportTicketDetail"));
const SupportAccessRequests = lazy(() => import("../../features/support/access/SupportAccessRequests"));
const SupportKnowledgeBase = lazy(() => import("../../features/support/kb/SupportKnowledgeBase"));

export const supportRoutes = (
  <Route
    path="/support"
    element={
      <ProtectedRoute>
        <SupportLayout />
      </ProtectedRoute>
    }
  >
    <Route index element={<Navigate to="queue" replace />} />
    <Route path="queue" element={<SupportTicketQueue />} />
    <Route path="tickets/:ticketId" element={<SupportTicketDetail />} />
    <Route path="access-requests" element={<SupportAccessRequests />} />
    <Route path="knowledge-base" element={<SupportKnowledgeBase />} />
  </Route>
);

export default supportRoutes;
