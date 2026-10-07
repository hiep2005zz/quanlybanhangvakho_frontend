import React, { useState, useEffect } from 'react';
import { AuditLogItem, getEntityAuditLogsApi, getAvatarUrl } from '../services/api';
import { AuditDetailModal } from './AuditDetailModal';
import { formatLocalDateTime } from '../utils/dateUtils';
import { ModalPortal } from './ModalPortal';

interface ProductAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  productCode: string;
  productName: string;
  token: string;
  initialFilter?: 'ALL' | 'PRICE_CHANGE' | 'INVENTORY_ADJUST';
  isCostVisible?: boolean;
}

export const ProductAuditDrawer: React.FC<ProductAuditDrawerProps> = ({
  isOpen,
  onClose,
  productCode,
  productName,
  token,
  initialFilter = 'ALL',
  isCostVisible = false,
}) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDetailLog, setSelectedDetailLog] = useState<AuditLogItem | null>(null);
  const [filterType, setFilterType] = useState<'ALL' | 'PRICE_CHANGE' | 'INVENTORY_ADJUST'>(initialFilter);

  useEffect(() => {
    if (isOpen) {
      setFilterType(initialFilter || 'ALL');
    }
  }, [isOpen, initialFilter]);

  useEffect(() => {
    if (isOpen && productCode) {
      setLoading(true);
      setError(null);
      getEntityAuditLogsApi(token, 'Product', productCode)
        .then((data) => {
          setLogs(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Lỗi tải lịch sử thao tác sản phẩm.');
          setLoading(false);
        });
    }
  }, [isOpen, productCode, token]);

  if (!isOpen) return null;

  const parseJSON = (str?: string | null): any => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  const priceLogsCount = logs.filter((l) => l.action_type === 'PRICE_CHANGE').length;
  const inventoryLogsCount = logs.filter((l) => l.action_type === 'INVENTORY_ADJUST').length;

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'ALL') return true;
    return log.action_type === filterType;
  });

  return (
    <ModalPortal>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 99998,
        }}
      />

      {/* Drawer Container (Right side) */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '540px',
        maxWidth: '94vw',
        background: '#ffffff',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.2)',
        borderLeft: '1px solid #e2e8f0',
        animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
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
                fontSize: '14px',
              }}
              title="Đóng"
            >
              ✕
            </button>
          </div>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: filterType === 'ALL' ? '1px solid #0fad89' : '1px solid #e2e8f0',
                background: filterType === 'ALL' ? '#ecfdf5' : '#ffffff',
                color: filterType === 'ALL' ? '#065f46' : '#64748b',
                fontWeight: filterType === 'ALL' ? '600' : '500',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Tất cả ({logs.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('PRICE_CHANGE')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: filterType === 'PRICE_CHANGE' ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                background: filterType === 'PRICE_CHANGE' ? '#fef3c7' : '#ffffff',
                color: filterType === 'PRICE_CHANGE' ? '#b45309' : '#64748b',
                fontWeight: filterType === 'PRICE_CHANGE' ? '600' : '500',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>Thay đổi giá</span>
              <span style={{
                background: filterType === 'PRICE_CHANGE' ? '#fde68a' : '#f1f5f9',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '11px',
              }}>
                {priceLogsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('INVENTORY_ADJUST')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: filterType === 'INVENTORY_ADJUST' ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                background: filterType === 'INVENTORY_ADJUST' ? '#dbeafe' : '#ffffff',
                color: filterType === 'INVENTORY_ADJUST' ? '#1e40af' : '#64748b',
                fontWeight: filterType === 'INVENTORY_ADJUST' ? '600' : '500',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>Điều chỉnh kho</span>
              <span style={{
                background: filterType === 'INVENTORY_ADJUST' ? '#bfdbfe' : '#f1f5f9',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '11px',
              }}>
                {inventoryLogsCount}
              </span>
            </button>
          </div>
        </div>

        {/* Content list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
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
          ) : filteredLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: '500', color: '#64748b' }}>
                {filterType === 'PRICE_CHANGE'
                  ? 'Chưa có lịch sử thay đổi giá nào cho sản phẩm này.'
                  : filterType === 'INVENTORY_ADJUST'
                  ? 'Chưa có lịch sử điều chỉnh kho nào cho sản phẩm này.'
                  : 'Chưa có thao tác điều chỉnh nào được ghi lại cho sản phẩm này.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredLogs.map((log) => {
                const oldObj = parseJSON(log.old_values);
                const newObj = parseJSON(log.new_values);

                const isPriceChange = log.action_type === 'PRICE_CHANGE';
                const hasSellPrice = newObj?.sell_price !== undefined || oldObj?.sell_price !== undefined;
                const oldSellPrice = oldObj?.sell_price;
                const newSellPrice = newObj?.sell_price;
                const diffSellPrice = (typeof newSellPrice === 'number' && typeof oldSellPrice === 'number')
                  ? newSellPrice - oldSellPrice
                  : null;
                const diffSellPercent = (diffSellPrice !== null && oldSellPrice > 0)
                  ? Math.round((diffSellPrice / oldSellPrice) * 1000) / 10
                  : null;

                const hasCostPrice = isCostVisible && (newObj?.cost_price !== undefined || oldObj?.cost_price !== undefined);
                const oldCostPrice = oldObj?.cost_price;
                const newCostPrice = newObj?.cost_price;
                const diffCostPrice = (typeof newCostPrice === 'number' && typeof oldCostPrice === 'number')
                  ? newCostPrice - oldCostPrice
                  : null;

                const isInventoryAdjust = log.action_type === 'INVENTORY_ADJUST';
                const oldStock = oldObj?.stock;
                const newStock = newObj?.stock;
                const diffStock = (typeof newStock === 'number' && typeof oldStock === 'number')
                  ? newStock - oldStock
                  : null;

                return (
                  <div
                    key={log.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      background: '#ffffff',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {/* Header dòng log: Loại thao tác & Thời điểm áp dụng */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: isPriceChange ? '#fef3c7' : isInventoryAdjust ? '#dbeafe' : '#f1f5f9',
                        color: isPriceChange ? '#b45309' : isInventoryAdjust ? '#1d4ed8' : '#475569',
                      }}>
                        {isPriceChange ? 'Thay đổi giá' : isInventoryAdjust ? 'Điều chỉnh kho' : log.action_type}
                      </span>

                      {/* Thời điểm áp dụng */}
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Thời điểm: {formatLocalDateTime(log.created_at)}
                      </span>
                    </div>

                    {/* Khối hiển thị chi tiết GIÁ CŨ & GIÁ MỚI */}
                    {isPriceChange && hasSellPrice && (
                      <div style={{
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        marginBottom: '10px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                            Giá bán niêm yết
                          </span>
                          {diffSellPrice !== null && diffSellPrice !== 0 && (
                            <span style={{
                              fontSize: '11.5px',
                              fontWeight: '700',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              background: diffSellPrice > 0 ? '#dcfce7' : '#fee2e2',
                              color: diffSellPrice > 0 ? '#15803d' : '#b91c1c',
                            }}>
                              {diffSellPrice > 0 ? `+${diffSellPrice.toLocaleString('vi-VN')} đ` : `${diffSellPrice.toLocaleString('vi-VN')} đ`}
                              {diffSellPercent !== null ? ` (${diffSellPercent > 0 ? `+${diffSellPercent}%` : `${diffSellPercent}%`})` : ''}
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10.5px', color: '#78716c' }}>Giá cũ</span>
                            <span style={{
                              color: '#78716c',
                              textDecoration: 'line-through',
                              fontWeight: '600',
                              fontSize: '13.5px',
                            }}>
                              {oldSellPrice !== undefined ? `${Number(oldSellPrice).toLocaleString('vi-VN')} đ` : '—'}
                            </span>
                          </div>

                          <span style={{ color: '#b45309', fontWeight: '700', fontSize: '14px', margin: '8px 2px 0' }}>➔</span>

                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '10.5px', color: '#b45309', fontWeight: '600' }}>Giá mới áp dụng</span>
                            <span style={{
                              color: '#0f172a',
                              fontWeight: '700',
                              fontSize: '15px',
                            }}>
                              {newSellPrice !== undefined ? `${Number(newSellPrice).toLocaleString('vi-VN')} đ` : '—'}
                            </span>
                          </div>
                        </div>

                        {/* Giá vốn (chỉ hiển thị nếu người dùng có quyền COST_READ) */}
                        {hasCostPrice && (
                          <div style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px dashed #fde68a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <div>
                              <span style={{ fontSize: '11px', color: '#92400e', fontWeight: '600' }}>Giá vốn: </span>
                              <span style={{ color: '#78716c', textDecoration: 'line-through', fontSize: '12px' }}>
                                {oldCostPrice !== undefined ? `${Number(oldCostPrice).toLocaleString('vi-VN')} đ` : '—'}
                              </span>
                              <span style={{ color: '#b45309', margin: '0 4px', fontSize: '12px' }}>➔</span>
                              <span style={{ color: '#0f172a', fontWeight: '700', fontSize: '12px' }}>
                                {newCostPrice !== undefined ? `${Number(newCostPrice).toLocaleString('vi-VN')} đ` : '—'}
                              </span>
                            </div>
                            {diffCostPrice !== null && diffCostPrice !== 0 && (
                              <span style={{ fontSize: '11px', color: diffCostPrice > 0 ? '#b45309' : '#15803d', fontWeight: '600' }}>
                                {diffCostPrice > 0 ? `+${diffCostPrice.toLocaleString('vi-VN')} đ` : `${diffCostPrice.toLocaleString('vi-VN')} đ`}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Khối hiển thị chi tiết TỒN KHO CŨ & TỒN KHO MỚI */}
                    {isInventoryAdjust && (newStock !== undefined || oldStock !== undefined) && (
                      <div style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        marginBottom: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: '600' }}>Số lượng tồn:</span>
                          <span style={{ color: '#64748b', textDecoration: 'line-through', fontSize: '13px' }}>
                            {oldStock ?? '—'}
                          </span>
                          <span style={{ color: '#2563eb', fontWeight: '700' }}>➔</span>
                          <span style={{ color: '#0f172a', fontWeight: '700', fontSize: '13.5px' }}>
                            {newStock ?? '—'}
                          </span>
                        </div>
                        {diffStock !== null && diffStock !== 0 && (
                          <span style={{
                            fontSize: '11.5px',
                            fontWeight: '700',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: diffStock > 0 ? '#dcfce7' : '#fee2e2',
                            color: diffStock > 0 ? '#15803d' : '#b91c1c',
                          }}>
                            {diffStock > 0 ? `+${diffStock}` : `${diffStock}`}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Người sửa có Avatar */}
                    <div style={{ margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', color: '#64748b' }}>Người sửa:</span>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          background: log.user_avatar ? '#f1f5f9' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '11px',
                          overflow: 'hidden',
                          border: '1.5px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          flexShrink: 0,
                        }}>
                          {log.user_avatar ? (
                            <img
                              src={getAvatarUrl(log.user_avatar)}
                              alt={log.user_name || 'U'}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            (log.user_name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <strong style={{ color: '#0f172a', fontSize: '13px' }}>
                          {log.user_name || 'Hệ thống'}
                        </strong>
                      </div>
                    </div>

                    {/* Lý do điều chỉnh */}
                    {/* Hàng chứa Lý do và Nút Xem chi tiết */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: log.reason ? 'space-between' : 'flex-end', gap: '8px', marginTop: '6px' }}>
                      {log.reason ? (
                        <div style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: '12px',
                          color: '#475569',
                          background: '#f8fafc',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: '1px dashed #cbd5e1',
                        }}>
                          <strong style={{ color: '#334155' }}>Lý do:</strong> {log.reason}
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setSelectedDetailLog(log)}
                        style={{
                          flexShrink: 0,
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          padding: '7px 11px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: '600',
                          color: '#2563eb',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#eff6ff';
                          e.currentTarget.style.borderColor = '#93c5fd';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f1f5f9';
                          e.currentTarget.style.borderColor = '#cbd5e1';
                        }}
                      >
                        Xem chi tiết →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal chi tiết Diff */}
      <AuditDetailModal log={selectedDetailLog} onClose={() => setSelectedDetailLog(null)} />
    </ModalPortal>
  );
};
