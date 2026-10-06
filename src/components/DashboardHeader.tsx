import React, { useRef, useEffect } from 'react';
import { User, getAvatarUrl } from '../services/api';
import { TabType } from './Sidebar';

export interface DashboardHeaderProps {
  user: User;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isAdmin: boolean;
  canViewDealers: boolean;
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenSecurityModal: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
  officialRoles: string[];
  roleLabelMap: Record<string, string>;
  roleBadgeColorMap: Record<string, string>;
  primaryRole: string;
  currentBadgeColor: string;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  activeTab,
  setActiveTab,
  isAdmin,
  canViewDealers,
  isUserMenuOpen,
  setIsUserMenuOpen,
  onOpenSecurityModal,
  onLogout,
  isLoggingOut,
  officialRoles,
  roleLabelMap,
  roleBadgeColorMap,
  primaryRole,
  currentBadgeColor,
}) => {
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Đóng popover user khi click ra ngoài mà KHÔNG dùng fixed overlay chặn cuộn trang
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen, setIsUserMenuOpen]);

  return (
    <header
      style={{
        height: '52px',
        backgroundColor: '#272882',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        zIndex: 40,
        flexShrink: 0,
        width: '100%',
      }}
    >
      {/* Khối bên trái: Logo & Tên hệ thống (giống phong cách ảnh 2 CodeGym) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
        <span
          style={{
            fontSize: '15px',
            fontWeight: '700',
            color: '#ffffff',
            letterSpacing: '-0.01em',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Hệ Thống Quản Lý Kho & Bán Hàng
        </span>
      </div>

      {/* Khối bên phải: Avatar Người dùng + Tên + Nút mở Menu */}
      <div ref={userMenuRef} style={{ position: 'relative', zIndex: 501 }}>
        <button
          onClick={() => setIsUserMenuOpen((prev) => !prev)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px 4px 6px',
            borderRadius: '999px',
            background: isUserMenuOpen ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            cursor: 'pointer',
            transition: 'all 0.18s ease',
          }}
          title={`${user.full_name || user.username} (${roleLabelMap[primaryRole] || primaryRole}) - Nhấp để mở menu`}
          aria-label="Tài khoản người dùng"
        >
          <div style={{ position: 'relative', width: '32px', height: '32px', flexShrink: 0 }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: user.avatar_url ? '#f1f5f9' : `linear-gradient(135deg, ${currentBadgeColor} 0%, #2563eb 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                overflow: 'hidden',
                border: '1.5px solid rgba(255, 255, 255, 0.8)',
              }}
            >
              {user.avatar_url ? (
                <img
                  src={getAvatarUrl(user.avatar_url)}
                  alt={user.full_name || user.username}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (user.full_name || user.username).charAt(0).toUpperCase()
              )}
            </div>
            <span
              style={{
                position: 'absolute',
                bottom: '0px',
                right: '0px',
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: '#16a34a',
                border: '1.5px solid #272882',
              }}
              title="Đang hoạt động"
            />
          </div>
          <span
            style={{
              fontSize: '13.5px',
              fontWeight: '600',
              color: '#ffffff',
              maxWidth: '160px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'none',
            }}
          >
            {user.full_name || user.username}
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'rgba(255, 255, 255, 0.85)' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Popover User Menu */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: user.avatar_url ? '#f1f5f9' : `linear-gradient(135deg, ${currentBadgeColor} 0%, #6366f1 100%)`,
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
                }}
              >
                {user.avatar_url ? (
                  <img
                    src={getAvatarUrl(user.avatar_url)}
                    alt={user.full_name || user.username}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h4
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '16.5px',
                    fontWeight: '700',
                    color: '#0f172a',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {user.full_name || user.username}
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

            {/* Danh sách nút tác vụ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                title="Xem và cập nhật hồ sơ cá nhân"
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#dbeafe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <span>Hồ sơ cá nhân</span>
              </button>

              {/* Tra cứu đại lý - Không hiển thị ở popover cho Admin */}
              {canViewDealers && !isAdmin && (
                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setActiveTab('dealers');
                  }}
                  id="btn-popover-dealers"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: activeTab === 'dealers' ? '#eff6ff' : '#f8fafc',
                    border: activeTab === 'dealers' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                    color: activeTab === 'dealers' ? '#1d4ed8' : '#1e293b',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                    boxShadow: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#eff6ff';
                    e.currentTarget.style.borderColor = '#93c5fd';
                    e.currentTarget.style.color = '#1d4ed8';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = activeTab === 'dealers' ? '#eff6ff' : '#f8fafc';
                    e.currentTarget.style.borderColor = activeTab === 'dealers' ? '#bfdbfe' : '#e2e8f0';
                    e.currentTarget.style.color = activeTab === 'dealers' ? '#1d4ed8' : '#1e293b';
                  }}
                  title="Tìm kiếm và tra cứu đại lý trong tuyến"
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: '#fef3c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#d97706',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <span>Tra cứu đại lý</span>
                </button>
              )}

              {isAdmin && (
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
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: '#dbeafe',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#2563eb',
                    }}
                  >
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

              {isAdmin && (
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
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: '#e0e7ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#4f46e5',
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                  </div>
                  <span>Nhật ký thao tác</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onOpenSecurityModal();
                }}
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
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#e0f2fe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#0284c7',
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <span>Đổi mật khẩu & Bảo mật</span>
              </button>

              <button
                onClick={() => {
                  if (isLoggingOut) return;
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                disabled={isLoggingOut}
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
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: '#fee2e2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                  }}
                >
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
  );
};

export default DashboardHeader;
