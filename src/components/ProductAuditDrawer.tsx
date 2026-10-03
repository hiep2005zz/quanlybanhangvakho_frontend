import React, { useState, useEffect } from 'react';
import { AuditLogItem, getEntityAuditLogsApi, getUsersApi, UserAccount, getAvatarUrl } from '../services/api';
import { AuditDetailModal } from './AuditDetailModal';
import { formatLocalDateTime } from '../utils/dateUtils';

interface ProductAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productCode: string;
  productName: string;
  token: string;
}

export const ProductAuditDrawer: React.FC<ProductAuditDrawerProps> = ({
  isOpen,
  onClose,
  productCode,
  productName,
  token,
}) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetailLog, setSelectedDetailLog] = useState<AuditLogItem | null>(null);

  useEffect(() => {
    if (isOpen && token) {
      getUsersApi(token)
        .then((res) => {
          setUsersList(res.users || []);
        })
        .catch(() => {
          // ignore error loading users
        });
    }
  }, [isOpen, token]);

  useEffect(() => {
    if (isOpen && productCode) {
      setLoading(true);
      setError(null);
      getEntityAuditLogsApi(token, 'Product', productCode)
        .then((data: AuditLogItem[]) => {
          setLogs(data);
          setLoading(false);
        })
        .catch((err: any) => {
          setError(err.message || 'Lỗi tải lịch sử thao tác sản phẩm.');
          setLoading(false);
        });
    }
  }, [isOpen, productCode, token]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
        }}
      />

      {/* Drawer Container (Right side) */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '520px',
        maxWidth: '92vw',
        background: '#ffffff',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.2)',
        borderLeft: '1px solid #e2e8f0',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#e0e7ff',
                color: '#4338ca',
                fontFamily: 'monospace',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '12px',
              }}>
                {productCode}
              </span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Lịch sử thay đổi sản phẩm
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              {productName}
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
              <p style={{ margin: 0, fontSize: '13.5px' }}>Đang tải nhật ký thao tác...</p>
            </div>
          ) : error ? (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '13px',
            }}>
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
              <div style={{ fontSize: '32px', marginBottom: '10px' }}>📋</div>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#64748b' }}>
                Chưa có thao tác điều chỉnh nào được ghi lại cho sản phẩm này.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '14px',
                    background: '#ffffff',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: log.action_type === 'PRICE_CHANGE' ? '#fef3c7' : '#dbeafe',
                      color: log.action_type === 'PRICE_CHANGE' ? '#b45309' : '#1d4ed8',
                    }}>
                      {log.action_type === 'PRICE_CHANGE' ? 'Thay đổi giá' : 'Điều chỉnh kho'}
                    </span>
                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                      {formatLocalDateTime(log.created_at)}
                    </span>
                  </div>

                  {(() => {
                    const matchedUser = usersList.find(
                      (u) =>
                        u.id === log.user_id ||
                        u.username.toLowerCase() === (log.user_name || '').toLowerCase() ||
                        u.full_name === log.user_name
                    );
                    const userAvatar = matchedUser?.avatar_url;

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: userAvatar ? '#f1f5f9' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '700',
                            fontSize: '12px',
                            overflow: 'hidden',
                            border: '1.5px solid #e2e8f0',
                            flexShrink: 0,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          }}
                        >
                          {userAvatar ? (
                            <img
                              src={getAvatarUrl(userAvatar)}
                              alt={log.user_name || 'U'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            (log.user_name || 'H').charAt(0).toUpperCase()
                          )}
                        </div>
                        <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                          Người thực hiện: <strong style={{ color: '#0f172a' }}>{log.user_name || 'Hệ thống'}</strong>
                        </p>
                      </div>
                    );
                  })()}

                  {log.reason && (
                    <div style={{
                      fontSize: '12.5px',
                      color: '#475569',
                      background: '#f8fafc',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      marginBottom: '10px',
                      border: '1px dashed #cbd5e1',
                    }}>
                      💬 {log.reason}
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedDetailLog(log)}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#2563eb',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Xem chi tiết thay đổi →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal chi tiết Diff */}
      <AuditDetailModal log={selectedDetailLog} onClose={() => setSelectedDetailLog(null)} />
    </>
  );
};
