import React, { useState, useEffect } from 'react';

export interface Location {
  pathname: string;
  search: string;
  hash: string;
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

    // Bắt các sự kiện chuyển trang qua pushState và replaceState
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      handleLocationChange();
      return result;
    };

    window.history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      handleLocationChange();
      return result;
    };

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
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
  if (parts.length >= 2 && parts[0] === 'orders') {
    return { id: decodeURIComponent(parts[1]) } as unknown as T;
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
