import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getTurnoverReportApi,
  getTurnoverSummaryApi,
  exportTurnoverReportExcelApi,
  TurnoverReportResponse,
  TurnoverSummaryResponse,
  TurnoverReportFilterParams,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface InventoryTurnoverReportViewProps {
  token: string;
  onBackToHome?: () => void;
}

export const InventoryTurnoverReportView: React.FC<InventoryTurnoverReportViewProps> = ({
  token,
  onBackToHome: _onBackToHome,
}) => {
  // 1. Dữ liệu tổng hợp (5 thẻ KPI + Phân bổ kho/ngành hàng)
  const [summaryData, setSummaryData] = useState<TurnoverSummaryResponse | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(true);

  // 2. Dữ liệu bảng 20 dòng phân trang
  const [tableData, setTableData] = useState<TurnoverReportResponse | null>(null);
  const [isTableLoading, setIsTableLoading] = useState<boolean>(true);
  const [isFetchingPage, setIsFetchingPage] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDays, setSelectedDays] = useState<number>(30);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Tab xem phân bổ: 'warehouse' hoặc 'category'
  const [breakdownView, setBreakdownView] = useState<'warehouse' | 'category'>('warehouse');
  const [isBreakdownExpanded, setIsBreakdownExpanded] = useState<boolean>(false);

  // Phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Debounce tìm kiếm 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Tải dữ liệu KPI tổng hợp và phân bổ (chỉ chạy khi mở trang hoặc thay đổi bộ lọc chính)
  const loadSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const res = await getTurnoverSummaryApi(token, {
        warehouse_id: selectedWarehouse,
        category: selectedCategory,
        days: selectedDays,
        status: selectedStatus,
      });
      setSummaryData(res);
    } catch (err: any) {
      console.error('Lỗi khi tải thống kê tổng hợp:', err);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [token, selectedWarehouse, selectedCategory, selectedDays, selectedStatus]);

  // Tải dữ liệu bảng (chỉ 20 dòng theo offset/limit tầng DB)
  const loadTable = useCallback(
    async (pageToLoad: number, isPageChangeOnly: boolean = false) => {
      if (isPageChangeOnly) {
        setIsFetchingPage(true);
      } else {
        setIsTableLoading(true);
      }
      setError(null);
      try {
        const params: TurnoverReportFilterParams = {
          warehouse_id: selectedWarehouse,
          category: selectedCategory,
          days: selectedDays,
          status: selectedStatus,
          search: debouncedSearch,
          page: pageToLoad,
          page_size: pageSize,
          include_summary: false,
        };
        const res = await getTurnoverReportApi(token, params);
        setTableData(res);
      } catch (err: any) {
        console.error('Lỗi khi tải trang bảng báo cáo:', err);
        setError(err?.message || 'Không thể tải dữ liệu báo cáo vòng quay tồn kho.');
      } finally {
        setIsTableLoading(false);
        setIsFetchingPage(false);
      }
    },
    [token, selectedWarehouse, selectedCategory, selectedDays, selectedStatus, debouncedSearch, pageSize]
  );

  // Khi bộ lọc chính thay đổi: tải lại thống kê và trang 1
  useEffect(() => {
    loadSummary();
    setCurrentPage(1);
    loadTable(1, false);
  }, [token, selectedWarehouse, selectedCategory, selectedDays, selectedStatus, debouncedSearch]);

  // Chuyển trang siêu tốc: chỉ tải 20 dòng mới, giữ nguyên 5 thẻ KPI
  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage || isFetchingPage || isTableLoading) return;
    setCurrentPage(newPage);
    loadTable(newPage, true);
  };

  // Xử lý xuất Excel
  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const params: TurnoverReportFilterParams = {
        warehouse_id: selectedWarehouse,
        warehouse_code: selectedWarehouse,
        category: selectedCategory,
        days: selectedDays,
        status: selectedStatus,
        search: debouncedSearch,
      };
      await exportTurnoverReportExcelApi(token, params);
      const currentWhName = selectedWarehouse === 'all'
        ? 'Tất cả các kho'
        : (warehouses.find(w => w.warehouse_id === selectedWarehouse)?.warehouse_name || selectedWarehouse);
      emitStatusToast({
        title: 'Xuất file thành công',
        message: `Báo cáo tồn kho & vòng quay (${currentWhName} - ${selectedDays} ngày) đã được tải về máy tính.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Lỗi xuất file Excel:', err);
      emitStatusToast({
        title: 'Xuất file thất bại',
        message: err?.message || 'Có lỗi xảy ra khi xuất file Excel báo cáo.',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Định dạng hiển thị tiền tệ chuẩn: dấu chấm phân cách hàng nghìn và hậu tố " đ" (ví dụ: 8.500.000 đ)
  const formatCurrency = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0 đ';
    return `${Math.round(val).toLocaleString('vi-VN')} đ`;
  };

  // Định dạng số lượng có phân cách hàng nghìn
  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Number(val).toLocaleString('vi-VN');
  };

  // Định dạng hệ số vòng quay làm tròn 2 chữ số thập phân (ví dụ: 0.00, 1.25)
  const formatTurnover = (val: number | undefined | null) => {
    if (val === undefined || val === null || isNaN(val)) return '0.00';
    if (val >= 999) return 'Cao (Hết hàng)';
    return Number(val).toFixed(2);
  };

  // Định dạng DSI (Số ngày tồn kho) - Hiển thị số nguyên thuần túy (không phần thập phân và không dấu chấm)
  const formatDsi = (dsi: number | null | undefined, status: string) => {
    if (status === 'stagnant' || dsi === null || dsi === undefined) {
      return <span style={{ color: '#dc2626', fontWeight: '700' }}>Vô hạn</span>;
    }
    if (dsi === 0) {
      return <span style={{ color: '#16a34a', fontWeight: '600' }}>0 ngày</span>;
    }
    return <span>{Math.round(dsi)} ngày</span>;
  };

  const summary = summaryData?.summary || {
    total_inventory_value: 0,
    slow_stagnant_value: 0,
    slow_stagnant_skus: 0,
    total_skus: 0,
    avg_turnover_rate: 0,
    avg_dsi: null,
    total_cogs: 0,
    period_days: selectedDays,
  };

  const warehouseBreakdown = summaryData?.warehouse_breakdown || [];
  const categoryBreakdown = summaryData?.category_breakdown || [];
  const warehouses = summaryData?.warehouses || [];
  const categories = summaryData?.categories || [];

  const items = tableData?.items || [];
  const totalItems = tableData?.total || 0;
  const totalPages = tableData?.total_pages || Math.max(1, Math.ceil(totalItems / pageSize));

  // Tỷ lệ vốn đọng chậm trên tổng tồn kho
  const slowValueRatio = useMemo(() => {
    if (summary.total_inventory_value <= 0) return 0;
    return Math.min(100, Math.round((summary.slow_stagnant_value / summary.total_inventory_value) * 100));
  }, [summary.slow_stagnant_value, summary.total_inventory_value]);

  return (
    <div
      style={{
        padding: '12px 20px',
        backgroundColor: '#f8fafc',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* 1. Header & Nút Thao Tác Nhanh */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          flexWrap: 'wrap',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: '800',
              color: '#0f172a',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Báo Cáo Tồn Kho & Vòng Quay Hàng Hóa
          </h1>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            (Chu kỳ {selectedDays} ngày)
          </span>
        </div>

        {/* Nút hành động góc phải trên: Xuất File Excel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            id="btn-export-turnover-excel"
            onClick={handleExportExcel}
            disabled={isExporting || isTableLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 16px',
              borderRadius: '7px',
              border: 'none',
              backgroundColor: isExporting ? '#0e9f7d' : '#0fad89',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isExporting || isTableLoading ? 'not-allowed' : 'pointer',
              boxShadow: isExporting ? 'none' : '0 2px 5px rgba(15, 173, 137, 0.3)',
              transition: 'all 0.15s ease',
              opacity: isExporting || isTableLoading ? 0.8 : 1,
            }}
          >
            {isExporting ? (
              <>
                <svg
                  style={{
                    width: '14px',
                    height: '14px',
                    marginRight: '6px',
                    animation: 'spin 1s linear infinite',
                  }}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    style={{ opacity: 0.25 }}
                  />
                  <path
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    style={{ opacity: 0.75 }}
                  />
                </svg>
                <span>Đang xuất file Excel...</span>
              </>
            ) : (
              <>
                <svg
                  style={{ width: '15px', height: '15px', marginRight: '6px' }}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Xuất File Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Thẻ Thống Kê Nhanh (5 KPI Cards) - Thu gọn siêu mỏng */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '6px',
          marginBottom: '6px',
          flexShrink: 0,
          opacity: isSummaryLoading ? 0.6 : 1,
          transition: 'opacity 0.2s ease',
        }}
      >
        {/* Card 1: Tổng giá trị tồn */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '6px 10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: '#0fad89' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Tổng Giá Trị Tồn
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
              <strong style={{ color: '#0f172a' }}>{summary.total_skus}</strong> SKU
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.01em', marginTop: '2px', lineHeight: '1.2' }}>
            {formatCurrency(summary.total_inventory_value)}
          </div>
        </div>

        {/* Card 2: Tồn đọng chậm */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '6px 10px',
            border: '1px solid #fee2e2',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: '#ef4444' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#dc2626', textTransform: 'uppercase' }}>
              Tồn Đọng / Chậm Vốn
            </span>
            <span style={{ fontSize: '10.5px', color: '#b91c1c', fontWeight: '700' }}>
              {slowValueRatio}% vốn
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#b91c1c', letterSpacing: '-0.01em', marginTop: '2px', lineHeight: '1.2' }}>
            {formatCurrency(summary.slow_stagnant_value)}
          </div>
        </div>

        {/* Card 3: SKU cần lưu ý */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '6px 10px',
            border: '1px solid #fef3c7',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: '#f59e0b' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#d97706', textTransform: 'uppercase' }}>
              SKU Cần Lưu Ý
            </span>
            <span style={{ fontSize: '10.5px', color: '#92400e' }}>
              Chậm / Bất động
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#b45309', letterSpacing: '-0.01em', marginTop: '2px', lineHeight: '1.2' }}>
            {summary.slow_stagnant_skus} <span style={{ fontSize: '11px', fontWeight: '500' }}>SKU</span>
          </div>
        </div>

        {/* Card 4: Hệ số vòng quay bình quân */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '6px 10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px', backgroundColor: '#3b82f6' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              Vòng Quay BQ
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
              Vốn bán: {formatCurrency(summary.total_cogs)}
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e3a8a', letterSpacing: '-0.01em', marginTop: '2px', lineHeight: '1.2' }}>
            {formatTurnover(summary.avg_turnover_rate)}{' '}
            <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748b' }}>lần</span>
          </div>
        </div>

        {/* Card 5: DSI Bình quân */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '6px 10px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2.5px', backgroundColor: '#8b5cf6' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10.5px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
              DSI Bình Quân
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748b' }}>
              Ngày giải phóng
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#5b21b6', letterSpacing: '-0.01em', marginTop: '2px', lineHeight: '1.2' }}>
            {summary.avg_dsi !== null ? `${Math.round(summary.avg_dsi)} ngày` : 'Vô hạn'}
          </div>
        </div>
      </div>

      {/* 3. Phân Bổ Giá Trị Tồn Kho (Theo Kho & Theo Nhóm Hàng) - To hơn một chút, rõ ràng */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          padding: '7px 14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
          marginBottom: '6px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
              Phân Bổ:
            </span>
            <div style={{ display: 'inline-flex', borderRadius: '5px', padding: '2px', backgroundColor: '#f1f5f9' }}>
              <button
                type="button"
                onClick={() => setBreakdownView('warehouse')}
                style={{
                  padding: '3px 9px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: breakdownView === 'warehouse' ? '700' : '500',
                  backgroundColor: breakdownView === 'warehouse' ? '#ffffff' : 'transparent',
                  color: breakdownView === 'warehouse' ? '#0fad89' : '#64748b',
                  boxShadow: breakdownView === 'warehouse' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Kho ({warehouseBreakdown.length})
              </button>
              <button
                type="button"
                onClick={() => setBreakdownView('category')}
                style={{
                  padding: '3px 9px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: breakdownView === 'category' ? '700' : '500',
                  backgroundColor: breakdownView === 'category' ? '#ffffff' : 'transparent',
                  color: breakdownView === 'category' ? '#0fad89' : '#64748b',
                  boxShadow: breakdownView === 'category' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer',
                }}
              >
                Nhóm Hàng ({categoryBreakdown.length})
              </button>
            </div>

            {/* Dòng tóm tắt gọn gàng, rõ nét */}
            {!isBreakdownExpanded && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#64748b', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {(breakdownView === 'warehouse' ? warehouseBreakdown : categoryBreakdown).slice(0, 4).map((item: any, i) => (
                  <span key={i} style={{ whiteSpace: 'nowrap' }}>
                    <strong style={{ color: '#334155' }}>{'warehouse_name' in item ? item.warehouse_name : item.category}:</strong>{' '}
                    <span style={{ color: '#0fad89', fontWeight: '700' }}>{item.percentage}%</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsBreakdownExpanded(!isBreakdownExpanded)}
            style={{
              padding: '4px 10px',
              borderRadius: '5px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f8fafc',
              color: '#334155',
              fontSize: '11.5px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isBreakdownExpanded ? 'Thu gọn ▲' : 'Xem chi tiết ▼'}
          </button>
        </div>

        {/* Danh sách các thanh phân bổ khi mở rộng */}
        {isBreakdownExpanded && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
            {breakdownView === 'warehouse' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
                {warehouseBreakdown.map((wh) => (
                  <div
                    key={wh.warehouse_id}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b' }}>{wh.warehouse_name}</span>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#0fad89' }}>{wh.percentage}%</span>
                    </div>
                    <div style={{ width: '100%', height: '3px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginBottom: '2px' }}>
                      <div style={{ width: `${wh.percentage}%`, height: '100%', backgroundColor: '#0fad89', borderRadius: '2px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                      <span>{formatCurrency(wh.total_value)}</span>
                      <span>{formatNumber(wh.total_stock)} Cái ({wh.sku_count} SKU)</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '6px' }}>
                {categoryBreakdown.map((cat) => (
                  <div
                    key={cat.category}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '5px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e293b' }}>{cat.category}</span>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#0284c7' }}>{cat.percentage}%</span>
                    </div>
                    <div style={{ width: '100%', height: '3px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', marginBottom: '2px' }}>
                      <div style={{ width: `${cat.percentage}%`, height: '100%', backgroundColor: '#0284c7', borderRadius: '2px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                      <span>{formatCurrency(cat.total_value)}</span>
                      <span>{formatNumber(cat.total_stock)} Cái ({cat.sku_count} SKU)</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Thanh Bộ Lọc & Tìm Kiếm - Gọn gàng */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '6px 12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          marginBottom: '8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {/* Ô tìm kiếm */}
        <div style={{ flex: '1 1 240px', minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Tìm theo mã SKU hoặc tên sản phẩm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s ease',
            }}
          />
        </div>

        {/* Lọc theo kho lưu trữ */}
        <div style={{ minWidth: '150px' }}>
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả kho lưu trữ</option>
            {warehouses.map((wh) => (
              <option key={wh.warehouse_id} value={wh.warehouse_id}>
                {wh.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        {/* Lọc theo ngành hàng / danh mục */}
        <div style={{ minWidth: '150px' }}>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả ngành hàng</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Chu kỳ thời gian */}
        <div style={{ minWidth: '130px' }}>
          <select
            value={selectedDays}
            onChange={(e) => {
              setSelectedDays(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <option value={30}>Chu kỳ 30 ngày</option>
            <option value={60}>Chu kỳ 60 ngày</option>
            <option value={90}>Chu kỳ 90 ngày</option>
            <option value={180}>Chu kỳ 180 ngày</option>
            <option value={365}>Chu kỳ 365 ngày</option>
          </select>
        </div>

        {/* Lọc theo Trạng thái & Cảnh báo */}
        <div style={{ minWidth: '160px' }}>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff',
              color: '#1e293b',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="stagnant">Tồn bất động</option>
            <option value="slow">Chậm luân chuyển</option>
            <option value="normal">Bình thường</option>
            <option value="fast">Luân chuyển nhanh</option>
            <option value="out_of_stock">Hết hàng</option>
          </select>
        </div>

        {/* Nút đặt lại bộ lọc */}
        {(selectedWarehouse !== 'all' || selectedCategory !== 'all' || selectedDays !== 30 || selectedStatus !== 'all' || searchTerm) && (
          <button
            type="button"
            onClick={() => {
              setSelectedWarehouse('all');
              setSelectedCategory('all');
              setSelectedDays(30);
              setSelectedStatus('all');
              setSearchTerm('');
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Xóa lọc
          </button>
        )}
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            color: '#b91c1c',
            fontSize: '13px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* CSS tùy biến thanh cuộn dọc cho bảng sản phẩm và hiệu ứng Shimmer Skeleton */}
      <style>{`
        .turnover-table-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .turnover-table-scroll::-webkit-scrollbar-track {
          background: #f8fafc;
        }
        .turnover-table-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .turnover-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-box {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }
      `}</style>

      {/* 5. Bảng Chi Tiết SKU & Vòng Quay Hàng Hóa - Cuộn Trong Bảng, Cố Định Header */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          marginBottom: 0,
          position: 'relative',
        }}
      >
        {/* Đường progress bar nhẹ nhàng phía trên bảng khi đang chuyển trang */}
        {isFetchingPage && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2.5px',
              background: 'linear-gradient(90deg, #0fad89, #38bdf8, #0fad89)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1s infinite linear',
              zIndex: 30,
            }}
          />
        )}

        <div
          className="turnover-table-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'scroll',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: '#cbd5e1 #f8fafc',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              textAlign: 'left',
              tableLayout: 'auto',
            }}
          >
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#f1f5f9' }}>
              <tr
                style={{
                  backgroundColor: '#f1f5f9',
                  borderBottom: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: '10.5px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.01em',
                  whiteSpace: 'nowrap',
                }}
              >
                <th style={{ padding: '8px 5px', textAlign: 'center', width: '35px', whiteSpace: 'nowrap' }}>STT</th>
                <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Mã SKU</th>
                <th style={{ padding: '8px 8px' }}>Tên Sản Phẩm</th>
                <th style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>Nhóm Hàng</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>Tồn Kho</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>Giá Vốn</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>Giá Trị Tồn</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>SL Bán ({selectedDays}N)</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>COGS Giá Vốn</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>Vòng Quay</th>
                <th style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>DSI (Ngày)</th>
                <th style={{ padding: '8px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng Thái</th>
              </tr>
            </thead>
            <tbody
              style={{
                opacity: isFetchingPage ? 0.45 : 1,
                transition: 'opacity 0.15s ease',
                pointerEvents: isFetchingPage ? 'none' : 'auto',
              }}
            >
              {isTableLoading ? (
                Array.from({ length: 10 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} style={{ borderBottom: '1px solid #f1f5f9', height: '37px' }}>
                    <td style={{ padding: '8px 5px', textAlign: 'center' }}>
                      <div className="skeleton-box" style={{ width: '18px', height: '14px', margin: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <div className="skeleton-box" style={{ width: '55px', height: '14px' }} />
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <div className="skeleton-box" style={{ width: '160px', height: '14px' }} />
                    </td>
                    <td style={{ padding: '8px 6px' }}>
                      <div className="skeleton-box" style={{ width: '75px', height: '14px' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div className="skeleton-box" style={{ width: '40px', height: '14px', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div className="skeleton-box" style={{ width: '65px', height: '14px', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div className="skeleton-box" style={{ width: '80px', height: '14px', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div className="skeleton-box" style={{ width: '35px', height: '14px', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div className="skeleton-box" style={{ width: '70px', height: '14px', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div className="skeleton-box" style={{ width: '35px', height: '14px', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                      <div className="skeleton-box" style={{ width: '50px', height: '14px', marginLeft: 'auto' }} />
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                      <div className="skeleton-box" style={{ width: '80px', height: '18px', borderRadius: '9999px', margin: 'auto' }} />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ padding: '50px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Không tìm thấy sản phẩm phù hợp
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      Vui lòng thử thay đổi từ khóa tìm kiếm hoặc điều chỉnh bộ lọc kho/ngành hàng.
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const stt = (currentPage - 1) * pageSize + index + 1;

                  // Màu badge trạng thái
                  let badgeBg = '#f1f5f9';
                  let badgeText = '#475569';
                  let badgeBorder = '#cbd5e1';

                  if (item.status === 'stagnant') {
                    badgeBg = '#fee2e2';
                    badgeText = '#b91c1c';
                    badgeBorder = '#fca5a5';
                  } else if (item.status === 'slow') {
                    badgeBg = '#fef3c7';
                    badgeText = '#b45309';
                    badgeBorder = '#fde68a';
                  } else if (item.status === 'fast') {
                    badgeBg = '#dcfce7';
                    badgeText = '#15803d';
                    badgeBorder = '#86efac';
                  } else if (item.status === 'normal') {
                    badgeBg = '#e0f2fe';
                    badgeText = '#0369a1';
                    badgeBorder = '#bae6fd';
                  }

                  return (
                    <tr
                      key={item.product_id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: item.status === 'stagnant' ? '#fffbfc' : 'transparent',
                        transition: 'background-color 0.1s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = item.status === 'stagnant' ? '#fffbfc' : 'transparent';
                      }}
                    >
                      {/* STT */}
                      <td style={{ padding: '7px 5px', textAlign: 'center', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {stt}
                      </td>

                      {/* Mã SKU */}
                      <td style={{ padding: '7px 6px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '11.5px', backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                          {item.product_code}
                        </span>
                      </td>

                      {/* Tên SP */}
                      <td style={{ padding: '7px 8px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a', lineHeight: '1.25' }}>{item.product_name}</div>
                      </td>

                      {/* Nhóm hàng */}
                      <td style={{ padding: '7px 6px', color: '#475569', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '11px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {item.category}
                        </span>
                      </td>

                      {/* Tồn kho kèm đơn vị */}
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: '700', color: item.current_stock === 0 ? '#94a3b8' : '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatNumber(item.current_stock)}{' '}
                        <span style={{ fontSize: '10.5px', fontWeight: '500', color: '#64748b' }}>
                          {item.base_unit}
                        </span>
                      </td>

                      {/* Giá vốn */}
                      <td style={{ padding: '7px 6px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.cost_price)}
                      </td>

                      {/* Giá trị tồn kho */}
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: '700', color: item.status === 'stagnant' ? '#b91c1c' : '#047857', whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.inventory_value)}
                      </td>

                      {/* Số lượng xuất bán trong kỳ */}
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: '600', color: item.sold_quantity > 0 ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                        {formatNumber(item.sold_quantity)}{' '}
                        <span style={{ fontSize: '10.5px', fontWeight: '400', color: '#64748b' }}>
                          {item.base_unit}
                        </span>
                      </td>

                      {/* COGS */}
                      <td style={{ padding: '7px 6px', textAlign: 'right', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatCurrency(item.cogs)}
                      </td>

                      {/* Hệ số vòng quay */}
                      <td style={{ padding: '7px 6px', textAlign: 'right', fontWeight: '700', color: item.turnover_rate >= 2.0 ? '#15803d' : '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatTurnover(item.turnover_rate)}
                      </td>

                      {/* DSI Số ngày tồn */}
                      <td style={{ padding: '7px 6px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {formatDsi(item.dsi, item.status)}
                      </td>

                      {/* Trạng thái Badge */}
                      <td style={{ padding: '7px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 7px',
                            borderRadius: '9999px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            backgroundColor: badgeBg,
                            color: badgeText,
                            border: `1px solid ${badgeBorder}`,
                            whiteSpace: 'nowrap',
                          }}
                          title={item.warning_note || item.status_label}
                        >
                          {item.status_label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Phân Trang (Pagination Controls có nút số trang & nhảy trang nhanh) */}
        {/* 6. Phân Trang (Thanh số trang liền khối bo góc chuẩn thiết kế) */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              overflow: 'hidden',
              backgroundColor: '#ffffff',
              height: '32px',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Nút Trước < */}
            <button
              type="button"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1 || isFetchingPage || isTableLoading}
              style={{
                width: '32px',
                height: '100%',
                border: 'none',
                borderRight: '1px solid #e5e7eb',
                backgroundColor: '#ffffff',
                color: currentPage <= 1 ? '#cbd5e1' : '#374151',
                cursor: currentPage <= 1 || isFetchingPage || isTableLoading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Trang trước"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Danh sách các số trang */}
            {(() => {
              if (totalPages <= 5) {
                return Array.from({ length: totalPages }, (_, i) => i + 1);
              }
              const pages: (number | string)[] = [];
              if (currentPage <= 3) {
                pages.push(1, 2, 3, '...', totalPages);
              } else if (currentPage >= totalPages - 2) {
                pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
              } else {
                pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
              }
              return pages;
            })().map((p, idx) => {
              if (typeof p === 'string') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      minWidth: '34px',
                      height: '100%',
                      padding: '0 6px',
                      borderRight: '1px solid #e5e7eb',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '13px',
                      fontWeight: '500',
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
                  onClick={() => handlePageChange(p)}
                  disabled={isFetchingPage || isTableLoading}
                  style={{
                    minWidth: '36px',
                    height: '100%',
                    padding: '0 8px',
                    border: 'none',
                    borderRight: '1px solid #e5e7eb',
                    backgroundColor: isActive ? '#0fad89' : '#ffffff',
                    color: isActive ? '#ffffff' : '#1e293b',
                    cursor: isActive ? 'default' : 'pointer',
                    fontSize: '13px',
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

            {/* Nút Sau > */}
            <button
              type="button"
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage >= totalPages || isFetchingPage || isTableLoading}
              style={{
                width: '32px',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
                color: currentPage >= totalPages ? '#cbd5e1' : '#374151',
                cursor: currentPage >= totalPages || isFetchingPage || isTableLoading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Trang sau"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryTurnoverReportView;
