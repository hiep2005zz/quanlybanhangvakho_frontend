// frontend/src/components/DeliveryTripDetailView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from '../hooks/useLocation';
import type { DeliveryTripDetail, DeliveryStopDetail } from '../types/delivery';
import {
  getDeliveryTripDetail,
  updateDeliveryStopStatus,
  updateTripStatus,
} from '../services/deliveryService';
import { emitStatusToast } from './StatusToast';

export interface DeliveryTripDetailViewProps {
  token: string;
  tripId?: string;
  userRole?: string;
  userRoles?: string[];
  userName?: string;
  canManage?: boolean;
  onBack?: () => void;
}

export const DeliveryTripDetailView: React.FC<DeliveryTripDetailViewProps> = ({
  token,
  tripId: propTripId,
  userRole = '',
  userRoles = [],
  userName = '',
  canManage = true,
  onBack,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Xác định tripId từ props hoặc đường dẫn URL (/delivery-tracking/:id)
  const tripId = useMemo(() => {
    if (propTripId) return propTripId;
    const pathname = location.pathname;
    const parts = pathname.split('/').filter(Boolean);
    // Ví dụ: ["delivery-tracking", "1"]
    if (parts.length >= 2 && parts[0] === 'delivery-tracking') {
      return parts[1];
    }
    return '';
  }, [propTripId, location.pathname]);

  const [trip, setTrip] = useState<DeliveryTripDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [updatingStopId, setUpdatingStopId] = useState<number | null>(null);

  // State Modal thất bại điểm giao
  const [failedModalStop, setFailedModalStop] = useState<DeliveryStopDetail | null>(null);
  const [failedReasonInput, setFailedReasonInput] = useState<string>('Khách hàng hẹn giao lại sau');

  // State Modal xác nhận hoàn tất toàn bộ chuyến (thay thế window.confirm)
  const [showCompleteConfirmModal, setShowCompleteConfirmModal] = useState<boolean>(false);

  // Kiểm tra quyền hạn
  const isAuthorizedManager = useMemo(() => {
    const allRoles = [...userRoles, userRole].filter(Boolean);
    return canManage || allRoles.some((r) => ['warehouse_mgr', 'warehouse_manager', 'admin', 'warehouse'].includes(r));
  }, [userRole, userRoles, canManage]);

  // Nạp chi tiết chuyến giao
  const fetchTrip = useCallback(async (quiet = false) => {
    if (!tripId) {
      setError('Mã chuyến giao không hợp lệ.');
      setLoading(false);
      return;
    }

    if (!quiet) setLoading(true);
    setError(null);
    try {
      const data = await getDeliveryTripDetail(token, tripId);
      setTrip(data);
    } catch (err: any) {
      setError(err.message || 'Không thể tải thông tin chi tiết chuyến giao hàng.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [token, tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Điều hướng quay lại
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/delivery-tracking');
    }
  };

  // Xác nhận giao thành công cho 1 điểm
  const handleMarkStopDelivered = async (stopId: number) => {
    if (!trip) return;
    setUpdatingStopId(stopId);
    try {
      const stopToDeliver = trip.stops?.find((s: DeliveryStopDetail) => s.id === stopId);
      await updateDeliveryStopStatus(token, stopId, 'DELIVERED', 'Giao hàng thành công');

      // Cập nhật state tức thì
      setTrip((prev) => {
        if (!prev) return null;
        const updatedStops = (prev.stops || []).map((s: DeliveryStopDetail) =>
          s.id === stopId ? { ...s, status: 'DELIVERED', delivered_at: new Date().toISOString() } : s
        );
        const deliveredCount = updatedStops.filter((s) => s.status === 'DELIVERED').length;
        const remainingCount = updatedStops.length - deliveredCount;
        const remainingVal = updatedStops
          .filter((s) => s.status !== 'DELIVERED')
          .reduce((acc, s) => acc + (s.amount || 0), 0);
        return {
          ...prev,
          delivered_stops: deliveredCount,
          remaining_stops: remainingCount,
          remaining_value: remainingVal,
          stops: updatedStops,
        };
      });

      await fetchTrip(true);

      emitStatusToast({
        type: 'success',
        title: 'Giao hàng thành công',
        message: `Đã xác nhận giao thành công cho đại lý ${stopToDeliver?.dealer_name || stopToDeliver?.order_code || ''}.`,
        durationMs: 3500,
      });
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Cập nhật thất bại',
        message: err.message || 'Không thể cập nhật trạng thái giao hàng.',
        durationMs: 4000,
      });
    } finally {
      setUpdatingStopId(null);
    }
  };

  // Mở modal xác nhận báo giao thất bại
  const handlePromptStopFailed = (stop: DeliveryStopDetail) => {
    setFailedModalStop(stop);
    setFailedReasonInput('Khách hàng hẹn giao lại sau');
  };

  // Xác nhận báo giao thất bại trong modal
  const handleConfirmStopFailed = async () => {
    if (!failedModalStop || !trip) return;
    setUpdatingStopId(failedModalStop.id);
    try {
      await updateDeliveryStopStatus(token, failedModalStop.id, 'FAILED', failedReasonInput.trim());
      await fetchTrip(true);

      emitStatusToast({
        type: 'info',
        title: 'Ghi nhận giao thất bại',
        message: `Đã cập nhật lý do thất bại cho điểm giao ${failedModalStop.dealer_name}. Hàng vẫn trên xe.`,
        durationMs: 3500,
      });
      setFailedModalStop(null);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi cập nhật',
        message: err.message || 'Không thể cập nhật trạng thái thất bại.',
        durationMs: 4000,
      });
    } finally {
      setUpdatingStopId(null);
    }
  };

  // Mở modal xác nhận hoàn tất toàn bộ chuyến (thay thế hoàn toàn window.confirm)
  const handleOpenCompleteModal = () => {
    if (!trip) return;
    setShowCompleteConfirmModal(true);
  };

  // Thực thi hoàn tất toàn bộ chuyến trong modal
  const handleExecuteCompleteTrip = async () => {
    if (!trip) return;
    setShowCompleteConfirmModal(false);
    setActionLoading(true);
    const tripCode = trip.trip_code;
    const nowStr = new Date().toISOString();

    try {
      await updateTripStatus(token, trip.id, 'COMPLETED', 'Hoàn tất chuyến giao hàng');

      // 1. Cập nhật tức thì badge trạng thái sang ĐÃ HOÀN TẤT & tiền trên xe về 0 đ mà không cần F5
      setTrip((prev) => {
        if (!prev) return null;
        const updatedStops = (prev.stops || []).map((s: DeliveryStopDetail) => ({
          ...s,
          status: 'DELIVERED',
          delivered_at: s.delivered_at || nowStr,
        }));
        return {
          ...prev,
          status: 'COMPLETED',
          remaining_value: 0,
          remaining_stops: 0,
          delivered_stops: prev.total_stops,
          is_overdue: false,
          overdue_minutes: 0,
          completed_at: nowStr,
          stops: updatedStops,
        };
      });

      // 2. Đồng bộ dữ liệu chi tiết từ backend
      fetchTrip(true);

      // 3. Kích hoạt Toast thông báo cố định ở góc dưới bên phải
      emitStatusToast({
        type: 'success',
        title: 'Hoàn tất chuyến giao hàng thành công',
        message: `Toàn bộ điểm giao của chuyến hàng ${tripCode} đã được hoàn tất.`,
        durationMs: 3500,
      });
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi hoàn tất chuyến',
        message: err.message || 'Không thể cập nhật hoàn tất chuyến giao hàng.',
        durationMs: 4000,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Định dạng tiền tệ VNĐ
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Định dạng ngày giờ
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

  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-50 pb-20 text-slate-800 flex flex-col">
      {/* I. Thanh tiêu đề đầu trang (Top Header Bar) chuẩn StockAudit layout */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-transparent shrink-0">
        {/* Bên trái: Tiêu đề + Subtitle */}
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {trip ? `Chi tiết chuyến giao ${trip.trip_code}` : 'Đang tải chuyến giao...'}
              </h1>

              {trip && (
                trip.status === 'COMPLETED' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Đã hoàn tất
                  </span>
                ) : trip.is_overdue ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    Quá hạn {trip.overdue_minutes} phút
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Đang giao hàng
                  </span>
                )
              )}
            </div>

            {trip && (
              <p className="text-xs text-gray-500 mt-0.5">
                Tuyến: <span className="font-medium text-gray-700">{trip.route_name || 'Tuyến mặc định'}</span>
                {' • '}Kho xuất: <span className="font-medium text-gray-700">{trip.warehouse_name || 'Kho Tổng Hà Nội'}</span>
                {' • '}Xuất phát: <span className="font-medium text-gray-700">{formatDateTime(trip.dispatched_at)}</span>
              </p>
            )}
          </div>

        {/* Bên phải: Cụm nút hành động chính */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleBack}
            className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-300 bg-white transition-colors"
          >
            Đóng
          </button>

          {trip && trip.status !== 'COMPLETED' && isAuthorizedManager && (
            <button
              type="button"
              onClick={handleOpenCompleteModal}
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-bold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-lg shadow-sm disabled:opacity-50 cursor-pointer border-0 transition-all flex items-center gap-2"
            >
              {actionLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Hoàn tất toàn bộ chuyến</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Loading hoặc Error state */}
      {loading ? (
        <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-[#0fad89] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium">Đang tải chi tiết chuyến giao hàng...</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl border border-rose-200 p-8 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">Không thể tải chuyến giao</h3>
          <p className="text-xs text-slate-500 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => fetchTrip()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer shadow-xs"
          >
            Thử lại
          </button>
        </div>
      ) : trip ? (
        /* II. Bố cục 2 cột nội dung (Two-Column Layout 12 cột) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
          {/* Cột trái (4/12 cột ~ 35%): 1. Thông tin chuyến giao */}
          <div className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col gap-4">
              {/* Header mục */}
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">1. Thông tin chuyến giao</h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {trip.trip_code}
                </span>
              </div>

              {/* Các dòng thông tin dạng nhãn - giá trị */}
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Tài xế:</span>
                  <span className="font-semibold text-gray-900 text-right">
                    {trip.driver_name}{' '}
                    {trip.driver_phone && <span className="text-gray-500 font-normal">({trip.driver_phone})</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Biển số xe:</span>
                  <span className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold border border-slate-200">
                    {trip.vehicle_plate}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Tuyến đường:</span>
                  <span className="font-medium text-gray-800 text-right">{trip.route_name || 'Tuyến mặc định'}</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Kho xuất:</span>
                  <span className="font-medium text-gray-800 text-right">{trip.warehouse_name || 'Kho Tổng Hà Nội'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Xuất kho:</span>
                  <span className="font-medium text-gray-700">{formatDateTime(trip.dispatched_at)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Dự kiến giao:</span>
                  <span className={`font-semibold ${trip.is_overdue ? 'text-rose-600' : 'text-gray-800'}`}>
                    {formatDateTime(trip.estimated_delivery_time)}
                  </span>
                </div>
                {trip.note && (
                  <div className="pt-2 border-t border-gray-100 text-gray-500 italic">
                    Ghi chú: {trip.note}
                  </div>
                )}
              </div>

              {/* 4 Ô chỉ số tóm tắt gọn gàng (Mini KPI Cards) */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* Ô 1: Tiền hàng còn trên xe */}
                <div className="bg-emerald-900 text-white p-3 rounded-xl shadow-xs border border-emerald-800 flex flex-col justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-200">
                    Tiền trên xe
                  </span>
                  <div className="text-sm font-extrabold text-white mt-1">
                    {formatVND(trip.remaining_value)}
                  </div>
                </div>

                {/* Ô 2: Tổng giá trị chuyến */}
                <div className="bg-gray-50 border border-gray-200 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-gray-500">
                    Tổng chuyến
                  </span>
                  <div className="text-sm font-extrabold text-gray-900 mt-1">
                    {formatVND(trip.total_trip_value)}
                  </div>
                </div>

                {/* Ô 3: Tiến độ điểm giao */}
                <div className="bg-blue-50/70 border border-blue-200 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-blue-700">
                    Tiến độ giao
                  </span>
                  <div className="text-sm font-extrabold text-blue-800 mt-1">
                    {trip.delivered_stops} / {trip.total_stops}{' '}
                    <span className="text-[11px] font-medium text-slate-500">
                      {trip.remaining_stops > 0 ? `(còn ${trip.remaining_stops})` : '(Xong)'}
                    </span>
                  </div>
                </div>

                {/* Ô 4: Trạng thái thời gian */}
                <div className={`p-3 rounded-xl border flex flex-col justify-between ${
                  trip.is_overdue ? 'bg-rose-50 border-rose-200' : 'bg-gray-50 border-gray-200'
                }`}>
                  <span className={`text-[10.5px] font-bold uppercase tracking-wider ${
                    trip.is_overdue ? 'text-rose-700' : 'text-gray-500'
                  }`}>
                    {trip.is_overdue ? 'Trễ hạn' : 'Thời gian'}
                  </span>
                  <div className={`text-xs font-bold mt-1 ${trip.is_overdue ? 'text-rose-700' : 'text-gray-800'}`}>
                    {trip.is_overdue ? `Trễ ${trip.overdue_minutes}p` : 'Đúng hạn'}
                  </div>
                </div>
              </div>

              {/* Khối thông tin người giám sát */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs flex flex-col gap-1.5 text-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Người giám sát:</span>
                  <span className="font-semibold text-gray-900">{userName || 'Thủ kho'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Vai trò:</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {userRole || 'Quản lý kho'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải (8/12 cột ~ 65%): 2. Lịch trình & Trạng thái các điểm giao */}
          <div className="lg:col-span-8 flex flex-col bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            {/* Header của bảng lịch trình */}
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-gray-900">2. Lịch trình các điểm giao hàng</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {trip.stops?.length || 0} điểm giao
                </span>
              </div>
              <p className="text-xs text-gray-500 hidden sm:block">
                Xác nhận giao hàng cho từng đại lý theo lộ trình vận chuyển
              </p>
            </div>

            {/* Danh sách các điểm giao có khung cuộn roles-grid-scroll */}
            <div
              className="overflow-y-auto roles-grid-scroll overscroll-contain flex-1"
              style={{
                maxHeight: 'min(520px, calc(100vh - 340px))',
                minHeight: '260px',
              }}
            >
              <div className="divide-y divide-gray-100">
                {trip.stops?.map((stop: DeliveryStopDetail, index: number) => {
                  const isDelivered = stop.status === 'DELIVERED';
                  const isFailed = stop.status === 'FAILED';
                  const isUpdating = updatingStopId === stop.id;

                  return (
                    <div
                      key={stop.id}
                      className={`p-4 md:p-5 transition-colors ${
                        isDelivered
                          ? 'bg-emerald-50/20'
                          : isFailed
                          ? 'bg-rose-50/20'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Cột trái: Thông tin chi tiết điểm giao */}
                        <div className="flex items-start gap-3.5 flex-1">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                              isDelivered
                                ? 'bg-emerald-600 text-white'
                                : isFailed
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {isDelivered ? '✓' : isFailed ? '✕' : index + 1}
                          </div>

                          <div className="space-y-1 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-900 text-sm md:text-base">
                                {stop.dealer_name}
                              </span>
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                                {stop.order_code}
                              </span>
                              {isDelivered && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Đã giao thành công
                                </span>
                              )}
                              {isFailed && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                  Giao thất bại
                                </span>
                              )}
                              {!isDelivered && !isFailed && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                  Đang vận chuyển
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-600 flex items-center gap-1.5">
                              <span className="text-slate-400 font-medium">Địa chỉ:</span>
                              <span>{stop.delivery_point}</span>
                            </div>

                            {(stop.receiver_name || stop.receiver_phone) && (
                              <div className="text-xs text-slate-500">
                                Người nhận:{' '}
                                <span className="font-semibold text-slate-700">
                                  {stop.receiver_name || 'Khách nhận'}
                                </span>{' '}
                                {stop.receiver_phone && `(${stop.receiver_phone})`}
                              </div>
                            )}

                            {stop.delivered_at && (
                              <div className="text-xs text-emerald-700 font-medium">
                                Thời gian giao: {formatDateTime(stop.delivered_at)}
                              </div>
                            )}

                            {isFailed && stop.failed_reason && (
                              <div className="text-xs text-rose-700 font-semibold bg-rose-100/70 p-2 rounded-lg mt-1 border border-rose-200">
                                Lý do thất bại: {stop.failed_reason}
                              </div>
                            )}

                            {stop.note && (
                              <div className="text-xs text-slate-500 italic">
                                Ghi chú: {stop.note}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Cột phải: Tiền hàng & Nút thao tác */}
                        <div className="flex sm:flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                          <div className="text-left lg:text-right">
                            <div className="text-xs text-slate-400">Tiền hàng điểm này:</div>
                            <div
                              className={`text-base md:text-lg font-extrabold ${
                                isDelivered ? 'text-slate-400 line-through' : 'text-emerald-700'
                              }`}
                            >
                              {formatVND(stop.amount)}
                            </div>
                          </div>

                          {isAuthorizedManager && !isDelivered && (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleMarkStopDelivered(stop.id)}
                                className="px-3 py-1.5 rounded-lg bg-[#0fad89] hover:bg-[#0c8a6d] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                title="Xác nhận khách đã nhận đủ và ký nhận"
                              >
                                {isUpdating ? '...' : '✓ Giao thành công'}
                              </button>

                              {!isFailed && (
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handlePromptStopFailed(stop)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                                  title="Báo không giao được hoặc khách hẹn lại"
                                >
                                  ✕ Thất bại
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dòng đệm chân lịch trình */}
              <div className="py-4 px-5 text-center text-xs text-slate-400 bg-slate-50/50 border-t border-slate-100 select-none">
                <div className="flex items-center justify-center gap-2 text-slate-400">
                  <span className="w-8 h-[1px] bg-slate-200 inline-block" />
                  <span>Đã hiển thị toàn bộ {trip.stops?.length || 0} điểm giao hàng</span>
                  <span className="w-8 h-[1px] bg-slate-200 inline-block" />
                </div>
              </div>
            </div>

            {/* Footer chân bảng lịch trình */}
            <div className="p-3.5 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-gray-600 shrink-0">
              <div>
                Tổng số điểm giao: <span className="font-bold text-gray-800">{trip.stops?.length || 0}</span> điểm
                {' • '}Đã hoàn tất: <span className="font-bold text-emerald-700">{trip.delivered_stops}</span> điểm
              </div>
              <div className="text-[11px] text-gray-400">
                Xuất phát lúc {formatDateTime(trip.dispatched_at)}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* III. Modal Báo giao thất bại */}
      {failedModalStop && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 mb-2">Báo giao hàng thất bại</h3>
            <p className="text-xs text-slate-600 mb-4">
              Điểm giao cho <span className="font-semibold text-slate-800">{failedModalStop.dealer_name}</span> ({failedModalStop.order_code}).
              <br />
              <span className="text-rose-600 font-medium">
                * Lưu ý: Hàng hóa vẫn thuộc trách nhiệm chuyến giao, không tự động cộng ngược vào tồn kho khả dụng.
              </span>
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Lý do không giao được</label>
              <select
                value={failedReasonInput}
                onChange={(e) => setFailedReasonInput(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-sm mb-2 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                <option value="Khách hàng hẹn giao lại sau">Khách hàng hẹn giao lại sau</option>
                <option value="Không liên lạc được người nhận">Không liên lạc được người nhận</option>
                <option value="Sai địa chỉ giao hàng">Sai địa chỉ giao hàng</option>
                <option value="Khách từ chối nhận hàng do thay đổi kế hoạch">Khách từ chối nhận hàng do thay đổi kế hoạch</option>
                <option value="Phương tiện gặp sự cố kỹ thuật">Phương tiện gặp sự cố kỹ thuật</option>
                <option value="Lý do khác">Lý do khác</option>
              </select>

              {failedReasonInput === 'Lý do khác' && (
                <input
                  type="text"
                  placeholder="Nhập lý do chi tiết..."
                  onChange={(e) => setFailedReasonInput(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFailedModalStop(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmStopFailed}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-600/30"
              >
                Xác nhận thất bại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IV. Modal Xác nhận Hoàn tất toàn bộ chuyến giao hàng (Không dùng window.confirm) */}
      {showCompleteConfirmModal && trip && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 text-[#0fad89] flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hoàn tất chuyến giao hàng</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{trip.trip_code}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Bạn có chắc chắn muốn xác nhận hoàn tất toàn bộ chuyến giao hàng{' '}
              <strong className="text-slate-900 font-semibold">{trip.trip_code}</strong>?
              <br />
              <span className="text-emerald-700 font-medium block mt-2">
                ✓ Toàn bộ {trip.stops?.length || 0} điểm giao sẽ được ghi nhận đã hoàn thành.
                <br />
                ✓ Tiền hàng còn trên xe sẽ được tất toán về 0 đ.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCompleteConfirmModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-gray-200"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteCompleteTrip}
                disabled={actionLoading}
                className="px-5 py-2 text-xs font-bold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-700/20 flex items-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang hoàn tất...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Xác nhận hoàn tất</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryTripDetailView;
