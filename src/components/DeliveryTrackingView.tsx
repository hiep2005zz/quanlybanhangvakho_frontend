// frontend/src/components/DeliveryTrackingView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '../hooks/useLocation';
import type {
  InTransitSummaryResponse,
  DeliveryTripResponse,
} from '../types/delivery';
import {
  getInTransitSummary,
  getInTransitTrips,
} from '../services/deliveryService';

interface DeliveryTrackingViewProps {
  token: string;
  userRole?: string;
  userRoles?: string[];
  canManage?: boolean;
}

export const DeliveryTrackingView: React.FC<DeliveryTrackingViewProps> = ({
  token,
  userRole = '',
  userRoles = [],
  canManage = true,
}) => {
  const navigate = useNavigate();

  // 1. States cho dữ liệu
  const [summary, setSummary] = useState<InTransitSummaryResponse>({
    total_in_transit_value: 0,
    active_trips_count: 0,
    remaining_stops_count: 0,
    overdue_trips_count: 0,
  });
  const [trips, setTrips] = useState<DeliveryTripResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 2. States cho bộ lọc & tìm kiếm
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_TRANSIT' | 'OVERDUE' | 'COMPLETED'>('IN_TRANSIT');

  // States phân trang (Pagination) - Mặc định 10 bản ghi trên 1 trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset về trang 1 khi thay đổi tìm kiếm hoặc bộ lọc trạng thái
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);



  // Kiểm tra quyền hạn
  const isAuthorizedManager = useMemo(() => {
    const allRoles = [...userRoles, userRole].filter(Boolean);
    return canManage || allRoles.some((r) => ['warehouse_mgr', 'warehouse_manager', 'admin', 'warehouse'].includes(r));
  }, [userRole, userRoles, canManage]);

  // Load KPI và Danh sách chuyến
  const fetchData = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);
        setError(null);

        // Fetch KPI tổng hợp
        const summaryPromise = getInTransitSummary(token);

        // Fetch danh sách chuyến theo filter
        let queryParams: { status?: string; search?: string; is_overdue?: boolean } = {};
        if (statusFilter === 'OVERDUE') {
          queryParams = { is_overdue: true, search: searchQuery };
        } else if (statusFilter === 'ALL') {
          queryParams = { status: 'ALL', search: searchQuery };
        } else if (statusFilter === 'COMPLETED') {
          queryParams = { status: 'COMPLETED', search: searchQuery };
        } else {
          queryParams = { status: 'IN_TRANSIT', search: searchQuery };
        }

        const tripsPromise = getInTransitTrips(token, queryParams);

        const [summaryData, tripsData] = await Promise.all([summaryPromise, tripsPromise]);
        setSummary(summaryData);
        setTrips(tripsData);
      } catch (err: any) {
        console.error('Lỗi khi tải dữ liệu chuyến giao hàng:', err);
        setError(err.message || 'Không thể tải dữ liệu theo dõi giao hàng.');
      } finally {
        setLoading(false);
      }
    },
    [token, statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);



  // Định dạng tiền tệ VNĐ
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Định dạng ngày giờ thân thiện
  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Tính toán logic Phân trang (Pagination) - Mặc định 10 dòng / trang
  const totalTrips = trips.length;
  const totalPages = Math.max(1, Math.ceil(totalTrips / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalTrips);

  // Mảng chuyến giao hiển thị trên trang hiện tại
  const paginatedTrips = useMemo(() => {
    return trips.slice(startIndex, endIndex);
  }, [trips, startIndex, endIndex]);

  // Danh sách các số trang hiển thị (hỗ trợ ellipsis nếu > 7 trang)
  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [1];
    if (safeCurrentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (safeCurrentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  }, [totalPages, safeCurrentPage]);

  return (
    <div className="w-full flex-1 flex flex-col p-4 md:p-6 bg-slate-50 pb-16 text-slate-800">
      {/* 1. Header Trang & Thao tác */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Theo dõi hàng đang giao</h1>
        </div>

        {isAuthorizedManager && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/delivery-tracking/create')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0faf8a] hover:bg-[#0c9877] active:bg-[#0a8568] text-white text-sm font-semibold shadow-sm shadow-[#0faf8a]/30 active:scale-95 transition-all cursor-pointer"
              style={{ backgroundColor: '#0faf8a' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Xuất chuyến giao mới</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Thẻ chỉ số tổng quan (4 KPI Cards / Summary Widgets - Compact) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
        {/* Card 1: Tổng tiền hàng trên đường */}
        <div className="bg-white rounded-xl px-4 py-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Tiền hàng trên đường
          </span>
          <div className="text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900">
            {formatVND(summary.total_in_transit_value)}
          </div>
        </div>

        {/* Card 2: Số chuyến đang chạy */}
        <div className="bg-white rounded-xl px-4 py-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Chuyến đang chạy
          </span>
          <div className="text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900">
            {summary.active_trips_count}{' '}
            <span className="text-sm font-medium text-slate-500">chuyến</span>
          </div>
        </div>

        {/* Card 3: Số điểm giao còn lại */}
        <div className="bg-white rounded-xl px-4 py-3.5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
            Điểm giao còn lại
          </span>
          <div className="text-xl lg:text-2xl font-extrabold tracking-tight text-slate-900">
            {summary.remaining_stops_count}{' '}
            <span className="text-sm font-medium text-slate-500">điểm</span>
          </div>
        </div>

        {/* Card 4: Cảnh báo chuyến trễ hạn */}
        <div
          className={`rounded-xl px-4 py-3.5 border shadow-xs flex flex-col justify-between ${
            summary.overdue_trips_count > 0
              ? 'bg-rose-50 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <span
            className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${
              summary.overdue_trips_count > 0 ? 'text-rose-700' : 'text-slate-500'
            }`}
          >
            Cảnh báo trễ hạn
          </span>
          <div
            className={`text-xl lg:text-2xl font-extrabold tracking-tight ${
              summary.overdue_trips_count > 0 ? 'text-rose-600' : 'text-slate-900'
            }`}
          >
            {summary.overdue_trips_count}{' '}
            <span className="text-sm font-medium text-slate-500">chuyến quá giờ</span>
          </div>
        </div>
      </div>

      {/* 3. Bảng điều khiển bộ lọc & Tìm kiếm */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs mb-6 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Tabs Trạng thái */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold w-full md:w-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('IN_TRANSIT')}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'IN_TRANSIT'
                  ? 'bg-white text-emerald-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đang giao ({summary.active_trips_count})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OVERDUE')}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'text-rose-600 hover:text-rose-700'
              }`}
            >
              Quá hạn ({summary.overdue_trips_count})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('COMPLETED')}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'COMPLETED'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã hoàn tất
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-800 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Ô tìm kiếm */}
          <div className="w-full md:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã chuyến, tài xế, xe, tuyến..."
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* 4. Bảng danh sách chuyến giao hàng (Cuộn ngang nếu tràn) */}
        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm">Đang tải danh sách chuyến giao hàng...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-600 flex flex-col items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm font-semibold">{error}</p>
              <button
                type="button"
                onClick={() => fetchData(true)}
                className="mt-2 text-xs text-emerald-600 hover:underline font-bold cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          ) : trips.length === 0 ? (
            <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13" rx="1" />
                  <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                  <circle cx="5.5" cy="18.5" r="2.5" />
                  <circle cx="18.5" cy="18.5" r="2.5" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Không tìm thấy chuyến giao hàng nào phù hợp</p>
              <p className="text-xs text-slate-400">Thử thay đổi bộ lọc hoặc tạo chuyến giao mới.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50 shadow-2xs">
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4 bg-slate-50">Mã chuyến & Trạng thái</th>
                  <th className="py-3 px-4 bg-slate-50">Tài xế / Xe</th>
                  <th className="py-3 px-4 bg-slate-50">Tuyến đường</th>
                  <th className="py-3 px-4 bg-slate-50">Thời gian</th>
                  <th className="py-3 px-4 bg-slate-50">Tiến độ điểm giao</th>
                  <th className="py-3 px-4 bg-slate-50">Tiền hàng trên xe</th>
                  <th className="py-3 px-4 bg-slate-50 text-right whitespace-nowrap w-[135px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedTrips.map((trip) => {
                  const percentDelivered =
                    trip.total_stops > 0 ? Math.round((trip.delivered_stops / trip.total_stops) * 100) : 0;

                  return (
                    <tr
                      key={trip.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/delivery-tracking/${trip.id}`)}
                    >
                      {/* Mã chuyến & Badge */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex flex-col gap-1.5 items-start">
                          <span className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                            {trip.trip_code}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {trip.status === 'COMPLETED' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                Đã hoàn thành
                              </span>
                            ) : trip.is_overdue ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                Quá hạn {trip.overdue_minutes} phút
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                Đang giao hàng
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Tài xế & Biển số xe */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-semibold text-slate-900">{trip.driver_name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-medium border border-slate-200">
                            {trip.vehicle_plate}
                          </span>
                          {trip.driver_phone && <span>- {trip.driver_phone}</span>}
                        </div>
                      </td>

                      {/* Tuyến đường & Kho xuất */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-medium text-slate-800 line-clamp-1">{trip.route_name || 'Tuyến mặc định'}</div>
                        <div className="text-xs text-slate-400">{trip.warehouse_name || 'Kho Tổng Hà Nội'}</div>
                      </td>

                      {/* Thời gian xuất kho & Dự kiến */}
                      <td className="py-4 px-4 align-top">
                        <div className="text-xs text-slate-600">
                          <span className="text-slate-400">Xuất:</span> {formatDateTime(trip.dispatched_at)}
                        </div>
                        <div
                          className={`text-xs font-medium ${
                            trip.is_overdue ? 'text-rose-600 font-bold' : 'text-slate-700'
                          }`}
                        >
                          <span className="text-slate-400">Dự kiến:</span> {formatDateTime(trip.estimated_delivery_time)}
                        </div>
                      </td>

                      {/* Tiến độ điểm giao */}
                      <td className="py-4 px-4 align-top min-w-[180px]">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-800">
                            {trip.delivered_stops}/{trip.total_stops} điểm giao
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            {trip.remaining_stops > 0 ? `Còn lại ${trip.remaining_stops}` : 'Hoàn tất'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className={`h-full ${
                              trip.status === 'COMPLETED'
                                ? 'bg-slate-400'
                                : trip.is_overdue
                                ? 'bg-rose-500'
                                : 'bg-emerald-600'
                            }`}
                            style={{ width: `${percentDelivered}%` }}
                          />
                        </div>
                      </td>

                      {/* Tiền hàng trên xe */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-extrabold text-emerald-700 text-sm">
                          {formatVND(trip.remaining_value)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Tổng chuyến: {formatVND(trip.total_trip_value)}
                        </div>
                      </td>

                      {/* Nút Thao tác */}
                      <td className="py-4 px-4 align-top text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => navigate(`/delivery-tracking/${trip.id}`)}
                          className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer border border-emerald-200 shadow-2xs whitespace-nowrap shrink-0"
                        >
                          <span>Xem chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {/* Dòng đệm chân bảng giúp chuyến giao cuối cùng luôn hiển thị trọn vẹn 100% */}
                {totalTrips > 0 && (
                  <tr className="bg-slate-50/50 border-t border-slate-100">
                    <td colSpan={7} className="py-3 px-4 text-center text-xs text-slate-400 font-medium select-none">
                      <div className="flex items-center justify-center gap-2 text-slate-400">
                        <span className="w-8 h-[1px] bg-slate-200 inline-block" />
                        <span>— Trang {safeCurrentPage} / {totalPages} (Hiển thị {totalTrips === 0 ? 0 : startIndex + 1} - {endIndex} trong {totalTrips} chuyến giao hàng) —</span>
                        <span className="w-8 h-[1px] bg-slate-200 inline-block" />
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer phân trang Pagination UI Chuẩn Enterprise */}
        {!loading && totalTrips > 0 && (
          <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shrink-0 select-none">
            {/* Bên trái: Thông tin tổng kết & Chọn pageSize */}
            <div className="flex flex-wrap items-center gap-3 text-slate-600">
              <span>
                Hiển thị <span className="font-bold text-slate-800">{totalTrips === 0 ? 0 : startIndex + 1}</span> -{' '}
                <span className="font-bold text-slate-800">{endIndex}</span> trong tổng số{' '}
                <span className="font-bold text-slate-800">{totalTrips}</span> chuyến giao hàng
              </span>

              <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                <label htmlFor="select-page-size-tracking" className="text-slate-500 whitespace-nowrap">
                  Số dòng:
                </label>
                <select
                  id="select-page-size-tracking"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer shadow-2xs"
                >
                  <option value={10}>10 / trang</option>
                  <option value={20}>20 / trang</option>
                  <option value={50}>50 / trang</option>
                </select>
              </div>
            </div>

            {/* Bên phải: Nút chuyển trang (Trước, 1, 2, 3..., Sau) */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                ‹ Trước
              </button>

              {paginationPages.map((page, pIdx) => {
                if (page === '...') {
                  return (
                    <span key={`dots-${pIdx}`} className="px-1.5 py-1 text-xs text-slate-400 select-none">
                      ...
                    </span>
                  );
                }
                const isCurrent = page === safeCurrentPage;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(Number(page))}
                    className={`min-w-[28px] h-7 px-1.5 flex items-center justify-center text-xs rounded-md transition-all border ${
                      isCurrent
                        ? 'bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs cursor-default'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 font-medium cursor-pointer'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Sau ›
              </button>
            </div>
          </div>
        )}
      </div>


    </div>
  );
};

export default DeliveryTrackingView;
