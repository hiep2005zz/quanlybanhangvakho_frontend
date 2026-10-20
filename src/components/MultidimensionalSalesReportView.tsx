import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchSalesMultidimensionalReport,
  SalesDimension,
  SalesTimePreset,
  SalesReportItem,
  SalesMultidimensionalResponse,
} from '../services/salesReportApi';
import { User } from '../services/api';
import { emitStatusToast } from './StatusToast';

interface MultidimensionalSalesReportViewProps {
  token: string;
  currentUser?: User;
  onNavigateTab?: (tab: string) => void;
}

export const MultidimensionalSalesReportView: React.FC<MultidimensionalSalesReportViewProps> = ({
  token,
}) => {
  // Bộ lọc
  const [dimension, setDimension] = useState<SalesDimension>(() => {
    try {
      const saved = sessionStorage.getItem('sales_report_dimension') as SalesDimension;
      if (saved && ['salesperson', 'region', 'dealer', 'category', 'sku'].includes(saved)) {
        sessionStorage.removeItem('sales_report_dimension');
        return saved;
      }
    } catch {}
    return 'salesperson';
  });

  const [timePreset, setTimePreset] = useState<SalesTimePreset>(() => {
    try {
      const saved = sessionStorage.getItem('sales_report_preset') as SalesTimePreset;
      if (saved && ['this_month', 'last_month', 'this_quarter', 'today'].includes(saved)) {
        sessionStorage.removeItem('sales_report_preset');
        return saved;
      }
    } catch {}
    return 'this_month';
  });
  const [searchTerm, setSearchTerm] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('sales_report_search') || '';
      if (saved) {
        sessionStorage.removeItem('sales_report_search');
        return saved;
      }
    } catch {}
    return '';
  });
  const [showComparison, setShowComparison] = useState<boolean>(true);

  // Dữ liệu API
  const [reportData, setReportData] = useState<SalesMultidimensionalResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sắp xếp bảng
  const [sortField, setSortField] = useState<string>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Tải dữ liệu báo cáo
  const loadReport = useCallback(
    async (isManualRefresh = false, isBackground = false) => {
      if (isManualRefresh) {
        setIsRefreshing(true);
      } else if (!isBackground) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const res = await fetchSalesMultidimensionalReport(
          {
            dimension,
            time_preset: timePreset,
            search: searchTerm.trim() || undefined,
          },
          token
        );
        setReportData(res);
        if (!isBackground) {
          setCurrentPage(1);
        }
      } catch (err: any) {
        console.error('Lỗi khi tải báo cáo doanh số đa chiều:', err);
        setError(err?.message || 'Không thể tải dữ liệu báo cáo doanh số.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [dimension, timePreset, searchTerm, token]
  );

  // Gọi API mỗi khi thay đổi dimension hoặc timePreset
  useEffect(() => {
    loadReport();
  }, [dimension, timePreset, loadReport]);

  // Thiết lập cơ chế tự động đồng bộ theo thời gian thực (Real-time auto sync)
  useEffect(() => {
    // 1. Lắng nghe các sự kiện nội bộ ứng dụng
    const handleSystemSync = () => {
      loadReport(false, true);
    };

    window.addEventListener('ORDERS_UPDATED', handleSystemSync);
    window.addEventListener('DEALER_DATA_CHANGED', handleSystemSync);
    window.addEventListener('INVENTORY_STOCK_UPDATED', handleSystemSync);
    window.addEventListener('RETURN_ORDERS_UPDATED', handleSystemSync);
    window.addEventListener('SALES_TARGETS_UPDATED', handleSystemSync);

    // 2. Lắng nghe thay đổi giữa các tab/cửa sổ khác (cross-tab sync qua localStorage)
    const handleStorageChange = (e: StorageEvent) => {
      if (
        e.key === 'orders_last_updated' ||
        e.key === 'dealers_last_updated' ||
        e.key === 'inventory_last_updated' ||
        e.key === 'return_orders_last_updated' ||
        e.key === 'sales_targets_last_updated'
      ) {
        loadReport(false, true);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // 3. Tự động đồng bộ lại khi người dùng quay lại tab (focus / visibility)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadReport(false, true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 4. Chu kỳ đồng bộ tự động mỗi 60 giây khi đang xem màn hình
    const intervalTimer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadReport(false, true);
      }
    }, 60000);

    return () => {
      window.removeEventListener('ORDERS_UPDATED', handleSystemSync);
      window.removeEventListener('DEALER_DATA_CHANGED', handleSystemSync);
      window.removeEventListener('INVENTORY_STOCK_UPDATED', handleSystemSync);
      window.removeEventListener('RETURN_ORDERS_UPDATED', handleSystemSync);
      window.removeEventListener('SALES_TARGETS_UPDATED', handleSystemSync);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalTimer);
    };
  }, [loadReport]);

  // Format tiền tệ VNĐ
  const formatVND = (val?: number | null) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Format số nguyên
  const formatNumber = (val?: number | null) => {
    if (val === null || val === undefined) return '0';
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  // Format tỷ lệ %
  const formatPercent = (val?: number | null) => {
    if (val === null || val === undefined) return '—';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(1)}%`;
  };

  // Label theo từng dimension
  const dimensionLabels: Record<SalesDimension, { title: string; colName: string }> = {
    salesperson: { title: 'Nhân viên kinh doanh', colName: 'Nhân viên kinh doanh' },
    region: { title: 'Khu vực địa lý', colName: 'Khu vực / Địa bàn' },
    dealer: { title: 'Đại lý', colName: 'Đại lý phân phối' },
    category: { title: 'Nhóm ngành hàng', colName: 'Ngành hàng / Danh mục' },
    sku: { title: 'Từng SKU / Sản phẩm', colName: 'Mã SKU & Sản phẩm' },
  };

  // Xử lý sắp xếp dữ liệu
  const sortedItems = useMemo(() => {
    if (!reportData?.items) return [];
    const list = [...reportData.items];

    list.sort((a, b) => {
      let valA: any = a[sortField as keyof SalesReportItem];
      let valB: any = b[sortField as keyof SalesReportItem];

      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB as string, 'vi');
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [reportData?.items, sortField, sortDirection]);

  // Dữ liệu phân trang
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedItems.slice(startIndex, startIndex + pageSize);
  }, [sortedItems, currentPage]);

  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;

  // Xử lý click header để sắp xếp
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Render icon sắp xếp
  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">↕</span>;
    }
    return <span className="text-indigo-600 ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Quyền xem lợi nhuận gộp
  const canViewProfit = Boolean(reportData?.can_view_profit);

  // Xuất Excel chuẩn UTF-8 kèm BOM
  const handleExportExcel = () => {
    if (!reportData || sortedItems.length === 0) {
      emitStatusToast({
        title: 'Xuất file Excel',
        message: 'Không có dữ liệu phù hợp với điều kiện lọc hiện tại để xuất Excel.',
        type: 'warning',
      });
      return;
    }

    const curDim = dimensionLabels[dimension];
    const reportTitle = `BÁO CÁO DOANH SỐ ĐA CHIỀU - THEO ${curDim.title.toUpperCase()}`;
    const periodStr = `Thời gian: ${reportData.start_date} đến ${reportData.end_date} (Cùng kỳ: ${reportData.previous_start_date} đến ${reportData.previous_end_date})`;

    // Tạo các cột
    const headers = [
      'STT',
      'Mã',
      curDim.colName,
      'Thông tin bổ trợ',
      'Sản lượng kỳ này',
      'Doanh số kỳ này (VNĐ)',
    ];

    if (showComparison) {
      headers.push('Sản lượng cùng kỳ', 'Doanh số cùng kỳ (VNĐ)', 'Tăng trưởng doanh số (%)');
    }

    if (canViewProfit) {
      headers.push('Giá vốn kỳ này (VNĐ)', 'Lợi nhuận gộp (VNĐ)', 'Biên lợi nhuận (%)');
    }

    let rowsHtml = '';
    sortedItems.forEach((it, idx) => {
      let row = `<tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>${it.code || 'N/A'}</td>
        <td>${it.name}</td>
        <td>${it.sub_text || ''}</td>
        <td style="text-align: right;">${it.quantity}</td>
        <td style="text-align: right;">${Math.round(it.revenue)}</td>
      `;

      if (showComparison) {
        row += `
          <td style="text-align: right;">${it.previous_quantity || 0}</td>
          <td style="text-align: right;">${Math.round(it.previous_revenue || 0)}</td>
          <td style="text-align: right;">${(it.growth_rate || 0).toFixed(1)}%</td>
        `;
      }

      if (canViewProfit) {
        row += `
          <td style="text-align: right;">${it.cost !== null && it.cost !== undefined ? Math.round(it.cost) : '—'}</td>
          <td style="text-align: right;">${it.gross_profit !== null && it.gross_profit !== undefined ? Math.round(it.gross_profit) : '—'}</td>
          <td style="text-align: right;">${it.gross_margin_pct !== null && it.gross_margin_pct !== undefined ? it.gross_margin_pct.toFixed(1) + '%' : '—'}</td>
        `;
      }

      row += '</tr>';
      rowsHtml += row;
    });

    // Dòng tổng cộng
    const sum = reportData.summary;
    let totalRow = `<tr style="font-weight: bold; background-color: #f3f4f6;">
      <td colspan="4" style="text-align: center;">TỔNG CỘNG</td>
      <td style="text-align: right;">${sum.total_quantity}</td>
      <td style="text-align: right;">${Math.round(sum.total_revenue)}</td>
    `;
    if (showComparison) {
      totalRow += `
        <td></td>
        <td style="text-align: right;">${Math.round(sum.previous_total_revenue)}</td>
        <td style="text-align: right;">${sum.total_growth_rate.toFixed(1)}%</td>
      `;
    }
    if (canViewProfit) {
      totalRow += `
        <td style="text-align: right;">${sum.total_cost !== null && sum.total_cost !== undefined ? Math.round(sum.total_cost) : '—'}</td>
        <td style="text-align: right;">${sum.total_gross_profit !== null && sum.total_gross_profit !== undefined ? Math.round(sum.total_gross_profit) : '—'}</td>
        <td style="text-align: right;">${sum.average_gross_margin_pct !== null && sum.average_gross_margin_pct !== undefined ? sum.average_gross_margin_pct.toFixed(1) + '%' : '—'}</td>
      `;
    }
    totalRow += '</tr>';

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th { background-color: #1e3a8a; color: #ffffff; border: 1px solid #cbd5e1; padding: 8px; text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 6px; }
          h2 { color: #1e3a8a; margin-bottom: 4px; }
          p { margin: 2px 0 10px 0; color: #64748b; font-size: 13px; }
        </style>
      </head>
      <body>
        <h2>${reportTitle}</h2>
        <p>${periodStr}</p>
        <table>
          <thead>
            <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
            ${totalRow}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `bao_cao_doanh_so_${dimension}_${todayStr}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    emitStatusToast({
      title: 'Xuất file Excel thành công',
      message: `Đã xuất báo cáo doanh số theo ${curDim.title.toLowerCase()} (${reportData.start_date} - ${reportData.end_date}) thành công.`,
      type: 'success',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Tiêu đề */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Báo Cáo Doanh Số Đa Chiều</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Nút Làm mới */}
          <button
            onClick={() => loadReport(true)}
            disabled={isRefreshing || isLoading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            {isRefreshing ? 'Đang tải...' : 'Làm mới'}
          </button>

          {/* Nút Xuất Excel */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition shadow-sm hover:shadow"
          >
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Tabs chọn Chiều phân tích (5 Dimensions) */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(dimensionLabels) as SalesDimension[]).map((dimKey) => {
            const dimInfo = dimensionLabels[dimKey];
            const isActive = dimension === dimKey;
            return (
              <button
                key={dimKey}
                onClick={() => setDimension(dimKey)}
                className={`flex-1 min-w-[150px] py-3 px-4 rounded-xl font-medium text-sm transition-all text-center ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 font-semibold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{dimInfo.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Thanh bộ lọc thời gian & tìm kiếm */}
      <div
        className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 overflow-x-auto"
        style={{ flexWrap: 'nowrap' }}
      >
        {/* Ô tìm kiếm đưa lên trước chữ Tháng này */}
        <div className="relative w-72 sm:w-80 md:w-96 shrink-0">
          <input
            type="text"
            placeholder={`Tìm ${dimensionLabels[dimension].colName.toLowerCase()}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-3 pr-8 py-1.5 h-8 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-semibold"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Preset thời gian */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600 shrink-0">
          {[
            { key: 'this_month', label: 'Tháng này' },
            { key: 'last_month', label: 'Tháng trước' },
            { key: 'this_quarter', label: 'Quý này' },
            { key: 'today', label: 'Hôm nay' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setTimePreset(p.key as SalesTimePreset)}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                timePreset === p.key
                  ? 'bg-white text-indigo-600 shadow-sm font-semibold'
                  : 'hover:text-slate-900'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Toggle so sánh cùng kỳ */}
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer shrink-0 ml-auto whitespace-nowrap">
          <input
            type="checkbox"
            checked={showComparison}
            onChange={(e) => setShowComparison(e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
          />
          <span>So sánh cùng kỳ trước</span>
        </label>
      </div>

      {/* Hiển thị lỗi nếu có */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-center justify-between">
          <div>
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadReport(true)}
            className="text-xs bg-white px-2.5 py-1 rounded-md border border-rose-200 font-medium hover:bg-rose-100"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Card 1: Tổng Doanh số */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Doanh số kỳ này</span>
            </div>
            <div className="mt-2 text-xl font-bold text-slate-800">
              {formatVND(reportData.summary.total_revenue)}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs">
              <span
                className={`font-semibold ${
                  reportData.summary.total_growth_rate >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatPercent(reportData.summary.total_growth_rate)}
              </span>
              <span className="text-slate-400">so với cùng kỳ trước</span>
            </div>
            {(reportData.summary.total_return_quantity || 0) > 0 && (
              <div className="mt-1 text-[11px] text-amber-600 font-medium">
                Đã trừ {formatNumber(reportData.summary.total_return_quantity)} sp trả lại ({formatVND(reportData.summary.total_return_amount)})
              </div>
            )}
          </div>

          {/* Card 2: Tổng Sản lượng */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sản lượng bán</span>
            </div>
            <div className="mt-2 text-xl font-bold text-slate-800">
              {formatNumber(reportData.summary.total_quantity)}{' '}
              <span className="text-xs font-normal text-slate-400">sản phẩm</span>
            </div>
            <div className="mt-2 text-xs text-slate-400">
              {reportData.summary.total_orders_count} đơn hàng hoàn tất
            </div>
          </div>

          {/* Card 3: Doanh số cùng kỳ trước */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Doanh số cùng kỳ</span>
            </div>
            <div className="mt-2 text-xl font-bold text-slate-700">
              {formatVND(reportData.summary.previous_total_revenue)}
            </div>
            <div className="mt-2 text-xs text-slate-400 truncate">
              Kỳ trước: {reportData.previous_start_date}
            </div>
          </div>

          {/* Card 4: Tổng Lãi Gộp (Chỉ hiển thị khi có quyền) */}
          {canViewProfit && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div>
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Tổng Lãi Gộp</span>
              </div>
              <div className="mt-2 text-xl font-bold text-emerald-600">
                {formatVND(reportData.summary.total_gross_profit)}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Giá vốn: {formatVND(reportData.summary.total_cost)}
              </div>
            </div>
          )}

          {/* Card 5: Biên Lợi Nhuận TB (Chỉ hiển thị khi có quyền) */}
          {canViewProfit && (
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <div>
                <span className="text-xs font-medium text-emerald-600 uppercase tracking-wider">Biên Lợi Nhuận TB</span>
              </div>
              <div className="mt-2 text-xl font-bold text-slate-800">
                {(reportData.summary.average_gross_margin_pct || 0).toFixed(1)}%
              </div>
              <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    (reportData.summary.average_gross_margin_pct || 0) >= 30
                      ? 'bg-emerald-500'
                      : (reportData.summary.average_gross_margin_pct || 0) >= 15
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(0, reportData.summary.average_gross_margin_pct || 0))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bảng dữ liệu chính */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Đang tải và tổng hợp dữ liệu doanh số...</p>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="py-20 text-center">
            <h3 className="text-base font-semibold text-slate-700">Không tìm thấy dữ liệu phát sinh</h3>
            <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
              Không có đơn hàng nào thỏa mãn điều kiện lọc thời gian hoặc từ khóa tìm kiếm này.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 text-[11px] text-slate-500 uppercase font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-2 w-9 text-center whitespace-nowrap">STT</th>
                  <th
                    className="py-2.5 px-2 cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      <span>{dimensionLabels[dimension].colName}</span>
                      {renderSortIcon('name')}
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-2 text-right cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                    onClick={() => handleSort('quantity')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Sản lượng</span>
                      {renderSortIcon('quantity')}
                    </div>
                  </th>
                  <th
                    className="py-2.5 px-2 text-right cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                    onClick={() => handleSort('revenue')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Doanh số</span>
                      {renderSortIcon('revenue')}
                    </div>
                  </th>

                  {/* Cột Chỉ tiêu KPI (khi xem theo nhân viên hoặc khu vực) */}
                  {(dimension === 'salesperson' || dimension === 'region') && (
                    <>
                      <th className="py-2.5 px-2 text-right text-indigo-700 font-semibold whitespace-nowrap">Chỉ tiêu KPI</th>
                      <th className="py-2.5 px-2 text-center text-indigo-700 font-semibold whitespace-nowrap">% Đạt KPI</th>
                    </>
                  )}

                  {/* Cột so sánh cùng kỳ */}
                  {showComparison && (
                    <>
                      <th className="py-2.5 px-2 text-right text-slate-400 font-normal whitespace-nowrap">SL cùng kỳ</th>
                      <th className="py-2.5 px-2 text-right text-slate-400 font-normal whitespace-nowrap">DS cùng kỳ</th>
                      <th
                        className="py-2.5 px-2 text-right cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('growth_rate')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Tăng trưởng</span>
                          {renderSortIcon('growth_rate')}
                        </div>
                      </th>
                    </>
                  )}

                  {/* Cột Lợi nhuận & Biên gộp (Chỉ Quản lý) */}
                  {canViewProfit && (
                    <>
                      <th className="py-2.5 px-2 text-right text-slate-500 font-medium whitespace-nowrap">Giá vốn</th>
                      <th
                        className="py-2.5 px-2 text-right cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('gross_profit')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Lãi gộp</span>
                          {renderSortIcon('gross_profit')}
                        </div>
                      </th>
                      <th
                        className="py-2.5 px-2 text-right cursor-pointer hover:text-indigo-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('gross_margin_pct')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>Biên lãi</span>
                          {renderSortIcon('gross_margin_pct')}
                        </div>
                      </th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedItems.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const marginPct = item.gross_margin_pct;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-2 px-2 text-center text-[11px] text-slate-400">{globalIdx}</td>
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="font-semibold text-slate-800 text-xs whitespace-nowrap">{item.name}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                          {item.code && (
                            <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px] font-mono">
                              {item.code}
                            </span>
                          )}
                          {item.sub_text && <span>{item.sub_text}</span>}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-medium text-slate-700 text-xs">
                        {formatNumber(item.quantity)}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-slate-900 text-xs whitespace-nowrap">
                        {formatVND(item.revenue)}
                      </td>

                      {/* Cột KPI cho nhân viên & khu vực */}
                      {(dimension === 'salesperson' || dimension === 'region') && (
                        <>
                          <td className="py-2 px-2 text-right text-slate-600 text-xs whitespace-nowrap font-medium">
                            {item.target_amount ? formatVND(item.target_amount) : <span className="text-slate-400">—</span>}
                          </td>
                          <td className="py-2 px-2 text-center text-xs whitespace-nowrap">
                            {item.target_achievement_rate !== null && item.target_achievement_rate !== undefined ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                  item.target_achievement_rate >= 100
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : item.target_achievement_rate >= 70
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {item.target_achievement_rate.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </>
                      )}

                      {/* Cột so sánh */}
                      {showComparison && (
                        <>
                          <td className="py-2 px-2 text-right text-slate-500 text-xs">
                            {formatNumber(item.previous_quantity)}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-500 text-xs whitespace-nowrap">
                            {formatVND(item.previous_revenue)}
                          </td>
                          <td className="py-2 px-2 text-right font-medium text-xs whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                (item.growth_rate || 0) >= 0
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {formatPercent(item.growth_rate)}
                            </span>
                          </td>
                        </>
                      )}

                      {/* Cột lợi nhuận gộp */}
                      {canViewProfit && (
                        <>
                          <td className="py-2 px-2 text-right text-slate-500 text-xs whitespace-nowrap">{formatVND(item.cost)}</td>
                          <td className="py-2 px-2 text-right font-semibold text-emerald-600 text-xs whitespace-nowrap">
                            {formatVND(item.gross_profit)}
                          </td>
                          <td className="py-2 px-2 text-right text-xs whitespace-nowrap">
                            {marginPct !== null && marginPct !== undefined ? (
                              <span
                                className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                  marginPct >= 30
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : marginPct >= 15
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {marginPct.toFixed(1)}%
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>

              {/* Dòng Tổng cộng */}
              {reportData && (
                <tfoot className="bg-slate-50/90 font-bold text-slate-800 border-t-2 border-slate-200 text-xs">
                  <tr>
                    <td colSpan={2} className="py-2.5 px-2 text-center uppercase tracking-wide text-[11px]">
                      TỔNG CỘNG ({sortedItems.length} đối tượng)
                    </td>
                    <td className="py-2.5 px-2 text-right text-indigo-700 text-xs">
                      {formatNumber(reportData.summary.total_quantity)}
                    </td>
                    <td className="py-2.5 px-2 text-right text-indigo-700 text-xs whitespace-nowrap">
                      {formatVND(reportData.summary.total_revenue)}
                    </td>

                    {/* Tổng KPI */}
                    {(dimension === 'salesperson' || dimension === 'region') && (
                      <>
                        <td className="py-2.5 px-2 text-right text-indigo-700 text-xs whitespace-nowrap font-bold">
                          {reportData.summary.total_target_amount ? formatVND(reportData.summary.total_target_amount) : '—'}
                        </td>
                        <td className="py-2.5 px-2 text-center text-xs whitespace-nowrap">
                          {reportData.summary.total_target_achievement_rate !== null && reportData.summary.total_target_achievement_rate !== undefined ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              {reportData.summary.total_target_achievement_rate.toFixed(1)}%
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </>
                    )}

                    {showComparison && (
                      <>
                        <td className="py-2.5 px-2 text-right text-slate-400 font-normal text-xs">—</td>
                        <td className="py-2.5 px-2 text-right text-slate-600 text-xs whitespace-nowrap">
                          {formatVND(reportData.summary.previous_total_revenue)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                              reportData.summary.total_growth_rate >= 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {formatPercent(reportData.summary.total_growth_rate)}
                          </span>
                        </td>
                      </>
                    )}

                    {canViewProfit && (
                      <>
                        <td className="py-2.5 px-2 text-right text-slate-600 text-xs whitespace-nowrap">
                          {formatVND(reportData.summary.total_cost)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-emerald-700 text-xs whitespace-nowrap">
                          {formatVND(reportData.summary.total_gross_profit)}
                        </td>
                        <td className="py-2.5 px-2 text-right text-xs whitespace-nowrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                            {(reportData.summary.average_gross_margin_pct || 0).toFixed(1)}%
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}

        {/* Phân trang */}
        {sortedItems.length > pageSize && (
          <div className="py-3.5 px-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Hiển thị {(currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, sortedItems.length)} trên tổng {sortedItems.length} dòng
            </div>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Trước
              </button>
              <span className="px-2">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default MultidimensionalSalesReportView;
