import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  WarehouseItem,
  WarehouseLocationItem,
  LocationProductStockItem,
  getWarehousesApi,
  createWarehouseApi,
  updateWarehouseApi,
  deleteWarehouseApi,
  getWarehouseLocationsApi,
  createWarehouseLocationApi,
  updateWarehouseLocationApi,
  deleteWarehouseLocationApi,
  getWarehouseProductsApi,
  assignProductToLocationApi,
  transferLocationProductApi,
  User,
  getProductsApi,
  Product,
} from '../services/api';
import './warehouse-management.css';

interface WarehouseManagementViewProps {
  token: string;
  currentUser: User;
  onBackToHome?: () => void;
}

interface PaginationControlProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalMatches: number;
  itemName: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PaginationControl: React.FC<PaginationControlProps> = ({
  currentPage,
  totalPages,
  pageSize,
  totalMatches,
  itemName,
  onPageChange,
  onPageSizeChange,
}) => {
  if (totalMatches === 0) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalMatches);

  return (
    <div className="wh-pagination-bar">
      <div className="wh-pagination-info">
        Hiển thị <strong>{start}-{end}</strong> / <strong>{totalMatches}</strong> {itemName}
      </div>

      <div className="wh-pagination-controls-wrap">
        <div className="wh-pagination-size-wrap">
          <span>Số dòng mỗi trang:</span>
          <select
            className="wh-pagination-select"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="wh-pagination-buttons">
          <button
            type="button"
            className="wh-btn-page"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            title="Trang trước"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            if (
              totalPages > 7 &&
              pageNum !== 1 &&
              pageNum !== totalPages &&
              Math.abs(pageNum - currentPage) > 2
            ) {
              if (Math.abs(pageNum - currentPage) === 3) {
                return (
                  <span key={pageNum} style={{ padding: '0 4px', color: '#94a3b8' }}>
                    ...
                  </span>
                );
              }
              return null;
            }

            return (
              <button
                key={pageNum}
                type="button"
                className={`wh-btn-page ${pageNum === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            type="button"
            className="wh-btn-page"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            title="Trang tiếp"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export const WarehouseManagementView: React.FC<WarehouseManagementViewProps> = ({
  token,
  currentUser,
}) => {
  // Phân quyền
  const userRoles = currentUser.roles || [currentUser.role];
  const canManage = userRoles.some((r) => ['admin', 'warehouse', 'warehouse_manager'].includes(r));

  // --- STATE CHÍNH ---
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bộ lọc danh sách kho
  const [whSearch, setWhSearch] = useState<string>('');
  const [whStatusFilter, setWhStatusFilter] = useState<string>('all');

  // Kho đang chọn để xem vị trí / gán sản phẩm
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);
  const [subTab, setSubTab] = useState<'locations' | 'products'>('locations');

  // State Vị trí kho (Locations)
  const [locations, setLocations] = useState<WarehouseLocationItem[]>([]);
  const [isLocLoading, setIsLocLoading] = useState<boolean>(false);
  const [locSearch, setLocSearch] = useState<string>('');
  const [locZoneFilter, setLocZoneFilter] = useState<string>('all');

  // State Sản phẩm theo vị trí (Location Products)
  const [locationProducts, setLocationProducts] = useState<LocationProductStockItem[]>([]);
  const [isProdLoading, setIsProdLoading] = useState<boolean>(false);
  const [prodSearch, setProdSearch] = useState<string>('');
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // --- PAGINATION STATE ---
  // Phân trang danh sách kho
  const [whCurrentPage, setWhCurrentPage] = useState<number>(1);
  const [whPageSize, setWhPageSize] = useState<number>(10);

  // Phân trang danh sách vị trí kệ
  const [locCurrentPage, setLocCurrentPage] = useState<number>(1);
  const [locPageSize, setLocPageSize] = useState<number>(10);

  // Phân trang sản phẩm theo vị trí kệ
  const [prodCurrentPage, setProdCurrentPage] = useState<number>(1);
  const [prodPageSize, setProdPageSize] = useState<number>(10);

  // --- MODALS STATE ---
  // Modal Kho
  const [isWhModalOpen, setIsWhModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [whFormData, setWhFormData] = useState({
    code: '',
    name: '',
    address: '',
    manager_name: '',
    phone: '',
    status: 'Đang hoạt động',
  });
  const [whFormErrors, setWhFormErrors] = useState<Record<string, string>>({});
  const [isWhSubmitting, setIsWhSubmitting] = useState<boolean>(false);

  // Modal Xóa Kho
  const [deletingWarehouse, setDeletingWarehouse] = useState<WarehouseItem | null>(null);

  // Modal Vị trí
  const [isLocModalOpen, setIsLocModalOpen] = useState<boolean>(false);
  const [editingLocation, setEditingLocation] = useState<WarehouseLocationItem | null>(null);
  const [locFormData, setLocFormData] = useState({
    location_code: '',
    location_name: '',
    zone: '',
    aisle: '',
    rack: '',
    bin: '',
    max_capacity: 1000,
    status: 'Đang sử dụng',
    note: '',
  });
  const [locFormErrors, setLocFormErrors] = useState<Record<string, string>>({});
  const [isLocSubmitting, setIsLocSubmitting] = useState<boolean>(false);

  // Modal Xóa Vị trí
  const [deletingLocation, setDeletingLocation] = useState<WarehouseLocationItem | null>(null);

  // Modal Gán sản phẩm vào vị trí
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [assignFormData, setAssignFormData] = useState({
    location_id: 0,
    product_id: 0,
    quantity: 10,
  });
  const [isAssignSubmitting, setIsAssignSubmitting] = useState<boolean>(false);

  // Modal Chuyển sản phẩm giữa các vị trí
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferFormData, setTransferFormData] = useState({
    from_location_id: 0,
    to_location_id: 0,
    product_id: 0,
    quantity: 1,
    product_name: '',
    max_available: 0,
  });
  const [isTransferSubmitting, setIsTransferSubmitting] = useState<boolean>(false);

  // Toast auto-hide
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // 1. Tải danh sách kho
  const fetchWarehouses = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getWarehousesApi(token, whSearch, whStatusFilter);
      setWarehouses(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi tải danh sách kho');
    } finally {
      setIsLoading(false);
    }
  }, [token, whSearch, whStatusFilter]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Tải danh mục sản phẩm dùng khi gán vị trí
  useEffect(() => {
    getProductsApi(token)
      .then((res) => setAllProducts(res.items || []))
      .catch(() => {});
  }, [token]);

  // 2. Tải vị trí và tồn sản phẩm của kho đang chọn
  const fetchLocations = useCallback(async (whId: number) => {
    setIsLocLoading(true);
    try {
      const data = await getWarehouseLocationsApi(token, whId, locZoneFilter, locSearch);
      setLocations(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi tải vị trí kho');
    } finally {
      setIsLocLoading(false);
    }
  }, [token, locZoneFilter, locSearch]);

  const fetchLocationProducts = useCallback(async (whId: number) => {
    setIsProdLoading(true);
    try {
      const data = await getWarehouseProductsApi(token, whId, prodSearch);
      setLocationProducts(data);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi tải sản phẩm theo vị trí');
    } finally {
      setIsProdLoading(false);
    }
  }, [token, prodSearch]);

  useEffect(() => {
    if (selectedWarehouse) {
      if (subTab === 'locations') {
        fetchLocations(selectedWarehouse.id);
      } else {
        fetchLocationProducts(selectedWarehouse.id);
      }
    }
  }, [selectedWarehouse, subTab, fetchLocations, fetchLocationProducts]);

  // Danh sách các Zone độc nhất trong kho đang chọn
  const uniqueZones = useMemo(() => {
    const s = new Set<string>();
    locations.forEach((l) => {
      if (l.zone) s.add(l.zone);
    });
    return Array.from(s);
  }, [locations]);

  // --- TÍNH TOÁN PHÂN TRANG ---
  const whTotalMatches = warehouses.length;
  const whTotalPages = Math.max(1, Math.ceil(whTotalMatches / whPageSize));
  const paginatedWarehouses = useMemo(() => {
    const start = (whCurrentPage - 1) * whPageSize;
    return warehouses.slice(start, start + whPageSize);
  }, [warehouses, whCurrentPage, whPageSize]);

  const locTotalMatches = locations.length;
  const locTotalPages = Math.max(1, Math.ceil(locTotalMatches / locPageSize));
  const paginatedLocations = useMemo(() => {
    const start = (locCurrentPage - 1) * locPageSize;
    return locations.slice(start, start + locPageSize);
  }, [locations, locCurrentPage, locPageSize]);

  const prodTotalMatches = locationProducts.length;
  const prodTotalPages = Math.max(1, Math.ceil(prodTotalMatches / prodPageSize));
  const paginatedLocationProducts = useMemo(() => {
    const start = (prodCurrentPage - 1) * prodPageSize;
    return locationProducts.slice(start, start + prodPageSize);
  }, [locationProducts, prodCurrentPage, prodPageSize]);

  // --- XỬ LÝ SUBMIT KHO ---
  const handleOpenCreateWarehouse = () => {
    setEditingWarehouse(null);
    setWhFormData({
      code: '',
      name: '',
      address: '',
      manager_name: '',
      phone: '',
      status: 'Đang hoạt động',
    });
    setWhFormErrors({});
    setIsWhModalOpen(true);
  };

  const handleOpenEditWarehouse = (wh: WarehouseItem) => {
    setEditingWarehouse(wh);
    setWhFormData({
      code: wh.code,
      name: wh.name,
      address: wh.address || '',
      manager_name: wh.manager_name || '',
      phone: wh.phone || '',
      status: wh.status || 'Đang hoạt động',
    });
    setWhFormErrors({});
    setIsWhModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!editingWarehouse && !whFormData.code.trim()) {
      errors.code = 'Mã kho hàng không được để trống.';
    }
    if (!whFormData.name.trim()) {
      errors.name = 'Tên kho hàng không được để trống.';
    }
    if (Object.keys(errors).length > 0) {
      setWhFormErrors(errors);
      return;
    }

    setIsWhSubmitting(true);
    try {
      if (editingWarehouse) {
        await updateWarehouseApi(token, editingWarehouse.id, {
          name: whFormData.name.trim(),
          address: whFormData.address.trim() || undefined,
          manager_name: whFormData.manager_name.trim() || undefined,
          phone: whFormData.phone.trim() || undefined,
          status: whFormData.status,
          is_active: whFormData.status === 'Đang hoạt động',
        });
        setSuccessMsg(`Cập nhật kho '${whFormData.name}' thành công.`);
      } else {
        await createWarehouseApi(token, {
          code: whFormData.code.trim().toUpperCase(),
          name: whFormData.name.trim(),
          address: whFormData.address.trim() || undefined,
          manager_name: whFormData.manager_name.trim() || undefined,
          phone: whFormData.phone.trim() || undefined,
          status: whFormData.status,
          is_active: whFormData.status === 'Đang hoạt động',
        });
        setSuccessMsg(`Thêm kho mới '${whFormData.name}' thành công.`);
      }
      setIsWhModalOpen(false);
      fetchWarehouses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi lưu thông tin kho');
    } finally {
      setIsWhSubmitting(false);
    }
  };

  const handleDeleteWarehouseConfirm = async () => {
    if (!deletingWarehouse) return;
    try {
      await deleteWarehouseApi(token, deletingWarehouse.id);
      setSuccessMsg(`Đã xóa kho '${deletingWarehouse.name}'.`);
      setDeletingWarehouse(null);
      if (selectedWarehouse?.id === deletingWarehouse.id) {
        setSelectedWarehouse(null);
      }
      fetchWarehouses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xóa kho');
      setDeletingWarehouse(null);
    }
  };

  // --- XỬ LÝ SUBMIT VỊ TRÍ ---
  const handleOpenCreateLocation = () => {
    setEditingLocation(null);
    setLocFormData({
      location_code: '',
      location_name: '',
      zone: '',
      aisle: '',
      rack: '',
      bin: '',
      max_capacity: 1000,
      status: 'Đang sử dụng',
      note: '',
    });
    setLocFormErrors({});
    setIsLocModalOpen(true);
  };

  const handleOpenEditLocation = (loc: WarehouseLocationItem) => {
    setEditingLocation(loc);
    setLocFormData({
      location_code: loc.location_code,
      location_name: loc.location_name || '',
      zone: loc.zone || '',
      aisle: loc.aisle || '',
      rack: loc.rack || '',
      bin: loc.bin || '',
      max_capacity: loc.max_capacity || 1000,
      status: loc.status || 'Đang sử dụng',
      note: loc.note || '',
    });
    setLocFormErrors({});
    setIsLocModalOpen(true);
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    const errors: Record<string, string> = {};
    if (!locFormData.location_code.trim()) {
      errors.location_code = 'Mã vị trí / kệ không được để trống.';
    }
    if (Object.keys(errors).length > 0) {
      setLocFormErrors(errors);
      return;
    }

    setIsLocSubmitting(true);
    try {
      if (editingLocation) {
        await updateWarehouseLocationApi(token, editingLocation.id, {
          location_code: locFormData.location_code.trim().toUpperCase(),
          location_name: locFormData.location_name.trim() || undefined,
          zone: locFormData.zone.trim() || undefined,
          aisle: locFormData.aisle.trim() || undefined,
          rack: locFormData.rack.trim() || undefined,
          bin: locFormData.bin.trim() || undefined,
          max_capacity: Number(locFormData.max_capacity) || 1000,
          status: locFormData.status,
          note: locFormData.note.trim() || undefined,
        });
        setSuccessMsg(`Cập nhật vị trí '${locFormData.location_code}' thành công.`);
      } else {
        await createWarehouseLocationApi(token, selectedWarehouse.id, {
          location_code: locFormData.location_code.trim().toUpperCase(),
          location_name: locFormData.location_name.trim() || undefined,
          zone: locFormData.zone.trim() || undefined,
          aisle: locFormData.aisle.trim() || undefined,
          rack: locFormData.rack.trim() || undefined,
          bin: locFormData.bin.trim() || undefined,
          max_capacity: Number(locFormData.max_capacity) || 1000,
          status: locFormData.status,
          note: locFormData.note.trim() || undefined,
        });
        setSuccessMsg(`Thêm vị trí mới '${locFormData.location_code}' thành công.`);
      }
      setIsLocModalOpen(false);
      fetchLocations(selectedWarehouse.id);
      fetchWarehouses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi lưu thông tin vị trí');
    } finally {
      setIsLocSubmitting(false);
    }
  };

  const handleDeleteLocationConfirm = async () => {
    if (!deletingLocation || !selectedWarehouse) return;
    try {
      await deleteWarehouseLocationApi(token, deletingLocation.id);
      setSuccessMsg(`Đã xóa vị trí '${deletingLocation.location_code}'.`);
      setDeletingLocation(null);
      fetchLocations(selectedWarehouse.id);
      fetchWarehouses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xóa vị trí');
      setDeletingLocation(null);
    }
  };

  // --- XỬ LÝ GÁN SẢN PHẨM VÀO VỊ TRÍ ---
  const handleOpenAssignProduct = () => {
    if (locations.length === 0) {
      setErrorMsg('Kho này chưa có vị trí kệ nào. Vui lòng tạo vị trí trước khi gán hàng.');
      return;
    }
    setAssignFormData({
      location_id: locations[0]?.id || 0,
      product_id: allProducts[0]?.id || 1,
      quantity: 10,
    });
    setIsAssignModalOpen(true);
  };

  const handleSaveAssignProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    if (assignFormData.location_id <= 0 || assignFormData.product_id <= 0) {
      setErrorMsg('Vui lòng chọn vị trí và sản phẩm hợp lệ.');
      return;
    }
    setIsAssignSubmitting(true);
    try {
      const res = await assignProductToLocationApi(
        token,
        assignFormData.location_id,
        assignFormData.product_id,
        assignFormData.quantity
      );
      setSuccessMsg(res.message || 'Đã gán sản phẩm vào vị trí thành công.');
      setIsAssignModalOpen(false);
      fetchLocationProducts(selectedWarehouse.id);
      fetchWarehouses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi gán sản phẩm');
    } finally {
      setIsAssignSubmitting(false);
    }
  };

  // --- XỬ LÝ CHUYỂN VỊ TRÍ SẢN PHẨM ---
  const handleOpenTransferProduct = (item: LocationProductStockItem) => {
    const otherLocations = locations.filter((l) => l.id !== item.location_id);
    if (otherLocations.length === 0) {
      setErrorMsg('Kho này chỉ có 1 vị trí kệ, không có vị trí khác để chuyển tới.');
      return;
    }
    setTransferFormData({
      from_location_id: item.location_id,
      to_location_id: otherLocations[0].id,
      product_id: item.product_id,
      quantity: 1,
      product_name: item.product_name,
      max_available: item.quantity,
    });
    setIsTransferModalOpen(true);
  };

  const handleSaveTransferProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    if (transferFormData.quantity > transferFormData.max_available) {
      setErrorMsg(`Số lượng chuyển (${transferFormData.quantity}) vượt quá tồn tại vị trí (${transferFormData.max_available}).`);
      return;
    }
    setIsTransferSubmitting(true);
    try {
      const res = await transferLocationProductApi(
        token,
        transferFormData.from_location_id,
        transferFormData.to_location_id,
        transferFormData.product_id,
        transferFormData.quantity
      );
      setSuccessMsg(res.message || 'Chuyển vị trí hàng thành công.');
      setIsTransferModalOpen(false);
      fetchLocationProducts(selectedWarehouse.id);
      fetchWarehouses();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi chuyển vị trí');
    } finally {
      setIsTransferSubmitting(false);
    }
  };

  return (
    <div className="wh-container">
      {/* Toast Alert Messages */}
      {successMsg && (
        <div className="wh-info-banner" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', color: '#15803d' }}>
          <span>✓</span>
          <strong>{successMsg}</strong>
        </div>
      )}
      {errorMsg && (
        <div className="wh-info-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
          <span>⚠️</span>
          <strong>{errorMsg}</strong>
        </div>
      )}

      {/* Main Header */}
      <div className="wh-header">
        <div className="wh-header-title-group">
          <h1>Quản Lý Danh Sách Kho Hàng & Vị Trí Kệ</h1>
        </div>

        <div className="wh-header-actions">
          {canManage && (
            <button type="button" className="wh-btn wh-btn-primary" onClick={handleOpenCreateWarehouse}>
              + Thêm kho mới
            </button>
          )}
        </div>
      </div>

      {/* Bố cục: Nếu chưa chọn kho -> Xem bảng danh sách kho */}
      {!selectedWarehouse ? (
        <>
          {/* Filter Bar Danh sách kho */}
          <div className="wh-filter-card">
            <div className="wh-filter-group">
              <input
                type="text"
                className="wh-search-input"
                placeholder="Tìm kiếm theo mã kho, tên kho, địa chỉ..."
                value={whSearch}
                onChange={(e) => {
                  setWhSearch(e.target.value);
                  setWhCurrentPage(1);
                }}
              />

              <select
                className="wh-select"
                value={whStatusFilter}
                onChange={(e) => {
                  setWhStatusFilter(e.target.value);
                  setWhCurrentPage(1);
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Ngừng hoạt động">Ngừng hoạt động</option>
              </select>
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Tổng số: <strong>{warehouses.length}</strong> kho hàng
            </div>
          </div>

          {/* Table Danh sách kho */}
          <div className="wh-table-card">
            {isLoading ? (
              <div className="wh-state-box">
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Đang nạp dữ liệu danh sách kho hàng...</div>
              </div>
            ) : warehouses.length === 0 ? (
              <div className="wh-state-box">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
                <h4>Chưa có kho hàng nào phù hợp</h4>
                <p>Hãy thêm kho hàng mới để bắt đầu định vị kệ và phân bổ hàng hóa cho các đại lý.</p>
                {canManage && (
                  <button
                    type="button"
                    className="wh-btn wh-btn-primary"
                    style={{ marginTop: '16px' }}
                    onClick={handleOpenCreateWarehouse}
                  >
                    + Khai báo kho đầu tiên
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="wh-table-responsive">
                  <table className="wh-table">
                    <thead>
                      <tr>
                        <th style={{ width: '110px' }}>Mã kho</th>
                        <th>Tên kho hàng</th>
                        <th>Địa chỉ</th>
                        <th>Người phụ trách</th>
                        <th style={{ textAlign: 'center' }}>Số vị trí kệ</th>
                        <th style={{ textAlign: 'center' }}>Mặt hàng</th>
                        <th style={{ textAlign: 'right' }}>Tổng tồn</th>
                        <th style={{ textAlign: 'center' }}>Trạng thái</th>
                        <th style={{ textAlign: 'center', width: '220px' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedWarehouses.map((wh) => (
                        <tr key={wh.id}>
                          <td>
                            <span className="wh-badge wh-badge-code">{wh.code}</span>
                          </td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>{wh.name}</strong>
                          </td>
                          <td style={{ maxWidth: '280px', color: '#475569' }}>
                            {wh.address || '—'}
                          </td>
                          <td>
                            <div>{wh.manager_name || 'Chưa chỉ định'}</div>
                            {wh.phone && <div style={{ fontSize: '12px', color: '#64748b' }}>SĐT: {wh.phone}</div>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="wh-badge wh-badge-number">{wh.locations_count} vị trí</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span>{wh.total_products_count} loại</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                            {wh.total_stock_quantity.toLocaleString('vi-VN')}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`wh-badge ${wh.is_active ? 'wh-badge-active' : 'wh-badge-inactive'}`}>
                              {wh.status || (wh.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                type="button"
                                className="wh-btn wh-btn-sm wh-btn-primary"
                                title="Quản lý sơ đồ vị trí kệ và phân bổ sản phẩm"
                                onClick={() => {
                                  setSelectedWarehouse(wh);
                                  setSubTab('locations');
                                }}
                              >
                                Quản lý vị trí
                              </button>
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    className="wh-btn wh-btn-sm wh-btn-secondary"
                                    title="Chỉnh sửa thông tin kho"
                                    onClick={() => handleOpenEditWarehouse(wh)}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    className="wh-btn wh-btn-sm wh-btn-danger"
                                    title="Xóa kho hàng"
                                    onClick={() => setDeletingWarehouse(wh)}
                                  >
                                    Xóa
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <PaginationControl
                  currentPage={whCurrentPage}
                  totalPages={whTotalPages}
                  pageSize={whPageSize}
                  totalMatches={whTotalMatches}
                  itemName="kho hàng"
                  onPageChange={setWhCurrentPage}
                  onPageSizeChange={setWhPageSize}
                />
              </>
            )}
          </div>
        </>
      ) : (
        /* Màn hình Chi tiết: Quản lý Vị trí lưu trữ & Phân bổ hàng hóa của Kho được chọn */
        <>
          {/* Breadcrumb & Kho Info Card */}
          <div className="wh-filter-card" style={{ background: '#ffffff', borderLeft: '4px solid #2563eb' }}>
            <div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '4px' }}>
                DANH MỤC VỊ TRÍ LƯU KHO & SOẠN ĐƠN
              </div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                {selectedWarehouse.name} ({selectedWarehouse.code})
              </h2>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                Địa chỉ: {selectedWarehouse.address || 'Chưa cập nhật'} | Phụ trách: {selectedWarehouse.manager_name || '—'} (SĐT: {selectedWarehouse.phone || '—'})
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setSelectedWarehouse(null)}
              >
                ← Quay lại danh sách kho
              </button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="wh-tabs">
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'locations' ? 'active' : ''}`}
              onClick={() => setSubTab('locations')}
            >
              Danh sách vị trí kệ ({locations.length})
            </button>
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'products' ? 'active' : ''}`}
              onClick={() => setSubTab('products')}
            >
              Sản phẩm theo vị trí kệ ({locationProducts.length})
            </button>
          </div>

          {/* TAB 1: DANH SÁCH VỊ TRÍ KỆ (LOCATIONS) */}
          {subTab === 'locations' && (
            <>
              <div className="wh-filter-card">
                <div className="wh-filter-group">
                  <input
                    type="text"
                    className="wh-search-input"
                    placeholder="Tìm mã vị trí, tên kệ, dãy..."
                    value={locSearch}
                    onChange={(e) => {
                      setLocSearch(e.target.value);
                      setLocCurrentPage(1);
                    }}
                  />

                  {uniqueZones.length > 0 && (
                    <select
                      className="wh-select"
                      value={locZoneFilter}
                      onChange={(e) => {
                        setLocZoneFilter(e.target.value);
                        setLocCurrentPage(1);
                      }}
                    >
                      <option value="all">Tất cả khu vực</option>
                      {uniqueZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {canManage && (
                  <button type="button" className="wh-btn wh-btn-primary" onClick={handleOpenCreateLocation}>
                    + Khai báo vị trí kệ mới
                  </button>
                )}
              </div>

              <div className="wh-table-card">
                {isLocLoading ? (
                  <div className="wh-state-box">
                    <div>Đang tải danh sách vị trí kệ...</div>
                  </div>
                ) : locations.length === 0 ? (
                  <div className="wh-state-box">
                    <h4>Kho này chưa có vị trí kệ nào được khai báo</h4>
                    <p>Hãy khai báo khu vực, dãy kệ, tầng và ô chứa để phân bổ hàng hóa cho việc soạn đơn.</p>
                    {canManage && (
                      <button
                        type="button"
                        className="wh-btn wh-btn-primary"
                        style={{ marginTop: '14px' }}
                        onClick={handleOpenCreateLocation}
                      >
                        + Khai báo vị trí đầu tiên
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="wh-table-responsive">
                      <table className="wh-table">
                        <thead>
                          <tr>
                            <th style={{ width: '130px' }}>Mã vị trí</th>
                            <th>Tên vị trí kệ</th>
                            <th>Khu vực (Zone)</th>
                            <th>Dãy kệ (Aisle)</th>
                            <th>Tầng/Kệ (Rack)</th>
                            <th>Ô chứa (Bin)</th>
                            <th style={{ textAlign: 'center' }}>Sức chứa</th>
                            <th style={{ textAlign: 'center' }}>Mặt hàng</th>
                            <th style={{ textAlign: 'right' }}>Lượng hàng chứa</th>
                            <th style={{ textAlign: 'center' }}>Trạng thái</th>
                            {canManage && <th style={{ textAlign: 'center', width: '140px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedLocations.map((loc) => (
                            <tr key={loc.id}>
                              <td>
                                <span className="wh-badge wh-badge-location">{loc.location_code}</span>
                              </td>
                              <td>
                                <strong>{loc.location_name || loc.location_code}</strong>
                                {loc.note && <div style={{ fontSize: '12px', color: '#64748b' }}>{loc.note}</div>}
                              </td>
                              <td>{loc.zone || '—'}</td>
                              <td>{loc.aisle || '—'}</td>
                              <td>{loc.rack || '—'}</td>
                              <td>{loc.bin || '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                {loc.max_capacity?.toLocaleString('vi-VN')}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="wh-badge wh-badge-number">{loc.items_count} SP</span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                {loc.total_quantity.toLocaleString('vi-VN')}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="wh-badge wh-badge-active">
                                  {loc.status || 'Đang sử dụng'}
                                </span>
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                                    <button
                                      type="button"
                                      className="wh-btn wh-btn-sm wh-btn-secondary"
                                      onClick={() => handleOpenEditLocation(loc)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="wh-btn wh-btn-sm wh-btn-danger"
                                      onClick={() => setDeletingLocation(loc)}
                                    >
                                      Xóa
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControl
                      currentPage={locCurrentPage}
                      totalPages={locTotalPages}
                      pageSize={locPageSize}
                      totalMatches={locTotalMatches}
                      itemName="vị trí kệ"
                      onPageChange={setLocCurrentPage}
                      onPageSizeChange={setLocPageSize}
                    />
                  </>
                )}
              </div>
            </>
          )}

          {/* TAB 2: GÁN SẢN PHẨM & TỒN THEO KỆ (PRODUCTS BY LOCATION) */}
          {subTab === 'products' && (
            <>
              <div className="wh-filter-card">
                <div className="wh-filter-group">
                  <input
                    type="text"
                    className="wh-search-input"
                    placeholder="Tìm theo mã SP, tên SP, vị trí kệ..."
                    value={prodSearch}
                    onChange={(e) => {
                      setProdSearch(e.target.value);
                      setProdCurrentPage(1);
                    }}
                  />
                </div>

                {canManage && (
                  <button type="button" className="wh-btn wh-btn-primary" onClick={handleOpenAssignProduct}>
                    + Gán sản phẩm vào kệ
                  </button>
                )}
              </div>

              <div className="wh-table-card">
                {isProdLoading ? (
                  <div className="wh-state-box">
                    <div>Đang tải dữ liệu hàng hóa theo vị trí...</div>
                  </div>
                ) : locationProducts.length === 0 ? (
                  <div className="wh-state-box">
                    <h4>Chưa có sản phẩm nào được gán vào vị trí kệ trong kho này</h4>
                    <p>Hãy gán sản phẩm vào vị trí tương ứng để biết chính xác hàng nằm ở kệ nào khi soạn đơn.</p>
                    {canManage && (
                      <button
                        type="button"
                        className="wh-btn wh-btn-primary"
                        style={{ marginTop: '14px' }}
                        onClick={handleOpenAssignProduct}
                      >
                        + Gán sản phẩm vào kệ ngay
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="wh-table-responsive">
                      <table className="wh-table">
                        <thead>
                          <tr>
                            <th style={{ width: '100px' }}>Mã SP</th>
                            <th>Tên sản phẩm</th>
                            <th>ĐVT</th>
                            <th>Vị trí kệ lưu trữ</th>
                            <th>Khu vực / Dãy</th>
                            <th style={{ textAlign: 'right' }}>Số lượng tại kệ này</th>
                            <th style={{ textAlign: 'right' }}>Tổng tồn tại kho</th>
                            {canManage && <th style={{ textAlign: 'center', width: '130px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedLocationProducts.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <span className="wh-badge wh-badge-code">{item.product_code}</span>
                              </td>
                              <td>
                                <strong>{item.product_name}</strong>
                              </td>
                              <td>{item.base_unit || 'Cái'}</td>
                              <td>
                                <span className="wh-badge wh-badge-location">
                                  {item.location_code}
                                </span>
                                {item.location_name && (
                                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                                    {item.location_name}
                                  </div>
                                )}
                              </td>
                              <td>
                                {[item.zone, item.aisle, item.rack, item.bin].filter(Boolean).join(' - ') || '—'}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                {item.quantity.toLocaleString('vi-VN')} {item.base_unit}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                                {item.warehouse_total_stock.toLocaleString('vi-VN')} {item.base_unit}
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    className="wh-btn wh-btn-sm wh-btn-secondary"
                                    title="Chuyển một phần hoặc toàn bộ sang vị trí kệ khác"
                                    onClick={() => handleOpenTransferProduct(item)}
                                  >
                                    ⇄ Chuyển kệ
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <PaginationControl
                      currentPage={prodCurrentPage}
                      totalPages={prodTotalPages}
                      pageSize={prodPageSize}
                      totalMatches={prodTotalMatches}
                      itemName="sản phẩm"
                      onPageChange={setProdCurrentPage}
                      onPageSizeChange={setProdPageSize}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: THÊM / SỬA KHO HÀNG                          */}
      {/* ==================================================== */}
      {isWhModalOpen && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card">
            <div className="wh-modal-header">
              <h3>{editingWarehouse ? 'Chỉnh Sửa Kho Hàng' : 'Khai Báo Kho Hàng Mới'}</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setIsWhModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse}>
              <div className="wh-modal-body">
                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Mã kho hàng <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: KHO_HN, KHO_HCM..."
                      disabled={Boolean(editingWarehouse)}
                      value={whFormData.code}
                      onChange={(e) => setWhFormData({ ...whFormData, code: e.target.value })}
                    />
                    {whFormErrors.code && <div className="wh-form-error">{whFormErrors.code}</div>}
                  </div>

                  <div className="wh-form-group">
                    <label>
                      Tên kho hàng <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Kho Tổng Hà Nội"
                      value={whFormData.name}
                      onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })}
                    />
                    {whFormErrors.name && <div className="wh-form-error">{whFormErrors.name}</div>}
                  </div>
                </div>

                <div className="wh-form-group">
                  <label>Địa chỉ kho</label>
                  <input
                    type="text"
                    className="wh-form-input"
                    placeholder="VD: Lô CN1, Khu Công Nghiệp Từ Liêm, Hà Nội"
                    value={whFormData.address}
                    onChange={(e) => setWhFormData({ ...whFormData, address: e.target.value })}
                  />
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>Người phụ trách kho</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="Họ và tên thủ kho / quản lý"
                      value={whFormData.manager_name}
                      onChange={(e) => setWhFormData({ ...whFormData, manager_name: e.target.value })}
                    />
                  </div>

                  <div className="wh-form-group">
                    <label>Số điện thoại liên hệ</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="Số điện thoại"
                      value={whFormData.phone}
                      onChange={(e) => setWhFormData({ ...whFormData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="wh-form-group">
                  <label>Trạng thái hoạt động</label>
                  <select
                    className="wh-form-select"
                    value={whFormData.status}
                    onChange={(e) => setWhFormData({ ...whFormData, status: e.target.value })}
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Ngừng hoạt động">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setIsWhModalOpen(false)}
                  disabled={isWhSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="wh-btn wh-btn-primary" disabled={isWhSubmitting}>
                  {isWhSubmitting ? 'Đang lưu...' : editingWarehouse ? 'Cập nhật kho' : 'Tạo kho hàng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: XÁC NHẬN XÓA KHO                            */}
      {/* ==================================================== */}
      {deletingWarehouse && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card" style={{ maxWidth: '440px' }}>
            <div className="wh-modal-header" style={{ background: '#fef2f2' }}>
              <h3 style={{ color: '#dc2626' }}>Xác Nhận Xóa Kho Hàng</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setDeletingWarehouse(null)}>
                ✕
              </button>
            </div>
            <div className="wh-modal-body">
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#334155' }}>
                Bạn có chắc chắn muốn xóa kho <strong>{deletingWarehouse.name}</strong> (Mã: {deletingWarehouse.code}) không?
              </p>
              <div style={{ fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                ⚠️ Nếu kho đang có hàng tồn hoặc đang được phân công cho đại lý, hệ thống sẽ tự động chặn việc xóa để bảo vệ toàn vẹn dữ liệu.
              </div>
            </div>
            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setDeletingWarehouse(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="wh-btn wh-btn-danger"
                style={{ background: '#dc2626', color: '#ffffff' }}
                onClick={handleDeleteWarehouseConfirm}
              >
                Xác nhận xóa kho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: THÊM / SỬA VỊ TRÍ LƯU KHO                    */}
      {/* ==================================================== */}
      {isLocModalOpen && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card wh-modal-card-lg">
            <div className="wh-modal-header">
              <h3>{editingLocation ? 'Chỉnh Sửa Vị Trí Kệ' : 'Khai Báo Vị Trí Lưu Kho Mới'}</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setIsLocModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveLocation}>
              <div className="wh-modal-body">
                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Mã vị trí / Kệ <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: KE-A1-T2, KHU-A-01..."
                      value={locFormData.location_code}
                      onChange={(e) => setLocFormData({ ...locFormData, location_code: e.target.value })}
                    />
                    {locFormErrors.location_code && <div className="wh-form-error">{locFormErrors.location_code}</div>}
                  </div>

                  <div className="wh-form-group">
                    <label>Tên gợi nhớ vị trí</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Kệ A1 Tầng 2 Ô 01"
                      value={locFormData.location_name}
                      onChange={(e) => setLocFormData({ ...locFormData, location_name: e.target.value })}
                    />
                  </div>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>Khu vực (Zone)</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Khu A (Thời trang), Khu B..."
                      value={locFormData.zone}
                      onChange={(e) => setLocFormData({ ...locFormData, zone: e.target.value })}
                    />
                  </div>

                  <div className="wh-form-group">
                    <label>Dãy kệ (Aisle)</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Dãy A1, Dãy 02..."
                      value={locFormData.aisle}
                      onChange={(e) => setLocFormData({ ...locFormData, aisle: e.target.value })}
                    />
                  </div>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>Tầng/Kệ (Rack)</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Tầng 1, Tầng 2..."
                      value={locFormData.rack}
                      onChange={(e) => setLocFormData({ ...locFormData, rack: e.target.value })}
                    />
                  </div>

                  <div className="wh-form-group">
                    <label>Ô chứa hàng / Hộc (Bin)</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Ô 01, Hộc B..."
                      value={locFormData.bin}
                      onChange={(e) => setLocFormData({ ...locFormData, bin: e.target.value })}
                    />
                  </div>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>Sức chứa tối đa (ĐVT cơ sở)</label>
                    <input
                      type="number"
                      min="0"
                      className="wh-form-input"
                      value={locFormData.max_capacity}
                      onChange={(e) => setLocFormData({ ...locFormData, max_capacity: Number(e.target.value) })}
                    />
                  </div>

                  <div className="wh-form-group">
                    <label>Trạng thái</label>
                    <select
                      className="wh-form-select"
                      value={locFormData.status}
                      onChange={(e) => setLocFormData({ ...locFormData, status: e.target.value })}
                    >
                      <option value="Đang sử dụng">Đang sử dụng</option>
                      <option value="Tạm ngưng">Tạm ngưng</option>
                    </select>
                  </div>
                </div>

                <div className="wh-form-group">
                  <label>Ghi chú</label>
                  <textarea
                    className="wh-form-textarea"
                    placeholder="Ghi chú thêm về vị trí kệ này..."
                    value={locFormData.note}
                    onChange={(e) => setLocFormData({ ...locFormData, note: e.target.value })}
                  />
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setIsLocModalOpen(false)}
                  disabled={isLocSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="wh-btn wh-btn-primary" disabled={isLocSubmitting}>
                  {isLocSubmitting ? 'Đang lưu...' : editingLocation ? 'Cập nhật vị trí' : 'Khai báo vị trí'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 4: XÁC NHẬN XÓA VỊ TRÍ                         */}
      {/* ==================================================== */}
      {deletingLocation && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card" style={{ maxWidth: '440px' }}>
            <div className="wh-modal-header" style={{ background: '#fef2f2' }}>
              <h3 style={{ color: '#dc2626' }}>Xác Nhận Xóa Vị Trí</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setDeletingLocation(null)}>
                ✕
              </button>
            </div>
            <div className="wh-modal-body">
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#334155' }}>
                Bạn có chắc chắn muốn xóa vị trí <strong>{deletingLocation.location_code}</strong> không?
              </p>
              <div style={{ fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                ⚠️ Vị trí chỉ được phép xóa khi số lượng sản phẩm lưu trữ tại vị trí này bằng 0.
              </div>
            </div>
            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setDeletingLocation(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="wh-btn wh-btn-danger"
                style={{ background: '#dc2626', color: '#ffffff' }}
                onClick={handleDeleteLocationConfirm}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 5: GÁN SẢN PHẨM VÀO VỊ TRÍ                     */}
      {/* ==================================================== */}
      {isAssignModalOpen && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card">
            <div className="wh-modal-header">
              <h3>Gán Sản Phẩm Vào Vị Trí Kệ</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setIsAssignModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAssignProduct}>
              <div className="wh-modal-body">
                <div className="wh-form-group">
                  <label>
                    Chọn sản phẩm <span className="wh-required-star">*</span>
                  </label>
                  <select
                    className="wh-form-select"
                    value={assignFormData.product_id}
                    onChange={(e) => setAssignFormData({ ...assignFormData, product_id: Number(e.target.value) })}
                  >
                    {allProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.code}] {p.name} (Tồn tổng: {p.stock} {p.base_unit || 'Cái'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="wh-form-group">
                  <label>
                    Chọn vị trí kệ lưu trữ <span className="wh-required-star">*</span>
                  </label>
                  <select
                    className="wh-form-select"
                    value={assignFormData.location_id}
                    onChange={(e) => setAssignFormData({ ...assignFormData, location_id: Number(e.target.value) })}
                  >
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.location_code} — {l.location_name || l.zone || 'Kệ'} (Hiện có: {l.total_quantity} SP)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="wh-form-group">
                  <label>
                    Số lượng gán tại vị trí này <span className="wh-required-star">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="wh-form-input"
                    value={assignFormData.quantity}
                    onChange={(e) => setAssignFormData({ ...assignFormData, quantity: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    💡 Nếu nhập 0, sản phẩm sẽ được gỡ khỏi vị trí kệ này.
                  </div>
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setIsAssignModalOpen(false)}
                  disabled={isAssignSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="wh-btn wh-btn-primary" disabled={isAssignSubmitting}>
                  {isAssignSubmitting ? 'Đang lưu...' : 'Gán vào vị trí'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 6: CHUYỂN VỊ TRÍ HÀNG HÓA                      */}
      {/* ==================================================== */}
      {isTransferModalOpen && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card">
            <div className="wh-modal-header">
              <h3>Chuyển Hàng Giữa Các Vị Trí Kệ</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setIsTransferModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTransferProduct}>
              <div className="wh-modal-body">
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '13.5px' }}>
                  Sản phẩm: <strong>{transferFormData.product_name}</strong>
                  <br />
                  Vị trí xuất hiện tại: <strong>{locations.find((l) => l.id === transferFormData.from_location_id)?.location_code}</strong> (Tồn tại kệ: {transferFormData.max_available})
                </div>

                <div className="wh-form-group">
                  <label>
                    Chuyển đến vị trí kệ đích <span className="wh-required-star">*</span>
                  </label>
                  <select
                    className="wh-form-select"
                    value={transferFormData.to_location_id}
                    onChange={(e) => setTransferFormData({ ...transferFormData, to_location_id: Number(e.target.value) })}
                  >
                    {locations
                      .filter((l) => l.id !== transferFormData.from_location_id)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.location_code} — {l.location_name || l.zone || 'Kệ'}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="wh-form-group">
                  <label>
                    Số lượng chuyển <span className="wh-required-star">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={transferFormData.max_available}
                    className="wh-form-input"
                    value={transferFormData.quantity}
                    onChange={(e) => setTransferFormData({ ...transferFormData, quantity: Number(e.target.value) })}
                  />
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Tối đa có thể chuyển: {transferFormData.max_available}
                  </div>
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={isTransferSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="wh-btn wh-btn-primary" disabled={isTransferSubmitting}>
                  {isTransferSubmitting ? 'Đang chuyển...' : 'Xác nhận chuyển'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseManagementView;
