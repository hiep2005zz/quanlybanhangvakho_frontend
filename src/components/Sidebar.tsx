import React from 'react';
import { useLocation } from '../hooks/useLocation';

export type TabType =
  | 'inventory'
  | 'orders'
  | 'create-order'
  | 'users'
  | 'categories'
  | 'audit-logs'
  | 'profile'
  | 'suppliers'
  | 'dealers'
  | 'price-books'
  | 'delivery-points'
  | 'product-history';

export interface SidebarProps {
  activeTab?: TabType;
  onSelectTab: (tab: TabType) => void;
  canCreateOrders?: boolean;
  canReadOrders?: boolean;
  canViewDealers?: boolean;
  canManageDeliveryPoints?: boolean;
  canManageSuppliers?: boolean;
  canAccessPriceBooks?: boolean;
  canManageCategories?: boolean;
  canViewProductHistory?: boolean;
  isAdmin?: boolean;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

interface MenuItemConfig {
  id?: string;
  tab: TabType;
  path: string;
  label: string;
  visible: boolean;
  icon: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  canCreateOrders = false,
  canReadOrders = false,
  canViewDealers = false,
  canManageDeliveryPoints = false,
  canManageSuppliers = false,
  canAccessPriceBooks = false,
  canManageCategories = false,
  canViewProductHistory = false,
  onLogout,
  isLoggingOut = false,
}) => {
  // Lấy pathname hiện tại từ hook useLocation
  const location = useLocation();
  const currentPath = location.pathname.toLowerCase();

  // Cấu hình danh sách mục menu điều hướng
  const menuItems: MenuItemConfig[] = [
    {
      id: 'btn-sidebar-inventory',
      tab: 'inventory',
      path: '/',
      label: 'Quản lý kho hàng',
      visible: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-product-history',
      tab: 'product-history',
      path: '/product-history',
      label: 'Lịch sử sản phẩm',
      visible: canViewProductHistory,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-create-order',
      tab: 'create-order',
      path: '/create-order',
      label: 'Tạo đơn hàng',
      visible: canCreateOrders,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-orders',
      tab: 'orders',
      path: '/orders',
      label: 'Quản lý đơn hàng',
      visible: canReadOrders,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h4" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-dealers',
      tab: 'dealers',
      path: '/dealers',
      label: 'Tra cứu đại lý',
      visible: canViewDealers,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-delivery-points',
      tab: 'delivery-points',
      path: '/delivery-points',
      label: 'Điểm giao hàng',
      visible: canManageDeliveryPoints,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-suppliers',
      tab: 'suppliers',
      path: '/suppliers',
      label: 'Nhà cung cấp',
      visible: canManageSuppliers,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="3" width="15" height="13" rx="1" />
          <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-price-books',
      tab: 'price-books',
      path: '/price-books',
      label: 'Bảng giá',
      visible: canAccessPriceBooks,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      ),
    },
    {
      id: 'btn-sidebar-categories',
      tab: 'categories',
      path: '/categories',
      label: 'Nhóm hàng & Doanh số',
      visible: canManageCategories,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0 select-none">
      {/* Danh sách mục điều hướng Sidebar */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Menu chính">
        {menuItems
          .filter((item) => item.visible)
          .map((item) => {
            // Logic so sánh URL hiện tại (từ useLocation) với path của từng menu item
            const isPathMatched =
              item.path === '/'
                ? currentPath === '/' || currentPath === '' || currentPath === '/inventory' || currentPath === '/index.html'
                : currentPath === item.path.toLowerCase() || currentPath.startsWith(`${item.path.toLowerCase()}/`);

            // Trạng thái trang hiện hành (Active State): so sánh URL hiện tại với path, hỗ trợ fallback theo activeTab
            const isAnyPathMatched = menuItems.some((m) =>
              m.path === '/'
                ? currentPath === '/' || currentPath === '' || currentPath === '/inventory' || currentPath === '/index.html'
                : currentPath === m.path.toLowerCase() || currentPath.startsWith(`${m.path.toLowerCase()}/`)
            );

            const isActive = isAnyPathMatched
              ? isPathMatched
              : activeTab
              ? activeTab === item.tab
              : isPathMatched;

            return (
              <button
                key={item.tab}
                type="button"
                id={item.id}
                onClick={() => onSelectTab(item.tab)}
                style={{
                  backgroundImage: 'none',
                  boxShadow: 'none',
                  marginTop: 0,
                }}
                className={`group w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition-colors text-left border-0 cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900 font-medium'
                }`}
              >
                <span
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-[#0fad89]' : 'text-gray-500 group-hover:text-gray-700'
                  }`}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
      </nav>

      {/* Footer Sidebar: Nút Đăng xuất */}
      {onLogout && (
        <div className="p-3 border-t border-gray-200 bg-white flex-shrink-0">
          <button
            type="button"
            onClick={onLogout}
            disabled={isLoggingOut}
            style={{
              backgroundImage: 'none',
              boxShadow: 'none',
              marginTop: 0,
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 text-left bg-transparent border-0 cursor-pointer"
          >
            <span className="text-gray-500 hover:text-red-600 transition-colors flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="truncate">{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
