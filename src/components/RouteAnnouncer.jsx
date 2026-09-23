/**
 * ============================================================================
 * 📣 SAYING THAT THE PAGE CHANGED
 * ============================================================================
 *
 * A single-page app swaps the contents of the document without a page load.
 * A browser announces nothing, because from its point of view nothing
 * happened; a screen reader carries on reading whatever it was reading; and
 * focus stays on the link that was clicked, which the new route has usually
 * unmounted, so the next Tab restarts from the top of the document.
 *
 * This puts back the three things a real page load would have done:
 *
 *  1. **The title.** Every history entry, tab and bookmark in this app read
 *     "QueueUp - School Canteen Smart Pre-Order & Queue Platform", because
 *     that is the one <title> in index.html and nothing ever changed it.
 *  2. **The announcement.** A polite live region named after the new screen,
 *     so a reader says "กระเป๋าเงินนักเรียนของฉัน" when the wallet opens.
 *  3. **Focus.** Moved to the main region, so the next Tab continues from the
 *     new content rather than from the top.
 *
 * Focus is deliberately NOT moved on the first render. Landing directly on a
 * URL is an ordinary page load, where the browser has already put focus in the
 * right place; stealing it there would scroll a person past the header they
 * arrived to read.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { routeName, routeTitle } from '../utils/routeTitles.js';

export default function RouteAnnouncer({ mainId = 'main-content' }) {
  const { pathname } = useLocation();
  const liveRef = useRef(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    document.title = routeTitle(pathname);

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const name = routeName(pathname) || 'ไม่พบหน้านี้';
    // Written into the node rather than rendered through state: a live region
    // announces a change to its contents, and React replacing the whole region
    // on a re-render is not reliably read as one.
    if (liveRef.current) liveRef.current.textContent = name;

    const main = document.getElementById(mainId);
    if (main && typeof main.focus === 'function') {
      // preventScroll, because the scroll position is restored separately and
      // a focus jump would fight it.
      main.focus({ preventScroll: true });
    }
  }, [pathname, mainId]);

  return (
    <div
      ref={liveRef}
      // Announced without interrupting whatever is being read, which is the
      // right urgency for "you are now on a different screen".
      aria-live="polite"
      aria-atomic="true"
      // Available to a reader, invisible and unselectable on screen. `sr-only`
      // keeps it in the accessibility tree; `display: none` would not.
      className="sr-only"
      // Not a heading, not content: only ever the name of the current screen.
      role="status"
    />
  );
}
