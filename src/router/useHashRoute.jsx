import React, { useCallback, useEffect, useState } from 'react';

/**
 * Minimal hash router — every view has a stable, bookmarkable URL
 * (#/reports/performance/chart) without a server-side rewrite.
 */
export const DEFAULT_ROUTE = '/dashboard';

function readHash() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw || !raw.startsWith('/')) return DEFAULT_ROUTE;
  return raw.replace(/\/+$/, '') || DEFAULT_ROUTE;
}

export function useHashRoute() {
  const [path, setPath] = useState(readHash);

  useEffect(() => {
    const onChange = () => setPath(readHash());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((to) => {
    const target = to.startsWith('#') ? to.slice(1) : to;
    if (readHash() === target) return;
    window.location.hash = target;
  }, []);

  return { path, navigate };
}

/** Anchor that navigates via the hash router. */
export function Link({ to, className = '', children, ...rest }) {
  return (
    <a href={`#${to}`} className={className} {...rest}>{children}</a>
  );
}
