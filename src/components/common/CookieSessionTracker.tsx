import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const CookieSessionTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Record anonymous session timestamp and current active route for state recovery
    try {
      const sessionId = sessionStorage.getItem('queueup_session_id') || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sessionStorage.setItem('queueup_session_id', sessionId);
      sessionStorage.setItem('queueup_last_path', location.pathname);
      sessionStorage.setItem('queueup_last_active', new Date().toISOString());
    } catch {}
  }, [location.pathname]);

  return null;
};
