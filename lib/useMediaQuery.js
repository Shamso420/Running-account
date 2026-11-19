import { useEffect, useState } from 'react';

// True while the viewport matches the query. Starts from the real value when
// running in the browser, so the first paint is already correct; the dashboard
// only renders after sign-in, so there is no server-rendered markup to mismatch.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false
  ));

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

// Same breakpoint as the `.dash-sidebar` / `.dash-mobile-topbar` rules in globals.css.
export const MOBILE_QUERY = '(max-width: 820px)';
