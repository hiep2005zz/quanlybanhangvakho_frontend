import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  DeliveryTrip,
  DriverOption,
  VehicleOption,
  EligibleDispatch,
  listDeliveryTripsApi,
  getDeliveryTripDetailApi,
  createDeliveryTripApi,
  updateDeliveryTripStatusApi,
  updateDeliveryTripStopResultApi,
  deleteDeliveryTripApi,
  listEligibleDispatchesApi,
  listDriversApi,
  listVehiclesApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface DeliveryTripsViewProps {
  token: string;
  currentUser: User;
  onBackToHome?: () => void;
}

export const DeliveryTripsView: React.FC<DeliveryTripsViewProps> = ({
  token,
  currentUser,
}) => {
  // Mode giao diện: 'list' (danh sách), 'create' (tạo chuyến), 'detail' (chi tiết chuyến), 'print' (mẫu in A4)
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail' | 'print'>('list');

  // Danh sách chuyến giao
  const [trips, setTrips] = useState<DeliveryTrip[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Bộ lọc danh sách chuyến
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Chuyến được chọn xem chi tiết hoặc in
  const [selectedTrip, setSelectedTrip] = useState<DeliveryTrip | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Dữ liệu cho màn hình Tạo chuyến giao hàng
  const [eligibleDispatches, setEligibleDispatches] = useState<EligibleDispatch[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [isLoadingCreateData, setIsLoadingCreateData] = useState(false);

  // Form tạo chuyến
  const [createDeliveryDate, setCreateDeliveryDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [createDriverId, setCreateDriverId] = useState<number | ''>('');
  const [createVehicleId, setCreateVehicleId] = useState<number | ''>('');
  const [createWarehouseName, setCreateWarehouseName] = useState('Kho Tổng Hà Nội');
  const [createNote, setCreateNote] = useState('');
  const [selectedDispatchIds, setSelectedDispatchIds] = useState<number[]>([]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Danh sách điểm dừng được gom tạm thời khi tạo chuyến
  const [stagedStops, setStagedStops] = useState<{
    stop_order: number;
    dealer_id?: number;
    dealer_name: string;
    delivery_point_id?: number;
    address: string;
    receiver_name: string;
    receiver_phone: string;
    route_note?: string;
    dispatches: EligibleDispatch[];
  }[]>([]);

  // State cập nhật kết quả điểm dừng tại trang chi tiết
  const [activeFailureStopId, setActiveFailureStopId] = useState<number | null>(null);
  const [failureReasonInput, setFailureReasonInput] = useState('');
  const [isUpdatingStop, setIsUpdatingStop] = useState(false);

  // 1. Tải danh sách chuyến giao hàng
  const loadTrips = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listDeliveryTripsApi(token, {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        delivery_date: dateFilter || undefined,
        search: searchTerm.trim() || undefined,
      });
      setTrips(data);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi nạp danh sách chuyến',
        message: err.message || 'Không thể tải danh sách chuyến giao hàng.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter, dateFilter, searchTerm]);

  useEffect(() => {
    if (viewMode === 'list') {
      loadTrips();
    }
  }, [loadTrips, viewMode]);

  // 2. Tải dữ liệu chuẩn bị tạo chuyến mới
  const handleOpenCreatePage = async () => {
    setIsLoadingCreateData(true);
    setViewMode('create');
    setSelectedDispatchIds([]);
    setStagedStops([]);
    setCreateNote('');
    setCreateDriverId('');
    setCreateVehicleId('');

    try {
      const [dispatchesRes, driversRes, vehiclesRes] = await Promise.all([
        listEligibleDispatchesApi(token),
        listDriversApi(token, createDeliveryDate),
        listVehiclesApi(token, createDeliveryDate),
      ]);
      setEligibleDispatches(dispatchesRes);
      setDrivers(driversRes);
      setVehicles(vehiclesRes);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi nạp dữ liệu',
        message: err.message || 'Không thể tải phiếu xuất hoặc tài xế.',
      });
    } finally {
      setIsLoadingCreateData(false);
    }
  };

  // Cập nhật lại tài xế/xe khi đổi ngày giao hàng trong form tạo
  const handleDeliveryDateChange = async (newDate: string) => {
    setCreateDeliveryDate(newDate);
    try {
      const [driversRes, vehiclesRes] = await Promise.all([
        listDriversApi(token, newDate),
        listVehiclesApi(token, newDate),
      ]);
      setDrivers(driversRes);
      setVehicles(vehiclesRes);
    } catch {}
  };

  // Chọn/bỏ chọn phiếu xuất kho và tự động gom điểm dừng
  const handleToggleDispatch = (disp: EligibleDispatch) => {
    let nextIds: number[];
    if (selectedDispatchIds.includes(disp.dispatch_id)) {
      nextIds = selectedDispatchIds.filter((id) => id !== disp.dispatch_id);
    } else {
      nextIds = [...selectedDispatchIds, disp.dispatch_id];
    }
    setSelectedDispatchIds(nextIds);
    rebuildStagedStops(nextIds, eligibleDispatches);
  };

  const handleSelectAllDispatches = () => {
    if (selectedDispatchIds.length === eligibleDispatches.length) {
      setSelectedDispatchIds([]);
      setStagedStops([]);
    } else {
      const allIds = eligibleDispatches.map((d) => d.dispatch_id);
      setSelectedDispatchIds(allIds);
      rebuildStagedStops(allIds, eligibleDispatches);
    }
  };

  // Hàm gom các phiếu xuất có cùng địa chỉ/điểm giao thành 1 điểm dừng
  const rebuildStagedStops = (ids: number[], allDispatches: EligibleDispatch[]) => {
    const selectedObjs = allDispatches.filter((d) => ids.includes(d.dispatch_id));
    const groupMap: Record<string, {
      dealer_id?: number;
      dealer_name: string;
      delivery_point_id?: number;
      address: string;
      receiver_name: string;
      receiver_phone: string;
      route_note?: string;
      dispatches: EligibleDispatch[];
    }> = {};

    selectedObjs.forEach((disp) => {
      const key = `${disp.delivery_point_id || ''}-${(disp.address || '').trim().toLowerCase()}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          dealer_id: disp.dealer_id,
          dealer_name: disp.dealer_name,
          delivery_point_id: disp.delivery_point_id,
          address: disp.address,
          receiver_name: disp.receiver_name,
          receiver_phone: disp.receiver_phone,
          route_note: disp.route_note,
          dispatches: [],
        };
      }
      groupMap[key].dispatches.push(disp);
    });

    const stopsArray = Object.values(groupMap).map((grp, idx) => ({
      stop_order: idx + 1,
      ...grp,
    }));

    setStagedStops(stopsArray);
  };

  // Di chuyển thứ tự điểm dừng lên/xuống
  const handleMoveStop = (index: number, direction: 'UP' | 'DOWN') => {
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stagedStops.length) return;

    const newArr = [...stagedStops];
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;

    // Cập nhật lại stop_order
    const updated = newArr.map((st, i) => ({
      ...st,
      stop_order: i + 1,
    }));
    setStagedStops(updated);
  };

  // Gửi tạo chuyến giao hàng
  const handleSubmitCreateTrip = async () => {
    if (selectedDispatchIds.length === 0) {
      emitStatusToast({
        type: 'error',
        title: 'Chưa chọn phiếu xuất',
        message: 'Vui lòng chọn ít nhất 1 phiếu xuất kho để tạo chuyến.',
      });
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const payloadStops = stagedStops.map((st) => ({
        stop_order: st.stop_order,
        dealer_id: st.dealer_id,
        dealer_name: st.dealer_name,
        delivery_point_id: st.delivery_point_id,
        address: st.address,
        receiver_name: st.receiver_name,
        receiver_phone: st.receiver_phone,
        route_note: st.route_note,
        dispatch_ids: st.dispatches.map((d) => d.dispatch_id),
      }));

      const res = await createDeliveryTripApi(token, {
        delivery_date: createDeliveryDate,
        driver_id: createDriverId !== '' ? Number(createDriverId) : undefined,
        vehicle_id: createVehicleId !== '' ? Number(createVehicleId) : undefined,
        warehouse_name: createWarehouseName,
        note: createNote.trim() || undefined,
        stops: payloadStops,
      });

      emitStatusToast({
        type: 'success',
        title: 'Tạo chuyến thành công',
        message: res.message || `Đã tạo chuyến giao hàng ${res.trip_code}`,
      });

      setViewMode('list');
      await loadTrips();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi tạo chuyến',
        message: err.message || 'Không thể tạo chuyến giao hàng.',
      });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // 3. Xem chi tiết chuyến giao hàng
  const handleOpenDetail = async (tripId: number) => {
    setIsLoadingDetail(true);
    setViewMode('detail');
    try {
      const data = await getDeliveryTripDetailApi(token, tripId);
      setSelectedTrip(data);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi tải chi tiết',
        message: err.message || 'Không thể tải chi tiết chuyến giao hàng.',
      });
      setViewMode('list');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 4. Mở mẫu in A4
  const handleOpenPrint = async (tripId: number) => {
    setIsLoadingDetail(true);
    try {
      const data = await getDeliveryTripDetailApi(token, tripId);
      setSelectedTrip(data);
      setViewMode('print');
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi tải dữ liệu in',
        message: err.message || 'Không thể chuẩn bị mẫu in.',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 5. Cập nhật trạng thái chuyến (Bắt đầu, Hoàn tất, Hủy)
  const handleUpdateTripStatus = async (newStatus: string) => {
    if (!selectedTrip) return;
    try {
      const res = await updateDeliveryTripStatusApi(token, selectedTrip.id, {
        status: newStatus,
      });
      emitStatusToast({
        type: 'success',
        title: 'Cập nhật trạng thái',
        message: res.message,
      });
      // Tải lại chi tiết chuyến
      const refreshed = await getDeliveryTripDetailApi(token, selectedTrip.id);
      setSelectedTrip(refreshed);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi cập nhật trạng thái',
        message: err.message || 'Không thể cập nhật trạng thái chuyến.',
      });
    }
  };

  // 6. Cập nhật kết quả điểm dừng (Thành công / Thất bại)
  const handleUpdateStopResult = async (stopId: number, statusVal: 'DELIVERED' | 'FAILED', reason?: string) => {
    if (!selectedTrip) return;
    setIsUpdatingStop(true);
    try {
      const res = await updateDeliveryTripStopResultApi(token, selectedTrip.id, stopId, {
        status: statusVal,
        failure_reason: reason,
      });
      emitStatusToast({
        type: 'success',
        title: 'Cập nhật điểm dừng',
        message: res.message,
      });
      setActiveFailureStopId(null);
      setFailureReasonInput('');
      const refreshed = await getDeliveryTripDetailApi(token, selectedTrip.id);
      setSelectedTrip(refreshed);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi cập nhật điểm dừng',
        message: err.message || 'Không thể cập nhật kết quả giao.',
      });
    } finally {
      setIsUpdatingStop(false);
    }
  };

  // 7. Xóa chuyến nháp
  const handleDeleteDraftTrip = async (tripId: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa chuyến giao hàng này?')) return;
    try {
      await deleteDeliveryTripApi(token, tripId);
      emitStatusToast({
        type: 'success',
        title: 'Xóa chuyến thành công',
        message: 'Đã xóa chuyến giao hàng.',
      });
      if (viewMode === 'detail') setViewMode('list');
      await loadTrips();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi xóa chuyến',
        message: err.message || 'Không thể xóa chuyến giao hàng.',
      });
    }
  };

  // Thống kê số lượng chuyến
  const totalTripsCount = trips.length;
  const inProgressTripsCount = trips.filter((t) => t.status === 'IN_PROGRESS').length;
  const completedTripsCount = trips.filter((t) => t.status === 'COMPLETED').length;
  const pendingAssignedTripsCount = trips.filter((t) => t.status === 'ASSIGNED' || t.status === 'DRAFT').length;

  // Lấy màu sắc badge trạng thái chuyến
  const getTripStatusBadge = (st: string) => {
    switch (st) {
      case 'DRAFT':
        return { text: 'Nháp', bg: '#f1f5f9', color: '#475569' };
      case 'ASSIGNED':
        return { text: 'Đã phân công', bg: '#e0f2fe', color: '#0369a1' };
      case 'IN_PROGRESS':
        return { text: 'Đang giao hàng', bg: '#fef3c7', color: '#b45309' };
      case 'COMPLETED':
        return { text: 'Hoàn thành', bg: '#dcfce7', color: '#166534' };
      case 'PARTIALLY_FAILED':
        return { text: 'Có điểm thất bại', bg: '#fee2e2', color: '#b91c1c' };
      case 'CANCELLED':
        return { text: 'Đã hủy', bg: '#f1f5f9', color: '#94a3b8' };
      default:
        return { text: st, bg: '#f1f5f9', color: '#475569' };
    }
  };

  if ((viewMode === 'detail' || viewMode === 'print') && isLoadingDetail) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', background: '#f8fafc', minHeight: '100vh' }}>
        Đang nạp dữ liệu chuyến giao hàng...
      </div>
    );
  }

  // =========================================================================
  // VIEW: MẪU IN A4 (PRINT VIEW)
  // =========================================================================
  if (viewMode === 'print' && selectedTrip) {
    return (
      <div style={{ background: '#525659', minHeight: '100vh', padding: '24px 0' }}>
        {/* Thanh công cụ khi xem trước in */}
        <div
          className="no-print"
          style={{
            maxWidth: '210mm',
            margin: '0 auto 16px auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 20px',
            background: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('detail')}
            style={{
              padding: '8px 16px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Quay lại chi tiết
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                padding: '8px 24px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(2,132,199,0.3)',
              }}
            >
              In phiếu ngay (A4)
            </button>
          </div>
        </div>

        {/* Khung tài liệu A4 chuẩn in ấn */}
        <div
          id="print-sheet"
          style={{
            maxWidth: '210mm',
            minHeight: '297mm',
            margin: '0 auto',
            background: '#ffffff',
            padding: '20mm',
            boxSizing: 'border-box',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            color: '#000000',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          {/* Header phiếu in */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #000000', paddingBottom: '12px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '800', textTransform: 'uppercase' }}>HỆ THỐNG QUẢN LÝ KHO & BÁN HÀNG</div>
              <div style={{ fontSize: '11px', color: '#444444' }}>Kho xuất: {selectedTrip.warehouse_name || 'Kho Tổng Hà Nội'}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '700' }}>Mã chuyến: {selectedTrip.trip_code}</div>
              <div style={{ fontSize: '11px', color: '#444444' }}>Ngày in: {new Date().toLocaleDateString('vi-VN')}</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              PHIẾU GIAO HÀNG THEO CHUYẾN
            </h1>
            <div style={{ fontSize: '12.5px', fontStyle: 'italic' }}>
              Ngày giao hàng: <strong>{selectedTrip.delivery_date}</strong> | Tổng số điểm giao: <strong>{selectedTrip.total_stops}</strong> điểm | Tổng số phiếu xuất: <strong>{selectedTrip.total_dispatches}</strong> phiếu
            </div>
          </div>

          {/* Khung thông tin tài xế & phương tiện */}
          <div style={{ border: '1px solid #000000', padding: '10px 14px', marginBottom: '18px', background: '#fafafa' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px' }}>
              <div>Tài xế phụ trách: <strong>{selectedTrip.driver_name || 'Chưa phân công'}</strong></div>
              <div>Số điện thoại tài xế: <strong>{selectedTrip.driver_phone || '—'}</strong></div>
              <div>Phương tiện / Biển số: <strong>{selectedTrip.vehicle_plate || 'Chưa phân công'}</strong></div>
              <div>Loại xe: <strong>{selectedTrip.vehicle_type || '—'}</strong></div>
            </div>
            {selectedTrip.note && (
              <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #cccccc', fontSize: '12px' }}>
                Ghi chú điều phối: <em>{selectedTrip.note}</em>
              </div>
            )}
          </div>

          {/* Bảng danh sách điểm giao theo thứ tự */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', marginBottom: '24px' }}>
            <thead>
              <tr style={{ background: '#eeeeee', borderTop: '1px solid #000000', borderBottom: '1px solid #000000' }}>
                <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '35px' }}>STT</th>
                <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'left', width: '140px' }}>Người nhận / Đại lý</th>
                <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '85px' }}>Số điện thoại</th>
                <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'left' }}>Địa chỉ giao hàng</th>
                <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'left', width: '110px' }}>Phiếu xuất</th>
                <th style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', width: '90px' }}>Ký nhận</th>
              </tr>
            </thead>
            <tbody>
              {(selectedTrip.stops || []).map((st: any) => (
                <tr key={st.id} style={{ borderBottom: '1px solid #cccccc' }}>
                  <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', fontWeight: '800' }}>
                    {st.stop_order}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px' }}>
                    <div style={{ fontWeight: '700' }}>{st.receiver_name}</div>
                    <div style={{ fontSize: '10.5px', color: '#555555' }}>{st.dealer_name}</div>
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', fontWeight: '600' }}>
                    {st.receiver_phone}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px' }}>
                    <div>{st.address}</div>
                    {st.route_note && <div style={{ fontSize: '10.5px', color: '#555555', fontStyle: 'italic' }}>Lưu ý: {st.route_note}</div>}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px' }}>
                    {(st.dispatches || []).map((d: any) => (
                      <div key={d.id} style={{ fontWeight: '600' }}>
                        {d.dispatch_code}
                      </div>
                    ))}
                  </td>
                  <td style={{ border: '1px solid #000000', padding: '6px', textAlign: 'center', height: '45px' }}>
                    {/* Ô trống cho khách ký nhận */}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Phần chữ ký xác nhận */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center', marginTop: '30px' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '12px' }}>NGƯỜI LẬP PHIẾU</div>
              <div style={{ fontSize: '11px', color: '#666666', marginBottom: '50px' }}>(Ký, họ tên)</div>
              <div style={{ fontWeight: '600' }}>{selectedTrip.created_by}</div>
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '12px' }}>TÀI XẾ NHẬN HÀNG</div>
              <div style={{ fontSize: '11px', color: '#666666', marginBottom: '50px' }}>(Ký, họ tên)</div>
              <div style={{ fontWeight: '600' }}>{selectedTrip.driver_name || '................................'}</div>
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '12px' }}>QUẢN LÝ KHO DUYỆT</div>
              <div style={{ fontSize: '11px', color: '#666666', marginBottom: '50px' }}>(Ký, họ tên)</div>
              <div style={{ fontWeight: '600' }}>................................</div>
            </div>
          </div>
        </div>

        {/* Global style cho Print ẩn navigation */}
        <style>{`
          @media print {
            body { background: #ffffff !important; }
            .no-print { display: none !important; }
            #print-sheet {
              box-shadow: none !important;
              padding: 0 !important;
              max-width: 100% !important;
              width: 100% !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // =========================================================================
  // VIEW: CHI TIẾT CHUYẾN GIAO HÀNG & CẬP NHẬT KẾT QUẢ (ĐÓNG GÓI TRONG 1 KHUNG DUY NHẤT)
  // =========================================================================
  if (viewMode === 'detail' && selectedTrip) {
    const badge = getTripStatusBadge(selectedTrip.status);

    return (
      <div
        style={{
          padding: '12px 18px',
          maxWidth: '1440px',
          margin: '0 auto',
          background: '#f8fafc',
          height: 'calc(100vh - 65px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Thanh tiêu đề & Nút thao tác */}
          <div
            style={{
              padding: '8px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              gap: '12px',
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  loadTrips();
                }}
                style={{
                  padding: '5px 12px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                ← Quay lại danh sách
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  Chuyến Giao Hàng {selectedTrip.trip_code}
                </h1>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: badge.bg,
                    color: badge.color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {badge.text}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => handleOpenPrint(selectedTrip.id)}
                style={{
                  padding: '5px 12px',
                  background: '#ffffff',
                  border: '1px solid #0284c7',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0284c7',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                In danh sách
              </button>

              {selectedTrip.status === 'ASSIGNED' && (
                <button
                  type="button"
                  onClick={() => handleUpdateTripStatus('IN_PROGRESS')}
                  style={{
                    padding: '5px 14px',
                    background: '#0284c7',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Bắt đầu giao hàng
                </button>
              )}

              {selectedTrip.status === 'IN_PROGRESS' && (
                <button
                  type="button"
                  onClick={() => handleUpdateTripStatus('COMPLETED')}
                  style={{
                    padding: '5px 14px',
                    background: '#16a34a',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Hoàn tất toàn bộ chuyến
                </button>
              )}

              {selectedTrip.status !== 'COMPLETED' && selectedTrip.status !== 'CANCELLED' && (
                <button
                  type="button"
                  onClick={() => handleUpdateTripStatus('CANCELLED')}
                  style={{
                    padding: '5px 12px',
                    background: '#ffffff',
                    border: '1px solid #dc2626',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#dc2626',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Hủy chuyến
                </button>
              )}

              {selectedTrip.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => handleDeleteDraftTrip(selectedTrip.id)}
                  style={{
                    padding: '5px 12px',
                    background: '#fee2e2',
                    border: '1px solid #fca5a5',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#b91c1c',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Xóa nháp
                </button>
              )}
            </div>
          </div>

          {/* Dòng thông tin chuyến (1 dòng gọn gàng, không xuống dòng) */}
          <div
            style={{
              padding: '7px 14px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              gap: '24px',
              fontSize: '12px',
              color: '#475569',
              alignItems: 'center',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflowX: 'auto',
            }}
          >
            <div>Ngày giao: <strong style={{ color: '#0f172a' }}>{selectedTrip.delivery_date}</strong></div>
            <div>Tài xế: <strong style={{ color: '#0f172a' }}>{selectedTrip.driver_name || 'Chưa phân công'}</strong> {selectedTrip.driver_phone && `(${selectedTrip.driver_phone})`}</div>
            <div>Phương tiện: <strong style={{ color: '#0f172a' }}>{selectedTrip.vehicle_plate || 'Chưa gán xe'}</strong> {selectedTrip.vehicle_type && `- ${selectedTrip.vehicle_type}`}</div>
            <div>Kho xuất: <strong style={{ color: '#0f172a' }}>{selectedTrip.warehouse_name || 'Kho Tổng Hà Nội'}</strong></div>
            <div>Tổng điểm dừng: <strong style={{ color: '#0284c7' }}>{selectedTrip.total_stops}</strong> | Phiếu xuất: <strong style={{ color: '#0284c7' }}>{selectedTrip.total_dispatches}</strong></div>
            {selectedTrip.note && <div>Ghi chú: <em style={{ color: '#334155' }}>{selectedTrip.note}</em></div>}
          </div>

          {/* Danh sách các điểm dừng theo thứ tự */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(selectedTrip.stops || []).map((st: any) => {
              const isPending = st.status === 'PENDING';
              const isDelivered = st.status === 'DELIVERED';
              const isFailed = st.status === 'FAILED';

              return (
                <div
                  key={st.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    background: isDelivered ? '#f0fdf4' : isFailed ? '#fef2f2' : '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'inline-block', width: '24px', height: '24px', minWidth: '24px', lineHeight: '24px', textAlign: 'center', background: '#0284c7', color: '#ffffff', borderRadius: '50%', fontWeight: '800', fontSize: '11.5px' }}>
                        {st.stop_order}
                      </span>
                      <strong style={{ fontSize: '12.5px', color: '#0f172a', whiteSpace: 'nowrap' }}>{st.receiver_name}</strong>
                      <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>
                        - ĐT: <strong>{st.receiver_phone}</strong> ({st.dealer_name})
                      </span>
                      <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        | Địa chỉ: <strong>{st.address}</strong>
                      </span>
                      <span style={{ fontSize: '11px', color: '#0284c7', whiteSpace: 'nowrap' }}>
                        | Gom {st.dispatches?.length || 0} phiếu: {(st.dispatches || []).map((d: any) => d.dispatch_code).join(', ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: isDelivered ? '#dcfce7' : isFailed ? '#fee2e2' : '#fef3c7',
                          color: isDelivered ? '#166534' : isFailed ? '#b91c1c' : '#b45309',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isDelivered ? 'Đã giao thành công' : isFailed ? 'Giao thất bại' : 'Chờ giao hàng'}
                      </span>

                      {isPending && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => handleUpdateStopResult(st.id, 'DELIVERED')}
                            disabled={isUpdatingStop}
                            style={{
                              padding: '4px 10px',
                              background: '#16a34a',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              color: '#ffffff',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Đã giao xong
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveFailureStopId(activeFailureStopId === st.id ? null : st.id)}
                            disabled={isUpdatingStop}
                            style={{
                              padding: '4px 10px',
                              background: '#ffffff',
                              border: '1px solid #dc2626',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#dc2626',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Báo thất bại
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {activeFailureStopId === st.id && (
                    <div style={{ marginTop: '8px', padding: '8px 10px', background: '#fff1f2', borderRadius: '6px', border: '1px solid #fecdd3', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={failureReasonInput}
                        onChange={(e) => setFailureReasonInput(e.target.value)}
                        placeholder="Nhập lý do thất bại (khách vắng nhà, không liên lạc được...)..."
                        style={{
                          flex: 1,
                          padding: '5px 8px',
                          borderRadius: '4px',
                          border: '1px solid #fda4af',
                          fontSize: '12px',
                          color: '#0f172a',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateStopResult(st.id, 'FAILED')}
                        disabled={isUpdatingStop}
                        style={{
                          padding: '5px 12px',
                          background: '#dc2626',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: '#ffffff',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Xác nhận
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveFailureStopId(null)}
                        style={{
                          padding: '5px 10px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: '#475569',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Hủy
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW: TẠO CHUYẾN GIAO HÀNG (CREATE VIEW - COMPACT 100% ZOOM FIT)
  // =========================================================================
  if (viewMode === 'create') {
    return (
      <div
        style={{
          padding: '12px 18px',
          maxWidth: '1440px',
          margin: '0 auto',
          background: '#f8fafc',
          height: 'calc(100vh - 65px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* Thanh Header điều hướng & Nút hành động */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 14px',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              disabled={isSubmittingCreate}
              style={{
                padding: '5px 12px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              ← Quay lại danh sách
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
                Tạo Chuyến Giao Hàng & Phân Tuyến
              </h1>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Người tạo chuyến: <strong style={{ color: '#0f172a' }}>{currentUser.full_name || currentUser.username}</strong>
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              disabled={isSubmittingCreate}
              style={{
                padding: '6px 14px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmitCreateTrip}
              disabled={isSubmittingCreate || selectedDispatchIds.length === 0}
              style={{
                padding: '6px 18px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: isSubmittingCreate || selectedDispatchIds.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isSubmittingCreate || selectedDispatchIds.length === 0 ? 0.6 : 1,
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
              }}
            >
              {isSubmittingCreate ? 'Đang tạo...' : `Xác nhận tạo chuyến (${selectedDispatchIds.length} phiếu)`}
            </button>
          </div>
        </div>

        {/* Khối 1: Thông tin chuyến (Dàn ngang 1 hàng gọn gàng) */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 14px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '135px 165px 1.2fr 1.2fr 1.8fr',
              gap: '10px',
              alignItems: 'end',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Ngày giao hàng *
              </label>
              <input
                type="date"
                value={createDeliveryDate}
                onChange={(e) => handleDeliveryDateChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Kho xuất phát
              </label>
              <input
                type="text"
                value={createWarehouseName}
                onChange={(e) => setCreateWarehouseName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Tài xế phụ trách
              </label>
              <select
                value={createDriverId}
                onChange={(e) => setCreateDriverId(e.target.value ? Number(e.target.value) : '')}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">-- Chọn tài xế (hoặc để sau) --</option>
                {drivers.map((d: any) => (
                  <option key={d.id} value={d.id} disabled={d.is_busy}>
                    {d.name} ({d.phone}) {d.is_busy ? `[Đã bận chuyến ${d.current_trip_code}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Phương tiện / Xe
              </label>
              <select
                value={createVehicleId}
                onChange={(e) => setCreateVehicleId(e.target.value ? Number(e.target.value) : '')}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              >
                <option value="">-- Chọn phương tiện (hoặc để sau) --</option>
                {vehicles.map((v: any) => (
                  <option key={v.id} value={v.id} disabled={v.is_busy}>
                    {v.plate_number} - {v.vehicle_type} {v.capacity_kg ? `(${v.capacity_kg} kg)` : ''} {v.is_busy ? `[Đã bận chuyến ${v.current_trip_code}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Ghi chú điều phối chuyến
              </label>
              <input
                type="text"
                value={createNote}
                onChange={(e) => setCreateNote(e.target.value)}
                placeholder="Ví dụ: Xe giao tuyến Cầu Giấy - Đống Đa - Ba Đình..."
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        </div>

        {/* Khối 2: Chọn phiếu xuất kho đủ điều kiện giao */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 14px',
            flex: stagedStops.length > 0 ? '1 1 52%' : '1 1 auto',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                Chọn Phiếu Xuất Kho Đủ Điều Kiện Giao
              </h2>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                (Phiếu xuất đã xác nhận và chưa nằm trong chuyến giao nào đang chạy)
              </span>
            </div>

            <button
              type="button"
              onClick={handleSelectAllDispatches}
              style={{
                padding: '4px 10px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '5px',
                fontSize: '11px',
                fontWeight: '600',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              {selectedDispatchIds.length === eligibleDispatches.length && eligibleDispatches.length > 0 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>

          {isLoadingCreateData ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '12px' }}>Đang nạp danh sách phiếu xuất...</div>
          ) : eligibleDispatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '12px' }}>
              Hiện không có phiếu xuất kho nào sẵn sàng giao. Vui lòng xác nhận xuất kho trước tại mục <strong>Xuất kho & Giao thiếu</strong>.
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '6px 8px', width: '36px', textAlign: 'center' }}>Chọn</th>
                    <th style={{ padding: '6px 8px', width: '130px' }}>Mã phiếu xuất</th>
                    <th style={{ padding: '6px 8px', width: '120px' }}>Mã đơn hàng</th>
                    <th style={{ padding: '6px 8px', width: '170px' }}>Đại lý / Người nhận</th>
                    <th style={{ padding: '6px 8px', width: '100px' }}>Số điện thoại</th>
                    <th style={{ padding: '6px 8px', width: '220px' }}>Địa chỉ giao hàng</th>
                    <th style={{ padding: '6px 8px' }}>Mặt hàng</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleDispatches.map((disp: any) => {
                    const isChecked = selectedDispatchIds.includes(disp.dispatch_id);
                    return (
                      <tr
                        key={disp.dispatch_id}
                        onClick={() => handleToggleDispatch(disp)}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isChecked ? '#f0f9ff' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <td style={{ padding: '6px 8px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleDispatch(disp)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap' }}>
                          {disp.dispatch_code}
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {disp.order_code}
                        </td>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{disp.receiver_name}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>{disp.dealer_name}</div>
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                          {disp.receiver_phone}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#334155', whiteSpace: 'nowrap' }}>
                          {disp.address}
                        </td>
                        <td style={{ padding: '6px 8px', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {disp.items_summary || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Khối 3: Sắp xếp thứ tự các điểm dừng đã gom (Gọn gàng) */}
        {stagedStops.length > 0 && (
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '10px 14px',
              flex: '1 1 48%',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ marginBottom: '6px', flexShrink: 0 }}>
              <h2 style={{ margin: 0, fontSize: '13.5px', fontWeight: '800', color: '#0f172a' }}>
                Thứ Tự Giao Hàng & Phân Tuyến ({stagedStops.length} điểm dừng)
              </h2>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                Tự động gom các phiếu cùng địa chỉ vào 1 điểm dừng. Dùng nút Lên / Xuống để tối ưu hóa lộ trình xe chạy.
              </div>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
              {stagedStops.map((st: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        minWidth: '24px',
                        borderRadius: '50%',
                        background: '#0284c7',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '11.5px',
                      }}
                    >
                      {st.stop_order}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {st.receiver_name} - ĐT: {st.receiver_phone}
                      </div>
                      <div style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Địa chỉ: <strong>{st.address}</strong>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#0284c7', marginTop: '1px' }}>
                        Gom {st.dispatches.length} phiếu xuất: {st.dispatches.map((d: any) => d.dispatch_code).join(', ')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveStop(idx, 'UP')}
                      style={{
                        padding: '3px 8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: idx === 0 ? '#cbd5e1' : '#334155',
                        cursor: idx === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Lên
                    </button>
                    <button
                      type="button"
                      disabled={idx === stagedStops.length - 1}
                      onClick={() => handleMoveStop(idx, 'DOWN')}
                      style={{
                        padding: '3px 8px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: idx === stagedStops.length - 1 ? '#cbd5e1' : '#334155',
                        cursor: idx === stagedStops.length - 1 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      Xuống
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }


  // =========================================================================
  // VIEW: DANH SÁCH CÁC CHUYẾN GIAO HÀNG (ĐÓNG GÓI TRONG 1 KHUNG DUY NHẤT)
  // =========================================================================
  return (
    <div
      style={{
        padding: '12px 18px',
        maxWidth: '1440px',
        margin: '0 auto',
        background: '#f8fafc',
        height: 'calc(100vh - 65px)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header tích hợp: Tiêu đề + Chỉ số nhanh + Nút tạo chuyến */}
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '12px',
            flexWrap: 'nowrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
              Quản Lý Chuyến Giao Hàng & Phân Tuyến
            </h1>
            <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
              Gom nhiều phiếu xuất kho theo khu vực, gán tài xế & phương tiện, theo dõi kết quả từng điểm giao
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* 4 Huy hiệu tóm tắt nhanh nằm ngay trên thanh tiêu đề, không tạo ô rời rạc */}
            <span
              style={{
                padding: '4px 10px',
                background: '#f1f5f9',
                color: '#334155',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
              }}
            >
              Tổng: <strong>{totalTripsCount}</strong> chuyến
            </span>

            <span
              style={{
                padding: '4px 10px',
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
              }}
            >
              Đang giao: <strong>{inProgressTripsCount}</strong>
            </span>

            <span
              style={{
                padding: '4px 10px',
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
              }}
            >
              Đã xong: <strong>{completedTripsCount}</strong>
            </span>

            <span
              style={{
                padding: '4px 10px',
                background: '#e0f2fe',
                color: '#0369a1',
                border: '1px solid #7dd3fc',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                whiteSpace: 'nowrap',
              }}
            >
              Chờ khởi hành: <strong>{pendingAssignedTripsCount}</strong>
            </span>

            <button
              type="button"
              onClick={loadTrips}
              disabled={isLoading}
              style={{
                padding: '5px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#334155',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>

            <button
              type="button"
              onClick={handleOpenCreatePage}
              style={{
                padding: '5px 14px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(2,132,199,0.2)',
              }}
            >
              + Tạo chuyến giao hàng
            </button>
          </div>
        </div>

        {/* Thanh Bộ lọc tìm kiếm (Nằm ngang trong cùng 1 khung) */}
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            gap: '10px',
            flexWrap: 'nowrap',
            alignItems: 'center',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã chuyến, tài xế, biển số..."
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          />

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              color: '#0f172a',
              whiteSpace: 'nowrap',
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              color: '#0f172a',
              background: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="DRAFT">Nháp</option>
            <option value="ASSIGNED">Đã phân công</option>
            <option value="IN_PROGRESS">Đang giao hàng</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="PARTIALLY_FAILED">Có điểm thất bại</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          {(searchTerm || dateFilter || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
                setStatusFilter('ALL');
              }}
              style={{
                padding: '5px 10px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '11.5px',
                color: '#475569',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>

        {/* Bảng danh sách chuyến - Tiêu đề đứng yên, không xuống dòng */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
              <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '120px' }}>Mã chuyến</th>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px' }}>Ngày giao</th>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap' }}>Tài xế phụ trách</th>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '180px' }}>Phương tiện / Biển số</th>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '90px', textAlign: 'center' }}>Điểm giao</th>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px', textAlign: 'center' }}>Số phiếu xuất</th>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '120px' }}>Trạng thái</th>
                <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '130px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>Không có chuyến giao hàng nào</div>
                    <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Bấm nút "+ Tạo chuyến giao hàng" ở trên để phân tuyến chuyến mới.</div>
                  </td>
                </tr>
              ) : (
                trips.map((t) => {
                  const badge = getTripStatusBadge(t.status);
                  return (
                    <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 12px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap' }}>
                        {t.trip_code}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {t.delivery_date}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#334155', whiteSpace: 'nowrap' }}>
                        <strong>{t.driver_name || 'Chưa phân công'}</strong>
                        {t.driver_phone && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>({t.driver_phone})</span>}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#334155', whiteSpace: 'nowrap' }}>
                        <strong>{t.vehicle_plate || 'Chưa gán xe'}</strong>
                        {t.vehicle_type && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>({t.vehicle_type})</span>}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {t.total_stops} điểm
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap' }}>
                        {t.total_dispatches} phiếu
                      </td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: badge.bg,
                            color: badge.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {badge.text}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenPrint(t.id)}
                            style={{
                              padding: '4px 8px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              color: '#475569',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            In phiếu
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(t.id)}
                            style={{
                              padding: '4px 10px',
                              background: '#0284c7',
                              border: 'none',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              color: '#ffffff',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              boxShadow: '0 1px 2px rgba(2,132,199,0.2)',
                            }}
                          >
                            Chi tiết
                          </button>
                        </div>
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
