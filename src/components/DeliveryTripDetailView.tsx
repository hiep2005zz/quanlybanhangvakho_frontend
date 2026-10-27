// frontend/src/components/DeliveryTripDetailView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from '../hooks/useLocation';
import type { DeliveryTripDetail, DeliveryStopDetail, DeliveryStopItemDetail } from '../types/delivery';
import {
  getDeliveryTripDetail,
  updateTripStatus,
  uploadPodImage,
  confirmDeliveryStop,
  recordDeliveryStopFailure,
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
  userName: _userName = '',
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
  const [updatingStopId] = useState<number | null>(null);

  // States phân trang (Pagination) - Mặc định 10 dòng trên 1 trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Reset trang về 1 khi đổi chuyến giao
  useEffect(() => {
    setCurrentPage(1);
  }, [tripId]);

  // Helper lấy chuỗi ngày giờ địa phương cho input datetime-local
  const getNowDateTimeLocal = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // State Modal Xác nhận giao hàng thành công (SCRUM-85)
  const [confirmDeliveryStopModal, setConfirmDeliveryStopModal] = useState<DeliveryStopDetail | null>(null);
  const [receiverNameInput, setReceiverNameInput] = useState<string>('');
  const [actualDeliveryTimeInput, setActualDeliveryTimeInput] = useState<string>('');
  const [podFile, setPodFile] = useState<File | null>(null);
  const [podPreviewUrl, setPodPreviewUrl] = useState<string>('');
  const [confirmItems, setConfirmItems] = useState<DeliveryStopItemDetail[]>([]);
  const [confirmDeliveryNote, setConfirmDeliveryNote] = useState<string>('');
  const [submittingConfirm, setSubmittingConfirm] = useState<boolean>(false);

  // State Modal thất bại điểm giao (SCRUM-85)
  const [failedModalStop, setFailedModalStop] = useState<DeliveryStopDetail | null>(null);
  const [failedReasonSelect, setFailedReasonSelect] = useState<string>('Khách hàng vắng mặt / Không liên lạc được');
  const [failedReasonCustom, setFailedReasonCustom] = useState<string>('');
  const [failedNote, setFailedNote] = useState<string>('');
  const [submittingFailure, setSubmittingFailure] = useState<boolean>(false);

  // State Modal xem ảnh chứng từ POD phóng to (Lightbox)
  const [viewingPodModal, setViewingPodModal] = useState<{
    imageUrl: string;
    dealerName: string;
    orderCode: string;
    receiverName?: string | null;
    deliveredAt?: string | null;
  } | null>(null);

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

  // Mở modal xác nhận giao hàng thành công (SCRUM-85)
  const handleOpenConfirmDeliveryModal = (stop: DeliveryStopDetail) => {
    setConfirmDeliveryStopModal(stop);
    setReceiverNameInput(stop.receiver_name || '');
    if (stop.actual_delivery_time || stop.delivered_at) {
      try {
        const d = new Date(stop.actual_delivery_time || stop.delivered_at || '');
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setActualDeliveryTimeInput(`${year}-${month}-${day}T${hours}:${minutes}`);
      } catch {
        setActualDeliveryTimeInput(getNowDateTimeLocal());
      }
    } else {
      setActualDeliveryTimeInput(getNowDateTimeLocal());
    }

    setPodFile(null);
    setPodPreviewUrl(stop.pod_image_url || '');

    // Nạp chi tiết dòng hàng
    if (stop.items_detail && stop.items_detail.length > 0) {
      setConfirmItems(
        stop.items_detail.map((it) => ({
          ...it,
          delivered_quantity: it.delivered_quantity !== undefined ? it.delivered_quantity : it.quantity,
        }))
      );
    } else {
      setConfirmItems([
        {
          product_code: stop.order_code,
          product_name: `Hàng hóa đơn ${stop.order_code} (${stop.dealer_name})`,
          quantity: 1,
          delivered_quantity: 1,
          unit: 'Kiện / Thùng',
        },
      ]);
    }

    setConfirmDeliveryNote(stop.note || '');
  };

  // Thay đổi số lượng thực giao của 1 dòng
  const handleItemDeliveredQtyChange = (index: number, val: number) => {
    setConfirmItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, delivered_quantity: Math.max(0, val) } : it))
    );
  };

  // Chọn tệp ảnh POD từ máy hoặc chụp ảnh
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        emitStatusToast({
          type: 'error',
          title: 'Định dạng tệp không hợp lệ',
          message: 'Vui lòng chọn ảnh định dạng JPG, PNG hoặc WEBP.',
          durationMs: 3500,
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        emitStatusToast({
          type: 'error',
          title: 'Tệp quá lớn',
          message: 'Kích thước ảnh không được vượt quá 10MB.',
          durationMs: 3500,
        });
        return;
      }
      setPodFile(file);
      const objUrl = URL.createObjectURL(file);
      setPodPreviewUrl(objUrl);
    }
  };

  // Thực thi Xác nhận Giao hàng thành công (SCRUM-85)
  const handleExecuteConfirmDelivery = async () => {
    if (!confirmDeliveryStopModal || !trip) return;

    const receiverName = receiverNameInput.trim();
    if (!receiverName) {
      emitStatusToast({
        type: 'error',
        title: 'Thiếu thông tin người nhận',
        message: 'Vui lòng nhập họ tên người nhận hàng trước khi xác nhận.',
        durationMs: 3500,
      });
      return;
    }

    setSubmittingConfirm(true);
    try {
      let finalPodUrl = podPreviewUrl;

      // Nếu có chọn file mới -> Upload lên server trước
      if (podFile) {
        const uploadRes = await uploadPodImage(token, podFile);
        finalPodUrl = uploadRes.url;
      }

      let actualDeliveryIso: string | undefined = undefined;
      if (actualDeliveryTimeInput) {
        try {
          actualDeliveryIso = new Date(actualDeliveryTimeInput).toISOString();
        } catch {
          actualDeliveryIso = new Date().toISOString();
        }
      }

      const payload = {
        receiver_name: receiverName,
        actual_delivery_time: actualDeliveryIso,
        pod_image_url: finalPodUrl || undefined,
        items_detail: confirmItems,
        note: confirmDeliveryNote.trim() || undefined,
      };

      await confirmDeliveryStop(token, confirmDeliveryStopModal.id, payload);

      // Cập nhật state tức thì
      setTrip((prev) => {
        if (!prev) return null;
        const updatedStops = (prev.stops || []).map((s: DeliveryStopDetail) =>
          s.id === confirmDeliveryStopModal.id
            ? {
                ...s,
                status: 'DELIVERED',
                delivery_status: 'Delivered',
                receiver_name: receiverName,
                actual_delivery_time: actualDeliveryIso,
                delivered_at: actualDeliveryIso,
                pod_image_url: finalPodUrl,
                items_detail: confirmItems,
                failed_reason: null,
                failure_reason: null,
                return_status: null,
                note: confirmDeliveryNote.trim() || s.note,
              }
            : s
        );
        const deliveredCount = updatedStops.filter((s) => s.status === 'DELIVERED').length;
        const remainingCount = updatedStops.length - deliveredCount;
        const remainingVal = updatedStops
          .filter((s) => s.status !== 'DELIVERED')
          .reduce((acc, s) => acc + (s.amount || 0), 0);
        return {
          ...prev,
          status: remainingCount === 0 ? 'COMPLETED' : prev.status,
          delivered_stops: deliveredCount,
          remaining_stops: remainingCount,
          remaining_value: remainingVal,
          stops: updatedStops,
        };
      });

      emitStatusToast({
        type: 'success',
        title: 'Xác nhận giao hàng thành công',
        message: `Đã lưu chứng từ POD cho đại lý ${confirmDeliveryStopModal.dealer_name}. Đơn hàng đã chuyển sang trạng thái ĐÃ GIAO.`,
        durationMs: 4500,
      });

      setConfirmDeliveryStopModal(null);
      fetchTrip(true);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi xác nhận giao hàng',
        message: err.message || 'Không thể xác nhận giao hàng thành công.',
        durationMs: 4000,
      });
    } finally {
      setSubmittingConfirm(false);
    }
  };

  // Mở modal xác nhận báo giao thất bại (SCRUM-85)
  const handlePromptStopFailed = (stop: DeliveryStopDetail) => {
    setFailedModalStop(stop);
    setFailedReasonSelect(stop.failure_reason || stop.failed_reason || 'Khách hàng vắng mặt / Không liên lạc được');
    setFailedReasonCustom('');
    setFailedNote(stop.note || '');
  };

  // Xác nhận báo giao thất bại trong modal (SCRUM-85)
  const handleConfirmStopFailed = async () => {
    if (!failedModalStop || !trip) return;
    setSubmittingFailure(true);
    try {
      const finalReason =
        failedReasonSelect === 'Lý do khác'
          ? (failedReasonCustom.trim() || 'Lý do khác')
          : failedReasonSelect;

      await recordDeliveryStopFailure(token, failedModalStop.id, {
        failure_reason: finalReason,
        note: failedNote.trim() || undefined,
      });

      // Cập nhật state tức thì
      setTrip((prev) => {
        if (!prev) return null;
        const updatedStops = (prev.stops || []).map((s: DeliveryStopDetail) =>
          s.id === failedModalStop.id
            ? {
                ...s,
                status: 'FAILED',
                delivery_status: 'Failed',
                failure_reason: finalReason,
                failed_reason: finalReason,
                return_status: 'CHỜ_HOÀN_KHO',
                note: failedNote.trim() || s.note,
              }
            : s
        );
        return {
          ...prev,
          stops: updatedStops,
        };
      });

      emitStatusToast({
        type: 'info',
        title: 'Ghi nhận giao thất bại',
        message: `Đã ghi nhận lý do cho đại lý ${failedModalStop.dealer_name}. Hàng chuyển sang trạng thái CHỜ HOÀN KHO.`,
        durationMs: 4500,
      });

      setFailedModalStop(null);
      fetchTrip(true);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi ghi nhận thất bại',
        message: err.message || 'Không thể ghi nhận trạng thái giao thất bại.',
        durationMs: 4000,
      });
    } finally {
      setSubmittingFailure(false);
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

  // Tính toán logic Phân trang (Pagination) - Mặc định 10 bản ghi trên 1 trang
  const totalStops = trip?.stops?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalStops / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalStops);

  // Mảng điểm giao hiển thị trên trang hiện tại
  const paginatedStops = useMemo(() => {
    if (!trip?.stops) return [];
    return trip.stops.slice(startIndex, endIndex);
  }, [trip?.stops, startIndex, endIndex]);

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
    <div className="w-full flex-1 overflow-y-auto min-h-screen p-4 md:p-6 bg-slate-50 pb-20 text-slate-800 flex flex-col">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* 1. Thanh tiêu đề đầu trang (Header Bar) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-transparent shrink-0">
          {/* Bên trái: Tiêu đề + Subtitle */}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                {trip ? `Chi tiết chuyến giao ${trip.trip_code}` : 'Đang tải chuyến giao...'}
              </h1>

              {trip && (
                trip.status === 'COMPLETED' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                    Đã hoàn tất
                  </span>
                ) : trip.is_overdue ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                    Quá hạn {trip.overdue_minutes} phút
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    Đang giao hàng
                  </span>
                )
              )}
            </div>

            {trip && (
              <p className="text-xs text-gray-500 mt-1">
                Tài xế: <span className="font-medium text-gray-700">{trip.driver_name || 'Chưa gán tài xế'}{trip.driver_phone ? ` (${trip.driver_phone})` : ''}</span>
                {' • '}Tuyến: <span className="font-medium text-gray-700">{trip.route_name || 'Tuyến mặc định'}</span>
                {' • '}Xe: <span className="font-medium text-gray-700 font-mono">{trip.vehicle_plate || '—'}</span>
                {' • '}Kho xuất: <span className="font-medium text-gray-700">{trip.warehouse_name || 'Kho Tổng Hà Nội'}</span>
              </p>
            )}
          </div>

          {/* Bên phải: Nút phụ "Quay lại" và Nút chính "✓ Hoàn tất toàn bộ chuyến" */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 rounded-lg cursor-pointer border border-gray-300 bg-white shadow-xs transition-colors"
            >
              Quay lại
            </button>

            {trip && trip.status !== 'COMPLETED' && isAuthorizedManager && (
              <button
                type="button"
                onClick={handleOpenCompleteModal}
                disabled={actionLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-lg shadow-sm disabled:opacity-50 cursor-pointer border-0 transition-all flex items-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <span>Hoàn tất toàn bộ chuyến</span>
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
          <>
            {/* 2. Cụm 4 Thẻ KPI Chỉ số (Summary Cards) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Thẻ 1: Tiền hàng còn trên xe */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tiền hàng còn trên xe
                </div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-600 mt-2">
                  {formatVND(trip.remaining_value)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Giá trị hàng chưa giao xong
                </div>
              </div>

              {/* Thẻ 2: Tổng giá trị chuyến */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tổng giá trị chuyến
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-2">
                  {formatVND(trip.total_trip_value)}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Toàn bộ điểm giao
                </div>
              </div>

              {/* Thẻ 3: Tiến độ điểm giao */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Tiến độ điểm giao
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-800 mt-2 flex items-baseline gap-1.5">
                  <span>{trip.delivered_stops}/{trip.total_stops} điểm</span>
                  {trip.remaining_stops > 0 && (
                    <span className="text-xs font-medium text-slate-500">
                      (còn {trip.remaining_stops})
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Tỷ lệ hoàn thành {trip.total_stops > 0 ? `(${Math.round((trip.delivered_stops / trip.total_stops) * 100)}%)` : ''}
                </div>
              </div>

              {/* Thẻ 4: Cảnh báo thời gian */}
              <div className={`rounded-xl border p-4 shadow-sm flex flex-col justify-between ${
                trip.is_overdue ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200'
              }`}>
                <div className={`text-xs font-semibold uppercase tracking-wider ${
                  trip.is_overdue ? 'text-rose-600' : 'text-slate-500'
                }`}>
                  Cảnh báo thời gian
                </div>
                <div className={`text-xl sm:text-2xl font-bold mt-2 ${
                  trip.is_overdue ? 'text-rose-600' : 'text-slate-800'
                }`}>
                  {trip.is_overdue ? `Quá hạn ${trip.overdue_minutes} phút` : 'Đúng tiến độ'}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Thời gian dự kiến: {formatDateTime(trip.estimated_delivery_time)}
                </div>
              </div>
            </div>

            {/* 3. Khối Bảng Dữ Liệu Các Điểm Giao Hàng (Data Table - KHÔNG CÓ BỘ LỌC) */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col w-full">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-3 text-center w-10">STT</th>
                      <th className="py-3 px-3 whitespace-nowrap">MÃ ĐƠN</th>
                      <th className="py-3 px-3">KHÁCH HÀNG / ĐẠI LÝ</th>
                      <th className="py-3 px-3">ĐỊA CHỈ NHẬN HÀNG</th>
                      <th className="py-3 px-3 whitespace-nowrap">NGƯỜI NHẬN & SĐT</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">TIỀN HÀNG</th>
                      <th className="py-3 px-3 whitespace-nowrap">TRẠNG THÁI GIAO</th>
                      <th className="py-3 px-3">GHI CHÚ</th>
                      <th className="py-3 px-3 text-right whitespace-nowrap">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {paginatedStops.map((stop: DeliveryStopDetail, index: number) => {
                      const isDelivered = stop.status === 'DELIVERED';
                      const isFailed = stop.status === 'FAILED';
                      const isUpdating = updatingStopId === stop.id;

                      return (
                        <tr
                          key={stop.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isDelivered ? 'bg-emerald-50/15' : isFailed ? 'bg-rose-50/15' : ''
                          }`}
                        >
                          {/* STT */}
                          <td className="py-3 px-3 text-center font-medium text-slate-500">
                            {startIndex + index + 1}
                          </td>

                          {/* MÃ ĐƠN */}
                          <td className="py-3 px-3 font-mono font-semibold text-blue-600 whitespace-nowrap">
                            {stop.order_code}
                          </td>

                          {/* KHÁCH HÀNG / ĐẠI LÝ */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{stop.dealer_name}</div>
                          </td>

                          {/* ĐỊA CHỈ NHẬN HÀNG */}
                          <td className="py-3 px-3 text-slate-600">
                            <div className="line-clamp-2" title={stop.delivery_point}>
                              {stop.delivery_point}
                            </div>
                          </td>

                          {/* NGƯỜI NHẬN & SĐT */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="font-medium text-slate-800">
                              {stop.receiver_name || 'Khách nhận'}
                            </div>
                            {stop.receiver_phone ? (
                              <div className="text-slate-500 mt-0.5">
                                {stop.receiver_phone}
                              </div>
                            ) : null}
                          </td>

                          {/* TIỀN HÀNG ĐIỂM NÀY */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span
                              className={`font-bold ${
                                isDelivered ? 'text-slate-400 line-through' : 'text-emerald-700'
                              }`}
                            >
                              {formatVND(stop.amount)}
                            </span>
                          </td>

                          {/* TRẠNG THÁI GIAO */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            {isDelivered && (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Đã giao
                                </span>
                                {(stop.actual_delivery_time || stop.delivered_at) && (
                                  <span className="text-[10px] text-slate-400">
                                    {formatDateTime(stop.actual_delivery_time || stop.delivered_at)}
                                  </span>
                                )}
                                {stop.pod_image_url && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewingPodModal({
                                        imageUrl: stop.pod_image_url!,
                                        dealerName: stop.dealer_name,
                                        orderCode: stop.order_code,
                                        receiverName: stop.receiver_name,
                                        deliveredAt: stop.actual_delivery_time || stop.delivered_at,
                                      })
                                    }
                                    className="text-[10px] text-blue-600 hover:text-blue-800 underline font-medium cursor-pointer"
                                  >
                                    Xem ảnh POD
                                  </button>
                                )}
                              </div>
                            )}

                            {isFailed && (
                              <div className="flex flex-col gap-1 items-start">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                                  Thất bại
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-300">
                                  Chờ hoàn kho
                                </span>
                                {(stop.failure_reason || stop.failed_reason) && (
                                  <span
                                    className="text-[10px] text-rose-600 line-clamp-1 max-w-[160px]"
                                    title={(stop.failure_reason || stop.failed_reason) || undefined}
                                  >
                                    {stop.failure_reason || stop.failed_reason}
                                  </span>
                                )}
                              </div>
                            )}

                            {!isDelivered && !isFailed && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Đang trên đường
                              </span>
                            )}
                          </td>

                          {/* GHI CHÚ */}
                          <td className="py-3 px-3 text-slate-500 italic">
                            <div className="max-w-[140px] truncate" title={stop.note || ''}>
                              {stop.note || '—'}
                            </div>
                          </td>

                          {/* THAO TÁC */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {isAuthorizedManager && (
                              <div className="flex items-center justify-end gap-1.5">
                                {!isDelivered && !isFailed && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => handleOpenConfirmDeliveryModal(stop)}
                                      className="px-2.5 py-1.5 rounded-lg bg-[#0fad89] hover:bg-[#0c8a6d] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                                      title="Xác nhận giao thành công (kèm POD)"
                                    >
                                      <span>Giao thành công</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isUpdating}
                                      onClick={() => handlePromptStopFailed(stop)}
                                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                                      title="Giao hàng thất bại"
                                    >
                                      Thất bại
                                    </button>
                                  </>
                                )}

                                {isDelivered && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConfirmDeliveryModal(stop)}
                                    className="px-2.5 py-1 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-medium transition-all cursor-pointer border border-slate-300"
                                    title="Cập nhật lại ảnh POD hoặc thông tin người nhận"
                                  >
                                    Cập nhật POD
                                  </button>
                                )}

                                {isFailed && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConfirmDeliveryModal(stop)}
                                    className="px-2.5 py-1.5 rounded-lg bg-[#0fad89] hover:bg-[#0c8a6d] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                                    title="Giao lại thành công và ký biên bản nhận hàng"
                                  >
                                    Giao lại / Ký POD
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {/* Dòng đệm chân bảng hiển thị thông tin trang */}
                    {totalStops > 0 && (
                      <tr className="bg-slate-50/50 border-t border-slate-100">
                        <td colSpan={9} className="py-2.5 px-4 text-center text-[11px] text-slate-400 select-none">
                          — Trang {safeCurrentPage} / {totalPages} (Hiển thị {totalStops === 0 ? 0 : startIndex + 1} - {endIndex} trong {totalStops} điểm giao) —
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Thanh phân trang Pagination UI Chuẩn Enterprise */}
              {totalStops > 0 && (
                <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shrink-0 select-none">
                  {/* Bên trái: Thông tin tổng kết & Chọn pageSize */}
                  <div className="flex flex-wrap items-center gap-3 text-slate-600">
                    <span>
                      Hiển thị <span className="font-bold text-slate-800">{totalStops === 0 ? 0 : startIndex + 1}</span> -{' '}
                      <span className="font-bold text-slate-800">{endIndex}</span> trong tổng số{' '}
                      <span className="font-bold text-slate-800">{totalStops}</span> điểm giao
                    </span>

                    <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
                      <label htmlFor="select-page-size-trip-detail" className="text-slate-500 whitespace-nowrap">
                        Số dòng:
                      </label>
                      <select
                        id="select-page-size-trip-detail"
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

              {/* Chân bảng (Table Footer): Dòng tóm tắt thông tin */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-600">
                <div className="font-medium">
                  Tổng số: <span className="font-bold text-slate-900">{trip.stops?.length || 0}</span> điểm giao
                  {' • '}Tiền hàng còn lại trên xe: <span className="font-bold text-emerald-700">{formatVND(trip.remaining_value)}</span>
                </div>
                <div className="text-slate-400">
                  Đã hoàn tất: <span className="font-semibold text-emerald-700">{trip.delivered_stops}</span>/{trip.total_stops} điểm
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* III. Modal Xác nhận Giao hàng thành công (SCRUM-85 - POD) */}
      {confirmDeliveryStopModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 flex flex-col max-h-[88vh] overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-start justify-between gap-3 p-5 sm:p-6 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Xác nhận Giao hàng thành công (POD)</h3>
                  <p className="text-xs text-gray-500">
                    Đại lý: <strong className="text-gray-800">{confirmDeliveryStopModal.dealer_name}</strong> • Đơn:{' '}
                    <span className="font-mono text-emerald-700 font-semibold">{confirmDeliveryStopModal.order_code}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDeliveryStopModal(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg text-lg leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form Content */}
            <div className="py-3.5 px-5 sm:px-6 space-y-3.5 text-xs overflow-y-auto flex-1 overscroll-contain">
              {/* 1. Họ tên người nhận & Thời điểm giao thực tế */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Họ tên người nhận hàng <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={receiverNameInput}
                    onChange={(e) => setReceiverNameInput(e.target.value)}
                    placeholder="Nhập họ tên người ký nhận..."
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Thời điểm giao thực tế <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={actualDeliveryTimeInput}
                    onChange={(e) => setActualDeliveryTimeInput(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* 2. Upload ảnh chứng từ POD */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Ảnh biên bản giao nhận có chữ ký (POD)
                </label>

                <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 bg-gray-50/50 flex flex-col items-center justify-center text-center">
                  {podPreviewUrl ? (
                    <div className="relative group w-full flex flex-col items-center">
                      <img
                        src={podPreviewUrl}
                        alt="POD Preview"
                        className="max-h-44 max-w-full rounded-lg object-contain border border-gray-200 shadow-xs"
                      />
                      <div className="flex items-center gap-2.5 mt-2">
                        <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                          Đã đính kèm ảnh biên bản bàn giao
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setPodFile(null);
                            setPodPreviewUrl('');
                          }}
                          className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          Xóa ảnh
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="w-full cursor-pointer py-3 flex flex-col items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <span className="text-xs font-semibold text-gray-700">Chụp ảnh hoặc Chọn tệp ảnh biên bản</span>
                      <span className="text-[10.5px] text-gray-400 mt-0.5">Hỗ trợ JPG, PNG, WEBP (Tối đa 10MB)</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* 3. Chi tiết hàng hóa thực giao rà soát */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700">
                  Rà soát chi tiết hàng hóa thực giao
                </label>
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2">Sản phẩm</th>
                        <th className="p-2 text-center w-20">ĐVT</th>
                        <th className="p-2 text-center w-20">SL Đặt</th>
                        <th className="p-2 text-center w-28">SL Thực giao</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {confirmItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50">
                          <td className="p-2 font-medium text-gray-900">
                            <div>{item.product_name || item.product_code || 'Sản phẩm'}</div>
                            {item.product_code && (
                              <div className="text-[10px] text-gray-400 font-mono">{item.product_code}</div>
                            )}
                          </td>
                          <td className="p-2 text-center text-gray-600">{item.unit || 'Cái'}</td>
                          <td className="p-2 text-center font-semibold text-gray-700">{item.quantity ?? 1}</td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="0"
                              max={item.quantity ?? 999999}
                              value={item.delivered_quantity ?? item.quantity ?? 1}
                              onChange={(e) => handleItemDeliveredQtyChange(idx, parseInt(e.target.value) || 0)}
                              className="w-16 p-1 text-center font-bold border border-gray-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. Ghi chú giao nhận */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ghi chú giao hàng (nếu có)</label>
                <input
                  type="text"
                  value={confirmDeliveryNote}
                  onChange={(e) => setConfirmDeliveryNote(e.target.value)}
                  placeholder="Ví dụ: Đại lý đã nhận đủ và ký biên bản giao nhận..."
                  className="w-full p-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 pt-3 border-t border-gray-100 shrink-0 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setConfirmDeliveryStopModal(null)}
                disabled={submittingConfirm}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer border border-gray-200"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmDelivery}
                disabled={submittingConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-xl transition-all cursor-pointer shadow-sm shadow-emerald-700/20 flex items-center gap-2"
              >
                {submittingConfirm ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang lưu POD...</span>
                  </>
                ) : (
                  <span>Xác nhận hoàn tất</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* IV. Modal Báo giao thất bại (SCRUM-85) */}
      {failedModalStop && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 font-bold text-lg">
                ✕
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Ghi nhận Giao hàng không thành công</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {failedModalStop.dealer_name} • {failedModalStop.order_code}
                </p>
              </div>
            </div>

            <div className="space-y-3 my-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do giao không thành công <span className="text-rose-500">*</span>
                </label>
                <select
                  value={failedReasonSelect}
                  onChange={(e) => setFailedReasonSelect(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="Khách hàng vắng mặt / Không liên lạc được">Khách hàng vắng mặt / Không liên lạc được</option>
                  <option value="Đại lý đóng cửa / Chưa đến giờ mở cửa">Đại lý đóng cửa / Chưa đến giờ mở cửa</option>
                  <option value="Khách hàng từ chối nhận hàng do thay đổi kế hoạch">Khách hàng từ chối nhận hàng do thay đổi kế hoạch</option>
                  <option value="Sai địa chỉ giao hàng / Không tìm thấy điểm giao">Sai địa chỉ giao hàng / Không tìm thấy điểm giao</option>
                  <option value="Khách hàng hẹn giao lại vào thời điểm khác">Khách hàng hẹn giao lại vào thời điểm khác</option>
                  <option value="Hàng hóa bị va đập / Sự cố phương tiện vận chuyển">Hàng hóa bị va đập / Sự cố phương tiện vận chuyển</option>
                  <option value="Lý do khác">Lý do khác (Nhập chi tiết bên dưới)</option>
                </select>
              </div>

              {failedReasonSelect === 'Lý do khác' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Chi tiết lý do</label>
                  <input
                    type="text"
                    value={failedReasonCustom}
                    onChange={(e) => setFailedReasonCustom(e.target.value)}
                    placeholder="Nhập lý do chi tiết..."
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú bổ sung</label>
                <textarea
                  rows={2}
                  value={failedNote}
                  onChange={(e) => setFailedNote(e.target.value)}
                  placeholder="Ví dụ: Đã gọi điện cho đại lý 3 lần nhưng không ai nhấc máy..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              {/* Hộp cảnh báo chuyển chờ hoàn kho */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11.5px] leading-relaxed">
                <strong>📦 Trạng thái Chờ hoàn kho:</strong>
                <br />
                Hàng hóa của điểm giao này sẽ chuyển sang trạng thái <strong>CHỜ HOÀN KHO</strong> và quay về kho theo xe. Hệ thống giữ nguyên tồn kho sổ sách, không gây âm tồn kho.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setFailedModalStop(null)}
                disabled={submittingFailure}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer border border-gray-200"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmStopFailed}
                disabled={submittingFailure}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer shadow-sm shadow-rose-600/30 flex items-center gap-2"
              >
                {submittingFailure ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Xác nhận thất bại</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* V. Modal Phóng to xem ảnh biên bản POD (Lightbox) */}
      {viewingPodModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-slate-900 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-3 sm:p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>Biên bản bàn giao hàng hóa có chữ ký (POD)</span>
                  <span className="text-xs font-mono font-normal text-slate-400">({viewingPodModal.orderCode})</span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Đại lý: <strong className="text-slate-200">{viewingPodModal.dealerName}</strong>
                  {viewingPodModal.receiverName && ` • Người nhận: ${viewingPodModal.receiverName}`}
                  {viewingPodModal.deliveredAt && ` • ${formatDateTime(viewingPodModal.deliveredAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={viewingPodModal.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                  title="Mở ảnh trong tab mới"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={() => setViewingPodModal(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors text-lg leading-none cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40">
              <img
                src={viewingPodModal.imageUrl}
                alt="Biên bản giao hàng POD"
                className="max-h-[70vh] max-w-full rounded-lg object-contain shadow-lg"
              />
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-850 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Chứng từ hợp lệ làm bằng chứng giao hàng (Proof of Delivery)
              </span>
              <button
                type="button"
                onClick={() => setViewingPodModal(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* VI. Modal Xác nhận Hoàn tất toàn bộ chuyến giao hàng (Không dùng window.confirm) */}
      {showCompleteConfirmModal && trip && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
                  <span>Xác nhận hoàn tất</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DeliveryTripDetailView;
