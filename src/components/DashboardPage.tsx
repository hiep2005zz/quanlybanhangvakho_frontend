import { useState, useEffect, useRef } from 'react';
import { getProductsApi, ProductItem, User } from '../services/api';
import { sessionManager, SessionState } from '../services/sessionManager';
import SecurityModal from './SecurityModal';
import { UserManagementView } from './UserManagementView';
import { CategoryManagementView } from './CategoryManagementView';
import CreateCustomerModal from './CreateCustomerModal';
import UserProfileModal from './UserProfileModal';
import MoveCategoryModal from './MoveCategoryModal';
import { StatusToastHost, emitStatusToast } from './StatusToast';
import { AccessDeniedView } from './AccessDeniedView';
import { AuditLogView } from './AuditLogView';
import { ProfileView } from './ProfileView';
import './dashboard.css';

interface DashboardProps {
  user: User;
  token: string;
  onLogout: () => void | Promise<void>;
  onTokenUpdated?: (newToken: string) => void;
  onSwitchUser?: (newUser: User, newToken: string) => void;
  onUserUpdated?: (updatedUser: User) => void;
}

export default function DashboardPage({
  user,
  token,
  onLogout,
  onTokenUpdated,
  onUserUpdated,
}: DashboardProps) {
  // 1. Xác định vai trò & Kiểm tra quyền Admin tối cao
  const rawRoles = user.roles && user.roles.length > 0 ? user.roles : [user.role];
  const officialRoles = rawRoles.filter((r) => r && r !== 'customer');
  
  // Tài khoản bị khóa màn hình chờ chỉ khi chưa được phân công kho/địa bàn VÀ chưa có vai trò hợp lệ
  const isPendingCustomer =
    officialRoles.length === 0 &&
    (!user.branch || user.branch === 'Chưa phân công');
  const isAdmin = user.role === 'admin' || Boolean(user.roles && user.roles.includes('admin'));
  const isSalesManager = user.role === 'sales_manager' || Boolean(user.roles && user.roles.includes('sales_manager'));
  const canManageCategories = isAdmin || isSalesManager;

  // 2. Khởi tạo State với Clean URL (/users, /audit-logs, /categories, /profile)
  const [activeTab, setActiveTabState] = useState<'inventory' | 'users' | 'categories' | 'audit-logs' | 'profile'>(() => {
    const pathname = window.location.pathname.toLowerCase();
    const isUsersPath = pathname === '/users' || pathname.startsWith('/users/') || pathname === '/admin' || pathname.startsWith('/admin/');
    const isCategoriesPath = pathname === '/categories';
    const isAuditPath = pathname === '/audit-logs' || pathname.startsWith('/audit-logs/');
    const isProfilePath = pathname === '/profile' || pathname.startsWith('/profile/');

    // Dọn sạch tàn dư query parameter cũ (?tab=users, ?tab=audit-logs, ?tab=profile)
    const params = new URLSearchParams(window.location.search);
    const hasOldTabParam = params.has('tab') || params.has('view');
    const oldTabVal = (params.get('tab') || params.get('view') || '').toLowerCase();

    if (isProfilePath || oldTabVal === 'profile') {
      if (hasOldTabParam || pathname !== '/profile') {
        try {
          window.history.replaceState({}, '', '/profile');
        } catch {
          // ignore
        }
      }
      return 'profile';
    } else if (isAuditPath || oldTabVal === 'audit-logs' || oldTabVal === 'audit') {
      if (hasOldTabParam || pathname !== '/audit-logs') {
        try {
          window.history.replaceState({}, '', '/audit-logs');
        } catch {
          // ignore
        }
      }
      return 'audit-logs';
    } else if (isUsersPath || hasOldTabParam) {
      if (hasOldTabParam || pathname !== '/users') {
        try {
          window.history.replaceState({}, '', '/users');
        } catch {
          // ignore
        }
      }
      return 'users';
    }
    if (isCategoriesPath) {
      if (canManageCategories) {
        return 'categories';
      }
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        // ignore
      }
    }
    return 'inventory';
  });

  // 3. Chuyển đổi Route Clean URL: /users, /categories, /audit-logs, /profile, /
  const setActiveTab = (tab: 'inventory' | 'users' | 'categories' | 'audit-logs' | 'profile') => {
    if (tab === 'profile') {
      setActiveTabState('profile');
      try {
        window.history.pushState({}, '', '/profile');
      } catch {
        // ignore
      }
    } else if (tab === 'users') {
      if (!isAdmin) {
        setActiveTabState('inventory');
        try {
          window.history.replaceState({}, '', '/');
        } catch {
          // ignore
        }
        return;
      }
      setActiveTabState('users');
      try {
        window.history.pushState({}, '', '/users');
      } catch {
        // ignore
      }
    } else if (tab === 'categories') {
      if (!canManageCategories) {
        setActiveTabState('inventory');
        try {
          window.history.replaceState({}, '', '/');
        } catch {
          // ignore
        }
        return;
      }
      setActiveTabState('categories');
      try {
        window.history.pushState({}, '', '/categories');
      } catch {
        // ignore
      }
    } else if (tab === 'audit-logs') {
      setActiveTabState('audit-logs');
      try {
        window.history.pushState({}, '', '/audit-logs');
      } catch {
        // ignore
      }
    } else {
      setActiveTabState('inventory');
      try {
        window.history.pushState({}, '', '/');
      } catch {
        // ignore
      }
    }
  };

  // 4. [REACTIVE GUARD] Tự động bảo vệ khi phiên thay đổi (ví dụ: switch sang tài khoản không phải Admin)
  useEffect(() => {
    if (activeTab === 'users' && !isAdmin) {
      setActiveTabState('inventory');
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        // ignore
      }
    } else if (activeTab === 'categories' && !canManageCategories) {
      setActiveTabState('inventory');
      try {
        window.history.replaceState({}, '', '/');
      } catch {
        // ignore
      }
    }
  }, [activeTab, isAdmin, canManageCategories, user.username]);

  // 5. Đồng bộ sự kiện Lịch sử trình duyệt (Back/Forward - popstate) chuẩn Clean URL
  useEffect(() => {
    const syncFromUrl = () => {
      const pathname = window.location.pathname.toLowerCase();
      const isUsersPath = pathname === '/users' || pathname.startsWith('/users/') || pathname === '/admin' || pathname.startsWith('/admin/');
      const isAuditPath = pathname === '/audit-logs' || pathname.startsWith('/audit-logs/');
      const isProfilePath = pathname === '/profile' || pathname.startsWith('/profile/');
      const params = new URLSearchParams(window.location.search);
      const tabParam = (params.get('tab') || params.get('view') || '').toLowerCase();

      if (isProfilePath || tabParam === 'profile') {
        if (pathname !== '/profile' || tabParam) {
          try {
            window.history.replaceState({}, '', '/profile');
          } catch {
            // ignore
          }
        }
        setActiveTabState('profile');
      } else if (isAuditPath || tabParam === 'audit-logs' || tabParam === 'audit') {
        if (pathname !== '/audit-logs' || tabParam) {
          try {
            window.history.replaceState({}, '', '/audit-logs');
          } catch {
            // ignore
          }
        }
        setActiveTabState('audit-logs');
      } else if (isUsersPath || tabParam === 'users') {
        if (pathname !== '/users' || tabParam) {
          try {
            window.history.replaceState({}, '', '/users');
          } catch {
            // ignore
          }
        }
        setActiveTabState('users');
      } else if (pathname === '/categories') {
        if (canManageCategories) {
          setActiveTabState('categories');
        } else {
          setActiveTabState('inventory');
          try {
            window.history.replaceState({}, '', '/');
          } catch {
            // ignore
          }
        }
      } else {
        setActiveTabState('inventory');
      }
    };

    window.addEventListener('popstate', syncFromUrl);
    return () => {
      window.removeEventListener('popstate', syncFromUrl);
    };
  }, [canManageCategories]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isCostVisible, setIsCostVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionState>(() => sessionManager.getSessionState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isCreateAccountModalOpen, setIsCreateAccountModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [currentUserState, setCurrentUserState] = useState<User>(user);

  useEffect(() => {
    setCurrentUserState(user);
  }, [user]);

  // Move Category Modal State
  const [movingProduct, setMovingProduct] = useState<{ id: number; name: string; category_id?: number | null } | null>(null);

  // Timer điều khiển di chuột vào mở rộng, di chuột ra tự động đóng
  const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnterMenu = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
    setIsMenuOpen(true);
  };

  const handleMouseLeaveMenu = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
    }
    menuTimerRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 250);
  };

  const handleCloseMenu = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
    setIsMenuOpen(false);
  };

  // Tự động đóng menu khi người dùng bấm phím Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    if (isMenuOpen || isUserMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, isUserMenuOpen]);

  // Lắng nghe cập nhật trạng thái phiên
  useEffect(() => {
    const unsubscribe = sessionManager.onStatusChange((state) => {
      setSessionInfo(state);
    });
    return () => unsubscribe();
  }, []);

  const remainingSeconds = sessionInfo.remainingSeconds;
  const isWarningZone = remainingSeconds > 0 && remainingSeconds <= 120;

  useEffect(() => {
    if (isPendingCustomer) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    getProductsApi(token)
      .then((data) => {
        if (isMounted) {
          setProducts(data.items);
          setIsCostVisible(data.is_cost_price_visible);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Lỗi khi tải dữ liệu sản phẩm từ Backend.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, isPendingCustomer]);



  // Tính toán số liệu thống kê
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.sell_price * p.stock, 0);

  // Tính giá vốn và lợi nhuận (chỉ khả dụng khi Backend trả về cho Quản lý kinh doanh / Admin)
  const isCostAvailable = isCostVisible && products.length > 0 && products.every((p) => p.cost_price !== null && p.cost_price !== undefined);
  const totalCostValue = isCostAvailable ? products.reduce((acc, p) => acc + (p.cost_price || 0) * p.stock, 0) : 0;
  const totalProfit = totalSellValue - totalCostValue;

  // Lọc sản phẩm theo Toolbar (Search và Category)
  const filteredProducts = products.filter((p) => {
    const q = productSearchTerm.trim().toLowerCase();
    const matchQuery = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    return matchQuery && matchCat;
  });

  const roleLabelMap: Record<string, string> = {
    admin: 'Quản Trị Hệ Thống',
    sales_manager: 'Quản Lý Kinh Doanh',
    sales: 'Nhân Viên Kinh Doanh',
    warehouse: 'Thủ Kho',
    warehouse_manager: 'Quản Lý Kho',
    accountant: 'Kế Toán',
    purchasing: 'Nhân Viên Mua Hàng',
    customer: (!user.branch || user.branch === 'Chưa phân công') ? 'Chưa Phân Quyền' : 'Đại Lý',
  };

  const roleBadgeColorMap: Record<string, string> = {
    admin: '#ef4444',
    sales_manager: '#8b5cf6',
    sales: '#3b82f6',
    warehouse: '#10b981',
    warehouse_manager: '#059669',
    accountant: '#f59e0b',
    purchasing: '#06b6d4',
    customer: (!user.branch || user.branch === 'Chưa phân công') ? '#94a3b8' : '#0284c7',
  };

  const primaryRole = officialRoles[0] || user.role;
  const currentBadgeColor = roleBadgeColorMap[primaryRole] || '#64748b';

  return (
    <div className="dashboard-main-container">
      {/* Top Navbar */}
      <header className="dashboard-header-bar">
        {/* Khối bên trái: Nút 3 gạch (chỉ ở trang chủ và không phải tài khoản chờ duyệt) + Logo + Tên hệ thống */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeTab === 'inventory' && !isPendingCustomer && (
            <button
              onMouseEnter={handleMouseEnterMenu}
              onMouseLeave={handleMouseLeaveMenu}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Mở rộng menu"
              title="Mở rộng menu"
              className="hamburger-left-btn"
              style={{
                width: '40px',
                height: '40px',
                padding: 0,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transform: 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ width: '18px', height: '2px', background: '#334155', borderRadius: '2px' }}></span>
                <span style={{ width: '18px', height: '2px', background: '#334155', borderRadius: '2px' }}></span>
                <span style={{ width: '18px', height: '2px', background: '#334155', borderRadius: '2px' }}></span>
              </div>
            </button>
          )}

          <div
            className="brand-logo-animated"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
              cursor: 'default',
              userSelect: 'none',
              flexShrink: 0
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 className="brand-title-shimmer" style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Hệ Thống Quản Lý Kho & Bán Hàng
              </h1>
            </div>
          </div>
        </div>

        {/* Khối bên phải: Header User pill (Avatar chữ cái đầu + Tên + Badge vai trò + Kho) */}
        <div style={{ position: 'relative', zIndex: 501 }}>
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              borderRadius: '50%',
              background: 'transparent',
              border: isUserMenuOpen ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isUserMenuOpen ? '0 0 0 3px rgba(37, 99, 235, 0.2)' : 'none',
            }}
            title={`${user.full_name || user.username} (${roleLabelMap[primaryRole] || primaryRole}) - Nhấp để mở menu`}
            aria-label="Tài khoản người dùng"
          >
            {/* Avatar tròn với ảnh hoặc chữ cái đầu & Online status indicator */}
            <div style={{ position: 'relative', width: '36px', height: '36px', flexShrink: 0 }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${currentBadgeColor} 0%, #2563eb 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '15px',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden'
              }}>
                {currentUserState.avatar_thumbnail_url || currentUserState.avatar_url ? (
                  <img
                    src={(currentUserState.avatar_thumbnail_url || currentUserState.avatar_url) ?? ''}
                    alt={currentUserState.full_name || currentUserState.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  (currentUserState.full_name || currentUserState.username).charAt(0).toUpperCase()
                )}
              </div>
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: '#16a34a',
                  border: '2px solid #ffffff',
                }}
                title="Đang hoạt động"
              />
            </div>
          </button>

          {/* Popover thông tin người dùng (Clean Light Theme) */}
          {isUserMenuOpen && (
            <div
              className="header-popover-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '330px',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.04)',
                border: '1px solid #e2e8f0',
                zIndex: 1000,
                animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Phần trên: Avatar + Tên + Role Badge (Click Avatar để đến trang Hồ sơ & Đổi ảnh) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                <div
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setActiveTab('profile');
                  }}
                  title="Nhấp để xem hồ sơ và đổi ảnh đại diện"
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '16px',
                    background: `linear-gradient(135deg, ${currentBadgeColor} 0%, #6366f1 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '22px',
                    flexShrink: 0,
                    boxShadow: `0 8px 20px ${currentBadgeColor}55, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  {currentUserState.avatar_url || currentUserState.avatar_thumbnail_url ? (
                    <img
                      src={(currentUserState.avatar_url || currentUserState.avatar_thumbnail_url) ?? ''}
                      alt={currentUserState.full_name || currentUserState.username}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    (currentUserState.full_name || currentUserState.username).charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{
                    margin: '0 0 6px 0',
                    fontSize: '16.5px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {currentUserState.full_name || currentUserState.username}
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>

                    {(officialRoles.length > 0 ? officialRoles : ['customer']).map((rCode) => {
                      const color = roleBadgeColorMap[rCode] || '#64748b';
                      const label = roleLabelMap[rCode] || rCode;
                      return (
                        <span
                          key={rCode}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            background: `${color}18`,
                            color: color,
                            fontSize: '11px',
                            fontWeight: '700',
                            border: `1px solid ${color}35`,
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Thông tin tài khoản Light Card */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#64748b',
                lineHeight: '1.6',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Tài khoản:</span>
                  <strong style={{ color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>{user.username}</strong>
                </div>
                {user.email && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span>Email:</span>
                    <strong style={{ color: '#334155', fontSize: '12px', maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={user.email}>{user.email}</strong>
                  </div>
                )}
                {user.phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Điện thoại:</span>
                    <strong style={{ color: '#334155' }}>{user.phone}</strong>
                  </div>
                )}
                {user.branch && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Kho / Địa bàn:</span>
                    <strong style={{ color: '#334155' }}>{user.branch}</strong>
                  </div>
                )}
              </div>

              {/* Danh sách hành động (Interactive Buttons for Light Theme) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* 1. Hồ sơ cá nhân - Dành cho tất cả vai trò */}
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setActiveTab('profile');
                  }}
                  id="btn-popover-profile"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: activeTab === 'profile' ? '#eff6ff' : '#f8fafc',
                    border: activeTab === 'profile' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    color: activeTab === 'profile' ? '#1d4ed8' : '#1e293b',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: 'none',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.color = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = activeTab === 'profile' ? '#eff6ff' : '#f8fafc';
                    e.currentTarget.style.borderColor = activeTab === 'profile' ? '#bfdbfe' : '#e2e8f0';
                    e.currentTarget.style.color = activeTab === 'profile' ? '#1d4ed8' : '#1e293b';
                  }}
                  title="Hồ sơ cá nhân & Đổi ảnh đại diện"
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                    flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <span>Hồ sơ cá nhân</span>
                </button>

                {/* 2. Phân quyền & Tạo tài khoản - CHỈ hiển thị nếu là Admin */}
                {(user.role === 'admin' || (user.roles && user.roles.includes('admin'))) && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setActiveTab('users');
                    }}
                    id="btn-popover-roles-and-create"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: activeTab === 'users' ? '#eff6ff' : '#f8fafc',
                      border: activeTab === 'users' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      color: activeTab === 'users' ? '#1d4ed8' : '#1e293b',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: 'none',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.color = '#1d4ed8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = activeTab === 'users' ? '#eff6ff' : '#f8fafc';
                      e.currentTarget.style.borderColor = activeTab === 'users' ? '#bfdbfe' : '#e2e8f0';
                      e.currentTarget.style.color = activeTab === 'users' ? '#1d4ed8' : '#1e293b';
                    }}
                    title="Truy cập trang Phân quyền & Quản lý người dùng"
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb',
                      flexShrink: 0,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <span>Phân quyền & Tạo tài khoản</span>
                  </button>
                )}

                {/* 3. Nhật ký thao tác - CHỈ hiển thị nếu là Admin */}
                {(user.role === 'admin' || (user.roles && user.roles.includes('admin'))) && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setActiveTab('audit-logs');
                    }}
                    id="btn-popover-audit-logs"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: activeTab === 'audit-logs' ? '#eff6ff' : '#f8fafc',
                      border: activeTab === 'audit-logs' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                      color: activeTab === 'audit-logs' ? '#1d4ed8' : '#1e293b',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: 'none',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#eff6ff';
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.color = '#1d4ed8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = activeTab === 'audit-logs' ? '#eff6ff' : '#f8fafc';
                      e.currentTarget.style.borderColor = activeTab === 'audit-logs' ? '#bfdbfe' : '#e2e8f0';
                      e.currentTarget.style.color = activeTab === 'audit-logs' ? '#1d4ed8' : '#1e293b';
                    }}
                    title="Truy cập Nhật ký thao tác hệ thống"
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb',
                      flexShrink: 0,
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </div>
                    <span>Nhật ký thao tác</span>
                  </button>
                )}

                {/* 4. Đổi mật khẩu & Bảo mật */}
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSecurityModalOpen(true);
                  }}
                  id="btn-popover-security"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#1e293b',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: 'none',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0f9ff';
                    e.currentTarget.style.borderColor = '#bae6fd';
                    e.currentTarget.style.color = '#0284c7';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                    flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <span>Đổi mật khẩu & Bảo mật</span>
                </button>

                {/* 5. Đăng xuất */}
                <button
                  onClick={() => {
                    if (isLoggingOut) return;
                    setIsUserMenuOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                  disabled={isLoggingOut}
                  id="btn-popover-logout"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: 'none',
                    marginTop: '2px',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fee2e2';
                    e.currentTarget.style.borderColor = '#fca5a5';
                    e.currentTarget.style.color = '#b91c1c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.borderColor = '#fecaca';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                    flexShrink: 0,
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </div>
                  <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Backdrop đóng popover user khi click ra ngoài (đặt ở root level ngoài header) */}
      {isUserMenuOpen && (
        <div
          onClick={() => setIsUserMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 499,
            background: 'transparent',
          }}
        />
      )}

      {/* Backdrop mờ khi mở Drawer */}
      <div
        className={`sidebar-drawer-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={handleCloseMenu}
      />

      {/* Drawer menu mở rộng từ bên trái (13 mục nguyên bản, không thêm chức năng thừa) */}
      <aside
        className={`sidebar-drawer ${isMenuOpen ? 'open' : ''}`}
        onMouseEnter={handleMouseEnterMenu}
        onMouseLeave={handleMouseLeaveMenu}
      >
        {/* Header Drawer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#ffffff', fontWeight: '600', fontSize: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ width: '18px', height: '2px', background: '#93c5fd', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#93c5fd', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#93c5fd', borderRadius: '2px' }}></span>
            </div>
            <span>Mở rộng menu</span>
          </div>
          <button
            onClick={handleCloseMenu}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '14px',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            title="Đóng menu"
          >
            ✕
          </button>
        </div>

        {/* Danh sách mục menu: Hiển thị đúng theo quyền của người dùng */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {/* Quản lý kho hàng - Tất cả nhân viên đều truy cập trang kho */}
          <div
            className={`sidebar-menu-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('inventory');
              handleCloseMenu();
            }}
          >
            <div className="sidebar-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <span style={{ fontWeight: activeTab === 'inventory' ? '700' : '500', fontSize: '14.5px' }}>Quản lý kho hàng</span>
          </div>

          {/* Hồ sơ cá nhân - Tất cả tài khoản */}
          <div
            className={`sidebar-menu-item ${activeTab === 'profile' ? 'active' : ''}`}
            id="btn-sidebar-profile"
            onClick={() => {
              setActiveTab('profile');
              handleCloseMenu();
            }}
          >
            <div className="sidebar-icon-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <span style={{ fontWeight: activeTab === 'profile' ? '700' : '500', fontSize: '14.5px' }}>Hồ sơ cá nhân</span>
          </div>

          {/* Mục Phân quyền & Tạo tài khoản - CHỈ hiển thị nếu là Admin */}
          {(user.role === 'admin' || (user.roles && user.roles.includes('admin'))) && (
            <div
              className={`sidebar-menu-item ${activeTab === 'users' ? 'active' : ''}`}
              id="btn-sidebar-roles-and-create"
              onClick={() => {
                setActiveTab('users');
                handleCloseMenu();
              }}
            >
              <div className="sidebar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 8v4" />
                  <path d="M12 16h.01" />
                </svg>
              </div>
              <span style={{ fontWeight: activeTab === 'users' ? '700' : '500', fontSize: '14.5px' }}>Phân quyền & Tạo tài khoản</span>
            </div>
          )}

          {/* Quản lý Danh Mục - CHỈ hiển thị nếu là Admin hoặc có quyền */}
          {canManageCategories && (
            <div
              className={`sidebar-menu-item ${activeTab === 'categories' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('categories');
                handleCloseMenu();
              }}
            >
              <div className="sidebar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 3h7v7H3z" />
                  <path d="M14 3h7v7h-7z" />
                  <path d="M14 14h7v7h-7z" />
                  <path d="M3 14h7v7H3z" />
                </svg>
              </div>
              <span style={{ fontWeight: activeTab === 'categories' ? '700' : '500', fontSize: '14.5px' }}>Nhóm hàng & Doanh số</span>
            </div>
          )}

          {/* Mục Nhật ký thao tác - CHỈ hiển thị nếu là Admin */}
          {(user.role === 'admin' || (user.roles && user.roles.includes('admin'))) && (
            <div
              className={`sidebar-menu-item ${activeTab === 'audit-logs' ? 'active' : ''}`}
              id="btn-sidebar-audit-logs"
              onClick={() => {
                setActiveTab('audit-logs');
                handleCloseMenu();
              }}
            >
              <div className="sidebar-icon-box">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <span style={{ fontWeight: activeTab === 'audit-logs' ? '700' : '500', fontSize: '14.5px' }}>Nhật ký thao tác</span>
            </div>
          )}
        </div>


        {/* Nút Đăng xuất ở cuối sidebar */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.12)',
          background: 'rgba(0, 0, 0, 0.15)'
        }}>
          <button
            className="sidebar-logout-btn"
            onClick={() => {
              if (isLoggingOut) return;
              setIsMenuOpen(false);
              setShowLogoutConfirm(true);
            }}
            disabled={isLoggingOut}
          >
            <div className="sidebar-logout-icon-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content: Switch between User Management, Inventory and Pending Authorization */}
      {activeTab === 'users' ? (
        isAdmin ? (
          <UserManagementView
            currentUser={user}
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
            onCreateAccount={() => setIsCreateAccountModalOpen(true)}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản trị hệ thống (Admin)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'categories' ? (
        <CategoryManagementView
          token={token}
          onBackToHome={() => setActiveTab('inventory')}
        />
      ) : activeTab === 'audit-logs' ? (
        isAdmin ? (
          <AuditLogView
            currentUser={user}
            token={token}
            onBackToHome={() => setActiveTab('inventory')}
          />
        ) : (
          <AccessDeniedView
            currentUser={user}
            requiredPermission="Quản trị hệ thống (Admin)"
            onBackToWorkflow={() => setActiveTab('inventory')}
            onLogout={onLogout}
          />
        )
      ) : activeTab === 'profile' ? (
        <ProfileView
          currentUser={user}
          token={token}
          onBackToHome={() => setActiveTab('inventory')}
          onUserUpdated={onUserUpdated}
        />
      ) : isPendingCustomer ? (
        /* GIAO DIỆN THÔNG BÁO CHO TÀI KHOẢN CHƯA ĐƯỢC ADMIN CẤP QUYỀN */
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px 20px',
          minHeight: '60vh',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: '40px 32px',
            maxWidth: '560px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(16px)',
          }}>
            {/* Icon Trạng Thái Chờ */}
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35))',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 20px auto',
              boxShadow: '0 10px 25px rgba(245, 158, 11, 0.25)',
            }}>
              ⏳
            </div>

            <h2 style={{
              fontSize: '22px',
              fontWeight: '800',
              color: '#ffffff',
              marginBottom: '12px',
              letterSpacing: '-0.01em',
            }}>
              Tài Khoản Đang Chờ Quản Trị Viên Cấp Quyền
            </h2>

            <p style={{
              fontSize: '14.5px',
              color: '#94a3b8',
              lineHeight: '1.6',
              marginBottom: '24px',
            }}>
              Xin chào <strong style={{ color: '#f8fafc' }}>{user.full_name || user.username}</strong>! Tài khoản của bạn đã được khởi tạo thành công trên hệ thống.
              Hiện tại tài khoản chưa được Quản trị viên phân bổ vai trò nghiệp vụ (Bán hàng, Kho, Mua hàng...) và phân công chi nhánh.
            </p>

            {/* Khung Thông Tin Tài Khoản */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '12px',
              padding: '16px 20px',
              marginBottom: '26px',
              textAlign: 'left',
              fontSize: '13.5px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: '#64748b' }}>Tên đăng nhập:</span>
                <span style={{ color: '#38bdf8', fontWeight: '600' }}>@{user.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: '#64748b' }}>Trạng thái tài khoản:</span>
                <span style={{
                  color: '#fbbf24',
                  background: 'rgba(245, 158, 11, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600'
                }}>
                  Chờ Quản trị viên phê duyệt
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: '#64748b' }}>Chi nhánh / Kho:</span>
                <span style={{ color: '#94a3b8' }}>{user.branch || 'Chưa phân công'}</span>
              </div>
            </div>

            {/* Gợi ý hành động */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <button
                onClick={async () => {
                  try {
                    await sessionManager.syncCurrentProfile();
                    window.location.reload();
                  } catch {
                    window.location.reload();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                🔄 Kiểm tra lại trạng thái quyền hạn
              </button>

              <button
                onClick={() => {
                  if (isLoggingOut) return;
                  setShowLogoutConfirm(true);
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#cbd5e1',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#cbd5e1')}
              >
                {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất tài khoản'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Dashboard Content */}

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              padding: '12px 16px',
              borderRadius: '10px',
              marginBottom: '20px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* 4 Thẻ KPI Dashboard (Metric Card chuẩn Stripe / Linear Enterprise Minimalist) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* Thẻ 1: Mặt hàng trong kho */}
            <div className="kpi-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Mặt hàng trong kho</span>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>Danh mục sản phẩm lưu hành</div>
                </div>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                    <line x1="12" y1="22.08" x2="12" y2="12" />
                  </svg>
                </div>
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                color: '#0f172a',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
                marginTop: '4px'
              }}>
                {isLoading ? '...' : `${products.length} mã SP`}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                color: '#64748b',
                marginTop: '12px',
                fontWeight: '500'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <span>Tổng lưu kho: <strong style={{ color: '#0f172a', fontWeight: '600' }}>{totalStock.toLocaleString()}</strong> đơn vị</span>
              </div>
            </div>

            {/* Thẻ 2: Giá trị bán niêm yết */}
            <div className="kpi-stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Tổng giá trị bán niêm yết</span>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>Dự kiến toàn bộ tồn kho</div>
                </div>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                color: '#0f172a',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.2,
                marginTop: '4px'
              }}>
                {isLoading ? '...' : `${totalSellValue.toLocaleString('vi-VN')} đ`}
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                color: '#64748b',
                marginTop: '12px',
                fontWeight: '500'
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                <span>Giá niêm yết bán lẻ · Đã gồm VAT</span>
              </div>
            </div>

            {/* Thẻ 3: Tổng Giá Vốn (Chỉ Quản lý kinh doanh & Admin) */}
            {isCostVisible && isCostAvailable && (
              <div className="kpi-stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Tổng giá vốn tồn kho</span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>Dữ liệu nội bộ bảo mật</div>
                  </div>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                  marginTop: '4px'
                }}>
                  {isLoading ? '...' : `${totalCostValue.toLocaleString('vi-VN')} đ`}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  color: '#64748b',
                  marginTop: '12px',
                  fontWeight: '500'
                }}>
                  <span style={{ color: '#0284c7' }}>🔒</span>
                  <span>Quyền xem: Quản lý kinh doanh / Admin</span>
                </div>
              </div>
            )}

            {/* Thẻ 4: Lợi Nhuận Dự Kiến (Chỉ Quản lý kinh doanh & Admin) */}
            {isCostVisible && isCostAvailable && (
              <div className="kpi-stat-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Lợi nhuận gộp dự kiến</span>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>Biên lãi chênh lệch giá</div>
                  </div>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                      <polyline points="17 6 23 6 23 12" />
                    </svg>
                  </div>
                </div>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  letterSpacing: '-0.02em',
                  color: '#0f172a',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.2,
                  marginTop: '4px'
                }}>
                  {isLoading ? '...' : `+${totalProfit.toLocaleString('vi-VN')} đ`}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '12px',
                  color: '#15803d',
                  marginTop: '12px',
                  fontWeight: '600'
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                    <polyline points="17 6 23 6 23 12" />
                  </svg>
                  <span>Biên lợi nhuận: +{totalSellValue && totalCostValue ? Math.round(((totalSellValue - totalCostValue) / totalSellValue) * 100) : 0}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Clean Enterprise Data Table Container */}
          <div className="premium-table-card roles-grid-scroll" style={{ overflowX: 'auto', padding: '0', borderRadius: '12px' }}>
            {/* Toolbar trên bảng theo chuẩn Stripe / Linear Enterprise */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              gap: '12px',
              background: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
                {/* Search Input với icon kính lúp */}
                <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Tìm theo mã hoặc tên sản phẩm..."
                    value={productSearchTerm}
                    onChange={(e) => setProductSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 12px 7px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Dropdown Lọc danh mục */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#334155',
                    background: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">Tất cả ngành hàng ({products.length})</option>
                  {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nút Xuất file & Làm mới chuyên nghiệp */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', color: '#64748b', marginRight: '4px' }}>
                  Hiển thị <strong style={{ color: '#0f172a' }}>{filteredProducts.length}</strong> / {products.length} SP
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // Xuất file chuẩn định dạng Excel (.xls - HTML XML Spreadsheet)
                    // Cách này đảm bảo:
                    // 1. Phân chia đúng 100% từng cột ô trong Excel mà không phụ thuộc vào Regional Settings (dấu phẩy hay chấm phẩy).
                    // 2. Không bao giờ bị lỗi phông chữ tiếng Việt có dấu.
                    // 3. Có định dạng tiêu đề, canh lề số và viền bảng chỉn chu.
                    const excelTemplate = `
                      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                      <head>
                        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
                        <!--[if gte mso 9]>
                        <xml>
                          <x:ExcelWorkbook>
                            <x:ExcelWorksheets>
                              <x:ExcelWorksheet>
                                <x:Name>Danh Sách Hàng Hóa</x:Name>
                                <x:WorksheetOptions>
                                  <x:DisplayGridlines/>
                                </x:WorksheetOptions>
                              </x:ExcelWorksheet>
                            </x:ExcelWorksheets>
                          </x:ExcelWorkbook>
                        </xml>
                        <![endif]-->
                        <style>
                          table { border-collapse: collapse; font-family: Calibri, sans-serif; }
                          th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
                          td { border: 1px solid #e2e8f0; padding: 8px 10px; color: #334155; }
                          .text-center { text-align: center; }
                          .text-right { text-align: right; }
                        </style>
                      </head>
                      <body>
                        <table>
                          <thead>
                            <tr>
                              <th style="width: 100px;">Mã SP</th>
                              <th style="width: 250px;">Tên sản phẩm</th>
                              <th style="width: 140px;" class="text-center">Ngành hàng</th>
                              <th style="width: 110px;" class="text-right">Số lượng tồn</th>
                              <th style="width: 150px;" class="text-right">Giá niêm yết (VNĐ)</th>
                            </tr>
                          </thead>
                          <tbody>
                            ${filteredProducts.map((p) => `
                              <tr>
                                <td style="mso-number-format:'\\@'; font-weight: 600;">${p.code}</td>
                                <td>${p.name}</td>
                                <td class="text-center">${p.category}</td>
                                <td class="text-right">${p.stock}</td>
                                <td class="text-right">${p.sell_price.toLocaleString('vi-VN')}</td>
                              </tr>
                            `).join('')}
                          </tbody>
                        </table>
                      </body>
                      </html>
                    `;
                    const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', `danh_sach_hang_hoa_${new Date().toISOString().slice(0, 10)}.xls`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f8fafc';
                    e.currentTarget.style.borderColor = '#94a3b8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#cbd5e1';
                  }}
                  title="Xuất danh sách sản phẩm dạng CSV"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Xuất file</span>
                </button>
              </div>
            </div>

            {isLoading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>Đang tải dữ liệu từ máy chủ Backend...</div>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                Không tìm thấy sản phẩm nào phù hợp với điều kiện tìm kiếm.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead>
                  <tr style={{
                    color: '#64748b',
                    background: '#f8fafc',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    borderBottom: '1px solid #e2e8f0',
                  }}>
                    <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'left' }}>Mã SP</th>
                    <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'left' }}>Tên Sản Phẩm</th>
                    <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'left' }}>Ngành Hàng</th>
                    <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right' }}>Số Lượng Tồn</th>
                    <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right' }}>Giá Niêm Yết (Bán)</th>
                    {/* CỘT GIÁ VỐN & BIÊN LỢI NHUẬN - CHỈ HIỆN KHI SERVER CHO PHÉP (QUẢN LÝ KINH DOANH / ADMIN) */}
                    {isCostVisible && (
                      <>
                        <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right' }}>Giá Vốn Nhập Kho</th>
                        <th style={{ padding: '12px 18px', fontWeight: '600', textAlign: 'right' }}>Biên Lợi Nhuận</th>
                      </>
                    )}
                    {!isCostVisible && (
                      <th style={{ width: '16px' }} />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="inventory-row"
                      style={{
                        background: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                        borderBottom: '1px solid #f1f5f9',
                      }}
                    >
                      {/* Mã SP: font monospace thanh mảnh, Slate đậm, không bọc khung giả nút bấm */}
                      <td style={{
                        padding: '13px 18px',
                        textAlign: 'left',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#334155',
                      }}>
                        {item.code}
                      </td>

                      {/* Tên Sản Phẩm */}
                      <td style={{ padding: '13px 18px', fontWeight: '500', color: '#0f172a', fontSize: '13.5px', textAlign: 'left' }}>
                        {item.name}
                      </td>

                      {/* Danh Mục: Text gọn gàng + Edit button if Admin/Write Inventory */}
                      <td style={{ padding: '13px 18px', textAlign: 'left', color: '#64748b', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.category}</span>
                          {canManageCategories && (
                            <button
                              onClick={() => setMovingProduct({ id: item.id, name: item.name, category_id: item.category_id })}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '2px',
                                color: '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Chuyển ngành hàng"
                              onMouseEnter={e => e.currentTarget.style.color = '#3b82f6'}
                              onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Số Lượng Tồn: Số kèm đơn vị bình thường, màu chữ tối chuẩn đồng nhất */}
                      <td style={{ padding: '13px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{
                          fontWeight: '600',
                          color: '#0f172a',
                        }}>
                          {item.stock.toLocaleString()} cái
                        </span>
                      </td>

                      {/* Giá Niêm Yết: Màu chữ tối chuẩn #0f172a, tabular-nums */}
                      <td style={{ padding: '13px 18px', color: '#0f172a', fontWeight: '600', fontSize: '13.5px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {item.sell_price.toLocaleString('vi-VN')} đ
                      </td>

                      {/* GIÁ VỐN & BIÊN LỢI NHUẬN TỪ SERVER: Chuyển từ đỏ tươi sang màu tối bình thường kèm tag bảo mật nhỏ */}
                      {isCostVisible && (
                        <>
                          <td style={{ padding: '13px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                              <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>
                                {item.cost_price ? `${item.cost_price.toLocaleString('vi-VN')} đ` : '—'}
                              </span>
                              <span style={{ fontSize: '10.5px', color: '#94a3b8', letterSpacing: '-0.01em' }}>
                                Chỉ Quản lý
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '13px 18px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {item.profit_margin !== undefined && item.profit_margin !== null ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                color: item.profit_margin >= 0 ? '#15803d' : '#dc2626',
                                fontWeight: '600',
                                fontSize: '13px',
                              }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  {item.profit_margin >= 0 ? (
                                    <>
                                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                                      <polyline points="17 6 23 6 23 12" />
                                    </>
                                  ) : (
                                    <>
                                      <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
                                      <polyline points="17 18 23 18 23 12" />
                                    </>
                                  )}
                                </svg>
                                <span>{item.profit_margin >= 0 ? '+' : ''}{item.profit_margin}%</span>
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                        </>
                      )}
                      {!isCostVisible && (
                        <td />
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Cảnh báo phiên sắp hết hạn khi < 2p */}
      {isWarningZone && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: '#1e293b',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '18px',
            padding: '28px 24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 158, 11, 0.2)',
            textAlign: 'center',
            color: '#f8fafc'
          }}>
            <h3 style={{ fontSize: '19px', fontWeight: '700', margin: '0 0 10px', color: '#fde68a' }}>
              Phiên Làm Việc Sắp Hết Hạn
            </h3>
            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px' }}>
              Hệ thống phát hiện bạn không thao tác trong một khoảng thời gian.
            </p>
          </div>
        </div>
      )}

      {/* Modal Bảo Mật & Đổi Mật Khẩu */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        token={token}
        username={user.username}
        onTokenUpdated={onTokenUpdated}
      />

      {/* Modal Hồ Sơ Cá Nhân & Tải Lên Ảnh Đại Diện */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUserState}
        token={token}
        onProfileUpdated={(updatedUser) => {
          setCurrentUserState(updatedUser);
          sessionManager.broadcastUserUpdate(updatedUser.username);
        }}
      />

      {/* Modal Tạo Tài Khoản (Kích hoạt từ Popover Avatar hoặc Sidebar Drawer) */}
      <CreateCustomerModal

        isOpen={isCreateAccountModalOpen}
        onClose={() => setIsCreateAccountModalOpen(false)}
        token={token}
        onSuccess={(msg) => {
          // Bắn sự kiện cập nhật để trang phân quyền tải lại ngay tức thì
          window.dispatchEvent(new CustomEvent('USER_ACCOUNTS_CHANGED', { detail: { message: msg } }));
          // Thông báo nổi góc phải màn hình: hiển thị ở MỌI tab (kể cả khi tạo từ Popover Avatar / Sidebar Drawer)
          emitStatusToast({ message: msg.replace(/^✅\s*/, ''), title: 'Tạo tài khoản thành công' });
        }}
      />

      <MoveCategoryModal
        isOpen={movingProduct !== null}
        onClose={() => setMovingProduct(null)}
        token={token}
        productId={movingProduct?.id || 0}
        productName={movingProduct?.name || ''}
        currentCategoryId={movingProduct?.category_id}
        onSuccess={() => {
          // Reload products
          getProductsApi(token).then(data => {
            setProducts(data.items);
          }).catch(console.error);
        }}
      />

      {/* Modal Popup Xác nhận đăng xuất ở giữa màn hình */}
      {showLogoutConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
            animation: 'fadeInCard 0.15s ease-out'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* Icon cảnh báo tròn */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                border: '1px solid #fee2e2'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: '0 0 8px 0' }}>
              Xác nhận đăng xuất
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              Bạn có chắc chắn muốn đăng xuất khỏi hệ thống không?
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
              >
                Hủy bỏ
              </button>

              <button
                type="button"
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  setIsLoggingOut(true);
                  try {
                    await onLogout();
                  } finally {
                    setIsLoggingOut(false);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#b91c1c')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dc2626')}
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Ổ thông báo nổi góc phải màn hình (dùng chung cho mọi thao tác tài khoản) */}
      <StatusToastHost />
    </div>
  );
}
