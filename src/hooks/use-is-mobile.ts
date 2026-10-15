'use client';

import { useEffect, useState } from 'react';

export const MOBILE_QUERY = '(max-width: 767px)';

/** Matches Tailwind's `max-md`. `null` until mounted, so the static pre-render and first client render agree. */
export function useIsMobile() {
  const [mobile, setMobile] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return mobile;
}
