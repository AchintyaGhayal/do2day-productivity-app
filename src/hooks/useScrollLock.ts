import { useEffect } from 'react';

/**
 * Locks body scrolling when active. Handles iOS Safari scroll bleed-through
 * by fixing the body position and restoring it on unlock.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const scrollY = window.scrollY;
    const body = document.body;
    const html = document.documentElement;

    // Save current values
    const originalBodyOverflow = body.style.overflow;
    const originalBodyPosition = body.style.position;
    const originalBodyTop = body.style.top;
    const originalBodyWidth = body.style.width;
    const originalHtmlOverflow = html.style.overflow;

    // Lock
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    html.style.overflow = 'hidden';

    // Also prevent touchmove on the body for iOS
    const preventTouch = (e: TouchEvent) => {
      // Allow scrolling inside the modal content
      if ((e.target as HTMLElement)?.closest('[data-modal-content]')) return;
      e.preventDefault();
    };
    document.addEventListener('touchmove', preventTouch, { passive: false });

    return () => {
      body.style.overflow = originalBodyOverflow;
      body.style.position = originalBodyPosition;
      body.style.top = originalBodyTop;
      body.style.width = originalBodyWidth;
      html.style.overflow = originalHtmlOverflow;
      document.removeEventListener('touchmove', preventTouch);

      // Restore scroll position
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
