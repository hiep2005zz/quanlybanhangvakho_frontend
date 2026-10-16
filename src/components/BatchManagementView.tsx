import React, { useState, useEffect, useCallback } from 'react';
import {
  BatchItem,
  BatchListResponse,
  getBatchesApi,
  toggleProductBatchTrackingApi,
  createStockIssueApi,
  ProductItem,
  getProductsApi,
  formatErrorMessage,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';
import { BatchCreateView } from './BatchCreateView';
import { ProductSelectDropdown } from './ProductSelectDropdown';

interface BatchManagementViewProps {
  token: string;
  user?: { role?: string; roles?: string[]; full_name?: string; username?: string };
  canWriteInventory?: boolean;
  onStockUpdated?: () => void;
}

export const BatchManagementView: React.FC<BatchManagementViewProps> = ({
  token,
  user,
  canWriteInventory = true,
  onStockUpdated,
}) => {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc & Cảnh báo
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [warningDays, setWarningDays] = useState<number>(30);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRED' | 'NEAR_EXPIRY' | 'SAFE'>('ALL');
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    expired_count: 0,
    near_expiry_count: 0,
    safe_count: 0,
  });

  // Danh sách sản phẩm phục vụ chọn SKU
  const [products, setProducts] = useState<ProductItem[]>([]);

  // Chế độ hiển thị: Danh sách hoặc Trang khởi tạo lô độc lập
  const [viewMode, setViewMode] = useState<'list' | 'create'>(() => {
    return typeof window !== 'undefined' && window.location.pathname.startsWith('/batches/create')
      ? 'create'
      : 'list';
  });

  // Đồng bộ nút Back/Forward của trình duyệt
  useEffect(() => {
    const handlePopState = () => {
      if (window.location.pathname.startsWith('/batches/create')) {
        setViewMode('create');
      } else {
        setViewMode('list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenCreatePage = () => {
    window.history.pushState({}, '', '/batches/create');
    setViewMode('create');
  };

  const handleBackToList = () => {
    window.history.pushState({}, '', '/batches');
    setViewMode('list');
  };

  const handleCreateSuccess = () => {
    window.history.pushState({}, '', '/batches');
    setViewMode('list');
    fetchBatches();
  };

  // Modals state
  const [isToggleModalOpen, setIsToggleModalOpen] = useState(false);
  const [issueBatchTarget, setIssueBatchTarget] = useState<BatchItem | null>(null);

  // Kiểm tra quyền Quản lý kho (Warehouse Manager hoặc Admin)
  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const isManager = userRoles.includes('admin') || userRoles.includes('warehouse_manager');

  // Phân trang
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Khi thay đổi điều kiện tìm kiếm/lọc -> Reset về trang 1
  useEffect(() => {
    setPage(1);
  }, [searchTerm, warningDays, statusFilter]);

  // 1. Tải danh sách lô hàng kèm cảnh báo (hỗ trợ phân trang)
  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: BatchListResponse = await getBatchesApi(token, {
        warning_days: warningDays,
        search: searchTerm.trim() || undefined,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        page_size: pageSize,
      });
      setBatches(res.items || []);
      setTotalCount(res.total);
      setTotalPages(res.total_pages || Math.ceil(res.total / pageSize) || 1);
      setSummaryStats({
        total: res.total,
        expired_count: res.expired_count,
        near_expiry_count: res.near_expiry_count,
        safe_count: res.safe_count,
      });
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách lô hàng.');
    } finally {
      setLoading(false);
    }
  }, [token, warningDays, searchTerm, statusFilter, page, pageSize]);

  // Tạo danh sách số trang hiển thị
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);
    if (page > 3) {
      pages.push('...');
    }
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) {
      pages.push('...');
    }
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    return pages;
  };

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // 2. Tải danh sách sản phẩm
  useEffect(() => {
    getProductsApi(token, { page: 1, page_size: 100 })
      .then((res) => {
        setProducts(res.items || []);
      })
      .catch(() => {});
  }, [token]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (viewMode === 'create') {
    return (
      <BatchCreateView
        token={token}
        products={products}
        onBack={handleBackToList}
        onSuccess={handleCreateSuccess}
      />
    );
  }

  return (
    <div style={{ padding: '24px', background: '#f8fafc', minHeight: '100%', height: '100%', overflowY: 'auto', color: '#0f172a' }}>
      {/* Tiêu đề & Nút hành động */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#0f172a', margin: '0 0 6px 0' }}>
            Theo Dõi Lô & Hạn Sử Dụng Hàng Hóa (WMS)
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
            Quản lý chặt chẽ 4 thuộc tính cốt lõi (Số lô, NSX, HSD, Số lượng còn lại), cảnh báo hạn dùng theo ngưỡng và chặn xuất lô quá hạn cho đại lý.
          </p>
        </div>

        {canWriteInventory && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setIsToggleModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 15px',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              Cấu hình SKU quản lý lô
            </button>
            <button
              onClick={handleOpenCreatePage}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                background: '#0fad89',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(15,173,137,0.25)',
              }}
            >
              + Khởi tạo lô mới
            </button>
          </div>
        )}
      </div>

      {/* Thống kê cảnh báo hạn dùng (Gọn gàng & Tinh tế) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          onClick={() => setStatusFilter('ALL')}
          style={{
            background: statusFilter === 'ALL' ? '#f8fafc' : '#ffffff',
            borderRadius: '8px',
            padding: '12px 16px',
            border: statusFilter === 'ALL' ? '1.5px solid #0fad89' : '1px solid #e2e8f0',
            boxShadow: statusFilter === 'ALL' ? '0 1px 3px rgba(15, 173, 137, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              TỔNG SỐ LÔ HÀNG
            </span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94a3b8' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px', lineHeight: 1.2 }}>
            {summaryStats.total.toLocaleString()}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('EXPIRED')}
          style={{
            background: statusFilter === 'EXPIRED' ? '#fff5f5' : '#ffffff',
            borderRadius: '8px',
            padding: '12px 16px',
            border: statusFilter === 'EXPIRED' ? '1.5px solid #ef4444' : '1px solid #fee2e2',
            boxShadow: statusFilter === 'EXPIRED' ? '0 1px 3px rgba(239, 68, 68, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              QUÁ HẠN (CHẶN XUẤT)
            </span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626', marginTop: '4px', lineHeight: 1.2 }}>
            {summaryStats.expired_count.toLocaleString()}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('NEAR_EXPIRY')}
          style={{
            background: statusFilter === 'NEAR_EXPIRY' ? '#fffdf5' : '#ffffff',
            borderRadius: '8px',
            padding: '12px 16px',
            border: statusFilter === 'NEAR_EXPIRY' ? '1.5px solid #f59e0b' : '1px solid #fef3c7',
            boxShadow: statusFilter === 'NEAR_EXPIRY' ? '0 1px 3px rgba(245, 158, 11, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              SẮP HẾT HẠN (≤ {warningDays} NGÀY)
            </span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#d97706', marginTop: '4px', lineHeight: 1.2 }}>
            {summaryStats.near_expiry_count.toLocaleString()}
          </div>
        </div>

        <div
          onClick={() => setStatusFilter('SAFE')}
          style={{
            background: statusFilter === 'SAFE' ? '#f0fdf4' : '#ffffff',
            borderRadius: '8px',
            padding: '12px 16px',
            border: statusFilter === 'SAFE' ? '1.5px solid #10b981' : '1px solid #d1fae5',
            boxShadow: statusFilter === 'SAFE' ? '0 1px 3px rgba(16, 185, 129, 0.12)' : '0 1px 2px rgba(0,0,0,0.02)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              CÒN HẠN AN TOÀN
            </span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669', marginTop: '4px', lineHeight: 1.2 }}>
            {summaryStats.safe_count.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Thanh công cụ tìm kiếm & Cấu hình ngưỡng cảnh báo */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          padding: '12px 16px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          {/* Ô tìm kiếm */}
          <div style={{ minWidth: '240px', flex: '1 1 280px' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo số lô, mã SKU, tên hàng hóa..."
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                color: '#0f172a',
                background: '#ffffff',
              }}
            />
          </div>

          {/* Cấu hình ngưỡng cảnh báo (Tiêu chí 3) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
              Ngưỡng cận hạn:
            </span>
            <select
              value={warningDays}
              onChange={(e) => setWarningDays(Number(e.target.value))}
              style={{
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                background: '#ffffff',
                color: '#0f172a',
                outline: 'none',
                fontWeight: '600',
              }}
            >
              <option value={15}>15 ngày</option>
              <option value={30}>30 ngày (Tiêu chuẩn)</option>
              <option value={45}>45 ngày</option>
              <option value={60}>60 ngày</option>
              <option value={90}>90 ngày</option>
              <option value={180}>180 ngày</option>
            </select>
          </div>
        </div>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          {(['ALL', 'EXPIRED', 'NEAR_EXPIRY', 'SAFE'] as const).map((st) => {
            const labels = {
              ALL: 'Tất cả',
              EXPIRED: 'Quá hạn',
              NEAR_EXPIRY: 'Cận hạn',
              SAFE: 'Còn hạn',
            };
            const active = statusFilter === st;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: active ? '700' : '500',
                  background: active ? '#ffffff' : 'transparent',
                  color: active ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {labels[st]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Bảng dữ liệu Lô hàng */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>MÃ & TÊN SẢN PHẨM</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>SỐ LÔ (BATCH NO.)</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>KHO LƯU TRỮ</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>NGÀY SẢN XUẤT</th>
                <th style={{ padding: '12px 16px', fontWeight: '600' }}>HẠN SỬ DỤNG</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'right' }}>SỐ LƯỢNG CÒN LẠI</th>
                <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>TRẠNG THÁI</th>
                {canWriteInventory && (
                  <th style={{ padding: '12px 16px', fontWeight: '600', textAlign: 'center' }}>THAO TÁC</th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    Đang tải dữ liệu lô hàng...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Không tìm thấy lô hàng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                batches.map((b) => {
                  const isExpired = b.expiry_status === 'EXPIRED';
                  const isNear = b.expiry_status === 'NEAR_EXPIRY';

                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isExpired ? '#fff5f5' : isNear ? '#fffdf5' : '#ffffff',
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{b.product_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{b.product_code}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: '700',
                            color: '#1e293b',
                            background: '#f1f5f9',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '13px',
                          }}
                        >
                          {b.batch_number}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {b.warehouse_name || 'Kho Tổng'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {formatDate(b.manufacturing_date)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: '600', color: isExpired ? '#dc2626' : isNear ? '#d97706' : '#0f172a' }}>
                          {formatDate(b.expiry_date)}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <strong style={{ fontSize: '14px', color: '#0f172a' }}>
                          {b.remaining_quantity.toLocaleString()}
                        </strong>{' '}
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{b.base_unit}</span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        {isExpired ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                            }}
                          >
                            Quá hạn {b.days_until_expiry ? `(${Math.abs(b.days_until_expiry)} ngày)` : ''}
                          </span>
                        ) : isNear ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              background: '#fffbeb',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                            }}
                          >
                            Còn {b.days_until_expiry} ngày
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              background: '#f0fdf4',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            Còn hạn ({b.days_until_expiry} ngày)
                          </span>
                        )}
                      </td>
                      {canWriteInventory && (
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <button
                            onClick={() => setIssueBatchTarget(b)}
                            disabled={b.remaining_quantity <= 0}
                            style={{
                              padding: '6px 13px',
                              borderRadius: '6px',
                              border: b.remaining_quantity <= 0 ? '1px solid #e2e8f0' : (isExpired ? '1px solid #b91c1c' : '1px solid #c2410c'),
                              fontSize: '12.5px',
                              fontWeight: '600',
                              background: b.remaining_quantity <= 0 ? '#f1f5f9' : (isExpired ? '#dc2626' : '#ea580c'),
                              color: b.remaining_quantity <= 0 ? '#94a3b8' : '#ffffff',
                              cursor: b.remaining_quantity <= 0 ? 'not-allowed' : 'pointer',
                              boxShadow: b.remaining_quantity <= 0 ? 'none' : (isExpired ? '0 1px 3px rgba(220, 38, 38, 0.25)' : '0 1px 3px rgba(234, 88, 12, 0.25)'),
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            onMouseEnter={(e) => {
                              if (b.remaining_quantity > 0) {
                                e.currentTarget.style.background = isExpired ? '#b91c1c' : '#c2410c';
                                e.currentTarget.style.boxShadow = isExpired ? '0 2px 5px rgba(185, 28, 28, 0.35)' : '0 2px 5px rgba(194, 65, 12, 0.35)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (b.remaining_quantity > 0) {
                                e.currentTarget.style.background = isExpired ? '#dc2626' : '#ea580c';
                                e.currentTarget.style.boxShadow = isExpired ? '0 1px 3px rgba(220, 38, 38, 0.25)' : '0 1px 3px rgba(234, 88, 12, 0.25)';
                              }
                            }}
                          >
                            {b.remaining_quantity <= 0 ? 'Hết hàng' : (isExpired ? 'Ghi đè' : 'Xuất kho lô')}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh điều khiển phân trang */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Thông tin số lượng hiển thị */}
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {totalCount === 0 ? (
              'Không có dữ liệu lô hàng'
            ) : (
              <>
                Hiển thị{' '}
                <strong style={{ color: '#0f172a' }}>{(page - 1) * pageSize + 1}</strong> -{' '}
                <strong style={{ color: '#0f172a' }}>{Math.min(page * pageSize, totalCount)}</strong> trong tổng số{' '}
                <strong style={{ color: '#0f172a' }}>{totalCount}</strong> lô hàng
              </>
            )}
          </div>

          {/* Điều khiển phân trang & Số lượng trên mỗi trang */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12.5px', color: '#64748b' }}>Mỗi trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '12.5px',
                  color: '#334155',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={10}>10 lô</option>
                <option value={20}>20 lô</option>
                <option value={50}>50 lô</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: page <= 1 ? '#f1f5f9' : '#ffffff',
                  color: page <= 1 ? '#94a3b8' : '#334155',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Trước</span>
              </button>

              {getPageNumbers().map((pNum, idx) => {
                if (pNum === '...') {
                  return (
                    <span key={`ellipsis-${idx}`} style={{ padding: '0 6px', color: '#94a3b8', fontSize: '13px' }}>
                      ...
                    </span>
                  );
                }
                const isActive = pNum === page;
                return (
                  <button
                    key={pNum}
                    type="button"
                    onClick={() => setPage(Number(pNum))}
                    disabled={loading}
                    style={{
                      minWidth: '32px',
                      height: '32px',
                      padding: '0 6px',
                      borderRadius: '6px',
                      border: isActive ? '1px solid #0fad89' : '1px solid #cbd5e1',
                      background: isActive ? '#0fad89' : '#ffffff',
                      color: isActive ? '#ffffff' : '#334155',
                      fontSize: '12.5px',
                      fontWeight: isActive ? '700' : '500',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: page >= totalPages ? '#f1f5f9' : '#ffffff',
                  color: page >= totalPages ? '#94a3b8' : '#334155',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span>Sau</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 2: Bật / Tắt quản lý lô theo từng SKU (Tiêu chí 1) */}
      {isToggleModalOpen && (
        <ToggleBatchTrackingModal
          isOpen={isToggleModalOpen}
          token={token}
          products={products}
          onClose={() => setIsToggleModalOpen(false)}
          onSuccess={() => {
            setIsToggleModalOpen(false);
            fetchBatches();
            // Cập nhật lại products list
            getProductsApi(token, { page: 1, page_size: 100 }).then((res) => setProducts(res.items || []));
          }}
        />
      )}

      {/* Modal 3: Xuất kho chỉ định lô & Chặn quá hạn / Ghi đè Quản lý kho (Tiêu chí 4) */}
      {issueBatchTarget && (
        <IssueBatchModal
          isOpen={Boolean(issueBatchTarget)}
          batch={issueBatchTarget}
          token={token}
          isManager={isManager}
          onClose={() => setIssueBatchTarget(null)}
          onSuccess={() => {
            setIssueBatchTarget(null);
            fetchBatches();
            onStockUpdated?.();
          }}
        />
      )}
    </div>
  );
};

// ===================================================================
// SUB-MODAL 2: Bật / Tắt quản lý lô theo từng SKU (Tiêu chí 1)
// ===================================================================
interface ToggleBatchTrackingModalProps {
  isOpen: boolean;
  token: string;
  products: ProductItem[];
  onClose: () => void;
  onSuccess: () => void;
}

const ToggleBatchTrackingModal: React.FC<ToggleBatchTrackingModalProps> = ({
  isOpen,
  token,
  products,
  onClose,
  onSuccess,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<number>(products[0]?.id || 0);
  const [currentProd, setCurrentProd] = useState<ProductItem | null>(products[0] || null);
  const [isManaged, setIsManaged] = useState<boolean>(products[0]?.is_batch_managed || false);
  const [initialBatch, setInitialBatch] = useState('');
  const [initialMfg, setInitialMfg] = useState('');
  const [initialExp, setInitialExp] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
      setCurrentProd(products[0]);
      setIsManaged(Boolean(products[0].is_batch_managed));
    }
  }, [products, selectedProductId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedProductId) {
      setErrorMsg('Vui lòng chọn sản phẩm.');
      return;
    }

    // Nếu bật quản lý lô và sản phẩm đang có tồn kho > 0
    if (isManaged && (currentProd?.stock || 0) > 0) {
      if (!initialBatch.trim()) {
        setErrorMsg('Sản phẩm đang có tồn kho hiện hữu. Bắt buộc cung cấp Số lô khởi tạo.');
        return;
      }
      if (!initialExp) {
        setErrorMsg('Bắt buộc cung cấp Hạn sử dụng cho lô khởi tạo.');
        return;
      }
      if (initialMfg && initialExp <= initialMfg) {
        setErrorMsg('Hạn sử dụng khởi tạo bắt buộc phải sau Ngày sản xuất.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await toggleProductBatchTrackingApi(token, selectedProductId, {
        is_batch_managed: isManaged,
        initial_batch_number: initialBatch.trim() ? initialBatch.trim().toUpperCase() : undefined,
        initial_manufacturing_date: initialMfg ? new Date(initialMfg).toISOString() : undefined,
        initial_expiry_date: initialExp ? new Date(initialExp).toISOString() : undefined,
        reason: reason.trim() || undefined,
      });

      emitStatusToast({
        title: 'Cập nhật thành công',
        message: res.message,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(formatErrorMessage(err?.message || err, 'Lỗi cập nhật cấu hình theo dõi lô.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '540px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            padding: '20px 24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            color: '#0f172a',
            boxSizing: 'border-box',
            position: 'relative',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                  Cấu hình theo dõi lô theo SKU
                </h2>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  Bật/tắt chế độ quản lý số lô & hạn sử dụng
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            >
              ✕
            </button>
          </div>

          {errorMsg && (
            <div style={{ padding: '9px 13px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '12.5px', marginBottom: '14px', flexShrink: 0 }}>
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              overflow: 'visible',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                marginBottom: '18px',
              }}
            >
              {/* Chọn sản phẩm / SKU */}
              <div style={{ position: 'relative', zIndex: 40 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '5px' }}>
                  Chọn sản phẩm / SKU <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <ProductSelectDropdown
                  token={token}
                  selectedProductId={selectedProductId}
                  onSelectProduct={(p) => {
                    setSelectedProductId(p.id);
                    setCurrentProd(p);
                    setIsManaged(Boolean(p.is_batch_managed));
                  }}
                  placeholder="Chọn sản phẩm / SKU cần cấu hình..."
                  dropdownMaxHeight="220px"
                />
              </div>

              {/* Toggle Switch Card */}
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: isManaged ? '#eff6ff' : '#f8fafc',
                  border: isManaged ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                      Quản lý theo lô:
                    </span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: isManaged ? '#dcfce7' : '#f1f5f9',
                        color: isManaged ? '#15803d' : '#64748b',
                        border: isManaged ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      }}
                    >
                      {isManaged ? 'ĐANG BẬT' : 'ĐANG TẮT'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px', lineHeight: '1.4' }}>
                    {isManaged
                      ? 'Bắt buộc truy vết chính xác số lô & HSD khi nhập và xuất kho.'
                      : 'Nhập/xuất theo tổng tồn kho bình thường, không yêu cầu lô.'}
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={isManaged}
                  onChange={(e) => setIsManaged(e.target.checked)}
                  style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#2563eb', flexShrink: 0 }}
                />
              </div>

              {/* Khối điều kiện biên: Bắt buộc lô khởi tạo nếu bật và có tồn kho hiện hữu */}
              {isManaged && (currentProd?.stock || 0) > 0 && (
                <div
                  style={{
                    padding: '11px 13px',
                    borderRadius: '10px',
                    background: '#fefce8',
                    border: '1px solid #fef08a',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      fontSize: '12px',
                      color: '#854d0e',
                      lineHeight: '1.4',
                      marginBottom: '8px',
                    }}
                  >
                    <span style={{ fontSize: '13px', flexShrink: 0 }}>⚠️</span>
                    <span>
                      Tồn hiện tại: <strong>{currentProd?.stock} {currentProd?.base_unit || 'Cái'}</strong>. Vui lòng nhập số lô & HSD ban đầu để đồng bộ:
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#713f12', marginBottom: '3px' }}>
                        Số lô khởi tạo <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={initialBatch}
                        onChange={(e) => setInitialBatch(e.target.value)}
                        placeholder="VD: LOT-INIT-2026"
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: '6px',
                          border: '1px solid #fde047',
                          background: '#ffffff',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#713f12', marginBottom: '3px' }}>
                        Ngày sản xuất
                      </label>
                      <input
                        type="date"
                        value={initialMfg}
                        onChange={(e) => setInitialMfg(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#713f12', marginBottom: '3px' }}>
                        Hạn sử dụng <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <input
                        type="date"
                        required
                        value={initialExp}
                        onChange={(e) => setInitialExp(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: '12px',
                          boxSizing: 'border-box',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Lý do chuyển đổi */}
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                  Lý do chuyển đổi trạng thái
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Thay đổi chính sách theo dõi hạn dùng dược phẩm..."
                  style={{
                    width: '100%',
                    padding: '8px 11px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '14px',
                borderTop: '1px solid #f1f5f9',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => !submitting && (e.currentTarget.style.background = '#1d4ed8')}
                onMouseLeave={(e) => !submitting && (e.currentTarget.style.background = '#2563eb')}
              >
                {submitting ? 'Đang cập nhật...' : 'Lưu cấu hình'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

// ===================================================================
// SUB-MODAL 3: Xuất kho chỉ định Lô & Chặn quá hạn / Ghi đè (Tiêu chí 4)
// ===================================================================
interface IssueBatchModalProps {
  isOpen: boolean;
  batch: BatchItem;
  token: string;
  isManager: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const IssueBatchModal: React.FC<IssueBatchModalProps> = ({
  isOpen,
  batch,
  token,
  isManager,
  onClose,
  onSuccess,
}) => {
  const [quantity, setQuantity] = useState<number | string>(batch.remaining_quantity > 0 ? 1 : '');
  const [destination, setDestination] = useState('');
  const [note, setNote] = useState('');
  const [overrideExpired, setOverrideExpired] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isExpired = batch.expiry_status === 'EXPIRED';
  const numQty = Number(quantity);
  const isZeroOrNegative = quantity === '' || isNaN(numQty) || numQty <= 0;
  const isExceedingStock = numQty > batch.remaining_quantity;
  const isDestinationMissing = !destination.trim();
  const isExpiredBlocked = isExpired && !overrideExpired;
  const isOverrideMissingReason = isExpired && overrideExpired && isManager && (!overrideReason.trim() || overrideReason.trim().length < 5);

  const isInvalidForm = isZeroOrNegative || isExceedingStock || isDestinationMissing || isExpiredBlocked || isOverrideMissingReason;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isZeroOrNegative) {
      setErrorMsg('Số lượng xuất kho phải lớn hơn 0 (tối thiểu 1 đơn vị).');
      return;
    }
    if (isExceedingStock) {
      setErrorMsg(`Lô ${batch.batch_number} chỉ còn ${batch.remaining_quantity} ${bUnit}, không đủ để xuất.`);
      return;
    }
    if (isDestinationMissing) {
      setErrorMsg('Vui lòng nhập nơi nhận / khách hàng.');
      return;
    }

    // Tiêu chí 4: Kiểm tra lô quá hạn
    if (isExpired) {
      if (!overrideExpired) {
        setErrorMsg('Lô hàng đã quá hạn sử dụng! Hệ thống chặn xuất lô quá hạn để tránh giao nhầm cho đại lý.');
        return;
      }
      if (!isManager) {
        setErrorMsg('Chỉ Quản lý kho (Warehouse Manager) hoặc Quản trị viên mới có quyền xác nhận ghi đè.');
        return;
      }
      if (!overrideReason.trim() || overrideReason.trim().length < 5) {
        setErrorMsg('Vui lòng nhập lý do Quản lý kho xác nhận ghi đè xuất lô quá hạn (tối thiểu 5 ký tự).');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await createStockIssueApi(token, {
        product_id: batch.product_id,
        quantity: Math.round(numQty),
        destination: destination.trim(),
        note: note.trim() || undefined,
        batch_number: batch.batch_number,
        override_expired: overrideExpired,
        override_reason: overrideReason.trim() || undefined,
      });

      emitStatusToast({
        title: 'Xuất kho thành công',
        message: res.message,
      });
      try {
        sessionStorage.setItem('last_product_history_code', batch.product_code);
        window.dispatchEvent(new CustomEvent('INVENTORY_STOCK_UPDATED'));
      } catch { }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(formatErrorMessage(err?.message || err, 'Lỗi xuất kho theo lô.'));
    } finally {
      setSubmitting(false);
    }
  };

  const bUnit = batch.base_unit || 'Cái';

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: 'min(90vh, 620px)',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px 20px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)',
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 2px 0', color: '#0f172a' }}>
                Xuất Kho Theo Lô Hàng
              </h2>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                [{batch.product_code}] {batch.product_name} — Lô: <strong style={{ color: '#0f172a' }}>{batch.batch_number}</strong>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
            >
              ✕
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '2px',
                marginBottom: '10px',
              }}
            >
              {/* Cảnh báo lô quá hạn & Cơ chế ghi đè của Warehouse Manager */}
              {isExpired && (
                <div
                  style={{
                    marginBottom: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                  }}
                >
                  <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#b91c1c', marginBottom: '4px' }}>
                    CẢNH BÁO: LÔ HÀNG ĐÃ QUÁ HẠN SỬ DỤNG!
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#7f1d1d', marginBottom: '8px' }}>
                    Hạn sử dụng: <strong>{new Date(batch.expiry_date || '').toLocaleDateString('vi-VN')}</strong>.
                    Mặc định hệ thống chặn xuất để chống giao nhầm cho đại lý.
                  </div>

                  {isManager ? (
                    <div>
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#991b1b',
                          cursor: 'pointer',
                          marginBottom: '6px',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={overrideExpired}
                          onChange={(e) => setOverrideExpired(e.target.checked)}
                          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#dc2626' }}
                        />
                        Quản lý kho xác nhận GHI ĐÈ xuất lô quá hạn
                      </label>

                      {overrideExpired && (
                        <div>
                          <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#7f1d1d', marginBottom: '2px' }}>
                            Lý do ghi đè bắt buộc (lưu Audit Log) <span style={{ color: '#dc2626' }}>*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={overrideReason}
                            onChange={(e) => setOverrideReason(e.target.value)}
                            placeholder="VD: Xuất mẫu tiêu hủy / Xuất trả nhà cung cấp..."
                            style={{
                              width: '100%',
                              padding: '6px 8px',
                              borderRadius: '6px',
                              border: '1px solid #fca5a5',
                              fontSize: '12px',
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: '600' }}>
                      🚫 Bạn không có quyền Quản lý kho. Vui lòng liên hệ Warehouse Manager để phê duyệt ghi đè.
                    </div>
                  )}
                </div>
              )}

              {errorMsg && (
                <div style={{ padding: '8px 12px', borderRadius: '7px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '12px', marginBottom: '10px' }}>
                  {errorMsg}
                </div>
              )}

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '3px' }}>
                  Nơi nhận / Khách hàng / Đại lý <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="VD: Đại lý Hà Đông / Kho chi nhánh..."
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '3px' }}>
                  Số lượng xuất ({bUnit}) — Tồn lô: <strong style={{ color: '#2563eb' }}>{batch.remaining_quantity} {bUnit}</strong> <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={batch.remaining_quantity}
                  step="any"
                  required
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Nhập số lượng xuất (> 0)..."
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: isZeroOrNegative || isExceedingStock ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    background: isZeroOrNegative || isExceedingStock ? '#fef2f2' : '#ffffff',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontWeight: '600',
                    color: isZeroOrNegative || isExceedingStock ? '#b91c1c' : '#0f172a',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                />
                {isZeroOrNegative && (
                  <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '3px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚠️ Số lượng xuất phải lớn hơn 0 (tối thiểu 1 {bUnit}).</span>
                  </div>
                )}
                {isExceedingStock && (
                  <div style={{ fontSize: '11.5px', color: '#dc2626', marginTop: '3px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>⚠️ Vượt quá tồn kho còn lại của lô (tối đa {batch.remaining_quantity} {bUnit}).</span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#334155', marginBottom: '3px' }}>
                  Ghi chú phiếu xuất
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm về lô hàng..."
                  style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #f1f5f9',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting || isInvalidForm}
                title={
                  isZeroOrNegative
                    ? 'Số lượng xuất kho phải lớn hơn 0'
                    : isExceedingStock
                    ? 'Vượt quá số lượng tồn kho của lô'
                    : isDestinationMissing
                    ? 'Vui lòng nhập nơi nhận / khách hàng'
                    : isExpiredBlocked
                    ? 'Lô hàng quá hạn chưa được ghi đè'
                    : isOverrideMissingReason
                    ? 'Bắt buộc nhập lý do ghi đè (tối thiểu 5 ký tự)'
                    : ''
                }
                style={{
                  padding: '7px 18px',
                  borderRadius: '7px',
                  border: 'none',
                  background: isInvalidForm
                    ? '#cbd5e1'
                    : isExpired
                    ? '#dc2626'
                    : '#ea580c',
                  color: isInvalidForm ? '#64748b' : '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: submitting || isInvalidForm ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  boxShadow: !isInvalidForm ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {submitting ? 'Đang xuất kho...' : isExpired ? 'Xác nhận ghi đè xuất kho' : 'Xác nhận xuất kho'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
