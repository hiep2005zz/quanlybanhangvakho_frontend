import React, { useState, useEffect } from 'react';
import { User, getAdminContactApi } from '../services/api';

interface AccessDeniedViewProps {
  currentUser: User;
  requiredPermission?: string;
  onBackToWorkflow: () => void;
  onLogout?: () => void | Promise<void>;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  currentUser,
  requiredPermission = 'Quản trị hệ thống (Admin)',
  onBackToWorkflow,
  onLogout,
}) => {
  const officialRoles = (currentUser.roles && currentUser.roles.length > 0
    ? currentUser.roles
    : [currentUser.role]
  ).filter((r) => r && r !== 'customer');

  const isDealer = currentUser.branch && currentUser.branch !== 'Chưa phân công';

  const roleLabelMap: Record<string, string> = {
    admin: 'Quản Trị Hệ Thống',
    sales_manager: 'Quản Lý Kinh Doanh',
    sales: 'Nhân Viên Kinh Doanh',
    warehouse: 'Thủ Kho',
    warehouse_manager: 'Quản Lý Kho',
    accountant: 'Kế Toán',
    purchasing: 'Nhân Viên Mua Hàng',
    customer: isDealer ? 'Đại Lý' : 'Chờ Cấp Quyền',
  };

  const roleBadgeColorMap: Record<string, string> = {
    admin: '#ef4444',
    sales_manager: '#8b5cf6',
    sales: '#3b82f6',
    warehouse: '#10b981',
    warehouse_manager: '#059669',
    accountant: '#f59e0b',
    purchasing: '#06b6d4',
    customer: isDealer ? '#0284c7' : '#94a3b8',
  };

  const primaryRole = officialRoles[0] || currentUser.role || 'customer';
  const roleName = roleLabelMap[primaryRole] || primaryRole;
  const badgeColor = roleBadgeColorMap[primaryRole] || '#64748b';

  const [adminEmail, setAdminEmail] = useState<string>('daongochiep645@gmail.com');

  useEffect(() => {
    let isMounted = true;
    getAdminContactApi().then((info) => {
      if (isMounted && info?.admin_email) {
        setAdminEmail(info.admin_email);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      maxWidth: '920px',
      margin: '20px auto 60px auto',
      padding: '0 16px',
      animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* Thẻ lỗi trung tâm Enterprise Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #fee2e2',
        borderRadius: '20px',
        padding: '44px 36px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02)',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '800',
          color: '#0f172a',
          letterSpacing: '-0.02em',
          margin: '0 0 14px 0',
        }}>
          Bạn Không Có Quyền Truy Cập Chức Năng Này
        </h1>

        <p style={{
          fontSize: '15px',
          color: '#64748b',
          lineHeight: '1.7',
          maxWidth: '640px',
          margin: '0 auto 28px auto',
        }}>
          Chức năng <strong>Phân quyền & Quản lý người dùng</strong> yêu cầu quyền hạn cấp cao{' '}
          <span style={{ color: '#b91c1c', fontWeight: '700' }}>{requiredPermission}</span>.
          Tài khoản của bạn hiện không thuộc danh sách được phân quyền thực thi nghiệp vụ này.
        </p>

        {/* Khung chi tiết tài khoản hiện tại */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 24px',
          maxWidth: '560px',
          margin: '0 auto 32px auto',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '13.5px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b' }}>Tài khoản đang đăng nhập:</span>
            <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>{currentUser.username}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b' }}>Vai trò hiện tại:</span>
            <span style={{
              display: 'inline-block',
              padding: '3px 12px',
              borderRadius: '999px',
              background: `${badgeColor}15`,
              color: badgeColor,
              fontWeight: '700',
              border: `1px solid ${badgeColor}35`,
            }}>
              {roleName}
            </span>
          </div>
          {currentUser.branch && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b' }}>Khu vực / Chi nhánh:</span>
              <span style={{ color: '#334155', fontWeight: '500' }}>{currentUser.branch}</span>
            </div>
          )}
        </div>

        {/* 3. KHỐI HÀNH ĐỘNG QUAY LẠI LUỒNG LÀM VIỆC */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '680px',
          margin: '0 auto',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}>
            {/* Hành động 1: Quay lại màn hình làm việc chính */}
            <button
              onClick={onBackToWorkflow}
              style={{
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.25)';
              }}
            >
              <div style={{ color: '#ffffff', fontSize: '14.5px', marginBottom: '3px' }}>Quản lý kho hàng & sản phẩm</div>
              <div style={{ fontSize: '12px', color: '#bfdbfe', fontWeight: '500' }}>Trang nghiệp vụ chính của bạn</div>
            </button>

            {/* Hành động 2: Đăng xuất / Đổi tài khoản có quyền */}
            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'center',
                  boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                <div style={{ color: '#0f172a', fontSize: '14.5px', marginBottom: '3px' }}>Đổi tài khoản khác</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Đăng nhập tài khoản Quản trị viên</div>
              </button>
            )}
          </div>

          {/* Dòng trợ giúp liên hệ quản trị - Căn chỉnh chuẩn hàng ngang không bị gãy dòng */}
          <div style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            fontSize: '13px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            lineHeight: '1.5',
            textAlign: 'center',
          }}>
            <span>Cần quyền hạn này cho công việc? Vui lòng liên hệ Quản trị viên hệ thống:</span>
            <a
              href={`mailto:${adminEmail}`}
              style={{
                color: '#2563eb',
                fontWeight: '700',
                textDecoration: 'none',
                borderBottom: '1px dashed #93c5fd',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap',
              }}
              title={`Gửi email đến Quản trị viên: ${adminEmail}`}
            >
              {adminEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
