import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';

export const ScrollToTop: React.FC = () => {
  const { pathname, search } = useLocation();
  const { currentView } = useQueue();

  useEffect(() => {
    // 1. Disable browser's automatic scroll restoration on page reload/back
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // 2. Instantly reset scroll to top (0, 0)
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior
    });

    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
    }

    // Also reset main element scroll if any overflow container exists
    const mainEl = document.querySelector('main');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [pathname, search, currentView]);

  return null;
};
