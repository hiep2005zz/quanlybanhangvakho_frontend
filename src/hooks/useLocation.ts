import React, { useState, useEffect } from 'react';

export interface Location {
  pathname: string;
  search: string;
  hash: string;
}

// Intercept pushState and replaceState once globally at module level
if (typeof window !== 'undefined' && !(window as any).__location_patched) {
  (window as any).__location_patched = true;
  const _history = window.history;
  const _pushState = _history.pushState.bind(_history);
  const _replaceState = _history.replaceState.bind(_history);

  _history.pushState = function (...args) {
    const res = _pushState(...args);
    window.dispatchEvent(new Event('popstate'));
    return res;
  };

  _history.replaceState = function (...args) {
    const res = _replaceState(...args);
    window.dispatchEvent(new Event('popstate'));
    return res;
  };
}

/**
 * Hook useLocation tương đương với react-router-dom,
 * tự động đồng bộ và re-render khi pathname thay đổi (popstate, pushState, replaceState).
 */
export function useLocation(): Location {
  const [location, setLocation] = useState<Location>(() => ({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }));

  useEffect(() => {
    const handleLocationChange = () => {
      setLocation({
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });
    };

    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  return location;
}

export function useNavigate() {
  return (to: string) => {
    window.history.pushState({}, '', to);
  };
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  const pathname = window.location.pathname;
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length >= 2) {
    if (parts[0] === 'orders') {
      return { id: decodeURIComponent(parts[1]) } as unknown as T;
    }
    if (parts[0] === 'price-books' || parts[0] === 'price-lists') {
      return { id: decodeURIComponent(parts[1]) } as unknown as T;
    }
    if (parts[0] === 'delivery-tracking') {
      return { id: decodeURIComponent(parts[1]) } as unknown as T;
    }
  }
  return {} as T;
}

export const Link: React.FC<React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }> = ({
  to,
  onClick,
  children,
  ...props
}) => {
  return React.createElement(
    'a',
    {
      ...props,
      href: to,
      onClick: (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        window.history.pushState({}, '', to);
        if (onClick) onClick(e);
      },
    },
    children
  );
};

export default useLocation;
