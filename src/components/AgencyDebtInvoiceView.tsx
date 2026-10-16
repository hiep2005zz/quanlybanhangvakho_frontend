// frontend/src/components/AgencyDebtInvoiceView.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { User } from '../services/api';
import type {
  AgencyDebtSummary,
  AgencyInvoiceItem,
  InvoiceStatusType,
} from '../types/agencyDebt';
import {
  getAgencyDebtSummaryApi,
  getAgencyInvoicesApi,
} from '../services/agencyDebtApi';
import { AgencyInvoiceDetailPage } from './AgencyInvoiceDetailPage';
import './agency-debt.css';

interface AgencyDebtInvoiceViewProps {
  currentUser: User;
  token: string;
  onBackToPortal?: () => void;
  onNavigateToOrders?: () => void;
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

export const AgencyDebtInvoiceView: React.FC<AgencyDebtInvoiceViewProps> = ({
  currentUser,
  token,
  onBackToPortal,
  onNavigateToOrders,
}) => {
  const [summary, setSummary] = useState<AgencyDebtSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<boolean>(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Invoices Table State
  const [invoices, setInvoices] = useState<AgencyInvoiceItem[]>([]);
  const [totalInvoices, setTotalInvoices] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusType>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  // Modal State
  const [selectedInvoiceCode, setSelectedInvoiceCode] = useState<string | null>(null);

  // Debounce tìm kiếm 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Reset trang về 1 khi đổi bộ lọc hoặc từ khóa
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearch, pageSize]);

