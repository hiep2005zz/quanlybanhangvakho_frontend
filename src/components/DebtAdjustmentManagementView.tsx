// frontend/src/components/DebtAdjustmentManagementView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  getDebtAdjustmentsApi,
  getPendingReturnOrdersApi,
} from '../services/debtAdjustmentApi';
import type { DebtAdjustment } from '../types/debtAdjustment';
import { CreateDebtAdjustmentModal } from './CreateDebtAdjustmentModal';
import { DebtAdjustmentPrintModal } from './DebtAdjustmentPrintModal';
import './debt-adjustment.css';

interface DebtAdjustmentManagementViewProps {
  token: string;
  currentUserRole?: string;
  currentUserId?: number;
  currentUserName?: string;
}

const formatCurrency = (val?: number | null) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
};

export const DebtAdjustmentManagementView: React.FC<DebtAdjustmentManagementViewProps> = ({
  token,
}) => {
  // Data state
  const [items, setItems] = useState<DebtAdjustment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [totalAdjustedSum, setTotalAdjustedSum] = useState<number>(0);

  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'POSTED' | 'CANCELLED'>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedForPrint, setSelectedForPrint] = useState<DebtAdjustment | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load pending returns count
  const loadPendingCount = useCallback(async () => {
    try {
      const data = await getPendingReturnOrdersApi(token);
      setPendingCount(data.length);
    } catch {
      // ignore
    }
  }, [token]);

  // Load adjustments list
  const loadAdjustments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDebtAdjustmentsApi(token, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        search: debouncedSearch.trim() || undefined,
        start_date: startDate ? `${startDate}T00:00:00` : undefined,
        end_date: endDate ? `${endDate}T23:59:59` : undefined,
        page,
        page_size: pageSize,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);

      // Compute total sum for displayed or all
      const sum = (res.items || []).reduce((acc, curr) => acc + (curr.total_adjusted_amount || 0), 0);
      setTotalAdjustedSum(sum);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách chứng từ điều chỉnh.');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, debouncedSearch, startDate, endDate, page, pageSize]);

  useEffect(() => {
    loadAdjustments();
    loadPendingCount();
  }, [loadAdjustments, loadPendingCount]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="debt-adj-container">
      {/* 1. Header */}
      <div className="debt-adj-header">
        <div className="debt-adj-title-group">
          <h1>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#0284c7' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            Giảm Trừ Công Nợ Khi Trả Hàng
          </h1>
          <p>
            Lập biên bản điều chỉnh giảm trừ công nợ theo hóa đơn gốc, tự động cập nhật Sổ S31-DN và Hạn mức tín dụng
          </p>
        </div>

        <div className="debt-adj-actions">

          <button
            type="button"
            className="debt-adj-btn-secondary"
            onClick={() => {
              loadAdjustments();
              loadPendingCount();
            }}
            title="Làm mới danh sách"
          >
            Làm mới
          </button>

          <button
            type="button"
            id="btn-create-debt-adjustment"
            className="debt-adj-btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Lập chứng từ mới
          </button>
        </div>
      </div>

      {/* 2. Stats Cards */}
      <div className="debt-adj-stats-grid">
        <div className="debt-adj-stat-card">
          <div className="debt-adj-stat-icon blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="debt-adj-stat-content">
            <div className="debt-adj-stat-label">Tổng chứng từ đã lập</div>
            <div className="debt-adj-stat-value">{total}</div>
          </div>
        </div>

        <div className="debt-adj-stat-card">
          <div className="debt-adj-stat-icon emerald">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div className="debt-adj-stat-content">
            <div className="debt-adj-stat-label">Tổng tiền đã giảm trừ</div>
            <div className="debt-adj-stat-value" style={{ color: '#059669' }}>
              {formatCurrency(totalAdjustedSum)}
            </div>
          </div>
        </div>

        <div className="debt-adj-stat-card">
          <div className="debt-adj-stat-icon amber">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
          </div>
          <div className="debt-adj-stat-content">
            <div className="debt-adj-stat-label">Phiếu trả hàng chờ lập giảm nợ</div>
            <div className="debt-adj-stat-value" style={{ color: '#d97706' }}>
              {pendingCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filters */}
      <div className="debt-adj-filters">
        <div className="debt-adj-search-box">
          <input
            type="text"
            placeholder="Tìm theo mã chứng từ, mã HĐ gốc, mã phiếu trả, tên đại lý..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="debt-adj-filter-item">
          <label>Trạng thái:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as any);
              setPage(1);
            }}
          >
            <option value="ALL">Tất cả</option>
            <option value="POSTED">Đã ghi sổ</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>
        </div>

        <div className="debt-adj-filter-item">
          <label>Từ ngày:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="debt-adj-filter-item">
          <label>Đến ngày:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="debt-adj-filter-item" style={{ marginLeft: 'auto' }}>
          <label>Hiển thị:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
          >
            <option value={10}>10 dòng</option>
            <option value={20}>20 dòng</option>
            <option value={50}>50 dòng</option>
          </select>
        </div>
      </div>

      {/* 4. Table */}
      <div className="debt-adj-table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p>Đang tải danh sách chứng từ điều chỉnh...</p>
          </div>
        ) : error ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
            <p>{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <p style={{ fontWeight: 600, color: '#475569', fontSize: '1rem', margin: 0 }}>
              Không tìm thấy chứng từ điều chỉnh nào
            </p>
            <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>
              Hãy nhấn "Lập chứng từ mới" để tạo biên bản giảm trừ công nợ từ phiếu trả hàng đã hoàn kho.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="debt-adj-table">
              <thead>
                <tr>
                  <th>Mã Chứng Từ</th>
                  <th>Ngày Lập</th>
                  <th>Đại Lý</th>
                  <th>Phiếu Trả Nguồn</th>
                  <th>Hóa Đơn Gốc</th>
                  <th style={{ textAlign: 'right' }}>Tổng Giảm Trừ</th>
                  <th style={{ textAlign: 'center' }}>Trạng Thái</th>
                  <th>Người Lập</th>
                  <th style={{ textAlign: 'right' }}>Hành Động</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        {row.adjustment_code}
                      </span>
                    </td>
                    <td>{formatDate(row.adjustment_date)}</td>
                    <td>
                      <strong style={{ color: '#1e293b' }}>{row.dealer_name}</strong>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#475569' }}>
                        {row.return_order_code}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                        {row.original_invoice_code}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                      {formatCurrency(row.total_adjusted_amount)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`debt-adj-badge ${row.status.toLowerCase()}`}>
                        {row.status === 'POSTED' ? 'Đã ghi sổ' : 'Đã hủy'}
                      </span>
                    </td>
                    <td>{row.created_by_name}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="debt-adj-btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
                        onClick={() => setSelectedForPrint(row)}
                        title="Xem chi tiết & In biên bản điều chỉnh A4"
                      >
                        🖨 In / Xem PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. Pagination */}
        {total > 0 && (
          <div className="debt-adj-pagination">
            <div>
              Hiển thị <strong>{items.length}</strong> / <strong>{total}</strong> chứng từ — Trang {page}/{totalPages}
            </div>
            <div className="debt-adj-page-btn-group">
              <button
                type="button"
                className="debt-adj-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Trước
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .slice(Math.max(0, page - 3), Math.min(totalPages, page + 2))
                .map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`debt-adj-page-btn ${p === page ? 'active' : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
              <button
                type="button"
                className="debt-adj-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Lập chứng từ */}
      {showCreateModal && (
        <CreateDebtAdjustmentModal
          token={token}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newAdj) => {
            setShowCreateModal(false);
            loadAdjustments();
            loadPendingCount();
            setSelectedForPrint(newAdj);
          }}
        />
      )}

      {/* Modal In chứng từ A4 */}
      {selectedForPrint && (
        <DebtAdjustmentPrintModal
          token={token}
          adjustment={selectedForPrint}
          onClose={() => setSelectedForPrint(null)}
        />
      )}
    </div>
  );
};
