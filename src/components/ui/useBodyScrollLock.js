import { useEffect } from 'react';

const LOCK_COUNT_KEY = 'scrollLockCount';
const BODY_OVERFLOW_KEY = 'scrollLockBodyOverflow';
const BODY_PADDING_RIGHT_KEY = 'scrollLockBodyPaddingRight';
const HTML_OVERFLOW_KEY = 'scrollLockHtmlOverflow';

const useBodyScrollLock = (locked) => {
  useEffect(() => {
    if (!locked || typeof document === 'undefined' || typeof window === 'undefined') {
      return undefined;
    }

    const body = document.body;
    const html = document.documentElement;
    const activeLocks = Number(body.dataset[LOCK_COUNT_KEY] || '0');

    if (activeLocks === 0) {
      body.dataset[BODY_OVERFLOW_KEY] = body.style.overflow || '';
      body.dataset[BODY_PADDING_RIGHT_KEY] = body.style.paddingRight || '';
      html.dataset[HTML_OVERFLOW_KEY] = html.style.overflow || '';

      const scrollbarWidth = window.innerWidth - html.clientWidth;
      const computedPaddingRight = window.getComputedStyle(body).paddingRight;

      body.style.overflow = 'hidden';
      html.style.overflow = 'hidden';

      if (scrollbarWidth > 0) {
        body.style.paddingRight = `calc(${computedPaddingRight} + ${scrollbarWidth}px)`;
      }
    }

    body.dataset[LOCK_COUNT_KEY] = String(activeLocks + 1);

    return () => {
      const nextLocks = Math.max(0, Number(body.dataset[LOCK_COUNT_KEY] || '1') - 1);

      if (nextLocks === 0) {
        body.style.overflow = body.dataset[BODY_OVERFLOW_KEY] || '';
        body.style.paddingRight = body.dataset[BODY_PADDING_RIGHT_KEY] || '';
        html.style.overflow = html.dataset[HTML_OVERFLOW_KEY] || '';

        delete body.dataset[LOCK_COUNT_KEY];
        delete body.dataset[BODY_OVERFLOW_KEY];
        delete body.dataset[BODY_PADDING_RIGHT_KEY];
        delete html.dataset[HTML_OVERFLOW_KEY];
        return;
      }

      body.dataset[LOCK_COUNT_KEY] = String(nextLocks);
    };
  }, [locked]);
};

export default useBodyScrollLock;
