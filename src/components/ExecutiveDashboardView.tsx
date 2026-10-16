import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getExecutiveMetricsApi,
  ExecutiveDashboardResponse,
  ExecutiveOverdueDealerItem,
  User,
} from '../services/api';

interface ExecutiveDashboardViewProps {
  token: string;
  currentUser?: User;
  onNavigateTab?: (tab: string) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  token,
  currentUser: _currentUser,
  onNavigateTab,
}) => {
  const [data, setData] = useState<ExecutiveDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<{ day: number; date: string; revenue: number } | null>(null);

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setError(null);
    try {
      const res = await getExecutiveMetricsApi(token);
      setData(res);
    } catch (err: any) {
      console.error('Lỗi khi tải Executive Dashboard:', err);
      setError(err?.message || 'Không thể tải dữ liệu Dashboard điều hành.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatCompactVND = (val: number) => {
    if (val >= 1_000_000_000) {
      return (val / 1_000_000_000).toFixed(1) + ' tỷ';
    }
    if (val >= 1_000_000) {
      return (val / 1_000_000).toFixed(1) + ' tr';
    }
    if (val >= 1_000) {
      return (val / 1_000).toFixed(0) + ' k';
    }
    return val.toString();
  };

  // Helper cho nhãn quá hạn
  const getOverdueBadge = (days: number) => {
    if (days > 90) {
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 border border-red-200">&gt; 90 ngày</span>;
    }
    if (days >= 61) {
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 text-orange-700 border border-orange-200">61-90 ngày</span>;
    }
    if (days >= 31) {
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 border border-amber-200">31-60 ngày</span>;
    }
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">1-30 ngày</span>;
  };

  // Tính toán biểu đồ doanh số theo ngày
  const dailyChartData = useMemo(() => {
    if (!data || !data.daily_revenue || data.daily_revenue.length === 0) return null;
    const items = data.daily_revenue;
    const maxRev = Math.max(...items.map((i) => i.revenue), 10_000_000);
    const avgRev = items.reduce((acc, i) => acc + i.revenue, 0) / items.length;
    return { items, maxRev, avgRev };
  }, [data]);

  // Màu sắc cho các vùng miền
  const regionColors: { [key: string]: { stroke: string; bg: string; text: string } } = {
    'Miền Bắc': { stroke: '#2563eb', bg: 'bg-blue-500', text: 'text-blue-700' },
    'Miền Trung': { stroke: '#0d9488', bg: 'bg-teal-500', text: 'text-teal-700' },
    'Miền Nam': { stroke: '#7c3aed', bg: 'bg-purple-500', text: 'text-purple-700' },
    'Miền Tây': { stroke: '#ea580c', bg: 'bg-orange-500', text: 'text-orange-700' },
    'Toàn quốc': { stroke: '#4b5563', bg: 'bg-gray-500', text: 'text-gray-700' },
  };

  if (isLoading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] bg-gray-50/50 rounded-xl p-8">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
        <h3 className="text-base font-semibold text-gray-700">Đang tải dữ liệu tổng quan điều hành...</h3>
        <p className="text-sm text-gray-400 mt-1">Đang tổng hợp doanh số, công nợ, đơn hàng và tồn kho toàn công ty</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-xl max-w-2xl mx-auto my-12 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-red-800 mb-1">Không thể tải Dashboard điều hành</h3>
        <p className="text-sm text-red-600 mb-4">{error}</p>
        <button
          onClick={() => loadData(true)}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-xs transition-colors"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* 1. Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
            Điều Hành Bán Hàng & Kho
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors border border-gray-300/80 disabled:opacity-50"
            title="Làm mới số liệu"
          >
            <svg
              className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-600' : 'text-gray-600'}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isRefreshing ? 'Đang cập nhật...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* 2. 6 KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* KPI 1: Doanh số hôm nay */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Doanh số hôm nay</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-xl font-black text-gray-900 tracking-tight">
              {formatCompactVND(kpis?.revenue_today || 0)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 truncate" title={formatVND(kpis?.revenue_today || 0)}>
              {formatVND(kpis?.revenue_today || 0)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">So hôm qua:</span>
            <span
              className={`font-bold flex items-center gap-0.5 ${
                (kpis?.revenue_today_growth || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {(kpis?.revenue_today_growth || 0) >= 0 ? '▲ +' : '▼ '}
              {kpis?.revenue_today_growth || 0}%
            </span>
          </div>
        </div>

        {/* KPI 2: Doanh số tháng này */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">Doanh số tháng này</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="text-xl font-black text-blue-900 tracking-tight">
              {formatCompactVND(kpis?.revenue_this_month || 0)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 truncate" title={formatVND(kpis?.revenue_this_month || 0)}>
              {formatVND(kpis?.revenue_this_month || 0)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
            <span className="text-gray-500">So tháng trước:</span>
            <span
              className={`font-bold flex items-center gap-0.5 ${
                (kpis?.revenue_this_month_growth || 0) >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {(kpis?.revenue_this_month_growth || 0) >= 0 ? '▲ +' : '▼ '}
              {kpis?.revenue_this_month_growth || 0}%
            </span>
          </div>
        </div>

        {/* KPI 3: Đơn chờ duyệt */}
        <div
          onClick={() => onNavigateTab?.('orders')}
          className="bg-white p-5 rounded-2xl border border-amber-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">Đơn chờ duyệt</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-black text-amber-700 tracking-tight">
              {kpis?.pending_approval_orders_count || 0}{' '}
              <span className="text-xs font-semibold text-amber-600">đơn</span>
            </div>
            <div className="text-xs text-amber-800/80 mt-1">Cần Sales duyệt ngay</div>
          </div>
          <div className="mt-3 pt-2 border-t border-amber-100 flex items-center justify-between text-xs text-amber-700 font-medium group-hover:underline">
            <span>Xử lý đơn hàng</span>
            <span>&rarr;</span>
          </div>
        </div>

        {/* KPI 4: Đơn chờ xuất */}
        <div
          onClick={() => onNavigateTab?.('orders')}
          className="bg-white p-5 rounded-2xl border border-sky-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-sky-500"></div>
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-800">Đơn chờ xuất</span>
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-black text-sky-700 tracking-tight">
              {kpis?.pending_export_orders_count || 0}{' '}
              <span className="text-xs font-semibold text-sky-600">đơn</span>
            </div>
            <div className="text-xs text-sky-800/80 mt-1">Kho đang soạn hàng</div>
          </div>
          <div className="mt-3 pt-2 border-t border-sky-100 flex items-center justify-between text-xs text-sky-700 font-medium group-hover:underline">
            <span>Tiến độ giao hàng</span>
            <span>&rarr;</span>
          </div>
        </div>

        {/* KPI 5: Công nợ quá hạn */}
        <div
          onClick={() => onNavigateTab?.('debt-aging')}
          className="bg-white p-5 rounded-2xl border border-red-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500"></div>
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-800">Công nợ quá hạn</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="text-xl font-black text-red-600 tracking-tight">
              {formatCompactVND(kpis?.total_overdue_debt || 0)}
            </div>
            <div className="text-xs text-red-500 mt-0.5 truncate" title={formatVND(kpis?.total_overdue_debt || 0)}>
              {formatVND(kpis?.total_overdue_debt || 0)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-red-100 flex items-center justify-between text-xs text-red-700 font-medium group-hover:underline">
            <span>Xem tuổi nợ</span>
            <span>&rarr;</span>
          </div>
        </div>

        {/* KPI 6: SKU dưới tồn tối thiểu */}
        <div
          onClick={() => onNavigateTab?.('low-stock-alerts')}
          className="bg-white p-5 rounded-2xl border border-purple-200/90 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between cursor-pointer group"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500"></div>
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-800">SKU dưới tồn tối thiểu</span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div className="text-2xl font-black text-purple-700 tracking-tight">
              {kpis?.low_stock_skus_count || 0}{' '}
              <span className="text-xs font-semibold text-purple-600">SKU</span>
            </div>
            <div className="text-xs text-purple-800/80 mt-1">Cần lên kế hoạch nhập</div>
          </div>
          <div className="mt-3 pt-2 border-t border-purple-100 flex items-center justify-between text-xs text-purple-700 font-medium group-hover:underline">
            <span>Cảnh báo tồn kho</span>
            <span>&rarr;</span>
          </div>
        </div>
      </div>

      {/* 3. Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ 1: Doanh số theo ngày trong tháng (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Doanh Số Theo Ngày Trong Tháng
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Diễn biến doanh thu từ ngày 1 đến cuối tháng, rà soát biến động bán hàng hàng ngày
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('sales-report')}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  title="Xem phân tích chi tiết theo Nhân viên, Khu vực, Đại lý, Ngành hàng, SKU"
                >
                  <span>Báo cáo doanh số đa chiều</span>
                  <span>&rarr;</span>
                </button>
              </div>
            </div>
            {dailyChartData && (
              <div className="flex items-center justify-end gap-2 text-xs mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span className="text-gray-600 font-medium">Doanh số ngày</span>
                </div>
                <div className="flex items-center gap-1.5 ml-2">
                  <span className="w-4 h-0.5 border-t-2 border-dashed border-gray-400"></span>
                  <span className="text-gray-500">Trung bình ({formatCompactVND(dailyChartData.avgRev)}/ngày)</span>
                </div>
              </div>
            )}

            {/* SVG Chart Area */}
            <div className="relative w-full h-64 mt-2">
              {dailyChartData && (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 700 220" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 190 - ratio * 160;
                    const val = dailyChartData.maxRev * ratio;
                    return (
                      <g key={idx}>
                        <line x1="40" y1={y} x2="690" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                        <text x="35" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                          {formatCompactVND(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Average Line */}
                  {(() => {
                    const avgY = 190 - (dailyChartData.avgRev / dailyChartData.maxRev) * 160;
                    return (
                      <line
                        x1="40"
                        y1={avgY}
                        x2="690"
                        y2={avgY}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                    );
                  })()}

                  {/* Area fill */}
                  {(() => {
                    const count = dailyChartData.items.length;
                    const step = 650 / (count - 1 || 1);
                    const points = dailyChartData.items.map((item, idx) => {
                      const x = 40 + idx * step;
                      const y = 190 - (item.revenue / dailyChartData.maxRev) * 160;
                      return `${x},${y}`;
                    });
                    const areaPoints = `40,190 ${points.join(' ')} ${40 + (count - 1) * step},190`;
                    return <polygon points={areaPoints} fill="url(#revenueGradient)" />;
                  })()}

                  {/* Trend line */}
                  {(() => {
                    const count = dailyChartData.items.length;
                    const step = 650 / (count - 1 || 1);
                    const linePoints = dailyChartData.items
                      .map((item, idx) => {
                        const x = 40 + idx * step;
                        const y = 190 - (item.revenue / dailyChartData.maxRev) * 160;
                        return `${x},${y}`;
                      })
                      .join(' ');
                    return <polyline fill="none" stroke="#2563eb" strokeWidth="2.5" points={linePoints} />;
                  })()}

                  {/* Data Points & Bars for hover */}
                  {dailyChartData.items.map((item, idx) => {
                    const count = dailyChartData.items.length;
                    const step = 650 / (count - 1 || 1);
                    const x = 40 + idx * step;
                    const y = 190 - (item.revenue / dailyChartData.maxRev) * 160;
                    const isHovered = hoveredDay?.day === item.day;

                    return (
                      <g key={item.day} className="cursor-pointer" onMouseEnter={() => setHoveredDay(item)}>
                        {/* Invisible hover trigger area */}
                        <rect
                          x={x - step / 2}
                          y="10"
                          width={step}
                          height="190"
                          fill="transparent"
                          className="hover:fill-blue-50/20"
                        />
                        {/* Day indicator at bottom */}
                        {item.day % 3 === 1 && (
                          <text x={x} y="210" textAnchor="middle" fontSize="10" fill="#64748b">
                            D{item.day}
                          </text>
                        )}
                        {/* Point Circle */}
                        <circle
                          cx={x}
                          cy={y}
                          r={item.is_today ? 5 : isHovered ? 4.5 : 2.5}
                          fill={item.is_today ? '#10b981' : isHovered ? '#1d4ed8' : '#2563eb'}
                          stroke="#ffffff"
                          strokeWidth="2"
                        />
                        {item.is_today && (
                          <text x={x} y={y - 8} textAnchor="middle" fontSize="10" fontWeight="bold" fill="#059669">
                            Hôm nay
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Tooltip on hover */}
              {hoveredDay && (
                <div
                  className="absolute top-2 right-4 bg-gray-900/95 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none backdrop-blur-xs flex items-center gap-3 animate-in fade-in"
                >
                  <span className="font-semibold">{hoveredDay.date}:</span>
                  <span className="font-bold text-emerald-400">{formatVND(hoveredDay.revenue)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Biểu đồ 2: Cơ cấu doanh số theo khu vực (1 col) */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-4">
              Doanh Số Theo Khu Vực
            </h3>

            <div className="space-y-4">
              {(data?.revenue_by_region || []).map((item) => {
                const color = regionColors[item.region] || {
                  stroke: '#64748b',
                  bg: 'bg-slate-500',
                  text: 'text-slate-700',
                };
                return (
                  <div key={item.region} className="group">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${color.bg}`} />
                        {item.region}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-gray-900 mr-2">{formatCompactVND(item.revenue)}</span>
                        <span className="font-semibold text-gray-500">({item.percentage}%)</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color.bg} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Tổng các vùng</span>
            <strong className="text-gray-800 font-bold">
              {formatVND((data?.revenue_by_region || []).reduce((acc, r) => acc + r.revenue, 0))}
            </strong>
          </div>
        </div>
      </div>

      {/* 4. Top Đại lý Quá hạn công nợ Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-gray-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-gray-900">
                Top Đại Lý Quá Hạn Công Nợ (Ưu Tiên Thu Hồi)
              </h3>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700">
                {(data?.top_overdue_dealers || []).length} đại lý
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab?.('debt-aging')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors self-start sm:self-auto border border-blue-200"
          >
            <span>Mở Báo cáo tuổi nợ chi tiết</span>
            <span>&rarr;</span>
          </button>
        </div>

        {/* Table content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/75 text-xs text-gray-600 uppercase font-semibold border-b border-gray-200">
              <tr>
                <th scope="col" className="px-5 py-3.5 w-12 text-center">#</th>
                <th scope="col" className="px-5 py-3.5">Mã &amp; Tên Đại Lý</th>
                <th scope="col" className="px-5 py-3.5">Số Điện Thoại</th>
                <th scope="col" className="px-5 py-3.5 text-center">Quá Hạn</th>
                <th scope="col" className="px-5 py-3.5 text-right text-red-600">Số Tiền Quá Hạn</th>
                <th scope="col" className="px-5 py-3.5 text-right">Tổng Dư Nợ</th>
                <th scope="col" className="px-5 py-3.5 text-right">Hạn Mức</th>
                <th scope="col" className="px-5 py-3.5 text-center">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(!data?.top_overdue_dealers || data.top_overdue_dealers.length === 0) ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-400">
                    Hiện không có đại lý nào bị quá hạn thanh toán.
                  </td>
                </tr>
              ) : (
                data.top_overdue_dealers.map((dealer: ExecutiveOverdueDealerItem, idx: number) => {
                  return (
                    <tr key={dealer.dealer_id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-4 text-center font-bold text-gray-400">
                        {idx + 1}
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900">{dealer.dealer_name}</div>
                        <div className="text-xs text-gray-400">{dealer.dealer_code}</div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-gray-600">
                        {dealer.phone || '---'}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {getOverdueBadge(dealer.overdue_days)}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-red-600">
                        {formatVND(dealer.overdue_amount)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-gray-800">
                        {formatVND(dealer.total_debt)}
                      </td>
                      <td className="px-5 py-4 text-right text-gray-500">
                        {formatVND(dealer.credit_limit)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => onNavigateTab?.('debt-aging')}
                          className="px-3 py-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