  // Tải dữ liệu Summary Cards
  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setSummaryError(null);
    try {
      const data = await getAgencyDebtSummaryApi(token);
      setSummary(data);
    } catch (err: any) {
      setSummaryError(err.message || 'Lỗi khi tải thông tin công nợ.');
    } finally {
      setLoadingSummary(false);
    }
  }, [token]);

  // Tải danh sách hóa đơn
  const loadInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    setInvoicesError(null);
    try {
      const res = await getAgencyInvoicesApi(token, {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: debouncedSearch.trim() || undefined,
        page: currentPage,
        page_size: pageSize,
      });
      setInvoices(res.items || []);
      setTotalInvoices(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      setInvoicesError(err.message || 'Lỗi khi tải danh sách hóa đơn.');
    } finally {
      setLoadingInvoices(false);
    }
  }, [token, statusFilter, debouncedSearch, currentPage, pageSize]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleRefresh = () => {
    loadSummary();
    loadInvoices();
  };

  // Khi chọn xem hóa đơn: Chuyển sang 1 trang riêng biệt (Full Page View) có nút "Quay lại danh sách"
  if (selectedInvoiceCode) {
    return (
      <AgencyInvoiceDetailPage
        token={token}
        invoiceCode={selectedInvoiceCode}
        onBack={() => setSelectedInvoiceCode(null)}
      />
    );
  }

  return (
    <div className="agency-debt-container">
      <div className="agency-debt-content">
        {/* KHỐI TRÊN ĐỨNG YÊN (Header & Summary Cards) */}
        <div className="agency-fixed-top-section">
          {/* Header thông tin đại lý & các nút hành động (KHÔNG ICON) */}
          <div className="agency-debt-header-card flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  Đại lý chính thức
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  Mã: {summary?.dealer_code || currentUser.username}
                </span>
              </div>
              <h1 className="text-lg md:text-xl font-bold text-gray-900 tracking-tight">
                Quản Lý Công Nợ &amp; Hóa Đơn Đại Lý
              </h1>
              <p className="text-xs text-gray-600 mt-0.5">
                Đại lý: <strong className="text-gray-900">{summary?.dealer_name || currentUser.full_name}</strong>
                {summary?.phone && ` | SĐT: ${summary.phone}`}
                {summary?.address && ` | Địa chỉ: ${summary.address}`}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                id="btn-refresh-agency-debt"
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
                title="Làm mới dữ liệu"
              >
                Làm mới
              </button>

              {onBackToPortal && (
                <button
                  type="button"
                  id="btn-back-to-products"
                  onClick={onBackToPortal}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                >
                  Đặt hàng sản phẩm
                </button>
              )}

              {onNavigateToOrders && (
                <button
                  type="button"
                  id="btn-goto-orders"
                  onClick={onNavigateToOrders}
                  className="px-3 py-1.5 rounded-md text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
                >
                  Đơn hàng của tôi
                </button>
              )}
            </div>
          </div>

          {/* 1. KHỐI HIỂN THỊ TỔNG QUAN (SUMMARY CARDS - KHÔNG ICON) */}
          {loadingSummary ? (
            <div className="p-4 text-center text-gray-500 bg-white rounded-lg border border-gray-200">
              <p className="text-xs font-medium">Đang tính toán các chỉ số công nợ...</p>
            </div>
          ) : summaryError ? (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-semibold">
              {summaryError}
            </div>
          ) : summary ? (
            <div className="agency-debt-summary-grid">
              {/* Card 1: Tổng còn nợ */}
              <div className="agency-stat-card agency-stat-card-total-debt">
                <div className="agency-stat-label">
                  <span>Tổng còn nợ</span>
                </div>
                <div className="agency-stat-value text-amber-700" id="stat-total-debt">
                  {formatCurrency(summary.total_debt)}
                </div>
                <div className="agency-stat-desc">
                  Tổng số tiền chưa thanh toán của tất cả hóa đơn đã phát hành
                </div>
              </div>

              {/* Card 2: Hạn mức còn lại */}
              <div className="agency-stat-card agency-stat-card-credit-limit">
                <div className="agency-stat-label">
                  <span>Hạn mức còn lại (Được lấy thêm)</span>
                </div>
                <div
                  className={`agency-stat-value ${summary.remaining_credit > 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                  id="stat-remaining-credit"
                >
                  {formatCurrency(summary.remaining_credit)}
                </div>
                <div className="agency-stat-desc">
                  Hạn mức cấp ({formatCurrency(summary.credit_limit)}) - Nợ ({formatCurrency(summary.total_debt)})
                  {summary.pending_orders_amount > 0 && ` - Đơn chờ duyệt (${formatCurrency(summary.pending_orders_amount)})`}
                </div>
              </div>

              {/* Card 3: Hạn thanh toán còn lại & Cảnh báo quá hạn */}
              <div
                className={`agency-stat-card ${
                  summary.overdue_invoices_count > 0 ? 'agency-stat-card-due-alert' : 'agency-stat-card-due-safe'
                }`}
              >
                <div className="agency-stat-label">
                  <span>Hạn thanh toán &amp; Cảnh báo</span>
                </div>
                <div className="agency-stat-value" id="stat-due-alert">
                  {summary.overdue_invoices_count > 0 ? (
                    <span className="text-rose-600">
                      {summary.overdue_invoices_count} hóa đơn quá hạn
                    </span>
                  ) : summary.nearest_due_days !== null ? (
                    <span className="text-blue-700">
                      Còn {summary.nearest_due_days} ngày
                    </span>
                  ) : (
                    <span className="text-emerald-700 text-base">Không có nợ đến hạn</span>
                  )}
                </div>
                <div className="agency-stat-desc">
                  {summary.overdue_invoices_count > 0 ? (
                    <span className="text-rose-700 font-semibold">
                      Có hóa đơn quá hạn! Vui lòng thanh toán để tránh tạm khóa quyền lên đơn mới.
                    </span>
                  ) : summary.nearest_due_invoice_code ? (
                    <span>
                      Hóa đơn gần nhất: <strong>{summary.nearest_due_invoice_code}</strong> (Hạn chót: {summary.nearest_due_date})
                    </span>
                  ) : (
                    <span>Tất cả hóa đơn phát hành đang ở trạng thái an toàn</span>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* 2. KHỐI BẢNG DỮ LIỆU LƯỚT ĐƯỢC (SCROLLABLE TABLE SECTION) */}
        <div className="agency-table-card">
          {/* Thanh công cụ tìm kiếm và lọc (KHÔNG ICON, KHÔNG ĐÈ CHỮ) */}
          <div className="agency-table-toolbar">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <input
                  type="text"
                  id="input-search-invoice"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm kiếm theo mã hóa đơn, mã đơn hàng..."
                  className="w-full px-3.5 py-1.5 border border-gray-300 rounded-md text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => setSearchKeyword('')}
                    className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs border-0 bg-transparent cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-600">
                <span className="font-medium">Trạng thái:</span>
                <select
                  id="select-invoice-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as InvoiceStatusType)}
                  className="px-2.5 py-1 border border-gray-300 rounded-md text-xs bg-white text-gray-800 font-medium focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="ALL">Tất cả ({totalInvoices})</option>
                  <option value="UNPAID">Chưa thanh toán</option>
                  <option value="PARTIAL">Thanh toán một phần</option>
                  <option value="PAID">Đã thanh toán</option>
                  <option value="OVERDUE">Quá hạn</option>
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>Hiện</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="px-2 py-1 border border-gray-300 rounded-md text-xs bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
                <span>dòng</span>
              </div>
            </div>
          </div>

          {/* Vùng cuộn riêng biệt cho bảng hóa đơn */}
          <div className="agency-table-wrapper">
            {loadingInvoices ? (
              <div className="p-8 text-center text-gray-400">
                <p className="text-xs font-medium">Đang tải danh sách hóa đơn...</p>
              </div>
            ) : invoicesError ? (
              <div className="p-6 text-center bg-rose-50 text-rose-700 text-xs font-medium">
                {invoicesError}
              </div>
            ) : invoices.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <p className="text-sm font-semibold text-gray-700">Không tìm thấy hóa đơn nào</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Chưa có hóa đơn nào phát hành khớp với bộ lọc hiện tại.
                </p>
              </div>
            ) : (
              <table className="agency-invoice-table">
                <thead>
                  <tr>
                    <th>Mã Hóa Đơn</th>
                    <th>Mã Đơn Hàng Gốc</th>
                    <th>Ngày Phát Hành</th>
                    <th>Hạn Thanh Toán</th>
                    <th className="text-right">Tổng Tiền Hóa Đơn</th>
                    <th className="text-right">Đã Thanh Toán</th>
                    <th className="text-right">Còn Nợ</th>
                    <th className="text-center">Trạng Thái</th>
                    <th className="text-center">Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isOverdue = inv.status === 'OVERDUE' || (inv.days_until_due < 0 && inv.status !== 'PAID');
                    return (
                      <tr key={inv.id}>
                        <td className="font-bold text-gray-900 font-mono text-xs">
                          {inv.invoice_code}
                        </td>
                        <td className="text-gray-700 font-mono text-xs">
                          {inv.order_code}
                        </td>
                        <td className="text-gray-600 text-xs whitespace-nowrap">
                          {formatDate(inv.issue_date)}
                        </td>
                        <td className="text-xs whitespace-nowrap">
                          <div>{formatDate(inv.due_date)}</div>
                          {inv.status !== 'PAID' && (
                            <div className="mt-0.5">
                              {inv.days_until_due > 0 ? (
                                <span className="text-[11px] font-semibold text-blue-600">
                                  (Còn {inv.days_until_due} ngày)
                                </span>
                              ) : inv.days_until_due === 0 ? (
                                <span className="text-[11px] font-bold text-amber-600">
                                  (Hạn hôm nay)
                                </span>
                              ) : (
                                <span className="text-[11px] font-bold text-rose-600">
                                  (Quá hạn {Math.abs(inv.days_until_due)} ngày)
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="text-right font-bold text-gray-900 text-xs whitespace-nowrap">
                          {formatCurrency(inv.total_amount)}
                        </td>
                        <td className="text-right text-emerald-700 font-semibold text-xs whitespace-nowrap">
                          {formatCurrency(inv.paid_amount)}
                        </td>
                        <td className="text-right font-bold text-amber-800 text-xs whitespace-nowrap">
                          {formatCurrency(inv.remaining_debt)}
                        </td>
                        <td className="text-center whitespace-nowrap">
                          <span
                            className={`agency-status-badge ${
                              inv.status === 'PAID'
                                ? 'agency-badge-paid'
                                : isOverdue
                                ? 'agency-badge-overdue'
                                : inv.status === 'PARTIAL'
                                ? 'agency-badge-partial'
                                : 'agency-badge-unpaid'
                            }`}
                          >
                            {inv.status_label}
                          </span>
                        </td>
                        <td className="text-center whitespace-nowrap">
                          {/* Nút Xem Hóa Đơn (KHÔNG ICON) */}
                          <button
                            type="button"
                            id={`btn-view-invoice-${inv.invoice_code}`}
                            onClick={() => setSelectedInvoiceCode(inv.invoice_code)}
                            className="px-3 py-1 rounded text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors shadow-2xs cursor-pointer"
                            title="Xem chi tiết hóa đơn"
                          >
                            Xem
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Phân trang cố định dưới đáy bảng */}
          {!loadingInvoices && totalInvoices > 0 && (
            <div className="agency-table-pagination">
              <div>
                Hiển thị{' '}
                <strong>
                  {Math.min((currentPage - 1) * pageSize + 1, totalInvoices)}
                </strong>{' '}
                - <strong>{Math.min(currentPage * pageSize, totalInvoices)}</strong> trong tổng số{' '}
                <strong>{totalInvoices}</strong> hóa đơn
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  id="btn-prev-page"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs"
                >
                  Trước
                </button>

                <div className="px-2 py-1 font-semibold text-gray-800 text-xs">
                  Trang {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  id="btn-next-page"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-xs"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgencyDebtInvoiceView;
