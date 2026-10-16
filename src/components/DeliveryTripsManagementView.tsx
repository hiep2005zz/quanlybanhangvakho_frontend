import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  InTransitSummary,
  DeliveryTrip,
  DeliveryTripStop,
  getInTransitTripsApi,
  createDeliveryTripApi,
  updateTripStopStatusApi,
  returnStopGoodsToWarehouseApi,
  getWarehousesApi,
  WarehouseItem,
  User,
  formatErrorMessage,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface DeliveryTripsManagementViewProps {
  token: string;
  currentUser?: User | null;
  onBackToHome?: () => void;
}

export const DeliveryTripsManagementView: React.FC<DeliveryTripsManagementViewProps> = ({
  token,
  currentUser,
  onBackToHome,
}) => {
  const [data, setData] = useState<InTransitSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Bộ lọc
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [onlyOverdueFilter, setOnlyOverdueFilter] = useState<boolean>(false);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal Chi tiết chuyến
  const [selectedTrip, setSelectedTrip] = useState<DeliveryTrip | null>(null);

  // Modal Đánh dấu thất bại
  const [failModalStop, setFailModalStop] = useState<DeliveryTripStop | null>(null);
  const [failReason, setFailReason] = useState<string>('');
  const [isSubmittingFail, setIsSubmittingFail] = useState<boolean>(false);

  // Modal Xác nhận nhập lại kho
  const [returnModalStop, setReturnModalStop] = useState<DeliveryTripStop | null>(null);
  const [returnNote, setReturnNote] = useState<string>('');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState<boolean>(false);

  // Modal Tạo chuyến giao hàng mới
  const [isCreateTripOpen, setIsCreateTripOpen] = useState<boolean>(false);
  const [newTripWarehouseId, setNewTripWarehouseId] = useState<string>('');
  const [newTripDriverName, setNewTripDriverName] = useState<string>('');
  const [newTripDriverPhone, setNewTripDriverPhone] = useState<string>('');
  const [newTripLicensePlate, setNewTripLicensePlate] = useState<string>('');
  const [newTripHours, setNewTripHours] = useState<number>(4);
  const [newTripNote, setNewTripNote] = useState<string>('');
  const [newTripStops, setNewTripStops] = useState<Array<{
    order_code: string;
    dealer_name: string;
    delivery_address: string;
    product_name: string;
    sku: string;
    quantity: number;
    price: number;
  }>>([
    {
      order_code: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
      dealer_name: 'Đại Lý Thực Phẩm Sạch Mai Linh',
      delivery_address: '28 Trần Duy Hưng, Cầu Giấy, Hà Nội',
      product_name: 'Sữa chua dâu tây Ba Vì 100g',
      sku: 'SKU-001',
      quantity: 20,
      price: 15000,
    },
  ]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Quyền thao tác
  const userRoles = currentUser?.roles || (currentUser?.role ? [currentUser.role] : []);
  const canManage = Boolean(
    currentUser?.role === 'admin' ||
    userRoles.some((r) => ['admin', 'warehouse_manager', 'warehouse'].includes(String(r).toLowerCase()))
  );

  // Tải danh sách kho để lọc
  useEffect(() => {
    if (token) {
      getWarehousesApi(token)
        .then((res) => setWarehouses(res || []))
        .catch(() => { });
    }
  }, [token]);

  // Tải dữ liệu chuyến giao đang chạy
  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getInTransitTripsApi(token, warehouseFilter, onlyOverdueFilter);
      setData(res);
      // Đồng bộ lại selectedTrip nếu đang mở
      if (selectedTrip) {
        const updated = res.trips.find((t) => t.id === selectedTrip.id);
        setSelectedTrip(updated || null);
      }
    } catch (err: any) {
      setErrorMsg(formatErrorMessage(err?.message || err, 'Không thể tải danh sách hàng trên đường.'));
    } finally {
      setLoading(false);
    }
  }, [token, warehouseFilter, onlyOverdueFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Lọc tìm kiếm theo mã chuyến, tài xế, biển số
  const filteredTrips = useMemo(() => {
    if (!data?.trips) return [];
    if (!searchTerm.trim()) return data.trips;
    const term = searchTerm.trim().toLowerCase();
    return data.trips.filter(
      (t) =>
        t.trip_code.toLowerCase().includes(term) ||
        t.driver_name.toLowerCase().includes(term) ||
        t.license_plate.toLowerCase().includes(term) ||
        t.warehouse_name.toLowerCase().includes(term)
    );
  }, [data?.trips, searchTerm]);

  // Xử lý Giao thành công
  const handleMarkDelivered = async (stopId: number) => {
    try {
      await updateTripStopStatusApi(token, stopId, 'DELIVERED');
      emitStatusToast({
        title: 'Thành công',
        message: 'Đã xác nhận điểm giao hàng thành công.',
      });
      loadData();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Cập nhật điểm giao',
        message: formatErrorMessage(err?.message || err, 'Lỗi khi cập nhật trạng thái điểm giao'),
      });
    }
  };

  // Xử lý Chưa giao được (FAILED)
  const handleSubmitFail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!failModalStop) return;
    if (!failReason.trim()) {
      emitStatusToast({
        type: 'warning',
        title: 'Chưa giao được',
        message: 'Vui lòng nhập lý do chưa giao được hàng.',
      });
      return;
    }
    setIsSubmittingFail(true);
    try {
      await updateTripStopStatusApi(token, failModalStop.id, 'FAILED', failReason.trim());
      emitStatusToast({
        title: 'Đã ghi nhận',
        message: 'Đã cập nhật trạng thái chưa giao được. Hàng tiếp tục thuộc trách nhiệm chuyến giao.',
      });
      setFailModalStop(null);
      setFailReason('');
      loadData();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Ghi nhận thất bại',
        message: formatErrorMessage(err?.message || err, 'Lỗi khi ghi nhận'),
      });
    } finally {
      setIsSubmittingFail(false);
    }
  };

  // Xử lý Nhập lại kho (RETURNED_TO_WAREHOUSE)
  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnModalStop) return;
    setIsSubmittingReturn(true);
    try {
      await returnStopGoodsToWarehouseApi(token, returnModalStop.id, returnNote.trim() || undefined);
      emitStatusToast({
        title: 'Nhập kho thành công',
        message: 'Đã hoàn nhập số lượng hàng chưa giao vào tồn kho và ghi Thẻ kho.',
      });
      setReturnModalStop(null);
      setReturnNote('');
      loadData();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Hoàn nhập kho',
        message: formatErrorMessage(err?.message || err, 'Lỗi khi hoàn nhập kho'),
      });
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Hàng Trên Đường (Chuyến Giao Đang Chạy)
            </h1>
            <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0284c7', padding: '3px 10px', borderRadius: '16px', fontWeight: '700' }}>
              SCRUM-84
            </span>
          </div>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: '4px 0 0 0' }}>
            Theo dõi chi tiết các phiếu xuất đã rời kho nhưng chưa giao xong, kiểm soát tổng tiền hàng nằm trên đường và cảnh báo trễ hạn.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {canManage && (
            <button
              type="button"
              onClick={() => {
                setNewTripWarehouseId(warehouses[0]?.id?.toString() || '1');
                setIsCreateTripOpen(true);
              }}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#0284c7',
                fontSize: '13px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              + Tạo chuyến xe mới
            </button>
          )}
          <button
            type="button"
            onClick={loadData}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Làm mới
          </button>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Quay lại kho
            </button>
          )}
        </div>
      </div>

      {/* Tiêu chí 1: THẺ TỔNG HỢP KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Thẻ 1: Tổng chuyến đang chạy */}
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tổng chuyến đang chạy
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>
            {data ? data.total_active_trips.toLocaleString() : '0'} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>chuyến</span>
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Tổng cộng {data ? data.total_stops : 0} điểm giao
          </div>
        </div>

        {/* Thẻ 2: Điểm còn lại chưa giao */}
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Điểm chưa giao xong
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#ea580c', marginTop: '6px' }}>
            {data ? data.total_remaining_stops.toLocaleString() : '0'} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>điểm</span>
          </div>
          <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px' }}>
            Đã giao hoàn tất: {data ? data.total_delivered_stops : 0} điểm
          </div>
        </div>

        {/* Thẻ 3: Tiền hàng đang nằm trên đường */}
        <div style={{ background: '#ffffff', padding: '18px 20px', borderRadius: '12px', border: '1px solid #fed7aa', backgroundAttachment: '#fffbeb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#9a3412', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Tiền hàng nằm trên đường
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#c2410c', marginTop: '6px' }}>
            {data ? data.total_in_transit_amount.toLocaleString('vi-VN') : '0'} <span style={{ fontSize: '14px', fontWeight: '700' }}>VNĐ</span>
          </div>
          <div style={{ fontSize: '12px', color: '#7c2d12', marginTop: '4px' }}>
            Chưa bàn giao xong cho khách / chưa hoàn kho
          </div>
        </div>

        {/* Thẻ 4: Cảnh báo quá thời gian dự kiến */}
        <div
          onClick={() => setOnlyOverdueFilter(!onlyOverdueFilter)}
          style={{
            background: onlyOverdueFilter ? '#fef2f2' : '#ffffff',
            padding: '18px 20px',
            borderRadius: '12px',
            border: onlyOverdueFilter ? '2px solid #ef4444' : '1px solid #fecaca',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ fontSize: '12.5px', fontWeight: '600', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Quá giờ dự kiến</span>
            <span style={{ fontSize: '11px', background: '#fee2e2', color: '#dc2626', padding: '2px 8px', borderRadius: '10px' }}>
              {onlyOverdueFilter ? 'Đang lọc' : 'Bấm để lọc'}
            </span>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#dc2626', marginTop: '6px' }}>
            {data ? data.total_overdue_trips : 0} <span style={{ fontSize: '14px', fontWeight: '600', color: '#991b1b' }}>chuyến</span>
          </div>
          <div style={{ fontSize: '12px', color: '#b91c1c', marginTop: '4px' }}>
            {data && data.total_overdue_trips > 0 ? 'Cần kiểm tra đôn đốc tài xế' : 'Tất cả chuyến đang đúng tiến độ'}
          </div>
        </div>
      </div>

      {/* Thanh công cụ & Bộ lọc */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Tìm theo mã chuyến, tên tài xế, biển số..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '9px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            outline: 'none',
          }}
        />

        <select
          value={warehouseFilter}
          onChange={(e) => setWarehouseFilter(e.target.value)}
          style={{
            padding: '9px 14px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            background: '#ffffff',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="all">Tất cả kho xuất</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.code}>
              {w.name} ({w.code})
            </option>
          ))}
        </select>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={onlyOverdueFilter}
            onChange={(e) => setOnlyOverdueFilter(e.target.checked)}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span style={{ fontWeight: onlyOverdueFilter ? '700' : '500', color: onlyOverdueFilter ? '#dc2626' : '#334155' }}>
            Chỉ hiển thị chuyến quá giờ dự kiến
          </span>
        </label>
      </div>

      {/* Bảng danh sách chuyến giao */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Đang tải dữ liệu chuyến giao hàng từ CSDL...
          </div>
        ) : errorMsg ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626', fontSize: '14px' }}>
            {errorMsg}
          </div>
        ) : filteredTrips.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            Hiện không có chuyến giao hàng nào đang chạy phù hợp với điều kiện tìm kiếm.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Mã chuyến</th>
                  <th style={{ padding: '12px 16px' }}>Kho xuất</th>
                  <th style={{ padding: '12px 16px' }}>Tài xế & Phương tiện</th>
                  <th style={{ padding: '12px 16px' }}>Tiến độ điểm giao</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Tiền hàng trên đường</th>
                  <th style={{ padding: '12px 16px' }}>Thời gian dự kiến</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrips.map((trip) => {
                  const percent = trip.total_stops > 0 ? Math.round((trip.delivered_stops / trip.total_stops) * 100) : 0;
                  return (
                    <tr
                      key={trip.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: trip.is_overdue ? '#fffbfb' : '#ffffff',
                        transition: 'background 0.15s ease',
                      }}
                    >
                      {/* Mã chuyến */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{trip.trip_code}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Khởi hành: {trip.departure_time}
                        </div>
                      </td>

                      {/* Kho xuất */}
                      <td style={{ padding: '14px 16px', color: '#334155', fontWeight: '500' }}>
                        {trip.warehouse_name}
                      </td>

                      {/* Tài xế & Phương tiện */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{trip.driver_name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                          Biển số: <strong style={{ color: '#1e293b' }}>{trip.license_plate}</strong> {trip.driver_phone ? `(${trip.driver_phone})` : ''}
                        </div>
                      </td>

                      {/* Tiến độ điểm giao */}
                      <td style={{ padding: '14px 16px', minWidth: '180px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                          <span style={{ fontWeight: '700', color: '#0f172a' }}>
                            Đã giao {trip.delivered_stops}/{trip.total_stops} điểm
                          </span>
                          <span style={{ color: trip.remaining_stops > 0 ? '#ea580c' : '#16a34a', fontWeight: '700' }}>
                            {trip.remaining_stops > 0 ? `Còn ${trip.remaining_stops} điểm` : 'Hoàn tất'}
                          </span>
                        </div>
                        {/* Thanh progress bar */}
                        <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#16a34a' : '#ea580c', transition: 'width 0.3s ease' }} />
                        </div>
                        {trip.failed_stops_count > 0 && (
                          <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', marginTop: '4px' }}>
                            Có {trip.failed_stops_count} điểm chưa giao được (thuộc trách nhiệm chuyến)
                          </div>
                        )}
                      </td>

                      {/* Giá trị tiền hàng đang trên đường */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ fontWeight: '800', color: '#c2410c', fontSize: '14px' }}>
                          {trip.in_transit_amount.toLocaleString('vi-VN')} đ
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Tổng chuyến: {trip.total_trip_amount.toLocaleString('vi-VN')} đ
                        </div>
                      </td>

                      {/* Thời gian dự kiến & Cảnh báo trễ */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ color: '#334155', fontWeight: '500' }}>{trip.expected_completion_time}</div>
                        {trip.is_overdue && (
                          <div
                            style={{
                              marginTop: '4px',
                              display: 'inline-block',
                              fontSize: '11px',
                              fontWeight: '700',
                              color: '#b91c1c',
                              background: '#fee2e2',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #fecaca',
                            }}
                          >
                            {trip.overdue_text || 'Quá hạn dự kiến'}
                          </div>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedTrip(trip)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0284c7',
                            fontWeight: '700',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                          }}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: CHI TIẾT CHUYẾN GIAO & QUẢN LÝ ĐIỂM GIAO */}
      {selectedTrip && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 99999,
              padding: '16px',
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '14px',
                width: '100%',
                maxWidth: '960px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              {/* Header Modal */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                    Chi Tiết Chuyến Giao: {selectedTrip.trip_code}
                  </h2>
                  <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                    Kho xuất: <strong>{selectedTrip.warehouse_name}</strong> | Tài xế: <strong>{selectedTrip.driver_name}</strong> ({selectedTrip.license_plate})
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTrip(null)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', color: '#64748b', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Body Modal: Danh sách điểm dừng */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: '1 1 auto' }}>
                {/* Banner cảnh báo quá giờ nếu có */}
                {selectedTrip.is_overdue && (
                  <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginBottom: '16px', fontSize: '13px', fontWeight: '600' }}>
                    Cảnh báo: Chuyến giao này đã {selectedTrip.overdue_text}. Dự kiến hoàn thành lúc {selectedTrip.expected_completion_time}.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    Danh sách các điểm giao hàng ({selectedTrip.stops.length} điểm)
                  </h3>
                  <div style={{ fontSize: '13px', color: '#c2410c', fontWeight: '700' }}>
                    Tiền hàng còn trên đường: {selectedTrip.in_transit_amount.toLocaleString('vi-VN')} đ
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedTrip.stops.map((stop) => {
                    const isPending = stop.status === 'PENDING';
                    const isDelivered = stop.status === 'DELIVERED';
                    const isFailed = stop.status === 'FAILED';
                    const isReturned = stop.status === 'RETURNED_TO_WAREHOUSE';

                    return (
                      <div
                        key={stop.id}
                        style={{
                          padding: '14px 16px',
                          borderRadius: '10px',
                          border: isFailed ? '1.5px solid #f87171' : isDelivered ? '1px solid #bbf7d0' : '1px solid #cbd5e1',
                          background: isFailed ? '#fff5f5' : isDelivered ? '#f0fdf4' : '#ffffff',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <span style={{ fontSize: '12px', fontWeight: '700', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', marginRight: '8px' }}>
                              Điểm #{stop.stop_order}
                            </span>
                            <strong style={{ fontSize: '14px', color: '#0f172a' }}>{stop.dealer_name}</strong>
                            <span style={{ fontSize: '12.5px', color: '#64748b', marginLeft: '6px' }}>({stop.order_code})</span>
                            <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '4px' }}>
                              Địa chỉ giao: {stop.delivery_address}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                              {stop.total_amount.toLocaleString('vi-VN')} đ
                            </div>
                            <span
                              style={{
                                display: 'inline-block',
                                marginTop: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: isDelivered ? '#dcfce7' : isFailed ? '#fee2e2' : isReturned ? '#f1f5f9' : '#ffedd5',
                                color: isDelivered ? '#15803d' : isFailed ? '#b91c1c' : isReturned ? '#475569' : '#c2410c',
                              }}
                            >
                              {stop.status_label}
                            </span>
                          </div>
                        </div>

                        {/* Danh sách mặt hàng */}
                        {stop.items && stop.items.length > 0 && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', fontSize: '12px', color: '#334155' }}>
                            <div style={{ fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>Mặt hàng xuất theo điểm:</div>
                            <ul style={{ margin: 0, paddingLeft: '18px' }}>
                              {stop.items.map((it, idx) => (
                                <li key={idx}>
                                  <strong>{it.product_name}</strong>: {it.quantity} {it.unit} x {it.price.toLocaleString('vi-VN')} đ = {it.line_total.toLocaleString('vi-VN')} đ
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Thông tin thất bại hoặc hoàn kho */}
                        {isFailed && (
                          <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', background: '#fef2f2', border: '1px solid #fecaca', fontSize: '12px', color: '#991b1b' }}>
                            <div><strong>Lý do chưa giao được:</strong> {stop.failure_reason}</div>
                            <div style={{ fontSize: '11.5px', color: '#7f1d1d', marginTop: '2px' }}>
                              (Quy tắc SCRUM-84: Hàng vẫn nằm trên chuyến giao, chưa tự hoàn vào kho)
                            </div>
                          </div>
                        )}

                        {isReturned && (
                          <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', background: '#f1f5f9', fontSize: '12px', color: '#334155' }}>
                            Đã hoàn nhập vào kho lúc {stop.returned_to_warehouse_at} bởi {stop.returned_by}.
                          </div>
                        )}

                        {/* Tiêu chí 2: Các nút thao tác trạng thái điểm giao */}
                        {canManage && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMarkDelivered(stop.id)}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Giao thành công
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFailModalStop(stop);
                                    setFailReason('');
                                  }}
                                  style={{
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    background: '#ffffff',
                                    color: '#dc2626',
                                    border: '1px solid #fca5a5',
                                    fontWeight: '600',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Chưa giao được
                                </button>
                              </>
                            )}

                            {isFailed && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReturnModalStop(stop);
                                  setReturnNote(`Nhập lại kho từ điểm giao thất bại đơn ${stop.order_code}`);
                                }}
                                style={{
                                  padding: '5px 14px',
                                  borderRadius: '6px',
                                  background: '#0284c7',
                                  color: '#ffffff',
                                  border: 'none',
                                  fontWeight: '700',
                                  fontSize: '12px',
                                  cursor: 'pointer',
                                }}
                              >
                                Xác nhận nhập lại hàng vào kho
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Modal */}
              <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={() => setSelectedTrip(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontWeight: '600',
                    fontSize: '13px',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 2: GHI NHẬN CHƯA GIAO ĐƯỢC (BẮT BUỘC NHẬP LÝ DO) */}
      {failModalStop && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000,
              padding: '16px',
            }}
          >
            <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#991b1b', margin: '0 0 8px 0' }}>
                Ghi nhận chưa giao được: {failModalStop.dealer_name}
              </h3>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 14px 0' }}>
                Hàng hóa sẽ tiếp tục được giữ trên chuyến giao và thuộc trách nhiệm của chuyến. Hệ thống tuyệt đối không tự động hoàn nhập vào kho.
              </p>

              <form onSubmit={handleSubmitFail}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Lý do chưa giao được *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={failReason}
                    onChange={(e) => setFailReason(e.target.value)}
                    placeholder="VD: Khách hàng vắng nhà, gọi điện không liên lạc được, khách hẹn giao lại hôm sau..."
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setFailModalStop(null)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '13px', color: '#475569' }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingFail}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#ffffff', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                  >
                    {isSubmittingFail ? 'Đang lưu...' : 'Xác nhận'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 3: XÁC NHẬN NHẬP LẠI HÀNG TRẢ VỀ KHO */}
      {returnModalStop && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 100000,
              padding: '16px',
            }}
          >
            <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '500px', padding: '20px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0369a1', margin: '0 0 8px 0' }}>
                Xác nhận nhập lại hàng vào kho
              </h3>
              <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 14px 0' }}>
                Thao tác này chỉ thực hiện khi hàng thực tế đã về tới kho. Hệ thống sẽ mở giao dịch CSDL, cộng lại tồn kho cho các mặt hàng và ghi Thẻ kho (Inventory Ledger).
              </p>

              <form onSubmit={handleSubmitReturn}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                    Ghi chú kiểm đếm hàng về kho
                  </label>
                  <input
                    type="text"
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="Ghi chú thêm về tình trạng hàng hóa khi nhận lại..."
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setReturnModalStop(null)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '13px', color: '#475569' }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReturn}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#ffffff', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                  >
                    {isSubmittingReturn ? 'Đang xử lý...' : 'Xác nhận hoàn kho'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal Khởi tạo Chuyến giao hàng mới */}
      {isCreateTripOpen && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Khởi Tạo Chuyến Xe Giao Hàng Mới
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreateTripOpen(false)}
                  style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#94a3b8' }}
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newTripDriverName.trim() || !newTripLicensePlate.trim()) {
                    emitStatusToast({
                      type: 'warning',
                      title: 'Thiếu thông tin',
                      message: 'Vui lòng điền tên tài xế và biển số xe.',
                    });
                    return;
                  }
                  setIsSubmittingCreate(true);
                  try {
                    const expectedTime = new Date(Date.now() + newTripHours * 3600 * 1000).toISOString();
                    const stopsPayload = newTripStops.map((s) => ({
                      order_code: s.order_code,
                      dealer_name: s.dealer_name,
                      delivery_address: s.delivery_address,
                      total_amount: s.quantity * s.price,
                      items: [
                        {
                          product_id: 1,
                          product_code: s.sku,
                          product_name: s.product_name,
                          unit: 'Hộp',
                          quantity: s.quantity,
                          price: s.price,
                          line_total: s.quantity * s.price,
                        },
                      ],
                    }));

                    await createDeliveryTripApi(token, {
                      warehouse_id: newTripWarehouseId || (warehouses[0]?.id?.toString() || '1'),
                      driver_name: newTripDriverName.trim(),
                      driver_phone: newTripDriverPhone.trim() || undefined,
                      license_plate: newTripLicensePlate.trim(),
                      expected_completion_time: expectedTime,
                      note: newTripNote.trim() || undefined,
                      stops: stopsPayload,
                    });

                    emitStatusToast({
                      title: 'Khởi tạo thành công',
                      message: 'Chuyến xe giao hàng đã xuất kho và bắt đầu lăn bánh trên đường.',
                    });
                    setIsCreateTripOpen(false);
                    setNewTripDriverName('');
                    setNewTripDriverPhone('');
                    setNewTripLicensePlate('');
                    loadData();
                  } catch (err: any) {
                    emitStatusToast({
                      type: 'error',
                      title: 'Tạo chuyến giao',
                      message: formatErrorMessage(err?.message || err, 'Lỗi khi tạo chuyến giao'),
                    });
                  } finally {
                    setIsSubmittingCreate(false);
                  }
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Kho xuất hàng *
                    </label>
                    <select
                      value={newTripWarehouseId}
                      onChange={(e) => setNewTripWarehouseId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Biển số xe *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: 29C-123.45"
                      value={newTripLicensePlate}
                      onChange={(e) => setNewTripLicensePlate(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Tên tài xế *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nguyễn Văn Tài"
                      value={newTripDriverName}
                      onChange={(e) => setNewTripDriverName(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Số điện thoại tài xế
                    </label>
                    <input
                      type="text"
                      placeholder="VD: 0981234567"
                      value={newTripDriverPhone}
                      onChange={(e) => setNewTripDriverPhone(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Dự kiến hoàn thành trong (giờ)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      value={newTripHours}
                      onChange={(e) => setNewTripHours(Number(e.target.value))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                      Ghi chú hành trình
                    </label>
                    <input
                      type="text"
                      placeholder="Ghi chú tuyến đường, lưu ý..."
                      value={newTripNote}
                      onChange={(e) => setNewTripNote(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                {/* Điểm dừng giao hàng mẫu */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                      Danh sách điểm giao hàng ({newTripStops.length} điểm)
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const idx = newTripStops.length + 1;
                        setNewTripStops([
                          ...newTripStops,
                          {
                            order_code: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
                            dealer_name: `Đại Lý Điểm Giao ${idx}`,
                            delivery_address: `${idx * 15} Đường Giải Phóng, Hà Nội`,
                            product_name: 'Sữa tươi tiệt trùng 180ml',
                            sku: 'SKU-002',
                            quantity: 10,
                            price: 25000,
                          },
                        ]);
                      }}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #0284c7', background: '#f0f9ff', color: '#0284c7', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      + Thêm điểm dừng
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {newTripStops.map((stop, idx) => (
                      <div key={idx} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                          <span>Điểm {idx + 1}: {stop.dealer_name} ({stop.order_code})</span>
                          <span style={{ color: '#0284c7' }}>{(stop.quantity * stop.price).toLocaleString()} đ</span>
                        </div>
                        <div style={{ color: '#64748b' }}>Địa chỉ: {stop.delivery_address}</div>
                        <div style={{ color: '#475569', marginTop: '2px' }}>
                          Hàng giao: {stop.product_name} - SL: {stop.quantity} - Đơn giá: {stop.price.toLocaleString()} đ
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setIsCreateTripOpen(false)}
                    style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontSize: '13px', color: '#475569' }}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCreate}
                    style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#0284c7', color: '#ffffff', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                  >
                    {isSubmittingCreate ? 'Đang tạo chuyến...' : 'Xác nhận xuất kho & Cho xe chạy'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
