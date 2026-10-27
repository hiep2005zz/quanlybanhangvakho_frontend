import React, { useState, useEffect, useCallback } from 'react';
import {
  WarehouseThresholdItem,
  WarehouseInfo,
  getInventoryWarehousesApi,
  getLowStockAlertsApi,
} from '../services/api';
import { WarehouseSelectDropdown } from './WarehouseSelectDropdown';

interface LowStockAlertManagementViewProps {
  token: string;
  canManageThresholds?: boolean;
  canWriteInventory?: boolean;
  onOpenGoodsReceipt?: () => void;
  onOpenThresholdConfig?: () => void;
  onBackToHome?: () => void;
}

export const LowStockAlertManagementView: React.FC<LowStockAlertManagementViewProps> = ({
  token,
  onOpenThresholdConfig,
}) => {
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [items, setItems] = useState<WarehouseThresholdItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'OUT_OF_STOCK' | 'NEAR_DEPLETED'>('ALL');

  // Phân trang Backend & Frontend (20 mục / trang)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;
  const [totalPages, setTotalPages] = useState<number>(1);
  const [_totalAlerts, setTotalAlerts] = useState<number>(0);

  // Thống kê KPI tổng thể (nhận trực tiếp từ backend siêu tốc, không cần tải toàn bộ records)
  const [stats, setStats] = useState({
    uniqueProductsCount: 0,
    totalAlerts: 0,
    outOfStockCount: 0,
    nearDepletedCount: 0,
  });

  // 1. Debounce tìm kiếm 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 2. Tải danh sách kho
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const whs = await getInventoryWarehousesApi(token);
        setWarehouses(whs);
      } catch (err: any) {
        console.error('Không thể tải danh sách kho:', err);
      }
    };
    loadWarehouses();
  }, [token]);

  // 3. Tải dữ liệu cảnh báo phân trang siêu tốc từ Server-side SQL (chỉ tải đúng 20 dòng)
  const loadPaginatedAlerts = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);
    try {
      const summary = await getLowStockAlertsApi(
        token,
        currentPage,
        pageSize,
        selectedWarehouseId,
        debouncedSearch,
        severityFilter
      );
      setItems(summary.items || []);
      setTotalPages(summary.total_pages || 1);
      setTotalAlerts(summary.total_alerts || (summary.items || []).length);
      setStats({
        uniqueProductsCount: summary.total_low_stock || 0,
        totalAlerts: summary.total_alerts || 0,
        outOfStockCount: summary.out_of_stock_count || 0,
        nearDepletedCount: summary.near_depleted_count || 0,
      });
    } catch (err: any) {
      console.error('Lỗi tải danh sách cảnh báo tồn:', err);
      setError(err.message || 'Không thể tải danh sách cảnh báo tồn kho.');
    } finally {
      setLoading(false);
    }
  }, [token, currentPage, pageSize, selectedWarehouseId, debouncedSearch, severityFilter]);

  useEffect(() => {
    loadPaginatedAlerts(items.length === 0);
  }, [loadPaginatedAlerts]);

  // Reset trang về 1 khi thay đổi kho hoặc mức độ khẩn
  const handleWarehouseChange = (whId: string) => {
    setSelectedWarehouseId(whId);
    setCurrentPage(1);
  };

  const handleSeverityChange = (sev: 'ALL' | 'OUT_OF_STOCK' | 'NEAR_DEPLETED') => {
    setSeverityFilter(sev);
    setCurrentPage(1);
  };

  return (
    <div
      style={{
        padding: '16px 24px',
        backgroundColor: '#f8fafc',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* 1. Header Tiêu Đề */}
      <div style={{ marginBottom: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: '800',
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Cảnh Báo Tồn Kho Dưới Định Mức Tối Thiểu
            </h1>
          </div>

          {/* Nút thao tác trên header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {onOpenThresholdConfig && (
              <button
                type="button"
                onClick={onOpenThresholdConfig}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Cấu Hình Định Mức Tồn
              </button>
            )}

            <button
              type="button"
              onClick={() => loadPaginatedAlerts(true)}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                cursor: loading ? 'default' : 'pointer',
              }}
              title="Làm mới dữ liệu cảnh báo"
            >
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 Thẻ KPI Thống Kê Tổng Quan */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '14px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: '1px solid #fee2e2',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
            Mặt hàng dưới định mức
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#b91c1c' }}>
            {stats.uniqueProductsCount.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>mã SP</span>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: '1px solid #fed7aa',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
            Tổng số cảnh báo kho
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#ea580c' }}>
            {stats.totalAlerts.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>chi nhánh</span>
          </div>
        </div>

        <div
          style={{
            background: stats.outOfStockCount > 0 ? '#fef2f2' : '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: stats.outOfStockCount > 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: stats.outOfStockCount > 0 ? '#991b1b' : '#64748b', fontWeight: '600', marginBottom: '4px' }}>
            Đã hết hàng (0 tồn)
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: stats.outOfStockCount > 0 ? '#dc2626' : '#0f172a' }}>
            {stats.outOfStockCount.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: '500', color: stats.outOfStockCount > 0 ? '#dc2626' : '#64748b' }}>cảnh báo khẩn</span>
          </div>
        </div>

        <div
          style={{
            background: stats.nearDepletedCount > 0 ? '#fffbeb' : '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: stats.nearDepletedCount > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: stats.nearDepletedCount > 0 ? '#b45309' : '#64748b', fontWeight: '600', marginBottom: '4px' }}>
            Sắp đứt hàng
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: stats.nearDepletedCount > 0 ? '#d97706' : '#0f172a' }}>
            {stats.nearDepletedCount.toLocaleString('vi-VN')} <span style={{ fontSize: '13px', fontWeight: '500', color: stats.nearDepletedCount > 0 ? '#d97706' : '#64748b' }}>chi nhánh</span>
          </div>
        </div>
      </div>

      {/* 3. Thanh Bộ Lọc & Tìm Kiếm */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '12px 16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '12px',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
          {/* Ô tìm kiếm với icon kính lúp SVG giống hình 5 */}
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <span
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Tìm theo mã SKU hoặc tên sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 12px 7px 32px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Chọn Kho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>Kho:</span>
            <div style={{ minWidth: '190px' }}>
              <WarehouseSelectDropdown
                warehouses={warehouses}
                selectedId={selectedWarehouseId}
                onSelect={(whId) => handleWarehouseChange(whId)}
                allowAll={true}
                allLabel="Tất cả kho"
                allValue="ALL"
                compact={true}
                placeholder="Tất cả kho"
                id="low-stock-warehouse-select"
              />
            </div>
          </div>

          {/* Bộ lọc mức độ khẩn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>Mức độ:</span>
            <select
              value={severityFilter}
              onChange={(e) => handleSeverityChange(e.target.value as any)}
              style={{
                padding: '8px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                background: '#ffffff',
                color: '#1e293b',
                outline: 'none',
                fontWeight: '500',
              }}
            >
              <option value="ALL">Tất cả mức độ</option>
              <option value="OUT_OF_STOCK">Đã hết hàng (0 tồn)</option>
              <option value="NEAR_DEPLETED">Sắp đứt hàng (&gt; 0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Bảng Danh Sách Cảnh Báo Thiếu Hụt (Phân trang 20 dòng từ Server SQL) */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && items.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              Đang tải danh sách cảnh báo tồn kho...
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#15803d', marginBottom: '4px' }}>
                Tất cả các mặt hàng hiện đều đang ở mức tồn kho an toàn!
              </div>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Không có sản phẩm nào tại các chi nhánh kho bị dưới định mức tồn tối thiểu.
              </p>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: '2px solid #fed7aa',
                    color: '#9a3412',
                    fontSize: '12px',
                    background: '#fffbeb',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Kho</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Mã SKU</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Tên Sản Phẩm</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'right' }}>Tồn Thực Tế</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'right' }}>Định Mức Tối Thiểu</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'right' }}>Thiếu Hụt Cần Nhập</th>
                  <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap' }}>Mức Độ Khẩn</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const isSevere = it.actual_stock <= 0;
                  return (
                    <tr
                      key={`${it.warehouse_id}_${it.product_id}`}
                      style={{
                        borderBottom: '1px solid #fef2f2',
                        background: isSevere ? '#fff5f5' : '#ffffff',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#475569' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            display: 'inline-block',
                          }}
                        >
                          {it.warehouse_name}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: '700', color: '#b91c1c' }}>
                        {it.product_code}
                      </td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#1e293b' }}>
                        {it.product_name}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: isSevere ? '#dc2626' : '#ea580c' }}>
                        {it.actual_stock.toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{it.base_unit}</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>
                        {it.min_stock.toLocaleString()} {it.base_unit}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                        +{Math.max(1, it.shortage_quantity).toLocaleString()} {it.base_unit}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {isSevere ? (
                          <span
                            style={{
                              background: '#b91c1c',
                              color: '#ffffff',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: '750',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                              letterSpacing: '0.02em',
                            }}
                          >
                            ĐÃ HẾT HÀNG (0)
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#ffedd5',
                              color: '#c2410c',
                              border: '1px solid #fed7aa',
                              borderRadius: '4px',
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                          >
                            SẮP ĐỨT HÀNG
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Chân trang bảng: Khối phân trang liền thanh nhỏ nhắn chuẩn backend 20 dòng */}
        {!loading && items.length > 0 && (
          <div
            style={{
              padding: '8px 18px',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'stretch',
                border: '1px solid #d1d5db',
                borderRadius: '5px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                height: '24px',
              }}
            >
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                    acc.push('...');
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx, arr) => {
                  const isLastItem = idx === arr.length - 1;
                  if (typeof p === 'string') {
                    return (
                      <span
                        key={`ellipsis-${idx}`}
                        style={{
                          minWidth: '22px',
                          height: '100%',
                          padding: '0 4px',
                          borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                          background: '#ffffff',
                          color: '#6b7280',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          userSelect: 'none',
                        }}
                      >
                        ...
                      </span>
                    );
                  }

                  const isActive = p === currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      style={{
                        minWidth: '24px',
                        height: '100%',
                        padding: '0 7px',
                        border: 'none',
                        borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                        background: isActive ? '#2ba1f4' : '#ffffff',
                        color: isActive ? '#ffffff' : '#374151',
                        cursor: isActive ? 'default' : 'pointer',
                        fontSize: '11.5px',
                        fontWeight: isActive ? '700' : '500',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
