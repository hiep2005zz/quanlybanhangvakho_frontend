import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  User,
  DeliveryTrip,
  DriverOption,
  VehicleOption,
  EligibleDispatch,
  WarehouseItem,
  listDeliveryTripsApi,
  getDeliveryTripDetailApi,
  createDeliveryTripApi,
  updateDeliveryTripStatusApi,
  updateDeliveryTripStopResultApi,
  deleteDeliveryTripApi,
  listEligibleDispatchesApi,
  listDriversApi,
  listVehiclesApi,
  getWarehousesApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { DeliveryTripPrintModal } from './DeliveryTripPrintModal';
import './warehouse-management.css';

// Component Combobox tìm kiếm kết hợp vừa nhập vừa chọn từ database
interface ComboboxOption {
  value: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
  isBusy?: boolean;
  disabled?: boolean;
}

interface SearchableComboboxProps {
  value: string | number;
  displayValue?: string;
  options: ComboboxOption[];
  placeholder?: string;
  onChange: (val: any, opt?: ComboboxOption) => void;
  onCustomTextChange?: (text: string) => void;
  allowCustomText?: boolean;
  disabled?: boolean;
}

const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  value,
  displayValue,
  options,
  placeholder = 'Chọn hoặc nhập...',
  onChange,
  onCustomTextChange,
  allowCustomText = false,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter((opt) => {
    if (!searchText.trim()) return true;
    const term = searchText.toLowerCase();
    return (
      opt.label.toLowerCase().includes(term) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(term)) ||
      (opt.badge && opt.badge.toLowerCase().includes(term))
    );
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOpt = options.find((o) => String(o.value) === String(value));
  const textToShow = isOpen
    ? searchText
    : (displayValue !== undefined
        ? displayValue
        : (selectedOpt
            ? selectedOpt.label
            : (allowCustomText ? String(value || '') : '')));

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <input
          type="text"
          value={textToShow}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            setSearchText(selectedOpt ? selectedOpt.label : (allowCustomText ? String(value || '') : ''));
            setIsOpen(true);
          }}
          onChange={(e) => {
            const val = e.target.value;
            setSearchText(val);
            if (!isOpen) setIsOpen(true);
            if (allowCustomText && onCustomTextChange) {
              onCustomTextChange(val);
            }
          }}
          style={{
            width: '100%',
            padding: '6px 26px 6px 8px',
            borderRadius: '6px',
            border: isOpen ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
            fontSize: '12px',
            color: '#0f172a',
            outline: 'none',
            boxSizing: 'border-box',
            backgroundColor: disabled ? '#f1f5f9' : '#ffffff',
          }}
        />
        <div style={{ position: 'absolute', right: '6px', display: 'flex', alignItems: 'center', gap: '3px' }}>
          {value !== '' && value !== undefined && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearchText('');
                if (allowCustomText && onCustomTextChange) onCustomTextChange('');
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#94a3b8',
                padding: '0 2px',
                lineHeight: 1,
              }}
              title="Xóa lựa chọn"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled) setIsOpen(!isOpen);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '9px',
              color: '#64748b',
              padding: '0 2px',
              lineHeight: 1,
            }}
          >
            ▼
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            width: 'max-content',
            maxWidth: '380px',
            maxHeight: '220px',
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
            zIndex: 100,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: '11.5px', color: '#94a3b8', textAlign: 'center' }}>
              Không tìm thấy kết quả phù hợp
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={String(opt.value)}
                onClick={() => {
                  if (opt.disabled) return;
                  onChange(opt.value, opt);
                  setSearchText('');
                  setIsOpen(false);
                }}
                style={{
                  padding: '7px 10px',
                  fontSize: '11.5px',
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  background: String(opt.value) === String(value) ? '#eff6ff' : '#ffffff',
                  borderBottom: '1px solid #f1f5f9',
                  opacity: opt.disabled ? 0.6 : 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  if (!opt.disabled) e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = String(opt.value) === String(value) ? '#eff6ff' : '#ffffff';
                }}
              >
                <div>
                  <div style={{ fontWeight: '700', color: opt.disabled ? '#94a3b8' : '#0f172a' }}>
                    {opt.label}
                  </div>
                  {opt.subLabel && (
                    <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '1px' }}>
                      {opt.subLabel}
                    </div>
                  )}
                </div>
                {opt.badge && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: '700',
                      background: opt.isBusy || opt.badge === 'Tạm dừng' ? '#fee2e2' : '#dcfce7',
                      color: opt.isBusy || opt.badge === 'Tạm dừng' ? '#b91c1c' : '#15803d',
                      whiteSpace: 'nowrap',
                      marginLeft: '6px',
                    }}
                  >
                    {opt.badge}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

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
  const previousViewModeRef = useRef<'list' | 'detail'>('list');

  // Danh sách chuyến giao
  const [trips, setTrips] = useState<DeliveryTrip[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Bộ lọc danh sách chuyến
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');

  // Phân trang danh sách chuyến (Mặc định 10 chuyến mỗi trang)
  const [tripPage, setTripPage] = useState<number>(1);
  const tripPageSize = 10;
  const tripTotalPages = Math.max(1, Math.ceil(trips.length / tripPageSize));
  const paginatedTrips = useMemo(() => {
    const start = (tripPage - 1) * tripPageSize;
    return trips.slice(start, start + tripPageSize);
  }, [trips, tripPage, tripPageSize]);

  // Tự động về trang 1 khi lọc hoặc tìm kiếm
  useEffect(() => {
    setTripPage(1);
  }, [searchTerm, dateFilter, statusFilter]);

  // Thanh phân trang chuẩn ERP [ 1 | 2 | 3 | > ] (Mặc định 10 dòng mới sang trang)
  const renderPaginationBar = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (page: number) => void
  ) => {
    if (totalItems === 0 || totalPages <= 1) return null;

    let pageList: (number | string)[] = [];
    if (totalPages <= 5) {
      pageList = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      if (currentPage <= 3) {
        pageList = [1, 2, 3, '...', totalPages];
      } else if (currentPage >= totalPages - 2) {
        pageList = [1, '...', totalPages - 2, totalPages - 1, totalPages];
      } else {
        pageList = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
      }
    }

    return (
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            height: '32px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          {currentPage > 1 && (
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              style={{
                width: '32px',
                height: '100%',
                border: 'none',
                borderRight: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
              }}
              title="Trang trước"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          {pageList.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 10px',
                    height: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRight: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    userSelect: 'none',
                  }}
                >
                  ...
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                style={{
                  minWidth: '34px',
                  padding: '0 8px',
                  height: '100%',
                  border: 'none',
                  borderRight: idx === pageList.length - 1 && currentPage === totalPages ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isActive ? '#0284c7' : '#ffffff',
                  color: isActive ? '#ffffff' : '#374151',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {pageNum}
              </button>
            );
          })}

          {currentPage < totalPages && (
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              style={{
                width: '32px',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
              }}
              title="Trang tiếp"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  };

  // Chuyến được chọn xem chi tiết hoặc in
  const [selectedTrip, setSelectedTrip] = useState<DeliveryTrip | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Dữ liệu cho màn hình Tạo chuyến giao hàng (Tải từ Database)
  const [eligibleDispatches, setEligibleDispatches] = useState<EligibleDispatch[]>([]);
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoadingCreateData, setIsLoadingCreateData] = useState(false);

  // Form tạo chuyến
  const [createDeliveryDate, setCreateDeliveryDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [createDriverId, setCreateDriverId] = useState<number | ''>('');
  const [createVehicleId, setCreateVehicleId] = useState<number | ''>('');
  const [createWarehouseName, setCreateWarehouseName] = useState('');
  const [createNote, setCreateNote] = useState('');
  const [selectedDispatchIds, setSelectedDispatchIds] = useState<number[]>([]);
  const [createDispatchSearch, setCreateDispatchSearch] = useState('');
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
  const [activeDropdownStopId, setActiveDropdownStopId] = useState<number | null>(null);
  const [activeDropdownOuterTripId, setActiveDropdownOuterTripId] = useState<number | null>(null);

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.wh-action-dropdown-container')) {
        setActiveDropdownStopId(null);
        setActiveDropdownOuterTripId(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // State xác nhận xóa chuyến nháp qua Popup thay vì window.confirm
  const [tripToDeleteId, setTripToDeleteId] = useState<number | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);

  // Kích hoạt class cho body khi mở chế độ in phiếu để tránh trang trắng
  useEffect(() => {
    if (viewMode === 'print') {
      document.body.classList.add('has-trip-print');
      return () => {
        document.body.classList.remove('has-trip-print');
      };
    }
  }, [viewMode]);

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

  // 2. Tải dữ liệu chuẩn bị tạo chuyến mới từ Database (Warehouses, Drivers, Vehicles, Dispatches)
  const handleOpenCreatePage = async () => {
    setIsLoadingCreateData(true);
    setViewMode('create');
    setSelectedDispatchIds([]);
    setStagedStops([]);
    setCreateNote('');
    setCreateDriverId('');
    setCreateVehicleId('');

    try {
      const [dispatchesRes, driversRes, vehiclesRes, warehousesRes] = await Promise.all([
        listEligibleDispatchesApi(token),
        listDriversApi(token, createDeliveryDate),
        listVehiclesApi(token, createDeliveryDate),
        getWarehousesApi(token),
      ]);
      setEligibleDispatches(dispatchesRes);
      setDrivers(driversRes);
      setVehicles(vehiclesRes);
      setWarehouses(warehousesRes);

      // Lấy kho hoạt động đầu tiên từ database làm giá trị ban đầu nếu có
      const activeWh =
        warehousesRes.find((w: any) => {
          const s = String(w.status || '').toLowerCase().trim();
          return !s || s === 'active' || s === 'hoạt động' || s === 'đang hoạt động' || Boolean(w.is_active);
        }) || warehousesRes[0];
      if (activeWh) {
        setCreateWarehouseName(activeWh.name);
      } else {
        setCreateWarehouseName('');
      }
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi nạp dữ liệu',
        message: err.message || 'Không thể tải dữ liệu kho, tài xế hoặc phương tiện.',
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

  // Lọc danh sách phiếu xuất kho theo từ khóa tìm kiếm
  const filteredEligibleDispatches = useMemo(() => {
    if (!createDispatchSearch.trim()) return eligibleDispatches;
    const q = createDispatchSearch.trim().toLowerCase();
    return eligibleDispatches.filter((disp: any) =>
      (disp.dispatch_code || '').toLowerCase().includes(q) ||
      (disp.order_code || '').toLowerCase().includes(q) ||
      (disp.receiver_name || '').toLowerCase().includes(q) ||
      (disp.dealer_name || '').toLowerCase().includes(q) ||
      (disp.receiver_phone || '').toLowerCase().includes(q) ||
      (disp.address || '').toLowerCase().includes(q) ||
      (disp.items_summary || '').toLowerCase().includes(q)
    );
  }, [eligibleDispatches, createDispatchSearch]);

  const handleSelectAllDispatches = () => {
    const targetList = createDispatchSearch.trim() ? filteredEligibleDispatches : eligibleDispatches;
    const idsToAdd = targetList.map((d) => d.dispatch_id);
    const unionIds = Array.from(new Set([...selectedDispatchIds, ...idsToAdd]));
    setSelectedDispatchIds(unionIds);
    rebuildStagedStops(unionIds, eligibleDispatches);
  };

  const handleDeselectAllDispatches = () => {
    if (!createDispatchSearch.trim()) {
      setSelectedDispatchIds([]);
      setStagedStops([]);
    } else {
      const idsToRemove = new Set(filteredEligibleDispatches.map((d) => d.dispatch_id));
      const nextIds = selectedDispatchIds.filter((id) => !idsToRemove.has(id));
      setSelectedDispatchIds(nextIds);
      rebuildStagedStops(nextIds, eligibleDispatches);
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
    if (!createWarehouseName || !createWarehouseName.trim()) {
      emitStatusToast({
        type: 'error',
        title: 'Chưa chọn kho xuất phát',
        message: 'Vui lòng chọn hoặc nhập Kho xuất phát cho chuyến giao hàng.',
      });
      return;
    }

    if (!createDriverId) {
      emitStatusToast({
        type: 'error',
        title: 'Chưa chọn tài xế',
        message: 'Vui lòng chọn Tài xế phụ trách cho chuyến giao hàng.',
      });
      return;
    }

    if (!createVehicleId) {
      emitStatusToast({
        type: 'error',
        title: 'Chưa chọn phương tiện',
        message: 'Vui lòng chọn Phương tiện / Xe cho chuyến giao hàng.',
      });
      return;
    }

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
        driver_id: Number(createDriverId),
        vehicle_id: Number(createVehicleId),
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
    previousViewModeRef.current = viewMode === 'detail' ? 'detail' : 'list';
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


  // Cập nhật trạng thái chuyến theo ID trực tiếp từ danh sách bên ngoài
  const handleUpdateTripStatusById = async (tripId: number, newStatus: string) => {
    try {
      const res = await updateDeliveryTripStatusApi(token, tripId, {
        status: newStatus,
      });
      emitStatusToast({
        type: 'success',
        title: 'Cập nhật trạng thái',
        message: res.message,
      });
      if (selectedTrip && selectedTrip.id === tripId) {
        const refreshed = await getDeliveryTripDetailApi(token, tripId);
        setSelectedTrip(refreshed);
      }
      await loadTrips();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi cập nhật trạng thái',
        message: err.message || 'Không thể cập nhật trạng thái chuyến.',
      });
    }
  };

  // 6. Cập nhật kết quả điểm dừng (Thành công / Thất bại / Chờ giao)
  const handleUpdateStopResult = async (stopId: number, statusVal: 'DELIVERED' | 'FAILED' | 'PENDING', reason?: string) => {
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

  // 7. Mở popup xác nhận xóa chuyến nháp
  const handleRequestDeleteDraftTrip = (tripId: number) => {
    setTripToDeleteId(tripId);
  };

  // Xác nhận thực hiện xóa chuyến từ popup
  const handleConfirmDeleteTrip = async () => {
    if (!tripToDeleteId) return;
    setIsDeletingTrip(true);
    try {
      await deleteDeliveryTripApi(token, tripToDeleteId);
      emitStatusToast({
        type: 'success',
        title: 'Xóa chuyến thành công',
        message: 'Đã xóa chuyến giao hàng.',
      });
      setTripToDeleteId(null);
      if (viewMode === 'detail') setViewMode('list');
      await loadTrips();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi xóa chuyến',
        message: err.message || 'Không thể xóa chuyến giao hàng.',
      });
    } finally {
      setIsDeletingTrip(false);
    }
  };



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
  // VIEW: MẪU IN A4 (PRINT VIEW) - MODAL CHUẨN ĐỒNG BỘ VỚI CHỨNG TỪ PHIẾU THU
  // =========================================================================
  if (viewMode === 'print' && selectedTrip) {
    return (
      <DeliveryTripPrintModal
        trip={selectedTrip}
        currentUser={currentUser}
        onClose={() => setViewMode(previousViewModeRef.current || 'detail')}
      />
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
          padding: '8px 14px',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#f8fafc',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                  transition: 'all 0.15s ease',
                }}
                title="Đóng chi tiết và quay lại danh sách chuyến"
              >
                Đóng
              </button>

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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} />
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
                    position: 'relative',
                    zIndex: activeDropdownStopId === st.id ? 50 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <span style={{ display: 'inline-block', width: '24px', height: '24px', minWidth: '24px', lineHeight: '24px', textAlign: 'center', background: '#0284c7', color: '#ffffff', borderRadius: '50%', fontWeight: '800', fontSize: '11.5px', flexShrink: 0 }}>
                        {st.stop_order}
                      </span>
                      <strong style={{ fontSize: '12.5px', color: '#0f172a', whiteSpace: 'nowrap', flexShrink: 0 }}>{st.receiver_name}</strong>
                      <span style={{ fontSize: '12px', color: '#475569', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        - ĐT: <strong>{st.receiver_phone}</strong> ({st.dealer_name})
                      </span>
                      {st.address && (
                        <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 1 }}>
                          | Địa chỉ: <strong>{st.address}</strong>
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#0284c7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 2 }}>
                        | Gom {st.dispatches?.length || 0} phiếu: {(st.dispatches || []).map((d: any) => d.dispatch_code).join(', ')}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, position: 'relative' }}>
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

                      {selectedTrip.status !== 'COMPLETED' && selectedTrip.status !== 'CANCELLED' && (
                        <div className="wh-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            className={`wh-action-dots-btn ${activeDropdownStopId === st.id ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDropdownStopId((prev) => (prev === st.id ? null : st.id));
                            }}
                            title="Tùy chọn trạng thái điểm dừng"
                          >
                            <span className="wh-action-dots-icon">
                              <span />
                              <span />
                              <span />
                            </span>
                          </button>

                          {activeDropdownStopId === st.id && (() => {
                            const stopsList = selectedTrip.stops || [];
                            const openUpward = stopsList.length > 2 && stopsList.findIndex((item: any) => item.id === st.id) >= stopsList.length - 2;
                            return (
                              <div
                                className={`wh-dropdown-menu ${openUpward ? 'open-up' : 'open-down'}`}
                                style={{ minWidth: '150px', right: 0, zIndex: 1000 }}
                              >
                                <button
                                  type="button"
                                  className="wh-dropdown-item"
                                  style={{ color: '#16a34a', fontWeight: isDelivered ? 700 : 500 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownStopId(null);
                                    handleUpdateStopResult(st.id, 'DELIVERED');
                                  }}
                                >
                                  Đã giao xong
                                </button>
                                <button
                                  type="button"
                                  className="wh-dropdown-item"
                                  style={{ color: '#dc2626', fontWeight: isFailed ? 700 : 500 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownStopId(null);
                                    setActiveFailureStopId(activeFailureStopId === st.id ? null : st.id);
                                  }}
                                >
                                  Báo thất bại
                                </button>
                                <button
                                  type="button"
                                  className="wh-dropdown-item"
                                  style={{ color: '#d97706', fontWeight: isPending ? 700 : 500 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownStopId(null);
                                    handleUpdateStopResult(st.id, 'PENDING');
                                  }}
                                >
                                  Chờ giao hàng
                                </button>
                              </div>
                            );
                          })()}
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
            <div style={{ height: '70px', flexShrink: 0 }} />
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
          padding: '8px 14px',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#f8fafc',
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
          <div>
            <h1 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
              Tạo Chuyến Giao Hàng & Phân Tuyến
            </h1>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Người tạo chuyến: <strong style={{ color: '#0f172a' }}>{currentUser.full_name || currentUser.username}</strong>
            </span>
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
            {(() => {
              const isCreateTripFormValid =
                selectedDispatchIds.length > 0 &&
                Boolean(createWarehouseName && createWarehouseName.trim()) &&
                Boolean(createDriverId) &&
                Boolean(createVehicleId);

              return (
                <button
                  type="button"
                  onClick={handleSubmitCreateTrip}
                  disabled={isSubmittingCreate || !isCreateTripFormValid}
                  style={{
                    padding: '6px 18px',
                    background: '#0284c7',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#ffffff',
                    cursor: isSubmittingCreate || !isCreateTripFormValid ? 'not-allowed' : 'pointer',
                    opacity: isSubmittingCreate || !isCreateTripFormValid ? 0.6 : 1,
                    boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
                  }}
                  title={
                    !createWarehouseName?.trim()
                      ? 'Vui lòng chọn Kho xuất phát'
                      : !createDriverId
                      ? 'Vui lòng chọn Tài xế phụ trách'
                      : !createVehicleId
                      ? 'Vui lòng chọn Phương tiện / Xe'
                      : selectedDispatchIds.length === 0
                      ? 'Vui lòng chọn ít nhất 1 phiếu xuất kho'
                      : 'Bấm để tạo chuyến giao hàng'
                  }
                >
                  {isSubmittingCreate ? 'Đang tạo...' : `Xác nhận tạo chuyến (${selectedDispatchIds.length} phiếu)`}
                </button>
              );
            })()}
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
              gridTemplateColumns: '135px 220px 1.2fr 1.2fr 1.8fr',
              gap: '10px',
              alignItems: 'end',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Ngày giao hàng <span style={{ color: '#ef4444' }}>*</span>
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
                Kho xuất phát <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <SearchableCombobox
                value={createWarehouseName}
                displayValue={createWarehouseName}
                options={warehouses.map((w) => {
                  const s = String(w.status || '').toLowerCase().trim();
                  const isActive = !s || s === 'active' || s === 'hoạt động' || s === 'đang hoạt động' || Boolean(w.is_active);
                  return {
                    value: w.name,
                    label: w.name,
                    subLabel: `${w.code || ''} • ${w.address || 'Kho hàng'}`,
                    badge: isActive ? 'Hoạt động' : 'Tạm dừng',
                    disabled: false,
                  };
                })}
                placeholder="-- Chọn kho xuất phát * --"
                allowCustomText={true}
                onChange={(val) => setCreateWarehouseName(val)}
                onCustomTextChange={(text) => setCreateWarehouseName(text)}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Tài xế phụ trách <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <SearchableCombobox
                value={createDriverId}
                options={drivers.map((d: any) => ({
                  value: d.id,
                  label: `${d.name} (${d.phone})`,
                  subLabel: `Mã: ${d.code || 'TX'} • GPLX: ${d.license_number || 'N/A'}`,
                  badge: d.is_busy ? `Bận ${d.current_trip_code}` : 'Sẵn sàng',
                  isBusy: d.is_busy,
                  disabled: d.is_busy,
                }))}
                placeholder="-- Chọn tài xế phụ trách * --"
                allowCustomText={false}
                onChange={(val) => setCreateDriverId(val ? Number(val) : '')}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', marginBottom: '3px' }}>
                Phương tiện / Xe <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <SearchableCombobox
                value={createVehicleId}
                options={vehicles.map((v: any) => ({
                  value: v.id,
                  label: `${v.plate_number} - ${v.vehicle_type}`,
                  subLabel: `Tải trọng: ${v.capacity_kg ? `${v.capacity_kg} kg` : 'N/A'}`,
                  badge: v.is_busy ? `Bận ${v.current_trip_code}` : 'Sẵn sàng',
                  isBusy: v.is_busy,
                  disabled: v.is_busy,
                }))}
                placeholder="-- Chọn phương tiện / xe * --"
                allowCustomText={false}
                onChange={(val) => setCreateVehicleId(val ? Number(val) : '')}
              />
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
              padding: '8px 12px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
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

            {/* Cụm thanh tìm kiếm & Các nút Thao tác chọn/xóa tất cả */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Thanh tìm kiếm phiếu xuất */}
              <div style={{ position: 'relative', width: '270px' }}>
                <input
                  type="text"
                  placeholder="Tìm mã PXK, đơn hàng, khách..."
                  value={createDispatchSearch}
                  onChange={(e) => setCreateDispatchSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 28px 5px 10px',
                    fontSize: '12px',
                    borderRadius: '5px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    color: '#0f172a',
                    background: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
                {createDispatchSearch && (
                  <button
                    type="button"
                    onClick={() => setCreateDispatchSearch('')}
                    style={{
                      position: 'absolute',
                      right: '7px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      fontSize: '11px',
                      padding: 0,
                      lineHeight: 1,
                    }}
                    title="Xóa tìm kiếm"
                  >
                    X
                  </button>
                )}
              </div>

              {/* Nút Thêm tất cả */}
              <button
                type="button"
                onClick={handleSelectAllDispatches}
                disabled={filteredEligibleDispatches.length === 0}
                style={{
                  padding: '5px 12px',
                  background: '#0284c7',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: filteredEligibleDispatches.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: filteredEligibleDispatches.length === 0 ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                }}
                title={createDispatchSearch.trim() ? 'Chọn tất cả các phiếu đang hiển thị' : 'Chọn tất cả phiếu xuất'}
              >
                Thêm tất cả {createDispatchSearch.trim() && `(${filteredEligibleDispatches.length})`}
              </button>

              {/* Nút Xóa tất cả */}
              <button
                type="button"
                onClick={handleDeselectAllDispatches}
                disabled={selectedDispatchIds.length === 0}
                style={{
                  padding: '5px 12px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  color: selectedDispatchIds.length === 0 ? '#94a3b8' : '#dc2626',
                  cursor: selectedDispatchIds.length === 0 ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Bỏ chọn các phiếu xuất đã chọn"
              >
                Xóa tất cả
              </button>
            </div>
          </div>

          {isLoadingCreateData ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '12px' }}>Đang nạp danh sách phiếu xuất...</div>
          ) : eligibleDispatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '12px' }}>
              Hiện không có phiếu xuất kho nào sẵn sàng giao. Vui lòng xác nhận xuất kho trước tại mục <strong>Xuất kho & Giao thiếu</strong>.
            </div>
          ) : filteredEligibleDispatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '12.5px' }}>
              Không tìm thấy phiếu xuất kho nào phù hợp với &quot;<strong>{createDispatchSearch}</strong>&quot;.
              <button
                type="button"
                onClick={() => setCreateDispatchSearch('')}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#0284c7',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '12px',
                }}
              >
                Xóa bộ lọc tìm kiếm
              </button>
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
                  {filteredEligibleDispatches.map((disp: any) => {
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
        padding: '8px 14px',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#f8fafc',
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
              Tạo chuyến giao hàng
            </button>
          </div>
        </div>

        {/* Thanh Bộ lọc tìm kiếm & Làm mới (Nằm ngang trong cùng 1 khung) */}
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            gap: '12px',
            flexWrap: 'nowrap',
            alignItems: 'center',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'relative', width: '300px', flexShrink: 0 }}>
            <span
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã chuyến, tài xế, biển số..."
              style={{
                width: '100%',
                padding: '6px 12px 6px 30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                background: '#ffffff',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>
              Ngày giao:
            </span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                width: '135px',
                flexShrink: 0,
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                background: '#ffffff',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>
              Trạng thái:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: '150px',
                flexShrink: 0,
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                background: '#ffffff',
                boxSizing: 'border-box',
                outline: 'none',
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
          </div>

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
                border: '1px solid #fca5a5',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '600',
                color: '#dc2626',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              ✕ Xóa lọc
            </button>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
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
              title="Làm mới dữ liệu từ hệ thống"
            >
              {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        {/* Bảng danh sách chuyến */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: '260px', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 40, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '120px' }}>Mã chuyến</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px' }}>Ngày giao</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap' }}>Tài xế phụ trách</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '180px' }}>Phương tiện / Biển số</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '90px', textAlign: 'center' }}>Điểm giao</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px', textAlign: 'center' }}>Số phiếu xuất</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '120px' }}>Trạng thái</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '80px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {trips.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>Không có chuyến giao hàng nào</div>
                      <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Bấm nút "Tạo chuyến giao hàng" ở trên để phân tuyến chuyến mới.</div>
                    </td>
                  </tr>
                ) : (
                  paginatedTrips.map((t, idx) => {
                    const badge = getTripStatusBadge(t.status);
                    return (
                      <tr
                        key={t.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                        }}
                      >
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
                        <td style={{ padding: '6px 12px', textAlign: 'center', whiteSpace: 'nowrap', position: 'relative', zIndex: activeDropdownOuterTripId === t.id ? 35 : 1 }}>
                          <div className="wh-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className={`wh-action-dots-btn ${activeDropdownOuterTripId === t.id ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownOuterTripId((prev) => (prev === t.id ? null : t.id));
                              }}
                              title="Tùy chọn thao tác chuyến"
                            >
                              <span className="wh-action-dots-icon">
                                <span />
                                <span />
                                <span />
                              </span>
                            </button>

                            {activeDropdownOuterTripId === t.id && (() => {
                              const openUpward = paginatedTrips.length > 2 && idx >= paginatedTrips.length - 2;
                              return (
                                <div className={`wh-dropdown-menu ${openUpward ? 'open-up' : 'open-down'}`} style={{ minWidth: '175px', right: 0 }}>
                                  <button
                                    type="button"
                                    className="wh-dropdown-item wh-dropdown-item-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownOuterTripId(null);
                                      handleOpenDetail(t.id);
                                    }}
                                  >
                                    <span>Chi tiết</span>
                                  </button>

                                  <button
                                    type="button"
                                    className="wh-dropdown-item"
                                    style={{ color: '#0284c7', fontWeight: 600 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownOuterTripId(null);
                                      handleOpenPrint(t.id);
                                    }}
                                  >
                                    <span>In danh sách</span>
                                  </button>

                                  {t.status === 'ASSIGNED' && (
                                    <button
                                      type="button"
                                      className="wh-dropdown-item"
                                      style={{ color: '#0284c7', fontWeight: 600 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdownOuterTripId(null);
                                        handleUpdateTripStatusById(t.id, 'IN_PROGRESS');
                                      }}
                                    >
                                      <span>Bắt đầu giao hàng</span>
                                    </button>
                                  )}

                                  {t.status === 'IN_PROGRESS' && (
                                    <button
                                      type="button"
                                      className="wh-dropdown-item"
                                      style={{ color: '#16a34a', fontWeight: 600 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdownOuterTripId(null);
                                        handleUpdateTripStatusById(t.id, 'COMPLETED');
                                      }}
                                    >
                                      <span>Hoàn tất toàn bộ chuyến</span>
                                    </button>
                                  )}

                                  {t.status !== 'COMPLETED' && t.status !== 'CANCELLED' && (
                                    <button
                                      type="button"
                                      className="wh-dropdown-item wh-dropdown-item-danger"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdownOuterTripId(null);
                                        handleUpdateTripStatusById(t.id, 'CANCELLED');
                                      }}
                                    >
                                      <span>Hủy chuyến</span>
                                    </button>
                                  )}

                                  {t.status === 'DRAFT' && (
                                    <button
                                      type="button"
                                      className="wh-dropdown-item wh-dropdown-item-danger"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveDropdownOuterTripId(null);
                                        handleRequestDeleteDraftTrip(t.id);
                                      }}
                                    >
                                      <span>Xóa nháp</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            <div style={{ height: '70px' }} />
          </div>
          {renderPaginationBar(tripPage, tripTotalPages, trips.length, setTripPage)}
        </div>
      </div>

      {/* Popup Modal xác nhận xóa chuyến nháp chuẩn UI chuyên nghiệp */}
      {tripToDeleteId !== null && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              width: '420px',
              maxWidth: '92%',
              padding: '22px 24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Xác nhận xóa chuyến giao hàng
                </h3>
                <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  Bạn có chắc chắn muốn xóa chuyến giao hàng này không? Thao tác này sẽ giải phóng toàn bộ phiếu xuất kho liên quan về trạng thái sẵn sàng giao.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setTripToDeleteId(null)}
                disabled={isDeletingTrip}
                style={{
                  padding: '7px 16px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: isDeletingTrip ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTrip}
                disabled={isDeletingTrip}
                style={{
                  padding: '7px 18px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: isDeletingTrip ? 'not-allowed' : 'pointer',
                  opacity: isDeletingTrip ? 0.7 : 1,
                  boxShadow: '0 1px 2px rgba(220, 38, 38, 0.25)',
                }}
              >
                {isDeletingTrip ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
