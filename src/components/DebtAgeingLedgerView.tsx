import React, { useState, useEffect, useMemo } from 'react';
import {
  getDebtLedgerApi,
  exportDebtLedgerExcelApi,
  DealerDebtAgeingItem,
  DebtLedgerSummary,
} from '../services/api';
import { getDealerFilters, DealerFiltersResponse } from '../services/dealerSearchApi';
import { emitStatusToast } from './StatusToast';
import './dealer-profile-management.css';

interface DebtAgeingLedgerViewProps {
  token: string;
  onNavigateReconciliation?: () => void;
}

export const DebtAgeingLedgerView: React.FC<DebtAgeingLedgerViewProps> = ({ token, onNavigateReconciliation }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [items, setItems] = useState<DealerDebtAgeingItem[]>([]);
  const [summary, setSummary] = useState<DebtLedgerSummary>({
    total_dealers: 0,
    total_receivable: 0,
    total_paid: 0,
    total_remaining_debt: 0,
    total_bucket_0_30: 0,
    total_bucket_31_60: 0,
    total_bucket_61_90: 0,
    total_bucket_over_90: 0,
  });

  // Filter options from API
  const [filterOptions, setFilterOptions] = useState<DealerFiltersResponse>({
    regions: [],
    sales: [],
  });

  // Filter state
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [overdueOnly, setOverdueOnly] = useState<boolean>(false);
  const [selectedAgeingBucket, setSelectedAgeingBucket] = useState<string>('all');

  // Tự động tìm kiếm tức thì sau 300ms khi người dùng nhập từ khóa
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Load Filter Options from /dealers/filters (allowed for accountant, sales_manager, admin)
  useEffect(() => {
    async function fetchFilters() {
      try {
        const filters = await getDealerFilters(token);
        if (filters) {
          setFilterOptions(filters);
        }
      } catch (err) {
        console.warn('Không tải được danh mục bộ lọc từ hệ thống:', err);
      }
    }
    if (token) {
      fetchFilters();
    }
  }, [token]);

  // Combined regions (from filterOptions or fallback to items)
  const combinedRegions = useMemo(() => {
    const set = new Set<string>(filterOptions.regions || []);
    items.forEach((it) => {
      if (it.region) set.add(it.region);
    });
    return Array.from(set).filter(Boolean);
  }, [filterOptions.regions, items]);

  // Combined sales (from filterOptions or fallback to items)
  const combinedSales = useMemo(() => {
    const list = [...(filterOptions.sales || [])];
    const existingIds = new Set(list.map((s) => s.id));
    items.forEach((it) => {
      if (it.assigned_sale_id && !existingIds.has(it.assigned_sale_id)) {
        existingIds.add(it.assigned_sale_id);
        list.push({
          id: it.assigned_sale_id,
          name: it.assigned_sale_name || `Kinh doanh #${it.assigned_sale_id}`,
        });
      }
    });
    return list;
  }, [filterOptions.sales, items]);

  // Fetch Ledger data
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDebtLedgerApi(token, {
        region: selectedRegion || undefined,
        assigned_sale_id: selectedSaleId ? Number(selectedSaleId) : undefined,
        overdue_only: overdueOnly,
        search: debouncedSearch.trim() || undefined,
        ageing_bucket: selectedAgeingBucket !== 'all' ? selectedAgeingBucket : undefined,
      });
      setItems(res.items || []);
      setSummary(res.summary);
    } catch (err: any) {
      console.error('Lỗi tải sổ công nợ:', err);
      const errMsg = err.message || 'Không thể tải dữ liệu sổ công nợ.';
      setError(errMsg);
      emitStatusToast({
        title: 'Lỗi tải sổ công nợ',
        message: errMsg,
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRegion, selectedSaleId, overdueOnly, selectedAgeingBucket, debouncedSearch]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setSelectedRegion('');
    setSelectedSaleId('');
    setOverdueOnly(false);
    setSelectedAgeingBucket('all');
  };

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const blob = await exportDebtLedgerExcelApi(token, {
        region: selectedRegion || undefined,
        assigned_sale_id: selectedSaleId ? Number(selectedSaleId) : undefined,
        overdue_only: overdueOnly,
        search: debouncedSearch.trim() || undefined,
        ageing_bucket: selectedAgeingBucket !== 'all' ? selectedAgeingBucket : undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `So_Cong_No_Va_Tuoi_No_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      emitStatusToast({
        title: 'Xuất tệp thành công',
        message: 'Báo cáo sổ công nợ & tuổi nợ đã được tải xuống máy tính.',
        type: 'success',
        actionType: 'export',
      });
    } catch (err: any) {
      emitStatusToast({
        title: 'Xuất file Excel thất bại',
        message: err.message || 'Có lỗi xảy ra khi xuất file Excel báo cáo công nợ.',
        type: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  return (
    <div className="dealer-profiles-container" style={{ padding: '4px 8px 12px 8px', gap: '8px' }}>
      {/* CSS Nhúng Riêng Cho Trang Sổ Công Nợ Để Hiển Thị Mượt Mà Hoàn Hảo Trên Điện Thoại */}
      <style>{`
        /* Desktop: Tối ưu 100% vừa khít màn hình, không cần lướt cuộn ngang */
        .debt-ledger-mobile-cards {
          display: none;
        }
        .debt-ledger-desktop-table {
          display: block;
          width: 100%;
          overflow-x: hidden !important;
          overflow-y: auto !important;
        }
        .debt-ledger-table-fit {
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 11px;
          box-sizing: border-box;
        }
        .debt-ledger-table-fit th {
          padding: 6px 2px !important;
          font-size: 9.5px !important;
          font-weight: 700 !important;
          letter-spacing: -0.01em !important;
          white-space: nowrap !important;
          text-align: left;
          box-sizing: border-box;
        }
        .debt-ledger-table-fit td {
          padding: 4px 2px !important;
          font-size: 10.5px !important;
          vertical-align: middle;
          box-sizing: border-box;
          word-break: break-word;
        }
        .debt-ledger-table-fit .dealer-code-pill {
          font-size: 10px !important;
          padding: 1px 3px !important;
        }
        .debt-ledger-table-fit .dealer-name-title {
          font-size: 11px !important;
          line-height: 1.25 !important;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .debt-ledger-table-fit .dealer-phone-sub {
          font-size: 10px !important;
          margin-top: 1px !important;
        }

        /* Mobile Viewport (<= 768px) */
        @media (max-width: 768px) {
          .debt-ledger-container {
            padding: 4px 6px 16px 6px !important;
            gap: 6px !important;
            height: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
          }

          /* Header co giãn tốt trên điện thoại */
          .debt-ledger-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
            padding: 10px 12px !important;
          }
          .debt-ledger-actions {
            display: flex !important;
            gap: 6px !important;
            width: 100% !important;
          }
          .debt-ledger-actions button {
            flex: 1 1 50% !important;
            justify-content: center !important;
            height: 34px !important;
            font-size: 12px !important;
          }

          /* 4 Thẻ KPI: 2 cột trên điện thoại (gọn gàng, rõ ràng, không bị méo/chữ đè chữ) */
          .debt-ledger-stats-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }
          .debt-ledger-stat-card {
            padding: 8px 10px !important;
            border-radius: 8px !important;
            min-height: auto !important;
          }
          .debt-ledger-stat-card .stat-card-label {
            font-size: 11px !important;
          }
          .debt-ledger-stat-card .stat-card-number {
            font-size: 14px !important;
            font-weight: 800 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          .debt-ledger-stat-card .stat-subtext {
            font-size: 10px !important;
            display: block !important;
          }

          /* Bộ Lọc trên điện thoại: Xếp dọc 1 cột dễ bấm, chiều cao 36px chuẩn ngón tay */
          .debt-ledger-filter-form {
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
          }
          .debt-ledger-filter-form .search-input-wrapper,
          .debt-ledger-filter-form .filter-select-wrapper,
          .debt-ledger-filter-form .btn-search-wrapper,
          .debt-ledger-filter-form .btn-reset-wrapper {
            width: 100% !important;
          }
          .debt-ledger-filter-form input,
          .debt-ledger-filter-form select,
          .debt-ledger-filter-form button {
            width: 100% !important;
            height: 36px !important;
            font-size: 12.5px !important;
          }

          /* Toggle switch/checkbox quá hạn trên mobile */
          .debt-ledger-overdue-toggle {
            padding-top: 6px !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 4px !important;
          }

          /* Chuyển đổi hiển thị: Bật bảng có thể cuộn ngang mượt mà kèm Card view trên mobile */
          .debt-ledger-desktop-table {
            display: none !important;
          }
          .debt-ledger-mobile-cards {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* 1. Header Section */}
      <div className="dealer-profiles-header debt-ledger-header" style={{ marginBottom: 0 }}>
        <div className="dealer-header-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <div>
              <h1 className="dealer-header-title" style={{ fontSize: '16px', fontWeight: 800 }}>
                Sổ Công Nợ Theo Đại Lý & Phân Tích Tuổi Nợ
              </h1>
              <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b' }}>
                Theo dõi phát sinh công nợ, phân tích 4 nhóm tuổi nợ để tập trung thu hồi những khoản nợ lâu nhất trước
              </p>
            </div>
          </div>
        </div>

        <div className="dealer-header-actions debt-ledger-actions">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="btn-secondary-white"
            style={{ height: '32px', fontSize: '12px' }}
            title="Làm mới dữ liệu"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
            <span>Làm mới</span>
          </button>

          {onNavigateReconciliation && (
            <button
              type="button"
              onClick={onNavigateReconciliation}
              className="btn-secondary-white"
              style={{
                height: '32px',
                fontSize: '12px',
                borderColor: '#6366f1',
                color: '#4f46e5',
                fontWeight: 600,
                backgroundColor: '#eef2ff',
              }}
              title="Chuyển sang màn hình Lập & Quản lý Biên bản đối chiếu công nợ"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <span>Đối chiếu công nợ</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || loading}
            className="btn-primary-gradient"
            style={{
              height: '32px',
              fontSize: '12px',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              border: 'none',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.25)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{exporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Stat Cards Section (4 Ô Thống Kê Cân Đối) */}
      <div className="dealer-stats-grid debt-ledger-stats-grid" style={{ marginBottom: 0 }}>
        {/* Card 1: Tổng Phải Thu */}
        <div className="dealer-stat-card debt-ledger-stat-card stat-card-blue" style={{ cursor: 'default' }}>
          <div className="stat-card-top">
            <span className="stat-card-label">Tổng phải thu</span>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
              {summary.total_dealers} đại lý
            </span>
          </div>
          <div className="stat-card-number" style={{ color: '#1e40af', fontSize: '17px', margin: '2px 0' }}>
            {formatVND(summary.total_receivable)}
          </div>
          <div className="stat-subtext" style={{ fontSize: '11px' }}>
            Toàn bộ phát sinh bán hàng
          </div>
        </div>

        {/* Card 2: Tổng Đã Thu */}
        <div className="dealer-stat-card debt-ledger-stat-card stat-card-green" style={{ cursor: 'default' }}>
          <div className="stat-card-top">
            <span className="stat-card-label">Tổng đã thu</span>
            <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
              {summary.total_receivable > 0
                ? `${Math.round((summary.total_paid / summary.total_receivable) * 100)}%`
                : '0%'}
            </span>
          </div>
          <div className="stat-card-number" style={{ color: '#16a34a', fontSize: '17px', margin: '2px 0' }}>
            {formatVND(summary.total_paid)}
          </div>
          <div className="stat-subtext" style={{ fontSize: '11px' }}>
            Đã thanh toán thực tế
          </div>
        </div>

        {/* Card 3: Tổng Còn Nợ */}
        <div className="dealer-stat-card debt-ledger-stat-card stat-card-red" style={{ cursor: 'default' }}>
          <div className="stat-card-top">
            <span className="stat-card-label" style={{ color: '#b91c1c' }}>Tổng còn nợ</span>
            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 700 }}>
              Cần thu hồi
            </span>
          </div>
          <div className="stat-card-number" style={{ color: '#dc2626', fontSize: '17px', margin: '2px 0' }}>
            {formatVND(summary.total_remaining_debt)}
          </div>
          <div className="stat-subtext" style={{ fontSize: '11px', color: '#ef4444' }}>
            Số dư công nợ hiện tại
          </div>
        </div>

        {/* Card 4: Nợ Quá Hạn > 60 Ngày */}
        <div className="dealer-stat-card debt-ledger-stat-card stat-card-amber" style={{ cursor: 'default' }}>
          <div className="stat-card-top">
            <span className="stat-card-label" style={{ color: '#b45309' }}>Nợ quá hạn &gt; 60 ngày</span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px',
              background: '#ffffff',
              color: '#b45309',
              border: '1px solid #fed7aa',
            }}>
              Ưu tiên đòi
            </span>
          </div>
          <div className="stat-card-number" style={{ color: '#d97706', fontSize: '17px', margin: '2px 0' }}>
            {formatVND(summary.total_bucket_61_90 + summary.total_bucket_over_90)}
          </div>
          <div className="stat-subtext" style={{ fontSize: '11px', color: '#b45309' }}>
            Nhóm nợ lâu ngày nhất
          </div>
        </div>
      </div>

      {/* 3. Filter Section (Chuẩn Layout Cân Đối Hệ Thống & Responsive Trên Điện Thoại) */}
      <div className="dealer-filter-card" style={{ marginBottom: 0 }}>
        <form onSubmit={handleSearchSubmit} className="dealer-filter-grid debt-ledger-filter-form" style={{
          gridTemplateColumns: 'minmax(220px, 2fr) minmax(140px, 1.2fr) minmax(150px, 1.2fr) minmax(150px, 1.2fr) auto',
          gap: '8px',
          alignItems: 'center',
        }}>
          {/* Ô Tìm kiếm (Tự động lọc khi gõ) */}
          <div className="search-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="search-icon"
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                zIndex: 2,
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã, tên, SĐT đại lý..."
              className="search-input"
              style={{ height: '32px', fontSize: '12px', paddingLeft: '34px', paddingRight: '28px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="btn-clear-search"
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          {/* Lọc Khu vực */}
          <div className="filter-select-wrapper">
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="filter-select"
              style={{ height: '32px', fontSize: '12px', width: '100%' }}
            >
              <option value="">Tất cả khu vực</option>
              {combinedRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc Nhân viên phụ trách */}
          <div className="filter-select-wrapper">
            <select
              value={selectedSaleId}
              onChange={(e) => setSelectedSaleId(e.target.value)}
              className="filter-select"
              style={{ height: '32px', fontSize: '12px', width: '100%' }}
            >
              <option value="">Tất cả nhân viên phụ trách</option>
              {combinedSales.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo Nhóm tuổi nợ */}
          <div className="filter-select-wrapper">
            <select
              value={selectedAgeingBucket}
              onChange={(e) => setSelectedAgeingBucket(e.target.value)}
              className="filter-select"
              style={{ height: '32px', fontSize: '12px', width: '100%' }}
              title="Lọc đại lý theo các nhóm tuổi nợ"
            >
              <option value="all">Tất cả tuổi nợ</option>
              <option value="0-30">Có nợ 0 - 30 ngày</option>
              <option value="31-60">Có nợ 31 - 60 ngày</option>
              <option value="61-90">Có nợ 61 - 90 ngày</option>
              <option value="over_90">Có nợ &gt; 90 ngày (Khó đòi)</option>
              <option value="settled">Đã tất toán (Hết nợ = 0 đ)</option>
            </select>
          </div>

          {/* Nút Đặt lại bộ lọc */}
          {(search || selectedRegion || selectedSaleId || overdueOnly || selectedAgeingBucket !== 'all') && (
            <div className="btn-reset-wrapper">
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-reset-filters"
                style={{ height: '32px', width: '100%' }}
                title="Đặt lại toàn bộ bộ lọc"
              >
                <span>Xóa lọc</span>
              </button>
            </div>
          )}
        </form>

        {/* Thanh trạng thái bộ lọc & Lọc nợ quá hạn */}
        <div className="debt-ledger-overdue-toggle" style={{
          marginTop: '6px',
          paddingTop: '6px',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => setOverdueOnly(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: '#dc2626', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Chỉ hiển thị đại lý có phát sinh nợ quá hạn (&gt; 0 ngày / quá hạn tín dụng)
            </span>
          </label>

          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
            Hiển thị <strong>{items.length}</strong> đại lý phù hợp
          </span>
        </div>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div style={{
          padding: '8px 12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          borderRadius: '6px',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* 4. Table Section (Desktop Table + Mobile Cards Cho Điện Thoại) */}
      <div className="dealer-table-card" style={{ flex: 1, minHeight: '340px' }}>
        {/* Bản Desktop: Table chuẩn kế toán vừa khít 100% màn hình, không cần lướt cuộn ngang */}
        <div className="table-responsive debt-ledger-desktop-table" style={{ display: 'block', overflowX: 'hidden', overflowY: 'auto', width: '100%' }}>
          <table className="dealer-table debt-ledger-table-fit" style={{ width: '100%', minWidth: 0, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '3%', textAlign: 'center', padding: '6px 2px', background: '#ffffff' }}>STT</th>
                <th style={{ width: '6.5%', padding: '6px 2px', background: '#ffffff' }}>MÃ ĐL</th>
                <th style={{ width: '16%', padding: '6px 3px', background: '#ffffff' }}>TÊN ĐẠI LÝ</th>
                <th style={{ width: '7%', padding: '6px 2px', background: '#ffffff' }}>KHU VỰC</th>
                <th style={{ width: '9%', padding: '6px 2px', background: '#ffffff' }}>PHỤ TRÁCH</th>
                <th style={{ width: '8.5%', textAlign: 'right', padding: '6px 2px', background: '#ffffff' }}>PHẢI THU</th>
                <th style={{ width: '8%', textAlign: 'right', padding: '6px 2px', background: '#ffffff', color: '#16a34a', fontWeight: 700 }}>ĐÃ THU</th>
                <th style={{
                  width: '9%',
                  textAlign: 'right',
                  padding: '6px 2px',
                  background: '#ffffff',
                  color: '#dc2626',
                  fontWeight: 800,
                }}>
                  CÒN NỢ
                </th>
                {/* 4 Cột Tuổi Nợ */}
                <th style={{ width: '7.5%', textAlign: 'right', padding: '6px 2px', background: '#ffffff', color: '#b45309', fontWeight: 700 }}>
                  0-30 NGÀY
                </th>
                <th style={{ width: '7.5%', textAlign: 'right', padding: '6px 2px', background: '#ffffff', color: '#b45309', fontWeight: 700 }}>
                  31-60 NGÀY
                </th>
                <th style={{ width: '7.5%', textAlign: 'right', padding: '6px 2px', background: '#ffffff', color: '#c2410c', fontWeight: 700 }}>
                  61-90 NGÀY
                </th>
                <th style={{ width: '7.5%', textAlign: 'right', padding: '6px 2px', background: '#ffffff', color: '#b91c1c', fontWeight: 700 }}>
                  &gt;90 NGÀY
                </th>
                <th style={{ width: '7%', textAlign: 'center', padding: '6px 2px', background: '#ffffff' }}>TRẠNG THÁI</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '40px 0', color: '#64748b', background: '#ffffff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }}>
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                      </svg>
                      <span style={{ fontSize: '12px' }}>Đang tải sổ công nợ và phân tích tuổi nợ...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', background: '#ffffff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="2" width="16" height="20" rx="2" />
                        <line x1="9" y1="22" x2="9" y2="22.01" />
                        <line x1="15" y1="22" x2="15.01" y2="22.01" />
                        <line x1="12" y1="22" x2="12.01" y2="22.01" />
                      </svg>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Không tìm thấy dữ liệu đại lý nào phù hợp.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  return (
                    <tr
                      key={item.dealer_id}
                      style={{
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <td style={{ textAlign: 'center', color: '#64748b', fontSize: '10.5px', padding: '4px 2px', background: '#ffffff' }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: '4px 2px', background: '#ffffff' }}>
                        <span className="dealer-code-pill" style={{ fontSize: '10px', padding: '1px 3px', background: '#ffffff', border: '1px solid #e2e8f0' }}>{item.dealer_code}</span>
                      </td>
                      <td style={{ padding: '4px 3px', background: '#ffffff' }}>
                        <div className="dealer-name-title" title={item.dealer_name}>{item.dealer_name}</div>
                        {item.phone && <div className="dealer-phone-sub">{item.phone}</div>}
                      </td>
                      <td style={{ fontSize: '10.5px', color: '#475569', padding: '4px 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: '#ffffff' }} title={item.region || 'Toàn quốc'}>
                        {item.region || 'Toàn quốc'}
                      </td>
                      <td style={{ fontSize: '10.5px', color: '#475569', padding: '4px 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: '#ffffff' }} title={item.assigned_sale_name || 'Chưa phân công'}>
                        {item.assigned_sale_name || 'Chưa phân công'}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a', padding: '4px 2px', whiteSpace: 'nowrap', fontSize: '10.5px', background: '#ffffff' }}>
                        {formatVND(item.total_receivable)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a', padding: '4px 2px', whiteSpace: 'nowrap', fontSize: '10.5px', background: '#ffffff' }}>
                        {formatVND(item.total_paid)}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: '#dc2626',
                        background: '#ffffff',
                        padding: '4px 2px',
                        whiteSpace: 'nowrap',
                        fontSize: '10.5px',
                      }}>
                        {formatVND(item.remaining_debt)}
                      </td>

                      {/* 0 - 30 days */}
                      <td style={{
                        textAlign: 'right',
                        fontSize: '10.5px',
                        fontWeight: item.ageing.bucket_0_30 > 0 ? 600 : 400,
                        color: item.ageing.bucket_0_30 > 0 ? '#b45309' : '#94a3b8',
                        background: '#ffffff',
                        padding: '4px 2px',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.ageing.bucket_0_30 > 0 ? formatVND(item.ageing.bucket_0_30) : '-'}
                      </td>

                      {/* 31 - 60 days */}
                      <td style={{
                        textAlign: 'right',
                        fontSize: '10.5px',
                        fontWeight: item.ageing.bucket_31_60 > 0 ? 700 : 400,
                        color: item.ageing.bucket_31_60 > 0 ? '#b45309' : '#94a3b8',
                        background: '#ffffff',
                        padding: '4px 2px',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.ageing.bucket_31_60 > 0 ? formatVND(item.ageing.bucket_31_60) : '-'}
                      </td>

                      {/* 61 - 90 days */}
                      <td style={{
                        textAlign: 'right',
                        fontSize: '10.5px',
                        fontWeight: item.ageing.bucket_61_90 > 0 ? 800 : 400,
                        color: item.ageing.bucket_61_90 > 0 ? '#c2410c' : '#94a3b8',
                        background: '#ffffff',
                        padding: '4px 2px',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.ageing.bucket_61_90 > 0 ? formatVND(item.ageing.bucket_61_90) : '-'}
                      </td>

                      {/* > 90 days */}
                      <td style={{
                        textAlign: 'right',
                        fontSize: '10.5px',
                        fontWeight: item.ageing.bucket_over_90 > 0 ? 800 : 400,
                        color: item.ageing.bucket_over_90 > 0 ? '#b91c1c' : '#94a3b8',
                        background: '#ffffff',
                        padding: '4px 2px',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.ageing.bucket_over_90 > 0 ? formatVND(item.ageing.bucket_over_90) : '-'}
                      </td>

                      {/* Status */}
                      <td style={{ textAlign: 'center', padding: '4px 2px', background: '#ffffff' }}>
                        {item.is_overdue ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 5px',
                            borderRadius: '10px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            background: '#ffffff',
                            color: '#b91c1c',
                            border: '1px solid #fca5a5',
                            whiteSpace: 'nowrap',
                          }}>
                            Quá hạn
                          </span>
                        ) : item.remaining_debt > 0 ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 5px',
                            borderRadius: '10px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            background: '#ffffff',
                            color: '#1d4ed8',
                            border: '1px solid #93c5fd',
                            whiteSpace: 'nowrap',
                          }}>
                            Trong hạn
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-block',
                            padding: '1px 5px',
                            borderRadius: '10px',
                            fontSize: '9.5px',
                            fontWeight: 700,
                            background: '#ffffff',
                            color: '#15803d',
                            border: '1px solid #86efac',
                            whiteSpace: 'nowrap',
                          }}>
                            Tất toán
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Chân Bảng Tổng Cộng (Footer Summary) */}
            {items.length > 0 && (
              <tfoot>
                <tr style={{
                  background: '#ffffff',
                  borderTop: '2px solid #cbd5e1',
                  borderBottom: '2px solid #cbd5e1',
                  fontWeight: 800,
                  fontSize: '10.5px',
                  color: '#0f172a',
                }}>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '6px 2px', textTransform: 'uppercase', fontSize: '10px', background: '#ffffff' }}>
                    TỔNG CỘNG ({summary.total_dealers} ĐL)
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 2px', whiteSpace: 'nowrap', background: '#ffffff', color: '#0f172a' }}>
                    {formatVND(summary.total_receivable)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 2px', color: '#16a34a', whiteSpace: 'nowrap', background: '#ffffff' }}>
                    {formatVND(summary.total_paid)}
                  </td>
                  <td style={{
                    textAlign: 'right',
                    padding: '6px 2px',
                    color: '#dc2626',
                    background: '#ffffff',
                    whiteSpace: 'nowrap',
                  }}>
                    {formatVND(summary.total_remaining_debt)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 2px', color: '#b45309', background: '#ffffff', whiteSpace: 'nowrap' }}>
                    {formatVND(summary.total_bucket_0_30)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 2px', color: '#b45309', background: '#ffffff', whiteSpace: 'nowrap' }}>
                    {formatVND(summary.total_bucket_31_60)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 2px', color: '#c2410c', background: '#ffffff', whiteSpace: 'nowrap' }}>
                    {formatVND(summary.total_bucket_61_90)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '6px 2px', color: '#b91c1c', background: '#ffffff', whiteSpace: 'nowrap' }}>
                    {formatVND(summary.total_bucket_over_90)}
                  </td>
                  <td style={{ textAlign: 'center', color: '#64748b', padding: '6px 2px', background: '#ffffff' }}>-</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Bản Mobile: Hiển thị Thẻ Danh Sách Đại Lý Gọn Gàng, Mượt Mà, Không Cần Trượt Ngang */}
        <div className="debt-ledger-mobile-cards">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#64748b' }}>
              <span style={{ fontSize: '13px' }}>Đang tải sổ công nợ...</span>
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
              <span style={{ fontSize: '13px' }}>Không có đại lý phù hợp.</span>
            </div>
          ) : (
            items.map((item, idx) => (
              <div
                key={item.dealer_id}
                style={{
                  background: '#ffffff',
                  border: item.is_overdue ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Header card đại lý */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>#{idx + 1}</span>
                      <span className="dealer-code-pill" style={{ fontSize: '11px', background: '#ffffff', border: '1px solid #e2e8f0' }}>{item.dealer_code}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>
                      {item.dealer_name}
                    </div>
                    {item.phone && (
                      <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '2px' }}>
                        📞 {item.phone}
                      </div>
                    )}
                  </div>

                  {/* Badge trạng thái */}
                  <div>
                    {item.is_overdue ? (
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#ffffff',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                      }}>
                        Quá hạn
                      </span>
                    ) : item.remaining_debt > 0 ? (
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#ffffff',
                        color: '#1d4ed8',
                        border: '1px solid #93c5fd',
                      }}>
                        Trong hạn
                      </span>
                    ) : (
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#ffffff',
                        color: '#15803d',
                        border: '1px solid #86efac',
                      }}>
                        Tất toán
                      </span>
                    )}
                  </div>
                </div>

                {/* Thông tin phụ trách & khu vực */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                  <span>Khu vực: <strong style={{ color: '#334155' }}>{item.region || 'Toàn quốc'}</strong></span>
                  <span>Phụ trách: <strong style={{ color: '#334155' }}>{item.assigned_sale_name || 'Chưa gán'}</strong></span>
                </div>

                {/* Khối tài chính: Tổng phải thu - Đã thu - Còn nợ */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  padding: '8px',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Phải thu</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>{formatVND(item.total_receivable)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Đã thu</div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>{formatVND(item.total_paid)}</div>
                  </div>
                  <div style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '4px', padding: '2px' }}>
                    <div style={{ fontSize: '10px', color: '#991b1b', textTransform: 'uppercase', fontWeight: 700 }}>Còn nợ</div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626' }}>{formatVND(item.remaining_debt)}</div>
                  </div>
                </div>

                {/* 4 Nhóm tuổi nợ trên mobile */}
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    Phân tích tuổi nợ:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', textAlign: 'center' }}>
                    <div style={{ background: '#ffffff', padding: '4px 2px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '9px', color: '#92400e', fontWeight: 600 }}>0-30 ngày</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569' }}>
                        {item.ageing.bucket_0_30 > 0 ? formatVND(item.ageing.bucket_0_30) : '-'}
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '4px 2px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '9px', color: '#854d0e', fontWeight: 600 }}>31-60 ngày</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: item.ageing.bucket_31_60 > 0 ? '#b45309' : '#94a3b8' }}>
                        {item.ageing.bucket_31_60 > 0 ? formatVND(item.ageing.bucket_31_60) : '-'}
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '4px 2px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '9px', color: '#9a3412', fontWeight: 600 }}>61-90 ngày</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, color: item.ageing.bucket_61_90 > 0 ? '#c2410c' : '#94a3b8' }}>
                        {item.ageing.bucket_61_90 > 0 ? formatVND(item.ageing.bucket_61_90) : '-'}
                      </div>
                    </div>
                    <div style={{ background: '#ffffff', padding: '4px 2px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '9px', color: '#991b1b', fontWeight: 700 }}>&gt; 90 ngày</div>
                      <div style={{ fontSize: '10.5px', fontWeight: 800, color: item.ageing.bucket_over_90 > 0 ? '#b91c1c' : '#94a3b8' }}>
                        {item.ageing.bucket_over_90 > 0 ? formatVND(item.ageing.bucket_over_90) : '-'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
