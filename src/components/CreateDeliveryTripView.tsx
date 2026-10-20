// frontend/src/components/CreateDeliveryTripView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from '../hooks/useLocation';
import type { ReadyOrderForDelivery, DeliveryTripCreate } from '../types/delivery';
import { getOrdersReadyForDelivery, createDeliveryTrip } from '../services/deliveryService';
import { emitStatusToast } from './StatusToast';

export interface CreateDeliveryTripViewProps {
  token: string;
  userRole?: string;
  userRoles?: string[];
  userName?: string;
  canManage?: boolean;
  onBack?: () => void;
}

// Regex chuẩn đầu số di động Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)
const VIETNAM_PHONE_REGEX = /^(03|05|07|08|09)\d{8}$/;

export const CreateDeliveryTripView: React.FC<CreateDeliveryTripViewProps> = ({
  token,
  userRole = '',
  userRoles = [],
  userName = '',
  canManage = true,
  onBack,
}) => {
  const navigate = useNavigate();

  // 1. Form fields state
  const [driverName, setDriverName] = useState<string>('');
  const [driverPhone, setDriverPhone] = useState<string>('');
  const [vehiclePlate, setVehiclePlate] = useState<string>('');
  const [routeName, setRouteName] = useState<string>('Tuyến giao nội thành');
  const [estDeliveryTime, setEstDeliveryTime] = useState<string>(() => {
    const d = new Date(Date.now() + 4 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [note, setNote] = useState<string>('');
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  // 2. Data loading & errors state
  const [readyOrders, setReadyOrders] = useState<ReadyOrderForDelivery[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [orderSearchTerm, setOrderSearchTerm] = useState<string>('');

  // Kiểm tra quyền hạn
  const isAuthorizedManager = useMemo(() => {
    const allRoles = [...userRoles, userRole].filter(Boolean);
    return canManage || allRoles.some((r) => ['warehouse_mgr', 'warehouse_manager', 'admin', 'warehouse'].includes(r));
  }, [userRole, userRoles, canManage]);

  // Nạp danh sách đơn hàng sẵn sàng xuất chuyến
  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    setFetchError(null);
    try {
      const orders = await getOrdersReadyForDelivery(token);
      setReadyOrders(orders);
    } catch (err: any) {
      setFetchError(err.message || 'Không thể tải danh sách đơn hàng sẵn sàng xuất chuyến.');
    } finally {
      setLoadingOrders(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Điều hướng quay lại
  const handleBack = () => {
    if (onBack) {
      onBack();
    }
    navigate('/delivery-tracking');
  };

  // Lọc đơn hàng theo từ khóa tìm kiếm
  const filteredOrders = useMemo(() => {
    if (!orderSearchTerm.trim()) return readyOrders;
    const term = orderSearchTerm.trim().toLowerCase();
    return readyOrders.filter(
      (o) =>
        o.order_code.toLowerCase().includes(term) ||
        (o.dealer_name && o.dealer_name.toLowerCase().includes(term)) ||
        (o.delivery_point && o.delivery_point.toLowerCase().includes(term))
    );
  }, [readyOrders, orderSearchTerm]);

  // Danh sách các đơn đã chọn (tính toán reactive)
  const selectedOrders = useMemo(() => {
    const selectedSet = new Set(selectedOrderIds);
    return readyOrders.filter((o) => selectedSet.has(o.id));
  }, [readyOrders, selectedOrderIds]);

  const totalSelectedAmount = useMemo(() => {
    const selectedSet = new Set(selectedOrderIds);
    return readyOrders
      .filter((o) => selectedSet.has(o.id))
      .reduce((sum, o) => sum + (o.amount || 0), 0);
  }, [readyOrders, selectedOrderIds]);

  // Khóa nút Xác nhận xuất chuyến khi chưa chọn ít nhất 1 đơn hàng
  const isSubmitDisabled = submitting || !isAuthorizedManager || selectedOrderIds.length === 0;

  // Toggle chọn từng đơn
  const handleToggleOrder = (orderId: number) => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
    if (fieldErrors.orders) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.orders;
        return next;
      });
    }
  };

  // Chọn hoặc bỏ chọn tất cả đơn đang hiển thị
  const handleToggleSelectAll = () => {
    const filteredIds = filteredOrders.map((o) => o.id);
    const isAllFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedOrderIds.includes(id));

    if (isAllFilteredSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
      if (fieldErrors.orders) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.orders;
          return next;
        });
      }
    }
  };

  // Format tiền tệ VNĐ
  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  // Xử lý nhập số điện thoại: Chỉ cho phép ký tự số và tối đa 10 ký tự
  const handleDriverPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 10);
    setDriverPhone(digitsOnly);

    if (fieldErrors.driverPhone) {
      if (!digitsOnly || VIETNAM_PHONE_REGEX.test(digitsOnly)) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next.driverPhone;
          return next;
        });
      }
    }
  };

  // Chặn phím không phải ký tự số ngay khi gõ
  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key) ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  // Kiểm tra tính hợp lệ khi rời khỏi ô nhập liệu (onBlur)
  const handlePhoneBlur = () => {
    const trimmed = driverPhone.trim();
    if (trimmed && !VIETNAM_PHONE_REGEX.test(trimmed)) {
      setFieldErrors((prev) => ({
        ...prev,
        driverPhone: 'Số điện thoại không hợp lệ (yêu cầu 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)',
      }));
    }
  };

  // Submit form tạo chuyến
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const errors: Record<string, string> = {};
    if (!driverName.trim()) {
      errors.driverName = 'Vui lòng nhập họ tên tài xế phụ trách.';
    }
    if (!vehiclePlate.trim()) {
      errors.vehiclePlate = 'Vui lòng nhập biển số phương tiện giao hàng.';
    }
    if (!estDeliveryTime) {
      errors.estDeliveryTime = 'Vui lòng chọn thời gian dự kiến hoàn tất giao hàng.';
    }
    if (driverPhone.trim() && !VIETNAM_PHONE_REGEX.test(driverPhone.trim())) {
      errors.driverPhone = 'Số điện thoại không hợp lệ (yêu cầu 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)';
    }
    if (selectedOrderIds.length === 0) {
      errors.orders = 'Vui lòng chọn ít nhất 1 đơn hàng để gắn vào chuyến giao này.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      emitStatusToast({
        type: 'warning',
        title: 'Chưa đủ thông tin',
        message: 'Vui lòng kiểm tra lại các trường thông tin bắt buộc và danh sách đơn hàng đã chọn.',
      });
      return;
    }

    const stopsPayload = selectedOrders.map((o) => ({
      order_id: o.id,
      order_code: o.order_code,
      dealer_id: o.dealer_id,
      dealer_name: o.dealer_name,
      delivery_point: o.delivery_point || 'Điểm giao đại lý',
      amount: o.amount || 0,
    }));

    const payload: DeliveryTripCreate = {
      driver_name: driverName.trim(),
      driver_phone: driverPhone.trim() || undefined,
      vehicle_plate: vehiclePlate.trim().toUpperCase(),
      route_name: routeName.trim() || 'Tuyến giao nội thành',
      estimated_delivery_time: new Date(estDeliveryTime).toISOString(),
      note: note.trim() || undefined,
      stops: stopsPayload,
    };

    setSubmitting(true);
    try {
      const newTrip = await createDeliveryTrip(token, payload);
      emitStatusToast({
        type: 'success',
        title: 'Xuất chuyến thành công',
        message: `Chuyến giao ${newTrip.trip_code} với ${stopsPayload.length} điểm giao đã được khởi tạo.`,
      });
      navigate(`/delivery-tracking/${newTrip.id}`);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi khi xuất chuyến',
        message: err.message || 'Không thể tạo chuyến giao hàng mới. Vui lòng thử lại.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isAllFilteredSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.includes(o.id));

  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto p-4 md:p-6 bg-slate-50 pb-20 text-slate-800 flex flex-col">
      <div className="flex flex-col gap-5 max-w-7xl mx-auto w-full">
        {/* 1. Thanh tiêu đề đầu trang (Top Header Bar) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-transparent shrink-0">
          {/* Bên trái: Tiêu đề + Dòng mô tả nhỏ */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Tạo chuyến giao hàng mới
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Gán tài xế, phương tiện và chọn các đơn hàng đã xuất kho cần vận chuyển
            </p>
          </div>

          {/* Bên phải: Nút phụ "Hủy bỏ" & Nút chính "✓ Xác nhận xuất chuyến" */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleBack}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-300 bg-white transition-colors disabled:opacity-50"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitDisabled}
              title={
                !isAuthorizedManager
                  ? 'Chỉ quản lý kho hoặc thủ kho mới có quyền xuất chuyến'
                  : selectedOrderIds.length === 0
                  ? 'Vui lòng chọn ít nhất 1 đơn hàng để xuất chuyến'
                  : undefined
              }
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 border-0 ${
                isSubmitDisabled
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-75'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer'
              }`}
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang xuất chuyến...</span>
                </>
              ) : (
                <span>Xác nhận xuất chuyến</span>
              )}
            </button>
          </div>
        </div>

        {/* 2. Gộp thành 1 Khung Thẻ Duy Nhất (Single Card Layout) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6 w-full max-w-7xl mx-auto">
          {/* Phần 1: Thông tin chuyến & Vận chuyển (Ở trên) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Thông tin chuyến & Vận chuyển
              </h3>
              <span className="text-xs text-slate-400">Các trường có dấu (<span className="text-rose-500 font-bold">*</span>) là bắt buộc</span>
            </div>

            {/* Hàng 1: Tài xế, SĐT, Biển số xe, Tuyến đường */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Tên tài xế phụ trách */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tên tài xế phụ trách <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => {
                    setDriverName(e.target.value);
                    if (fieldErrors.driverName) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.driverName;
                        return next;
                      });
                    }
                  }}
                  placeholder="VD: Nguyễn Văn Tuấn"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white transition-all ${
                    fieldErrors.driverName ? 'border-rose-400 bg-rose-50/20' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.driverName && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.driverName}</p>
                )}
              </div>

              {/* Số điện thoại tài xế */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Số điện thoại tài xế
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={driverPhone}
                  onChange={handleDriverPhoneChange}
                  onKeyDown={handlePhoneKeyDown}
                  onBlur={handlePhoneBlur}
                  placeholder="VD: 0981234567 (10 chữ số)"
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white transition-all ${
                    fieldErrors.driverPhone ? 'border-rose-400 bg-rose-50/20' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.driverPhone && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.driverPhone}</p>
                )}
              </div>

              {/* Biển số xe giao hàng */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Biển số xe giao hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => {
                    setVehiclePlate(e.target.value.toUpperCase());
                    if (fieldErrors.vehiclePlate) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.vehiclePlate;
                        return next;
                      });
                    }
                  }}
                  placeholder="VD: 29C-889.12"
                  className={`w-full px-3 py-2 text-xs font-mono uppercase border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white transition-all ${
                    fieldErrors.vehiclePlate ? 'border-rose-400 bg-rose-50/20' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.vehiclePlate && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.vehiclePlate}</p>
                )}
              </div>

              {/* Tuyến đường vận chuyển */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tuyến đường vận chuyển
                </label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="VD: Tuyến Cầu Giấy - Ba Đình - Đống Đa"
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white transition-all"
                />
              </div>
            </div>

            {/* Hàng 2: Thời gian dự kiến, Ghi chú, Metadata người tạo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs pt-1">
              {/* Thời gian dự kiến hoàn tất */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Thời gian dự kiến hoàn tất <span className="text-rose-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={estDeliveryTime}
                  onChange={(e) => {
                    setEstDeliveryTime(e.target.value);
                    if (fieldErrors.estDeliveryTime) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.estDeliveryTime;
                        return next;
                      });
                    }
                  }}
                  className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white transition-all ${
                    fieldErrors.estDeliveryTime ? 'border-rose-400 bg-rose-50/20' : 'border-gray-300'
                  }`}
                />
                {fieldErrors.estDeliveryTime && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">{fieldErrors.estDeliveryTime}</p>
                )}
              </div>

              {/* Ghi chú chuyến (span 2 cột trên lg) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Ghi chú chuyến giao
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm về hàng dễ vỡ, thời gian giao đặc biệt..."
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white transition-all"
                />
              </div>

              {/* Khối metadata người tạo phiếu */}
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-col justify-between gap-1 text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Người tạo:</span>
                  <span className="font-semibold text-slate-800">{userName || 'Thủ kho'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Vai trò:</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 text-[11px]">
                    {userRole || 'Quản lý kho'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Thời điểm:</span>
                  <span className="font-medium text-slate-700 text-[11px]">
                    {new Date().toLocaleTimeString('vi-VN')} {new Date().toLocaleDateString('vi-VN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Cảnh báo nếu chưa chọn đơn khi submit */}
            {fieldErrors.orders && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                ⚠️ {fieldErrors.orders}
              </div>
            )}
          </div>

          {/* Đường kẻ phân cách */}
          <div className="border-t border-slate-200" />

          {/* Phần 2: Danh sách đơn hàng cần giao (Ở dưới) */}
          <div className="space-y-4">
            {/* Header mục 2 & Ô tìm kiếm nhanh */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  2. Danh sách đơn hàng cần giao
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {filteredOrders.length} đơn hàng
                </span>
              </div>

              {/* Ô tìm kiếm nhanh & Chọn tất cả */}
              <div className="flex items-center gap-2.5">
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Lọc mã đơn, khách, địa chỉ..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white transition-all shadow-xs placeholder:text-gray-400"
                  />
                </div>

                {filteredOrders.length > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-lg border border-gray-300 transition-colors whitespace-nowrap cursor-pointer shadow-2xs"
                  >
                    {isAllFilteredSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                  </button>
                )}
              </div>
            </div>

            {/* Bảng danh sách đơn hàng xuất kho */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div
                className="overflow-x-auto overflow-y-auto roles-grid-scroll overscroll-contain"
                style={{
                  maxHeight: 'min(480px, calc(100vh - 420px))',
                  minHeight: '260px',
                }}
              >
                {loadingOrders ? (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                    <div className="w-7 h-7 border-3 border-[#0fad89] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-xs font-medium">Đang tải danh sách đơn hàng đã xuất kho...</p>
                  </div>
                ) : fetchError ? (
                  <div className="py-12 text-center text-rose-600 p-4">
                    <p className="text-xs font-semibold">{fetchError}</p>
                    <button
                      type="button"
                      onClick={fetchOrders}
                      className="mt-2 text-xs text-[#0fad89] hover:underline font-bold"
                    >
                      Thử lại
                    </button>
                  </div>
                ) : readyOrders.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 p-4 flex flex-col items-center justify-center gap-2">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="3" width="15" height="13" rx="1" />
                        <polygon points="16 8 20 8 23 11 23 16 16 16 8" />
                        <circle cx="5.5" cy="18.5" r="2.5" />
                        <circle cx="18.5" cy="18.5" r="2.5" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">Hiện không có đơn hàng nào chờ xuất chuyến</p>
                    <p className="text-xs text-slate-400">
                      Đơn hàng cần được xác nhận xuất kho (<span className="font-mono">EXPORTED</span>) trước khi có thể gán vào chuyến giao.
                    </p>
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 p-4">
                    <p className="text-xs font-medium">Không tìm thấy đơn hàng nào phù hợp với từ khóa tìm kiếm.</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
                      <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <th className="py-3 px-3.5 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={isAllFilteredSelected}
                            onChange={handleToggleSelectAll}
                            className="w-4 h-4 rounded text-[#0fad89] focus:ring-[#0fad89] cursor-pointer"
                            title="Chọn/Bỏ chọn tất cả"
                          />
                        </th>
                        <th className="py-3 px-3.5 w-12 text-center">STT</th>
                        <th className="py-3 px-3.5">MÃ ĐƠN HÀNG</th>
                        <th className="py-3 px-3.5">KHÁCH HÀNG / ĐẠI LÝ</th>
                        <th className="py-3 px-3.5 min-w-[200px]">ĐỊA CHỈ NHẬN HÀNG</th>
                        <th className="py-3 px-3.5 text-right pr-4 sm:pr-6 min-w-[140px]">TIỀN HÀNG</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredOrders.map((order, idx) => {
                        const isSelected = selectedOrderIds.includes(order.id);

                        return (
                          <tr
                            key={order.id}
                            onClick={() => handleToggleOrder(order.id)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50/40 hover:bg-emerald-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleOrder(order.id)}
                                className="w-4 h-4 rounded text-[#0fad89] focus:ring-[#0fad89] cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3.5 text-center text-slate-400 font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3.5">
                              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                {order.order_code}
                              </span>
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-800">{order.dealer_name || 'Khách lẻ / Chưa gán'}</div>
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="text-slate-600 line-clamp-1" title={order.delivery_point || ''}>
                                {order.delivery_point || 'Điểm nhận hàng đại lý'}
                              </div>
                            </td>
                            <td className="py-3 px-3.5 text-right pr-4 sm:pr-6 whitespace-nowrap">
                              <div className="font-bold text-emerald-700">
                                {formatVND(order.amount || 0)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Dòng đệm chân bảng */}
                      <tr className="bg-slate-50/50 border-t border-slate-100">
                        <td colSpan={6} className="py-3 px-4 text-center text-[11px] text-slate-400 select-none">
                          — Đã hiển thị toàn bộ {filteredOrders.length} đơn hàng sẵn sàng xuất chuyến —
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              {/* Dưới đáy bảng: Thống kê số đơn đã chọn và tổng tiền hàng tạm tính */}
              <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Đã chọn:</span>
                  <span className="font-bold px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {selectedOrderIds.length} / {readyOrders.length} đơn hàng
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-700 font-medium">Tổng tiền hàng tạm tính:</span>
                  <span className="text-emerald-700 font-extrabold text-sm px-3 py-1 rounded-md bg-white border border-emerald-200 shadow-2xs">
                    {formatVND(totalSelectedAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateDeliveryTripView;
