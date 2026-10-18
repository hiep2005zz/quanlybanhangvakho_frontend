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
  getProductLocationAllocationStatusApi,
  ProductAllocationStatusResponse,
  getWarehouseStocksMapApi,
  User,
  getProductsApi,
  Product,
  WarehouseZoneItem,
  WarehouseRackItem,
  WarehouseMasterData,
  getWarehouseMasterDataApi,
  getWarehouseZonesApi,
  createWarehouseZoneApi,
  updateWarehouseZoneApi,
  deleteWarehouseZoneApi,
  getWarehouseRacksApi,
  createWarehouseRackApi,
  updateWarehouseRackApi,
  deleteWarehouseRackApi,
} from '../services/api';
import './warehouse-management.css';
import WarehousePickingView from './WarehousePickingView';
import { emitStatusToast } from './StatusToast';
import { WarehouseKeeperSelectDropdown } from './WarehouseKeeperSelectDropdown';


interface WarehouseManagementViewProps {
  token: string;
  currentUser: User;
  onBackToHome?: () => void;
}



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

  // Thông báo đẩy nổi ở góc phải qua StatusToast
  const setErrorMsg = useCallback((msg: string | null) => {
    if (msg) {
      emitStatusToast({ message: msg, type: 'error', title: 'Thông báo hệ thống' });
    }
  }, []);

  const setSuccessMsg = useCallback((msg: string | null) => {
    if (msg) {
      emitStatusToast({ message: msg, type: 'success', title: 'Thông báo hệ thống' });
    }
  }, []);

  // Bộ lọc danh sách kho
  const [whSearch, setWhSearch] = useState<string>('');
  const [whStatusFilter, setWhStatusFilter] = useState<string>('all');

  // Kho đang chọn để xem vị trí / gán sản phẩm
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseItem | null>(null);
  const [subTab, setSubTab] = useState<'locations' | 'master-data' | 'products' | 'picking'>('locations');
  const [isGlobalPickingOpen, setIsGlobalPickingOpen] = useState<boolean>(false);


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
  const [warehouseStocksMap, setWarehouseStocksMap] = useState<Record<number, number>>({});

  // State Danh mục Master Data: Kệ, Dãy, Khu vực
  const [masterData, setMasterData] = useState<WarehouseMasterData>({
    zones: [],
    aisles: [],
    racks: [],
    bins: [],
  });
  const [zonesList, setZonesList] = useState<WarehouseZoneItem[]>([]);
  const [racksList, setRacksList] = useState<WarehouseRackItem[]>([]);
  const [isMasterLoading, setIsMasterLoading] = useState<boolean>(false);
  const [masterRackFilter, setMasterRackFilter] = useState<string>('all');
  const [masterSearch, setMasterSearch] = useState<string>('');

  // Modal Thêm Hàng vào Vị Trí Kệ
  const [isAddStockModalOpen, setIsAddStockModalOpen] = useState<boolean>(false);
  const [addStockItem, setAddStockItem] = useState<LocationProductStockItem | null>(null);
  const [addStockQuantity, setAddStockQuantity] = useState<number | string>(10);
  const [isAddStockSubmitting, setIsAddStockSubmitting] = useState<boolean>(false);


  // --- MODALS & FORM PAGES STATE ---
  // Trang riêng khai báo Full-page
  const [isWhFormPageActive, setIsWhFormPageActive] = useState<boolean>(false);
  const [isLocFormPageActive, setIsLocFormPageActive] = useState<boolean>(false);
  const [isZoneFormPageActive, setIsZoneFormPageActive] = useState<boolean>(false);
  const [isRackFormPageActive, setIsRackFormPageActive] = useState<boolean>(false);
  const [isAssignFormPageActive, setIsAssignFormPageActive] = useState<boolean>(false);

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
  const [locFormData, setLocFormData] = useState<{
    location_code: string;
    location_name: string;
    zone: string;
    aisle: string;
    rack: string;
    bin: string;
    max_capacity: number | string;
    initial_quantity: number | string;
    unit: string;
    status: string;
    note: string;
  }>({
    location_code: '',
    location_name: '',
    zone: '',
    aisle: '',
    rack: '',
    bin: '',
    max_capacity: 500,
    initial_quantity: 0,
    unit: 'Cái',
    status: 'Đang sử dụng',
    note: '',
  });
  const [locFormErrors, setLocFormErrors] = useState<Record<string, string>>({});
  const [isLocSubmitting, setIsLocSubmitting] = useState<boolean>(false);
  const [selectedZoneIdForDetail, setSelectedZoneIdForDetail] = useState<number | null>(null);

  // Modal Xóa Vị trí
  const [deletingLocation, setDeletingLocation] = useState<WarehouseLocationItem | null>(null);

  // Modal Master Data: Khu vực
  const [isZoneModalOpen, setIsZoneModalOpen] = useState<boolean>(false);
  const [editingZone, setEditingZone] = useState<WarehouseZoneItem | null>(null);
  const [zoneFormData, setZoneFormData] = useState({
    zone_code: '',
    zone_name: '',
    description: '',
    is_active: true,
  });
  const [zoneFormErrors, setZoneFormErrors] = useState<Record<string, string>>({});
  const [isZoneSubmitting, setIsZoneSubmitting] = useState<boolean>(false);
  const [deletingZone, setDeletingZone] = useState<WarehouseZoneItem | null>(null);

  // Modal Master Data: Kệ / Dãy
  const [isRackModalOpen, setIsRackModalOpen] = useState<boolean>(false);
  const [editingRack, setEditingRack] = useState<WarehouseRackItem | null>(null);
  const [rackFormData, setRackFormData] = useState<{
    rack_code: string;
    rack_name: string;
    rack_type: string;
    zone_id: number;
    max_capacity: number | string;
    is_active: boolean;
    aisle_input: string;
    rack_input: string;
  }>({
    rack_code: '',
    rack_name: '',
    rack_type: 'rack',
    zone_id: 0,
    max_capacity: 500,
    is_active: true,
    aisle_input: '',
    rack_input: '',
  });
  const [rackFormErrors, setRackFormErrors] = useState<Record<string, string>>({});
  const [isRackSubmitting, setIsRackSubmitting] = useState<boolean>(false);
  const [deletingRack, setDeletingRack] = useState<WarehouseRackItem | null>(null);

  // Modal Gán sản phẩm vào vị trí
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [assignFormData, setAssignFormData] = useState<{
    location_id: number;
    product_id: number;
    quantity: number | string;
  }>({
    location_id: 0,
    product_id: 0,
    quantity: 10,
  });
  const [isAssignSubmitting, setIsAssignSubmitting] = useState<boolean>(false);
  const [assignProductSearch, setAssignProductSearch] = useState<string>('');
  const [assignProductDisplayLimit, setAssignProductDisplayLimit] = useState<number>(20);
  const [assignAllocationStatus, setAssignAllocationStatus] = useState<ProductAllocationStatusResponse | null>(null);
  const [isFetchingAllocation, setIsFetchingAllocation] = useState<boolean>(false);
  const [selectedDropdownProduct, setSelectedDropdownProduct] = useState<any | null>(null);

  // Modal Chuyển sản phẩm giữa các vị trí
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [transferFormData, setTransferFormData] = useState<{
    from_location_id: number;
    to_location_id: number;
    product_id: number;
    quantity: number | string;
    product_name: string;
    max_available: number;
  }>({
    from_location_id: 0,
    to_location_id: 0,
    product_id: 0,
    quantity: 1,
    product_name: '',
    max_available: 0,
  });
  const [isTransferSubmitting, setIsTransferSubmitting] = useState<boolean>(false);

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
  const fetchProductsList = useCallback(async () => {
    try {
      const res = await getProductsApi(token);
      setAllProducts(res.items || []);
    } catch { }
  }, [token]);

  useEffect(() => {
    fetchProductsList();
  }, [fetchProductsList]);

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

  // 3. Tải Master Data (Khu vực, Kệ, Dãy, Ô) của kho
  const fetchMasterData = useCallback(async (whId: number) => {
    setIsMasterLoading(true);
    try {
      const [md, zList, rList] = await Promise.all([
        getWarehouseMasterDataApi(token, whId),
        getWarehouseZonesApi(token, whId),
        getWarehouseRacksApi(token, whId),
      ]);
      setMasterData(md);
      setZonesList(zList);
      setRacksList(rList);
    } catch (err) {
      console.error('Lỗi tải cấu hình master data kho:', err);
    } finally {
      setIsMasterLoading(false);
    }
  }, [token]);

  // 3.1 Tải bản đồ tồn kho thực tế của tất cả sản phẩm trong kho đang chọn
  const fetchWarehouseStocksMap = useCallback(async (whId: number) => {
    try {
      const data = await getWarehouseStocksMapApi(token, whId);
      setWarehouseStocksMap(data || {});
    } catch (err) {
      console.warn('Lỗi tải tồn kho sản phẩm theo kho:', err);
    }
  }, [token]);

  // Helper lấy tổng tồn của một sản phẩm trong kho đang chọn (ưu tiên warehouseStocksMap -> locationProducts -> fallbackGlobalStock)
  const getProductWarehouseStock = useCallback((productId: number, fallbackGlobalStock: number = 0): number => {
    if (warehouseStocksMap && warehouseStocksMap[productId] !== undefined) {
      return warehouseStocksMap[productId];
    }
    const lpItem = locationProducts.find((lp) => lp.product_id === productId);
    if (lpItem && lpItem.warehouse_total_stock !== undefined) {
      return lpItem.warehouse_total_stock;
    }
    return fallbackGlobalStock;
  }, [warehouseStocksMap, locationProducts]);

  useEffect(() => {
    if (selectedWarehouse) {
      fetchMasterData(selectedWarehouse.id);
      fetchLocations(selectedWarehouse.id);
      fetchLocationProducts(selectedWarehouse.id);
      fetchWarehouseStocksMap(selectedWarehouse.id);
    } else {
      setWarehouseStocksMap({});
    }
  }, [selectedWarehouse, fetchLocations, fetchLocationProducts, fetchMasterData, fetchWarehouseStocksMap]);

  // Danh sách các Zone độc nhất trong kho đang chọn (bảo đảm không bị mất khi lọc)
  const uniqueZones = useMemo(() => {
    const s = new Set<string>();
    if (Array.isArray(zonesList)) {
      zonesList.forEach((z) => {
        if (z.zone_name && z.zone_name.trim()) s.add(z.zone_name.trim());
      });
    }
    if (masterData && Array.isArray(masterData.zones)) {
      masterData.zones.forEach((z) => {
        if (z.zone_name && z.zone_name.trim()) s.add(z.zone_name.trim());
      });
    }
    if (Array.isArray(locations)) {
      locations.forEach((l) => {
        if (l.zone && l.zone.trim()) s.add(l.zone.trim());
      });
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [zonesList, masterData, locations]);

  // --- TÍNH TOÁN PHÂN TRANG ---
  const paginatedWarehouses = useMemo(() => {
    return warehouses;
  }, [warehouses]);

  const paginatedLocations = useMemo(() => {
    return locations;
  }, [locations]);

  const paginatedLocationProducts = useMemo(() => {
    return locationProducts;
  }, [locationProducts]);

  // Master data lọc và tìm kiếm
  const filteredZones = useMemo(() => {
    if (!masterSearch.trim()) return zonesList;
    const term = masterSearch.toLowerCase().trim();
    return zonesList.filter(
      (z) =>
        z.zone_code.toLowerCase().includes(term) ||
        z.zone_name.toLowerCase().includes(term) ||
        (z.description && z.description.toLowerCase().includes(term))
    );
  }, [zonesList, masterSearch]);

  // Tự động chọn khu vực đầu tiên cho Master-Detail nếu chưa chọn
  useEffect(() => {
    if (zonesList.length > 0) {
      if (selectedZoneIdForDetail === null || !zonesList.some((z) => z.id === selectedZoneIdForDetail)) {
        setSelectedZoneIdForDetail(zonesList[0].id);
      }
    } else {
      setSelectedZoneIdForDetail(null);
    }
  }, [zonesList, selectedZoneIdForDetail]);

  const activeZone = useMemo(() => {
    return zonesList.find((z) => z.id === selectedZoneIdForDetail) || zonesList[0] || null;
  }, [zonesList, selectedZoneIdForDetail]);

  const filteredRacks = useMemo(() => {
    let list = racksList;
    if (masterRackFilter !== 'all') {
      list = list.filter((r) => r.rack_type === masterRackFilter);
    }
    if (masterSearch.trim()) {
      const term = masterSearch.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.rack_code.toLowerCase().includes(term) ||
          r.rack_name.toLowerCase().includes(term) ||
          (r.zone_name && r.zone_name.toLowerCase().includes(term))
      );
    }
    return list;
  }, [racksList, masterRackFilter, masterSearch]);

  // Danh mục Kệ & Dãy thuộc khu vực đang được chọn ở cột trái (Master-Detail)
  const detailRacks = useMemo(() => {
    if (!activeZone) return filteredRacks;
    return filteredRacks.filter(
      (r) =>
        (r.zone_id && r.zone_id === activeZone.id) ||
        (r.zone_name && r.zone_name.toLowerCase() === activeZone.zone_name.toLowerCase())
    );
  }, [filteredRacks, activeZone]);

  // Đếm số lượng kệ trực thuộc khu vực
  const getZoneRacksCount = useCallback(
    (zone: WarehouseZoneItem) => {
      return racksList.filter(
        (r) =>
          (r.zone_id && r.zone_id === zone.id) ||
          (r.zone_name && r.zone_name.toLowerCase() === zone.zone_name.toLowerCase())
      ).length;
    },
    [racksList]
  );

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
    setIsWhFormPageActive(true);
    setIsWhModalOpen(false);
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
    setIsWhFormPageActive(true);
    setIsWhModalOpen(false);
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
    if (whFormData.phone.trim() && !/^0[2-9][0-9]{8}$/.test(whFormData.phone.trim())) {
      errors.phone = 'Số điện thoại không hợp lệ (yêu cầu 10 chữ số bắt đầu bằng 0).';
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
      setIsWhFormPageActive(false);
      setEditingWarehouse(null);
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

  // --- TỰ ĐỘNG GỢI Ý MÃ VÀ TÊN VỊ TRÍ THEO LỰA CHỌN DROPDOWN ---
  const handleAutoGenerateLocationCodeAndName = (
    zVal?: string,
    aVal?: string,
    rVal?: string
  ) => {
    const zone = zVal !== undefined ? zVal : locFormData.zone;
    const aisle = aVal !== undefined ? aVal : locFormData.aisle;
    const rack = rVal !== undefined ? rVal : locFormData.rack;

    const rawWhCode = selectedWarehouse?.code || 'HN';
    const whPrefix = rawWhCode.replace(/^KHO[-_]?/i, '') || rawWhCode;

    let zPart = '';
    if (zone) {
      const m = zone.match(/khu\s+([a-zA-Z0-9]+)/i);
      zPart = m ? `K${m[1].toUpperCase()}` : zone.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
    }

    let aPart = '';
    if (aisle) {
      const m = aisle.match(/dãy\s+([a-zA-Z0-9]+)/i);
      aPart = m ? `D${m[1].toUpperCase()}` : aisle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
    }

    let rPart = '';
    if (rack) {
      const mt = rack.match(/tầng\s+([a-zA-Z0-9]+)/i);
      const mk = rack.match(/kệ\s+([a-zA-Z0-9]+)/i);
      if (mt) rPart = `T${mt[1].toUpperCase()}`;
      else if (mk) rPart = `K${mk[1].toUpperCase()}`;
      else rPart = rack.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
    }

    const codeParts = [whPrefix, zPart, aPart, rPart].filter(Boolean);
    const genCode = codeParts.join('-');

    const nameParts = [zone, aisle, rack].filter(Boolean);
    const genName = nameParts.join(' - ');

    setLocFormData((prev) => ({
      ...prev,
      location_code: genCode || prev.location_code,
      location_name: genName || prev.location_name,
    }));
  };

  // --- XỬ LÝ SUBMIT VỊ TRÍ ---
  const handleOpenCreateLocation = () => {
    setEditingLocation(null);
    setLocFormData({
      location_code: '',
      location_name: '',
      zone: zonesList[0]?.zone_name || '',
      aisle: 'Dãy 1',
      rack: 'Tầng 1',
      bin: '',
      max_capacity: 500,
      initial_quantity: 0,
      unit: 'Cái',
      status: 'Đang sử dụng',
      note: '',
    });
    setLocFormErrors({});
    setIsLocFormPageActive(true);
    setIsLocModalOpen(false);
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
      max_capacity: loc.max_capacity || 500,
      initial_quantity: loc.total_quantity || 0,
      unit: 'Cái',
      status: loc.status || 'Đang sử dụng',
      note: loc.note || '',
    });
    setLocFormErrors({});
    setIsLocFormPageActive(true);
    setIsLocModalOpen(false);
  };

  // --- MASTER DATA: QUẢN LÝ KHU VỰC (ZONE HANDLERS) ---
  const handleOpenCreateZone = () => {
    setEditingZone(null);
    const nextCode = `KHU-${String.fromCharCode(65 + zonesList.length)}`;
    setZoneFormData({
      zone_code: nextCode,
      zone_name: '',
      description: '',
      is_active: true,
    });
    setZoneFormErrors({});
    setIsZoneFormPageActive(true);
    setIsZoneModalOpen(false);
  };

  const handleOpenEditZone = (zone: WarehouseZoneItem) => {
    setEditingZone(zone);
    setZoneFormData({
      zone_code: zone.zone_code,
      zone_name: zone.zone_name,
      description: zone.description || '',
      is_active: zone.is_active,
    });
    setZoneFormErrors({});
    setIsZoneFormPageActive(true);
    setIsZoneModalOpen(false);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    const errors: Record<string, string> = {};
    if (!zoneFormData.zone_code.trim()) errors.zone_code = 'Mã khu vực không được để trống.';
    if (!zoneFormData.zone_name.trim()) errors.zone_name = 'Tên khu vực không được để trống.';
    if (Object.keys(errors).length > 0) {
      setZoneFormErrors(errors);
      return;
    }
    setIsZoneSubmitting(true);
    try {
      if (editingZone) {
        await updateWarehouseZoneApi(token, editingZone.id, {
          zone_code: zoneFormData.zone_code.trim().toUpperCase(),
          zone_name: zoneFormData.zone_name.trim(),
          description: zoneFormData.description.trim() || undefined,
          is_active: zoneFormData.is_active,
        });
        setSuccessMsg(`Cập nhật khu vực '${zoneFormData.zone_name}' thành công.`);
      } else {
        await createWarehouseZoneApi(token, selectedWarehouse.id, {
          zone_code: zoneFormData.zone_code.trim().toUpperCase(),
          zone_name: zoneFormData.zone_name.trim(),
          description: zoneFormData.description.trim() || undefined,
          is_active: zoneFormData.is_active,
        });
        setSuccessMsg(`Thêm khu vực mới '${zoneFormData.zone_name}' thành công.`);
      }
      setIsZoneModalOpen(false);
      setIsZoneFormPageActive(false);
      setEditingZone(null);
      fetchMasterData(selectedWarehouse.id);
      fetchLocations(selectedWarehouse.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi lưu thông tin khu vực');
    } finally {
      setIsZoneSubmitting(false);
    }
  };

  const handleDeleteZoneConfirm = async () => {
    if (!deletingZone || !selectedWarehouse) return;
    try {
      await deleteWarehouseZoneApi(token, deletingZone.id);
      setSuccessMsg(`Đã xóa khu vực '${deletingZone.zone_name}'.`);
      setDeletingZone(null);
      fetchMasterData(selectedWarehouse.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xóa khu vực');
      setDeletingZone(null);
    }
  };

  // --- MASTER DATA: QUẢN LÝ KỆ / DÃY (RACK / AISLE HANDLERS) ---
  const handleOpenCreateRack = (preselectedZoneId?: number) => {
    setEditingRack(null);
    const targetZoneId = preselectedZoneId || selectedZoneIdForDetail || zonesList[0]?.id || 0;
    const targetZoneObj = zonesList.find((z) => z.id === targetZoneId) || zonesList[0];
    const cleanZ = (targetZoneObj?.zone_code || 'KC').replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || 'K';
    const nextCode = `${cleanZ}-D1-T1`;
    setRackFormData({
      rack_code: nextCode,
      rack_name: '',
      rack_type: 'rack',
      zone_id: targetZoneId,
      max_capacity: 500,
      is_active: true,
      aisle_input: '',
      rack_input: '',
    });
    setRackFormErrors({});
    setIsRackFormPageActive(true);
    setIsRackModalOpen(false);
  };

  const handleOpenEditRack = (rack: WarehouseRackItem) => {
    setEditingRack(rack);
    let aPart = '';
    let rPart = rack.rack_name;
    if (rack.rack_name.includes(' - ')) {
      const parts = rack.rack_name.split(' - ');
      aPart = parts[0].trim();
      rPart = parts[1].trim();
    }
    setRackFormData({
      rack_code: rack.rack_code,
      rack_name: rack.rack_name,
      rack_type: rack.rack_type,
      zone_id: rack.zone_id || 0,
      max_capacity: rack.max_capacity || 500,
      is_active: rack.is_active,
      aisle_input: aPart,
      rack_input: rPart,
    });
    setRackFormErrors({});
    setIsRackFormPageActive(true);
    setIsRackModalOpen(false);
  };

  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    const errors: Record<string, string> = {};
    const finalName = rackFormData.rack_name.trim() ||
      [rackFormData.aisle_input.trim(), rackFormData.rack_input.trim()].filter(Boolean).join(' - ');
    if (!rackFormData.rack_code.trim()) errors.rack_code = 'Mã kệ/dãy không được để trống.';
    if (!finalName) errors.rack_name = 'Vui lòng điền Dãy kệ và Tầng / Kệ.';
    if (Object.keys(errors).length > 0) {
      setRackFormErrors(errors);
      return;
    }
    setIsRackSubmitting(true);
    try {
      if (editingRack) {
        await updateWarehouseRackApi(token, editingRack.id, {
          rack_code: rackFormData.rack_code.trim().toUpperCase(),
          rack_name: finalName,
          rack_type: rackFormData.rack_type,
          zone_id: rackFormData.zone_id > 0 ? rackFormData.zone_id : undefined,
          max_capacity: Number(rackFormData.max_capacity) || 500,
          is_active: rackFormData.is_active,
        });
        setSuccessMsg(`Cập nhật kệ/dãy '${finalName}' thành công.`);
      } else {
        await createWarehouseRackApi(token, selectedWarehouse.id, {
          rack_code: rackFormData.rack_code.trim().toUpperCase(),
          rack_name: finalName,
          rack_type: rackFormData.rack_type,
          zone_id: rackFormData.zone_id > 0 ? rackFormData.zone_id : undefined,
          max_capacity: Number(rackFormData.max_capacity) || 500,
          is_active: rackFormData.is_active,
        });
        setSuccessMsg(`Thêm kệ/dãy mới '${finalName}' thành công. Vị trí đã tự động hiển thị ở Danh sách vị trí kệ.`);
      }
      setIsRackModalOpen(false);
      setIsRackFormPageActive(false);
      setEditingRack(null);
      await Promise.all([
        fetchMasterData(selectedWarehouse.id),
        fetchLocations(selectedWarehouse.id),
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi lưu thông tin kệ/dãy');
    } finally {
      setIsRackSubmitting(false);
    }
  };

  const handleDeleteRackConfirm = async () => {
    if (!deletingRack || !selectedWarehouse) return;
    try {
      await deleteWarehouseRackApi(token, deletingRack.id);
      setSuccessMsg(`Đã xóa kệ/dãy '${deletingRack.rack_name}'.`);
      setDeletingRack(null);
      await Promise.all([
        fetchMasterData(selectedWarehouse.id),
        fetchLocations(selectedWarehouse.id),
      ]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể xóa kệ/dãy');
      setDeletingRack(null);
    }
  };

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    const errors: Record<string, string> = {};
    if (!locFormData.location_code.trim()) {
      errors.location_code = 'Mã vị trí / kệ không được để trống.';
    }
    if (!locFormData.max_capacity || Number(locFormData.max_capacity) < 1) {
      errors.max_capacity = 'Sức chứa tối đa phải từ 1 trở lên.';
    }
    if (!locFormData.aisle || !locFormData.rack) {
      errors.aisle_rack = 'Vui lòng chọn dãy kệ và tầng.';
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
          max_capacity: Number(locFormData.max_capacity) || 500,
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
          max_capacity: Number(locFormData.max_capacity) || 500,
          status: locFormData.status,
          note: locFormData.note.trim() || undefined,
        });
        setSuccessMsg(`Thêm vị trí mới '${locFormData.location_code}' thành công.`);
      }
      setIsLocModalOpen(false);
      setIsLocFormPageActive(false);
      setEditingLocation(null);
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

  const fetchAllocationStatus = useCallback(async (warehouseId: number, productId: number) => {
    if (!warehouseId || !productId) return;
    setIsFetchingAllocation(true);
    try {
      const res = await getProductLocationAllocationStatusApi(token, warehouseId, productId);
      setAssignAllocationStatus(res);
    } catch (err) {
      console.warn('Failed to fetch allocation status', err);
      setAssignAllocationStatus(null);
    } finally {
      setIsFetchingAllocation(false);
    }
  }, [token]);

  // --- XỬ LÝ GÁN SẢN PHẨM VÀO VỊ TRÍ ---
  const handleOpenAssignProduct = (preferredProductId?: number | React.MouseEvent, preferredLocationId?: number) => {
    if (locations.length === 0) {
      setErrorMsg('Kho này chưa có vị trí kệ nào. Vui lòng tạo vị trí trước khi gán hàng.');
      return;
    }

    if (selectedWarehouse) {
      fetchLocationProducts(selectedWarehouse.id);
    }

    const actualPid = typeof preferredProductId === 'number' ? preferredProductId : undefined;
    const actualLocId = typeof preferredLocationId === 'number' ? preferredLocationId : undefined;
    const initialLocationId = actualLocId || locations[0]?.id || 0;

    let targetProd = actualPid ? allProducts.find((p) => p.id === actualPid) : undefined;
    if (!targetProd) {
      targetProd = allProducts.find((p) => {
        const assignedAll = locationProducts
          .filter((lp) => lp.product_id === p.id)
          .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
        const whStock = getProductWarehouseStock(p.id, p.stock || 0);
        return whStock - assignedAll > 0;
      }) || allProducts[0];
    }

    const targetProdId = targetProd?.id || 1;
    const curLocItem = locationProducts.find(
      (lp) => lp.location_id === initialLocationId && lp.product_id === targetProdId
    );
    const existingQtyOnLoc = curLocItem ? Number(curLocItem.quantity) || 0 : 0;
    const assignedOther = locationProducts
      .filter((lp) => lp.product_id === targetProdId && lp.location_id !== initialLocationId)
      .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
    const targetWhStock = getProductWarehouseStock(targetProdId, targetProd?.stock || 0);
    const unassigned = Math.max(0, targetWhStock - assignedOther - existingQtyOnLoc);

    setSelectedDropdownProduct(targetProd || null);
    setAssignFormData({
      location_id: initialLocationId,
      product_id: targetProdId,
      quantity: existingQtyOnLoc > 0 ? existingQtyOnLoc : unassigned,
    });
    setAssignProductSearch('');
    setIsAssignFormPageActive(true);
    setIsAssignModalOpen(false);
    if (selectedWarehouse) {
      fetchAllocationStatus(selectedWarehouse.id, targetProdId);
    }
  };

  // Tự động đồng bộ chi tiết phân bổ khi đổi sản phẩm cần gán
  useEffect(() => {
    if (selectedWarehouse && assignFormData.product_id && (isAssignFormPageActive || isAssignModalOpen)) {
      fetchAllocationStatus(selectedWarehouse.id, assignFormData.product_id);
    }
  }, [selectedWarehouse, assignFormData.product_id, isAssignFormPageActive, isAssignModalOpen, fetchAllocationStatus]);

  // --- KIỂM TRA SỨC CHỨA VỊ TRÍ KỆ (RACK LEVEL) ---
  const checkRackCapacity = (
    locationId: number,
    productId: number,
    targetQtyForThisProduct: number
  ): {
    ok: boolean;
    locationCode: string;
    currentStock: number;
    maxCapacity: number;
    attemptedAdd: number;
    availableSpace: number;
  } => {
    const targetLoc = locations.find((l) => l.id === locationId);
    const locCode = targetLoc?.location_code || 'Kệ';
    const maxCap = Number(targetLoc?.max_capacity) || 500;

    // Tổng số lượng của các sản phẩm KHÁC tại vị trí này
    const otherProductsStock = locationProducts
      .filter((lp) => lp.location_id === locationId && lp.product_id !== productId)
      .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);

    const curProductStock = locationProducts
      .find((lp) => lp.location_id === locationId && lp.product_id === productId)
      ?.quantity || 0;

    const curLocTotal = otherProductsStock + curProductStock;
    const newLocTotal = otherProductsStock + targetQtyForThisProduct;
    const netIncrease = targetQtyForThisProduct - curProductStock;
    const available = Math.max(0, maxCap - curLocTotal);

    if (maxCap > 0 && newLocTotal > maxCap) {
      return {
        ok: false,
        locationCode: locCode,
        currentStock: curLocTotal,
        maxCapacity: maxCap,
        attemptedAdd: Math.max(0, netIncrease),
        availableSpace: available,
      };
    }
    return {
      ok: true,
      locationCode: locCode,
      currentStock: curLocTotal,
      maxCapacity: maxCap,
      attemptedAdd: Math.max(0, netIncrease),
      availableSpace: available,
    };
  };

  // --- KIỂM TRA SỨC CHỨA KHU VỰC (ZONE LEVEL) ---
  const checkZoneCapacity = (
    zoneName: string,
    addedQuantity: number
  ): { ok: boolean; currentStock: number; maxCapacity: number } => {
    const trimmedZone = (zoneName || '').trim().toLowerCase();
    const zoneLocs = locations.filter(
      (l) => (l.zone || '').trim().toLowerCase() === trimmedZone
    );
    const totalCap = zoneLocs.reduce(
      (sum, l) => sum + (Number(l.max_capacity) || 0),
      0
    );
    const curStock = zoneLocs.reduce(
      (sum, l) => sum + (Number(l.total_quantity) || 0),
      0
    );

    if (totalCap > 0 && curStock + addedQuantity > totalCap) {
      return { ok: false, currentStock: curStock, maxCapacity: totalCap };
    }
    return { ok: true, currentStock: curStock, maxCapacity: totalCap };
  };

  const handleSaveAssignProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    if (assignFormData.location_id <= 0 || assignFormData.product_id <= 0) {
      setErrorMsg('Vui lòng chọn vị trí và sản phẩm hợp lệ.');
      return;
    }
    const targetQty = Number(assignFormData.quantity);
    if (targetQty < 0) {
      setErrorMsg('Số lượng gán không được nhỏ hơn 0.');
      return;
    }

    const targetLoc = locations.find((l) => l.id === assignFormData.location_id);
    const targetLocCode = targetLoc?.location_code || 'Kệ';
    const zoneName = targetLoc?.zone || 'Khu A';
    const existingStock = locationProducts.find(
      (lp) => lp.location_id === assignFormData.location_id && lp.product_id === assignFormData.product_id
    );
    const oldQty = existingStock ? existingStock.quantity : 0;
    const netIncrease = targetQty - oldQty;

    // 0. KIỂM TRA TỒN CHƯA PHÂN BỔ CỦA SẢN PHẨM TRONG KHO
    const targetProd = allProducts.find((p) => p.id === assignFormData.product_id);
    const curProductShelfItems = locationProducts.filter(
      (lp) => lp.product_id === assignFormData.product_id
    );
    const whStock =
      assignAllocationStatus?.warehouse_total_stock ??
      getProductWarehouseStock(assignFormData.product_id, targetProd?.stock ?? 0);
    const allocatedOther = curProductShelfItems
      .filter((lp) => lp.location_id !== assignFormData.location_id)
      .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
    const maxAllowedForLoc = Math.max(0, whStock - allocatedOther);

    if (targetQty > maxAllowedForLoc) {
      const msg = `Không thể gán ${targetQty} SP! Sản phẩm "${targetProd?.name}" đã được gán hết hoặc không đủ tồn chưa gán. Tối đa chỉ có thể gán ${maxAllowedForLoc} ${targetProd?.base_unit || 'Cái'} vào vị trí này (Tổng tồn: ${whStock}, đã gán ở các kệ khác: ${allocatedOther}).`;
      emitStatusToast({
        message: msg,
        type: 'error',
        title: 'Chặn gán vượt tồn kho',
      });
      setErrorMsg(msg);
      return;
    }

    if (netIncrease > 0) {
      // 1. Kiểm tra tải trọng và sức chứa của vị trí kệ
      const rackCheck = checkRackCapacity(assignFormData.location_id, assignFormData.product_id, targetQty);
      if (!rackCheck.ok) {
        emitStatusToast({
          message: `Vượt quá sức chứa và tải trọng của kệ ${targetLocCode}! Chỉ còn chỗ cho ${rackCheck.availableSpace} SP.`,
          type: 'warning',
          title: 'Cảnh báo quá tải kệ',
        });
        setErrorMsg(`Vị trí kệ ${targetLocCode} chỉ có sức chứa tối đa là ${rackCheck.maxCapacity} SP. Số lượng hàng vượt quá tải trọng cho phép.`);
        return;
      }

      // 2. Kiểm tra sức chứa khu vực
      const capCheck = checkZoneCapacity(zoneName, netIncrease);
      if (!capCheck.ok) {
        emitStatusToast({
          message: `Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa. Vui lòng sắp xếp vị trí khác hoặc mở thêm kho mới.`,
          type: 'warning',
          title: 'Cảnh báo đầy kho',
        });
        setErrorMsg(`Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa.`);
        return;
      }
    }

    setIsAssignSubmitting(true);
    try {
      const res = await assignProductToLocationApi(
        token,
        assignFormData.location_id,
        assignFormData.product_id,
        targetQty
      );
      setSuccessMsg(res.message || 'Đã gán sản phẩm vào vị trí thành công.');
      setIsAssignModalOpen(false);
      setIsAssignFormPageActive(false);
      await Promise.all([
        fetchLocationProducts(selectedWarehouse.id),
        fetchLocations(selectedWarehouse.id),
        fetchWarehouses(),
        fetchProductsList(),
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi gán sản phẩm';
      emitStatusToast({
        message: errMsg,
        type: 'error',
        title: 'Lỗi gán sản phẩm',
      });
      setErrorMsg(errMsg);
    } finally {
      setIsAssignSubmitting(false);
    }
  };

  // --- THAO TÁC THÊM HÀNG VÀO VỊ TRÍ KỆ HIỆN TẠI ---
  const handleOpenAddStock = (item: LocationProductStockItem) => {
    setAddStockItem(item);
    const curProductShelfItems = locationProducts.filter((lp) => lp.product_id === item.product_id);
    const otherShelvesQty = curProductShelfItems
      .filter((lp) => lp.location_id !== item.location_id)
      .reduce((s, lp) => s + (Number(lp.quantity) || 0), 0);
    const maxAllowed = Math.max(0, item.warehouse_total_stock - otherShelvesQty);
    const unallocated = Math.max(0, maxAllowed - item.quantity);
    setAddStockQuantity(unallocated > 0 ? Math.min(10, unallocated) : 0);
    setIsAddStockModalOpen(true);
  };

  const handleSaveAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse || !addStockItem) return;

    const qtyToAdd = Number(addStockQuantity);
    if (qtyToAdd <= 0) {
      setErrorMsg('Số lượng hàng nhập thêm phải lớn hơn 0.');
      return;
    }

    const targetLoc = locations.find((l) => l.id === addStockItem.location_id);
    const targetLocCode = targetLoc?.location_code || addStockItem.location_code;
    const zoneName = targetLoc?.zone || addStockItem.zone || 'Khu A';
    const newTotalForThisProduct = addStockItem.quantity + qtyToAdd;

    // 0. Kiểm tra số tồn chưa phân bổ của kho
    const curProductShelfItems = locationProducts.filter(
      (lp) => lp.product_id === addStockItem.product_id
    );
    const otherShelvesQty = curProductShelfItems
      .filter((lp) => lp.location_id !== addStockItem.location_id)
      .reduce((s, lp) => s + (Number(lp.quantity) || 0), 0);
    const maxAllowedOnThisShelf = Math.max(0, addStockItem.warehouse_total_stock - otherShelvesQty);
    const unallocatedAvail = Math.max(0, maxAllowedOnThisShelf - addStockItem.quantity);

    if (qtyToAdd > unallocatedAvail) {
      emitStatusToast({
        message: `Vượt quá tồn chưa phân bổ của kho! Chỉ còn có thể thêm tối đa ${unallocatedAvail} ${addStockItem.base_unit || 'Cái'}.`,
        type: 'error',
        title: 'Chặn thêm vượt tồn kho',
      });
      setErrorMsg(`Vượt quá tồn chưa phân bổ! Chỉ còn có thể thêm tối đa ${unallocatedAvail} ${addStockItem.base_unit || 'Cái'}.`);
      return;
    }

    // 1. Kiểm tra sức chứa & tải trọng kệ cụ thể
    const rackCheck = checkRackCapacity(addStockItem.location_id, addStockItem.product_id, newTotalForThisProduct);
    if (!rackCheck.ok) {
      emitStatusToast({
        message: `Vượt quá sức chứa và tải trọng của kệ ${targetLocCode}! Vui lòng giảm số lượng nhập hoặc chuyển sang kệ khác (chỉ còn chỗ cho ${rackCheck.availableSpace} SP).`,
        type: 'warning',
        title: 'Cảnh báo quá tải kệ',
      });
      setErrorMsg(`Vị trí kệ ${targetLocCode} chỉ có sức chứa tối đa là ${rackCheck.maxCapacity} SP. Không thể nhập thêm vượt tải trọng.`);
      return;
    }

    // 2. Kiểm tra giới hạn sức chứa toàn Khu vực
    const zoneCheck = checkZoneCapacity(zoneName, qtyToAdd);
    if (!zoneCheck.ok) {
      emitStatusToast({
        message: `Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa. Vui lòng sắp xếp vị trí khác hoặc mở thêm kho mới.`,
        type: 'warning',
        title: 'Cảnh báo đầy kho',
      });
      setErrorMsg(`Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa.`);
      return;
    }

    setIsAddStockSubmitting(true);
    try {
      const res = await assignProductToLocationApi(
        token,
        addStockItem.location_id,
        addStockItem.product_id,
        newTotalForThisProduct
      );
      setSuccessMsg(
        res.message ||
          `Đã thêm thành công ${qtyToAdd.toLocaleString('vi-VN')} ${addStockItem.base_unit || 'Cái'} vào vị trí ${targetLocCode}.`
      );
      setIsAddStockModalOpen(false);
      setAddStockItem(null);
      await Promise.all([
        fetchLocationProducts(selectedWarehouse.id),
        fetchLocations(selectedWarehouse.id),
        fetchWarehouses(),
        fetchProductsList(),
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi nhập thêm hàng';
      emitStatusToast({
        message: errMsg,
        type: 'error',
        title: 'Lỗi nhập thêm hàng',
      });
      setErrorMsg(errMsg);
    } finally {
      setIsAddStockSubmitting(false);
    }
  };

  // --- XỬ LÝ CHUYỂN VỊ TRÍ SẢN PHẨM ---
  const handleOpenTransferProduct = (item: LocationProductStockItem, targetLocId?: number) => {
    const otherLocations = locations.filter((l) => l.id !== item.location_id);
    if (otherLocations.length === 0) {
      setErrorMsg('Kho này chỉ có 1 vị trí kệ, không có vị trí khác để chuyển tới.');
      return;
    }
    const defaultToLocId = targetLocId && otherLocations.some((l) => l.id === targetLocId)
      ? targetLocId
      : otherLocations[0].id;

    setTransferFormData({
      from_location_id: item.location_id,
      to_location_id: defaultToLocId,
      product_id: item.product_id,
      quantity: Math.min(10, item.quantity),
      product_name: item.product_name,
      max_available: item.quantity,
    });
    setIsTransferModalOpen(true);
  };

  const handleSaveTransferProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    const transferQty = Number(transferFormData.quantity);
    if (!transferQty || transferQty <= 0) {
      setErrorMsg('Số lượng chuyển phải lớn hơn 0.');
      return;
    }
    if (transferQty > transferFormData.max_available) {
      setErrorMsg(`Số lượng chuyển (${transferQty}) vượt quá tồn tại vị trí (${transferFormData.max_available}).`);
      return;
    }
    setIsTransferSubmitting(true);
    try {
      const res = await transferLocationProductApi(
        token,
        transferFormData.from_location_id,
        transferFormData.to_location_id,
        transferFormData.product_id,
        transferQty
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

  // 1. TRANG KHAI BÁO / CHỈNH SỬA KHO HÀNG (FULL PAGE VIEW: 3 Ô CỘT NGANG 100% ĐÓNG KHUNG)
  if (isWhFormPageActive) {
    return (
      <div className="wh-container wh-form-fullscreen-wrap">
        <div className="wh-form-master-frame">
          <div className="wh-form-page-header">
            <button
              type="button"
              className="wh-btn wh-btn-secondary"
              onClick={() => {
                setIsWhFormPageActive(false);
                setEditingWarehouse(null);
                setWhFormErrors({});
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Quay lại danh sách kho
            </button>
            <h2>{editingWarehouse ? `Cập nhật kho hàng: ${editingWarehouse.name}` : 'Khai Báo Kho Hàng Mới'}</h2>
          </div>

          <form onSubmit={handleSaveWarehouse} className="wh-form-layout-3col">
            {/* Ô 1: Thông tin kho hàng (3 phần) */}
            <div className="wh-form-card wh-col-info">
              <h3>Thông tin kho hàng</h3>
              <div className="wh-form-col-fields">
                <div className="wh-form-field">
                  <span>Mã kho hàng <b>*</b></span>
                  <div className="wh-code-input-wrap">
                    <input
                      type="text"
                      placeholder="VD: KHO_HN, KHO_HCM..."
                      disabled={Boolean(editingWarehouse)}
                      value={whFormData.code}
                      onChange={(e) => setWhFormData({ ...whFormData, code: e.target.value.toUpperCase() })}
                    />
                    {!editingWarehouse && (
                      <button
                        type="button"
                        className="wh-btn-code-gen"
                        onClick={() => {
                          const rand = Math.floor(10 + Math.random() * 90);
                          setWhFormData({ ...whFormData, code: `KHO_${rand}` });
                        }}
                        title="Sinh ngẫu nhiên mã kho"
                      >
                        Sinh mã
                      </button>
                    )}
                  </div>
                  {whFormErrors.code && <div className="wh-form-field-error">{whFormErrors.code}</div>}
                </div>

                <div className="wh-form-field">
                  <span>Tên kho hàng <b>*</b></span>
                  <input
                    type="text"
                    placeholder="VD: Kho Tổng Hà Nội"
                    value={whFormData.name}
                    onChange={(e) => setWhFormData({ ...whFormData, name: e.target.value })}
                  />
                  {whFormErrors.name && <div className="wh-form-field-error">{whFormErrors.name}</div>}
                </div>

                <div className="wh-form-field">
                  <span>Trạng thái hoạt động</span>
                  <select
                    value={whFormData.status}
                    onChange={(e) => setWhFormData({ ...whFormData, status: e.target.value })}
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Ngừng hoạt động">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Ô 2: Địa chỉ & Người phụ trách (3 phần) */}
            <div className="wh-form-card wh-col-contact">
              <h3>Địa chỉ & Người phụ trách</h3>
              <div className="wh-form-col-fields">
                <div className="wh-form-field">
                  <span>Địa chỉ kho</span>
                  <input
                    type="text"
                    placeholder="VD: Lô CN1, Khu Công Nghiệp Từ Liêm, Hà Nội"
                    value={whFormData.address}
                    onChange={(e) => setWhFormData({ ...whFormData, address: e.target.value })}
                  />
                </div>

                <div className="wh-form-field">
                  <span>Người phụ trách kho</span>
                  <WarehouseKeeperSelectDropdown
                    token={token}
                    selectedManagerName={whFormData.manager_name}
                    onSelectKeeper={(keeper) => {
                      setWhFormData((prev) => ({
                        ...prev,
                        manager_name: keeper.full_name || keeper.username,
                        phone: keeper.phone || prev.phone,
                      }));
                    }}
                    onClearKeeper={() => {
                      setWhFormData((prev) => ({
                        ...prev,
                        manager_name: '',
                      }));
                    }}
                    placeholder="Chọn thủ kho phụ trách..."
                  />
                </div>

                <div className="wh-form-field">
                  <span>Số điện thoại liên hệ</span>
                  <input
                    type="tel"
                    placeholder="Số điện thoại (10 chữ số)"
                    value={whFormData.phone}
                    onChange={(e) => setWhFormData({ ...whFormData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  />
                  {whFormErrors.phone && <div className="wh-form-field-error">{whFormErrors.phone}</div>}
                </div>
              </div>
            </div>

            {/* Ô 3: Tổng kết kho hàng (2 phần) */}
            <div className="wh-form-card wh-col-summary">
              <h3 className="wh-summary-title-centered">Tổng kết kho hàng</h3>
              <div className="wh-summary-rows">
                <div className="wh-summary-row">
                  <span>Mã kho:</span>
                  <strong>{whFormData.code || '---'}</strong>
                </div>
                <div className="wh-summary-row">
                  <span>Tên kho:</span>
                  <strong>{whFormData.name || '---'}</strong>
                </div>
                <div className="wh-summary-row">
                  <span>Người phụ trách:</span>
                  <strong>{whFormData.manager_name || 'Chưa phân công'}</strong>
                </div>
                <div className="wh-summary-row">
                  <span>Số điện thoại:</span>
                  <strong>{whFormData.phone || '---'}</strong>
                </div>
                <div className="wh-summary-row">
                  <span>Trạng thái:</span>
                  <strong style={{ color: whFormData.status === 'Đang hoạt động' ? '#059669' : '#dc2626' }}>
                    {whFormData.status}
                  </strong>
                </div>
              </div>

              <div className="wh-summary-actions">
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary wh-btn-block"
                  disabled={isWhSubmitting}
                >
                  {isWhSubmitting ? 'Đang lưu...' : editingWarehouse ? 'Cập nhật kho' : 'Tạo kho hàng'}
                </button>
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary wh-btn-block"
                  onClick={() => {
                    setIsWhFormPageActive(false);
                    setEditingWarehouse(null);
                    setWhFormErrors({});
                  }}
                  disabled={isWhSubmitting}
                >
                  Hủy bỏ
                </button>
                <p className="wh-summary-hint">
                  Kho hàng sẽ được kết nối với hệ thống vị trí kệ và quản lý tồn kho tự động.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. TRANG KHAI BÁO / CHỈNH SỬA VỊ TRÍ KỆ (FULL PAGE VIEW: 3 Ô CỘT NGANG 100% ĐÓNG KHUNG)
  if (isLocFormPageActive && selectedWarehouse) {
    return (
      <div className="wh-container wh-form-fullscreen-wrap">
        <div className="wh-form-master-frame">
          <div className="wh-form-page-header">
          <button
            type="button"
            className="wh-btn wh-btn-secondary"
            onClick={() => {
              setIsLocFormPageActive(false);
              setEditingLocation(null);
              setLocFormErrors({});
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Quay lại danh sách vị trí kệ
          </button>
          <h2>{editingLocation ? `Cập nhật vị trí kệ: ${editingLocation.location_code}` : 'Khai Báo Vị Trí Lưu Kho Mới'}</h2>
        </div>

        <form onSubmit={handleSaveLocation} className="wh-form-layout-3col">
          {/* Ô 1: Kho & Khu vực lưu trữ (3 phần) */}
          <div className="wh-form-card wh-col-info">
            <h3>Kho & Khu vực lưu trữ</h3>
            <div className="wh-form-col-fields">
              <div className="wh-form-field">
                <span>Kho hàng áp dụng</span>
                <div style={{
                  padding: '6px 10px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '6px',
                  color: '#1e40af',
                  fontSize: '12px',
                  fontWeight: 700
                }}>
                  {selectedWarehouse.name} ({selectedWarehouse.code})
                </div>
              </div>

              <div className="wh-form-field">
                <span>Khu vực lưu kho <b>*</b></span>
                <select
                  value={locFormData.zone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocFormData((prev) => ({ ...prev, zone: val }));
                    handleAutoGenerateLocationCodeAndName(val, undefined, undefined);
                  }}
                >
                  <option value="">-- Chọn khu vực lưu kho --</option>
                  {zonesList.length > 0 ? (
                    zonesList.map((z) => (
                      <option key={z.id} value={z.zone_name}>
                        {z.zone_name}
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>Chưa có khu vực nào</option>
                  )}
                </select>
              </div>

              <div className="wh-form-field">
                <span>Dãy kệ và Tầng / Kệ <b>*</b></span>
                <select
                  value={
                    locFormData.aisle && locFormData.rack
                      ? `${locFormData.aisle} - ${locFormData.rack}`
                      : ''
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (!val) {
                      setLocFormData((prev) => ({ ...prev, aisle: '', rack: '' }));
                      return;
                    }
                    const parts = val.split(' - ');
                    const newAisle = parts[0] || '';
                    const newRack = parts[1] || '';
                    setLocFormData((prev) => ({ ...prev, aisle: newAisle, rack: newRack }));
                    handleAutoGenerateLocationCodeAndName(undefined, newAisle, newRack);
                  }}
                >
                  <option value="">-- Chọn dãy kệ và tầng --</option>
                  {[
                    'Dãy 1 - Tầng 1',
                    'Dãy 1 - Tầng 2',
                    'Dãy 2 - Tầng 1',
                    'Dãy 2 - Tầng 2',
                    'Dãy 3 - Tầng 1',
                    'Dãy 3 - Tầng 2',
                  ].map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {locFormErrors.aisle_rack && (
                  <div className="wh-form-field-error">{locFormErrors.aisle_rack}</div>
                )}
              </div>
            </div>
          </div>

          {/* Ô 2: Thông số vị trí & Sức chứa (3 phần) */}
          <div className="wh-form-card wh-col-capacity">
            <h3>Thông số & Sức chứa</h3>
            <div className="wh-form-col-fields">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div className="wh-form-field">
                  <span>Sức chứa tối đa <b>*</b></span>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="VD: 500"
                    value={locFormData.max_capacity === 0 || locFormData.max_capacity === '' ? '' : locFormData.max_capacity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setLocFormData((prev) => ({ ...prev, max_capacity: '' }));
                        return;
                      }
                      const clean = raw.replace(/^0+(?=\d)/, '');
                      if (clean === '0') {
                        setLocFormData((prev) => ({ ...prev, max_capacity: '' }));
                        return;
                      }
                      setLocFormData((prev) => ({ ...prev, max_capacity: Number(clean) }));
                    }}
                  />
                  {locFormErrors.max_capacity && (
                    <div className="wh-form-field-error">{locFormErrors.max_capacity}</div>
                  )}
                </div>

                <div className="wh-form-field">
                  <span>Đơn vị tính</span>
                  <select
                    value={locFormData.unit}
                    onChange={(e) => setLocFormData((prev) => ({ ...prev, unit: e.target.value }))}
                  >
                    <option value="Cái">Cái</option>
                    <option value="Chiếc">Chiếc</option>
                    <option value="Thùng">Thùng</option>
                    <option value="Hộp">Hộp</option>
                  </select>
                </div>
              </div>

              <div className="wh-form-field">
                <span>Mã vị trí / Kệ <b>*</b></span>
                <input
                  type="text"
                  placeholder="VD: KA-D1-T1-O01..."
                  value={locFormData.location_code}
                  onChange={(e) => setLocFormData((prev) => ({ ...prev, location_code: e.target.value }))}
                />
                {locFormErrors.location_code && (
                  <div className="wh-form-field-error">{locFormErrors.location_code}</div>
                )}
              </div>

              <div className="wh-form-field">
                <span>Tên vị trí kệ</span>
                <input
                  type="text"
                  placeholder="VD: Khu A - Dãy 1 - Tầng 1 - Ô 01"
                  value={locFormData.location_name}
                  onChange={(e) => setLocFormData((prev) => ({ ...prev, location_name: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Ô 3: Tổng kết vị trí kệ (2 phần) */}
          <div className="wh-form-card wh-col-summary">
            <h3 className="wh-summary-title-centered">Tổng kết vị trí kệ</h3>
            <div className="wh-form-col-fields" style={{ flex: 'none', marginBottom: '8px' }}>
              <div className="wh-form-field">
                <span>Trạng thái hoạt động</span>
                <select
                  value={locFormData.status}
                  onChange={(e) => setLocFormData((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="Đang sử dụng">Đang sử dụng</option>
                  <option value="Tạm ngưng">Tạm ngưng</option>
                </select>
              </div>

              <div className="wh-form-field">
                <span>Ghi chú thêm</span>
                <input
                  type="text"
                  placeholder="Ghi chú thêm..."
                  value={locFormData.note}
                  onChange={(e) => setLocFormData((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>
            </div>

            <div className="wh-summary-rows">
              <div className="wh-summary-row">
                <span>Mã vị trí:</span>
                <strong>{locFormData.location_code || '---'}</strong>
              </div>
              <div className="wh-summary-row">
                <span>Khu vực:</span>
                <strong>{locFormData.zone || '---'}</strong>
              </div>
              <div className="wh-summary-row">
                <span>Sức chứa:</span>
                <strong>{locFormData.max_capacity ? `${locFormData.max_capacity} ${locFormData.unit}` : '---'}</strong>
              </div>
              <div className="wh-summary-row">
                <span>Trạng thái:</span>
                <strong style={{ color: locFormData.status === 'Đang sử dụng' ? '#059669' : '#b45309' }}>
                  {locFormData.status}
                </strong>
              </div>
            </div>

            <div className="wh-summary-actions">
              <button
                type="submit"
                className="wh-btn wh-btn-primary wh-btn-block"
                disabled={isLocSubmitting}
              >
                {isLocSubmitting ? 'Đang lưu...' : editingLocation ? 'Cập nhật vị trí' : 'Lưu vị trí kệ'}
              </button>
              <button
                type="button"
                className="wh-btn wh-btn-secondary wh-btn-block"
                onClick={() => {
                  setIsLocFormPageActive(false);
                  setEditingLocation(null);
                  setLocFormErrors({});
                }}
                disabled={isLocSubmitting}
              >
                Hủy bỏ
              </button>
              <p className="wh-summary-hint">
                Vị trí kệ sẵn sàng tiếp nhận và xếp dỡ hàng hóa tự động.
              </p>
            </div>
          </div>
        </form>
        </div>
      </div>
    );
  }

  // 3. TRANG KHAI BÁO / CHỈNH SỬA KHU VỰC (FULL PAGE VIEW)
  if (isZoneFormPageActive && selectedWarehouse) {
    return (
      <div className="wh-container">
        <div className="wh-form-page-header">
          <button
            type="button"
            className="wh-btn wh-btn-secondary"
            onClick={() => {
              setIsZoneFormPageActive(false);
              setEditingZone(null);
              setZoneFormErrors({});
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Quay lại quản lý Kệ & Khu vực
          </button>
          <h2>{editingZone ? `Chỉnh sửa khu vực: ${editingZone.zone_name}` : 'Khai Báo Khu Vực Mới'}</h2>
        </div>

        <div className="wh-form-page-card">
          <form onSubmit={handleSaveZone}>
            <div className="wh-form-grid-2">
              <div className="wh-form-group">
                <label>
                  Mã khu vực <span className="wh-required-star">*</span>
                </label>
                <input
                  type="text"
                  className="wh-form-input"
                  placeholder="VD: KHU-A, KHU-B..."
                  disabled={Boolean(editingZone)}
                  value={zoneFormData.zone_code}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, zone_code: e.target.value })}
                />
                {zoneFormErrors.zone_code && <div className="wh-form-error">{zoneFormErrors.zone_code}</div>}
              </div>

              <div className="wh-form-group">
                <label>
                  Tên khu vực <span className="wh-required-star">*</span>
                </label>
                <input
                  type="text"
                  className="wh-form-input"
                  placeholder="VD: Khu A - Hàng điện tử"
                  value={zoneFormData.zone_name}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, zone_name: e.target.value })}
                />
                {zoneFormErrors.zone_name && <div className="wh-form-error">{zoneFormErrors.zone_name}</div>}
              </div>
            </div>

            <div className="wh-form-group">
              <label>Mô tả khu vực</label>
              <textarea
                className="wh-form-input"
                style={{ height: '70px', padding: '8px 12px' }}
                placeholder="Mô tả công năng của khu vực này..."
                value={zoneFormData.description}
                onChange={(e) => setZoneFormData({ ...zoneFormData, description: e.target.value })}
              />
            </div>

            <div className="wh-form-group">
              <label className="wh-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={zoneFormData.is_active}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, is_active: e.target.checked })}
                />
                <span>Khu vực đang hoạt động</span>
              </label>
            </div>

            <div className="wh-form-page-actions">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => {
                  setIsZoneFormPageActive(false);
                  setEditingZone(null);
                  setZoneFormErrors({});
                }}
                disabled={isZoneSubmitting}
              >
                Hủy bỏ
              </button>
              <button type="submit" className="wh-btn wh-btn-primary" disabled={isZoneSubmitting}>
                {isZoneSubmitting ? 'Đang lưu...' : editingZone ? 'Cập nhật khu vực' : 'Tạo khu vực'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 4. TRANG KHAI BÁO / CHỈNH SỬA DÃY KỆ (FULL PAGE VIEW)
  if (isRackFormPageActive && selectedWarehouse) {
    return (
      <div className="wh-container">
        <div className="wh-form-page-header">
          <button
            type="button"
            className="wh-btn wh-btn-secondary"
            onClick={() => {
              setIsRackFormPageActive(false);
              setEditingRack(null);
              setRackFormErrors({});
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Quay lại quản lý Kệ & Khu vực
          </button>
          <h2>{editingRack ? `Chỉnh sửa dãy kệ: ${editingRack.rack_name}` : 'Khai Báo Dãy Kệ Mới'}</h2>
        </div>

        <div className="wh-form-page-card">
          <form onSubmit={handleSaveRack}>
            <div className="wh-form-grid-2">
              <div className="wh-form-group">
                <label>
                  Thuộc khu vực <span className="wh-required-star">*</span>
                </label>
                <select
                  className="wh-form-select"
                  value={rackFormData.zone_id}
                  onChange={(e) => setRackFormData({ ...rackFormData, zone_id: Number(e.target.value) })}
                >
                  <option value={0}>-- Chọn khu vực --</option>
                  {zonesList.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.zone_name} ({z.zone_code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="wh-form-group">
                <label>
                  Mã kệ / dãy <span className="wh-required-star">*</span>
                </label>
                <input
                  type="text"
                  className="wh-form-input"
                  placeholder="VD: KA-D1-T1..."
                  value={rackFormData.rack_code}
                  onChange={(e) => setRackFormData({ ...rackFormData, rack_code: e.target.value })}
                />
                {rackFormErrors.rack_code && <div className="wh-form-error">{rackFormErrors.rack_code}</div>}
              </div>
            </div>

            <div className="wh-form-grid-2">
              <div className="wh-form-group">
                <label>
                  Dãy kệ <span className="wh-required-star">*</span>
                </label>
                <input
                  type="text"
                  className="wh-form-input"
                  placeholder="VD: Dãy 1, Dãy 2..."
                  value={rackFormData.aisle_input}
                  onChange={(e) => setRackFormData({ ...rackFormData, aisle_input: e.target.value })}
                />
              </div>

              <div className="wh-form-group">
                <label>
                  Tầng / Kệ <span className="wh-required-star">*</span>
                </label>
                <input
                  type="text"
                  className="wh-form-input"
                  placeholder="VD: Tầng 1, Tầng 2..."
                  value={rackFormData.rack_input}
                  onChange={(e) => setRackFormData({ ...rackFormData, rack_input: e.target.value })}
                />
              </div>
            </div>

            <div className="wh-form-grid-2">
              <div className="wh-form-group">
                <label>Sức chứa tối đa (sản phẩm)</label>
                <input
                  type="number"
                  min="1"
                  className="wh-form-input"
                  placeholder="VD: 500"
                  value={rackFormData.max_capacity}
                  onChange={(e) => setRackFormData({ ...rackFormData, max_capacity: e.target.value })}
                />
              </div>

              <div className="wh-form-group">
                <label className="wh-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '24px' }}>
                  <input
                    type="checkbox"
                    checked={rackFormData.is_active}
                    onChange={(e) => setRackFormData({ ...rackFormData, is_active: e.target.checked })}
                  />
                  <span>Dãy kệ đang hoạt động</span>
                </label>
              </div>
            </div>

            <div className="wh-form-page-actions">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => {
                  setIsRackFormPageActive(false);
                  setEditingRack(null);
                  setRackFormErrors({});
                }}
                disabled={isRackSubmitting}
              >
                Hủy bỏ
              </button>
              <button type="submit" className="wh-btn wh-btn-primary" disabled={isRackSubmitting}>
                {isRackSubmitting ? 'Đang lưu...' : editingRack ? 'Cập nhật dãy kệ' : 'Tạo dãy kệ'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 5. TRANG GÁN SẢN PHẨM VÀO VỊ TRÍ KỆ (FULL PAGE VIEW SANG TRANG MỚI)
  if (isAssignFormPageActive && selectedWarehouse) {
    const currentSelectedProd = allProducts.find((p) => p.id === assignFormData.product_id);
    const curUnit = currentSelectedProd?.base_unit || 'Cái';
    const curTotalStock =
      assignAllocationStatus?.warehouse_total_stock ??
      getProductWarehouseStock(assignFormData.product_id, currentSelectedProd?.stock || 0);
    const curAssignedAll = locationProducts
      .filter((lp) => lp.product_id === assignFormData.product_id)
      .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
    const curLocItem = locationProducts.find(
      (lp) => lp.location_id === assignFormData.location_id && lp.product_id === assignFormData.product_id
    );
    const curQtyAtThisLoc = curLocItem ? Number(curLocItem.quantity) || 0 : 0;
    const curAssignedOther = curAssignedAll - curQtyAtThisLoc;
    const curMaxAllowed = Math.max(0, curTotalStock - curAssignedOther);
    const curUnassigned = Math.max(0, curTotalStock - curAssignedAll);
    const isOverAssigned = Number(assignFormData.quantity) > curMaxAllowed;

    const filteredList = allProducts.filter((p) => {
      if (!assignProductSearch.trim()) return true;
      const q = assignProductSearch.trim().toLowerCase();
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.code || '').toLowerCase().includes(q)
      );
    });
    const displayedList = filteredList.slice(0, assignProductDisplayLimit);

    return (
      <div className="wh-container wh-form-fullscreen-wrap" style={{ padding: '16px' }}>
        <div className="wh-form-master-frame" style={{ maxWidth: '980px', margin: '0 auto', width: '100%', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 12px rgba(15, 23, 42, 0.08)', background: '#ffffff', overflow: 'hidden' }}>
          <div className="wh-form-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #cbd5e1', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setIsAssignFormPageActive(false)}
                style={{ padding: '6px 14px', fontWeight: '600', fontSize: '12.5px' }}
              >
                Quay lại
              </button>
              <div>
                <h2 style={{ margin: 0, fontSize: '16.5px', fontWeight: '800', color: '#0f172a' }}>
                  Gán Sản Phẩm Vào Vị Trí Kệ
                </h2>
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                  Kho: <strong style={{ color: '#0f172a' }}>{selectedWarehouse.name}</strong> ({selectedWarehouse.code})
                </div>
              </div>
            </div>

            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
              Phân bổ hàng hóa từ tồn tổng vào từng vị trí kệ lưu trữ cụ thể
            </div>
          </div>

          <form onSubmit={handleSaveAssignProduct} style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr', margin: 0, padding: 0 }}>
            {/* CỘT 1 (BÊN TRÁI): CHỌN SẢN PHẨM */}
            <div
              style={{
                padding: '16px 20px',
                borderRight: '1px solid #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                  Chọn sản phẩm cần gán vào kệ <span style={{ color: '#ef4444' }}>*</span>
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Hiện 20 SP/lượt (cuộn để xem thêm)
                </span>
              </div>

              {/* Thanh tìm kiếm sản phẩm */}
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc mã sản phẩm (SP001, Polo...)..."
                  value={assignProductSearch}
                  onChange={(e) => {
                    setAssignProductSearch(e.target.value);
                    setAssignProductDisplayLimit(20);
                  }}
                  style={{
                    width: '100%',
                    padding: '7px 28px 7px 10px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    color: '#0f172a',
                    background: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
                {assignProductSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setAssignProductSearch('');
                      setAssignProductDisplayLimit(20);
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#94a3b8',
                      fontSize: '11px',
                      padding: '2px',
                      lineHeight: 1,
                    }}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Danh sách thẻ sản phẩm cuộn */}
              <div
                style={{
                  maxHeight: '380px',
                  overflowY: 'auto',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  background: '#ffffff',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 40) {
                    if (assignProductDisplayLimit < filteredList.length) {
                      setAssignProductDisplayLimit((prev) => Math.min(prev + 20, filteredList.length));
                    }
                  }
                }}
              >
                {displayedList.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                    Không tìm thấy sản phẩm nào phù hợp với &quot;{assignProductSearch}&quot;
                  </div>
                ) : (
                  displayedList.map((p) => {
                    const pWhTotal = getProductWarehouseStock(p.id, p.stock || 0);
                    const pAssignedTotal = locationProducts
                      .filter((lp) => lp.product_id === p.id)
                      .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
                    const pAtThisLoc =
                      locationProducts.find(
                        (lp) => lp.location_id === assignFormData.location_id && lp.product_id === p.id
                      )?.quantity || 0;
                    const pAssignedOther = pAssignedTotal - pAtThisLoc;
                    const pAvailableForLoc = Math.max(0, pWhTotal - pAssignedOther);
                    const isExhausted = pAvailableForLoc <= 0 && pAtThisLoc === 0;
                    const isSelected = assignFormData.product_id === p.id;

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isExhausted) return;
                          const otherAssigned = locationProducts
                            .filter((lp) => lp.product_id === p.id && lp.location_id !== assignFormData.location_id)
                            .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
                          const locQty = locationProducts.find(
                            (lp) => lp.location_id === assignFormData.location_id && lp.product_id === p.id
                          )?.quantity || 0;
                          const unassigned = Math.max(0, pWhTotal - otherAssigned - locQty);
                          setAssignFormData({
                            ...assignFormData,
                            product_id: p.id,
                            quantity: locQty > 0 ? locQty : unassigned,
                          });
                          if (selectedWarehouse) {
                            fetchAllocationStatus(selectedWarehouse.id, p.id);
                          }
                        }}
                        style={{
                          padding: '7px 10px',
                          borderRadius: '5px',
                          border: isSelected ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                          background: isSelected ? '#f0f9ff' : isExhausted ? '#f8fafc' : '#ffffff',
                          cursor: isExhausted ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.1s ease',
                          opacity: isExhausted ? 0.6 : 1,
                        }}
                        onMouseEnter={(e) => {
                          if (!isExhausted && !isSelected) {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isExhausted && !isSelected) {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                          }
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: '700', color: isSelected ? '#0284c7' : '#0f172a', fontSize: '12.5px' }}>
                              [{p.code}] {p.name}
                            </span>
                            {isSelected && (
                              <span style={{ fontSize: '10.5px', color: '#0284c7', fontWeight: '800' }}>
                                Đang chọn
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            Tồn tại kho: <strong style={{ color: '#0f172a' }}>{pWhTotal}</strong> | Chưa gán:{' '}
                            <strong style={{ color: isExhausted ? '#dc2626' : '#16a34a' }}>
                              {Math.max(0, pWhTotal - pAssignedTotal)} {p.base_unit || 'Cái'}
                            </strong>
                            {isExhausted && (
                              <span style={{ color: '#dc2626', fontWeight: '600', marginLeft: '4px' }}>
                                (Đã gán hết)
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          <input
                            type="radio"
                            name="fullscreen_selected_assign_product"
                            checked={isSelected}
                            disabled={isExhausted}
                            readOnly
                            style={{ cursor: isExhausted ? 'not-allowed' : 'pointer' }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}

                {assignProductDisplayLimit < filteredList.length && (
                  <div style={{ padding: '6px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setAssignProductDisplayLimit((prev) => Math.min(prev + 20, filteredList.length))
                      }
                      style={{
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '5px',
                        padding: '5px 12px',
                        fontSize: '11.5px',
                        color: '#0284c7',
                        fontWeight: '600',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      Tải thêm 20 sản phẩm tiếp theo...
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* CỘT 2 (BÊN PHẢI): THÔNG TIN PHÂN BỔ & VỊ TRÍ KỆ */}
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                background: '#ffffff',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                Thông tin phân bổ & Vị trí kệ
              </h3>

              {/* Khung 4 ô tóm tắt tồn kho trên 1 hàng */}
              {currentSelectedProd && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tồn kho tổng</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '3px' }}>
                      {curTotalStock} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Đã gán ở kệ khác</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#64748b', marginTop: '3px' }}>
                      {curAssignedOther} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      background: '#ffffff',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Hiện tại kệ này</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7', marginTop: '3px' }}>
                      {curQtyAtThisLoc} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '8px 4px',
                      textAlign: 'center',
                      background: '#f0fdf4',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: '#166534', fontWeight: '700' }}>Tồn chưa gán</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: '#16a34a', marginTop: '3px' }}>
                      {curUnassigned} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="wh-form-group">
                <label style={{ fontWeight: '700', fontSize: '12.5px', color: '#1e293b', marginBottom: '5px', display: 'block' }}>
                  Chọn vị trí kệ lưu trữ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  className="wh-form-select"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                  }}
                  value={assignFormData.location_id}
                  onChange={(e) => {
                    const newLocId = Number(e.target.value);
                    const locQty = locationProducts.find(
                      (lp) => lp.location_id === newLocId && lp.product_id === assignFormData.product_id
                    )?.quantity || 0;
                    setAssignFormData({ ...assignFormData, location_id: newLocId, quantity: locQty });
                  }}
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.location_code} — {l.location_name || l.zone || 'Kệ'} (Hiện có: {l.total_quantity} SP / Sức chứa: {l.max_capacity || 500} SP)
                    </option>
                  ))}
                </select>
              </div>

              <div className="wh-form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ fontWeight: '700', fontSize: '12.5px', color: '#1e293b', margin: 0 }}>
                    Số lượng gán tại vị trí này <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setAssignFormData({ ...assignFormData, quantity: curMaxAllowed })}
                      style={{
                        background: '#e0f2fe',
                        color: '#0284c7',
                        border: '1px solid #bae6fd',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                      title={`Gán tối đa có thể cho kệ này (${curQtyAtThisLoc} hiện có + ${curUnassigned} chưa gán)`}
                    >
                      Gán tối đa ({curMaxAllowed})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignFormData({ ...assignFormData, quantity: 0 })}
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        borderRadius: '4px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      0 (Gỡ khỏi kệ)
                    </button>
                  </div>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    min={0}
                    className="wh-form-input"
                    style={{
                      width: '100%',
                      padding: '8px 36px 8px 10px',
                      fontSize: '13px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      border: isOverAssigned ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                      color: isOverAssigned ? '#dc2626' : '#0f172a',
                      boxSizing: 'border-box',
                    }}
                    value={assignFormData.quantity}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                      setAssignFormData({ ...assignFormData, quantity: val });
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    {curUnit}
                  </span>
                </div>

                {isOverAssigned && (
                  <div style={{ color: '#dc2626', fontSize: '11.5px', marginTop: '4px', fontWeight: '600' }}>
                    Số lượng vượt quá mức cho phép tối đa ({curMaxAllowed} {curUnit}).
                  </div>
                )}
              </div>

              {/* Nút bấm ở dưới góc phải */}
              <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setIsAssignFormPageActive(false)}
                  disabled={isAssignSubmitting}
                  style={{ padding: '7px 18px', fontWeight: '600', fontSize: '12.5px' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={isAssignSubmitting || isOverAssigned || Number(assignFormData.quantity) < 0 || !assignFormData.product_id || !assignFormData.location_id}
                  style={{ padding: '7px 20px', fontWeight: '700', fontSize: '12.5px', background: '#16a34a', borderColor: '#16a34a' }}
                >
                  {isAssignSubmitting ? 'Đang lưu...' : 'Lưu phân bổ vào kệ'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (isGlobalPickingOpen && canManage) {
    return (
      <div className="wh-container">
        <WarehousePickingView
          token={token}
          currentUser={currentUser}
          onBackToHome={() => setIsGlobalPickingOpen(false)}
        />
      </div>
    );
  }

  return (
    <div className="wh-container">

      {/* Main Header */}
      <div className="wh-header">
        <div className="wh-header-title-group">
          <h1>
            Quản Lý Danh Sách Kho Hàng & Vị Trí Kệ
            <span className="wh-header-badge">Quản lý kho</span>
          </h1>
          <p>Hệ thống quản lý cấu trúc kho hàng, phân bổ vị trí kệ và theo dõi tồn kho theo từng vị trí chi tiết</p>
        </div>

        <div className="wh-header-actions">
          {selectedWarehouse ? (
            <button
              type="button"
              className="wh-btn wh-btn-secondary"
              onClick={() => setSelectedWarehouse(null)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Quay lại danh sách kho
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {canManage && (
                <button
                  type="button"
                  className="wh-btn"
                  style={{
                    background: '#4f46e5',
                    color: '#ffffff',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  onClick={() => setIsGlobalPickingOpen(true)}
                >
                  Lập phiếu soạn hàng
                </button>
              )}
              {canManage && (
                <button type="button" className="wh-btn wh-btn-primary" onClick={handleOpenCreateWarehouse}>
                  Thêm kho mới
                </button>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Bố cục: Nếu chưa chọn kho -> Xem bảng danh sách kho */}
      {!selectedWarehouse ? (
        <>
          {/* Filter Bar Danh sách kho */}
          <div className="wh-filter-card">
            <div className="wh-filter-group">
              <div className="wh-search-wrap">
                <input
                  type="text"
                  className="wh-search-input"
                  placeholder="Tìm kiếm theo mã kho, tên kho, địa chỉ..."
                  value={whSearch}
                  onChange={(e) => setWhSearch(e.target.value)}
                />
              </div>

              <select
                className="wh-select"
                value={whStatusFilter}
                onChange={(e) => setWhStatusFilter(e.target.value)}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Đang hoạt động">Đang hoạt động</option>
                <option value="Ngừng hoạt động">Ngừng hoạt động</option>
              </select>
            </div>

            <div className="wh-filter-count">
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
                <h4>Chưa có kho hàng nào phù hợp</h4>
                <p>Hãy thêm kho hàng mới để bắt đầu định vị kệ và phân bổ hàng hóa cho các đại lý.</p>
                {canManage && (
                  <button
                    type="button"
                    className="wh-btn wh-btn-primary"
                    style={{ marginTop: '16px' }}
                    onClick={handleOpenCreateWarehouse}
                  >
                    Thêm kho mới
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="wh-table-responsive">
                  <table className="wh-table">
                    <thead>
                      <tr>
                        <th style={{ width: '120px' }}>Mã kho</th>
                        <th>Tên kho hàng</th>
                        <th>Địa chỉ</th>
                        <th>Người phụ trách</th>
                        <th style={{ textAlign: 'center', width: '150px' }}>Trạng thái</th>
                        <th style={{ textAlign: 'center', width: '280px', minWidth: '280px' }}>Thao tác</th>
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
                          <td style={{ maxWidth: '300px', color: '#475569' }}>
                            {wh.address || '—'}
                          </td>
                          <td>
                            <div className="wh-manager-wrap">
                              <span className="wh-manager-name">{wh.manager_name || 'Chưa chỉ định'}</span>
                              {wh.phone && (
                                <span className="wh-manager-phone">
                                  {wh.phone}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`wh-badge ${wh.is_active ? 'wh-badge-active' : 'wh-badge-inactive'}`}>
                              <span className={wh.is_active ? 'wh-dot' : 'wh-dot-gray'} />
                              {wh.status || (wh.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div className="wh-action-group" style={{ flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                className="wh-action-btn-manage"
                                style={{ whiteSpace: 'nowrap' }}
                                title="Quản lý sơ đồ vị trí kệ và phân bổ sản phẩm"
                                onClick={() => {
                                  setSelectedWarehouse(wh);
                                  setLocZoneFilter('all');
                                  setLocSearch('');
                                  setSubTab('locations');
                                }}
                              >
                                Quản lý vị trí
                              </button>
                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    className="wh-action-btn-edit"
                                    title="Chỉnh sửa thông tin kho"
                                    onClick={() => handleOpenEditWarehouse(wh)}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    className="wh-action-btn-delete"
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

                {/* Mobile Card View cho Danh sách kho hàng */}
                <div className="wh-mobile-card-list">
                  {paginatedWarehouses.map((wh) => (
                    <div key={wh.id} className="wh-mobile-card">
                      <div className="wh-mobile-card-header">
                        <div>
                          <span className="wh-badge wh-badge-code">{wh.code}</span>
                          <div className="wh-mobile-card-name">{wh.name}</div>
                        </div>
                        <span className={`wh-badge ${wh.is_active ? 'wh-badge-active' : 'wh-badge-inactive'}`}>
                          <span className={wh.is_active ? 'wh-dot' : 'wh-dot-gray'} />
                          {wh.status || (wh.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động')}
                        </span>
                      </div>

                      <div className="wh-mobile-card-body">
                        {wh.address && (
                          <div className="wh-mobile-card-row">
                            <span className="wh-mobile-card-label">Địa chỉ:</span>
                            <span className="wh-mobile-card-val">{wh.address}</span>
                          </div>
                        )}
                        <div className="wh-mobile-card-row">
                          <span className="wh-mobile-card-label">Người phụ trách:</span>
                          <span className="wh-mobile-card-val">{wh.manager_name || 'Chưa chỉ định'}</span>
                        </div>
                        {wh.phone && (
                          <div className="wh-mobile-card-row">
                            <span className="wh-mobile-card-label">SĐT liên hệ:</span>
                            <a
                              href={`tel:${wh.phone}`}
                              className="wh-mobile-card-val"
                              style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}
                            >
                              {wh.phone}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="wh-mobile-card-actions">
                        <button
                          type="button"
                          className="wh-mobile-btn-manage"
                          onClick={() => {
                            setSelectedWarehouse(wh);
                            setLocZoneFilter('all');
                            setLocSearch('');
                            setSubTab('locations');
                          }}
                        >
                          Quản lý vị trí kệ
                        </button>
                        {canManage && (
                          <>
                            <button
                              type="button"
                              className="wh-mobile-btn-edit"
                              onClick={() => handleOpenEditWarehouse(wh)}
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="wh-mobile-btn-delete"
                              onClick={() => setDeletingWarehouse(wh)}
                            >
                              Xóa
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Màn hình Chi tiết: Quản lý Vị trí lưu trữ & Phân bổ hàng hóa của Kho được chọn */
        <>
          {/* Breadcrumb & Kho Info Card */}
          <div className="wh-info-card">
            <div className="wh-info-card-left">
              <div className="wh-info-subtitle">
                DANH MỤC VỊ TRÍ LƯU KHO & SOẠN ĐƠN
              </div>
              <div className="wh-info-title-row">
                <h2 className="wh-info-title">{selectedWarehouse.name}</h2>
                {selectedWarehouse.code && (
                  <span className="wh-badge wh-badge-code">{selectedWarehouse.code}</span>
                )}
                <span className={`wh-badge ${selectedWarehouse.is_active ? 'wh-badge-active' : 'wh-badge-inactive'}`}>
                  <span className={selectedWarehouse.is_active ? 'wh-dot' : 'wh-dot-gray'} />
                  {selectedWarehouse.status || (selectedWarehouse.is_active ? 'Đang hoạt động' : 'Ngừng hoạt động')}
                </span>
              </div>
              <div className="wh-info-meta-row">
                <span className="wh-info-meta-item">
                  {selectedWarehouse.address || 'Chưa cập nhật địa chỉ'}
                </span>
                <span className="wh-info-meta-item">
                  {selectedWarehouse.manager_name || 'Chưa chỉ định quản lý'}
                </span>
                {selectedWarehouse.phone && (
                  <span className="wh-info-meta-item">
                    {selectedWarehouse.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="wh-tabs">
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'locations' ? 'active' : ''}`}
              onClick={() => setSubTab('locations')}
            >
              <span>Vị trí kệ</span>
              <span className="wh-tab-count">{locations.length}</span>
            </button>
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'master-data' ? 'active' : ''}`}
              onClick={() => setSubTab('master-data')}
            >
              <span>Kệ & Khu vực</span>
              <span className="wh-tab-count">{racksList.length}</span>
            </button>
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'products' ? 'active' : ''}`}
              onClick={() => setSubTab('products')}
            >
              <span>Sản phẩm theo kệ</span>
              <span className="wh-tab-count">{locationProducts.length}</span>
            </button>
            {canManage && (
              <button
                type="button"
                className={`wh-tab-btn ${subTab === 'picking' ? 'active' : ''}`}
                onClick={() => setSubTab('picking')}
              >
                <span>Phiếu soạn hàng</span>
              </button>
            )}
          </div>


          {/* TAB 1: DANH SÁCH VỊ TRÍ KỆ (LOCATIONS) */}
          {subTab === 'locations' && (
            <>
              <div className="wh-filter-card">
                <div className="wh-filter-group">
                  <div className="wh-search-wrap">
                    <input
                      type="text"
                      className="wh-search-input"
                      placeholder="Tìm mã vị trí, tên kệ, dãy..."
                      value={locSearch}
                      onChange={(e) => setLocSearch(e.target.value)}
                    />
                  </div>

                  {(uniqueZones.length > 0 || locZoneFilter !== 'all') && (
                    <select
                      className="wh-select"
                      value={locZoneFilter}
                      onChange={(e) => setLocZoneFilter(e.target.value)}
                    >
                      <option value="all">Tất cả khu vực</option>
                      {uniqueZones.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="wh-btn wh-btn-primary"
                      onClick={handleOpenCreateLocation}
                      style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                    >
                      + Thêm vị trí kệ mới
                    </button>
                  )}
                </div>
              </div>

              <div className="wh-table-card">
                {isLocLoading ? (
                  <div className="wh-state-box">
                    <div>Đang tải danh sách vị trí kệ...</div>
                  </div>
                ) : locations.length === 0 ? (
                  <div className="wh-state-box">
                    {locZoneFilter !== 'all' || locSearch.trim() ? (
                      <>
                        <h4>Không tìm thấy vị trí kệ nào phù hợp với bộ lọc</h4>
                        <p style={{ marginTop: '6px', color: '#64748b', fontSize: '13.5px' }}>
                          Không có vị trí kệ nào khớp với{' '}
                          {locZoneFilter !== 'all' ? `khu vực "${locZoneFilter}"` : ''}
                          {locZoneFilter !== 'all' && locSearch.trim() ? ' và ' : ''}
                          {locSearch.trim() ? `từ khóa "${locSearch.trim()}"` : ''}.
                        </p>
                        <button
                          type="button"
                          className="wh-btn wh-btn-secondary"
                          style={{ marginTop: '14px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#334155' }}
                          onClick={() => {
                            setLocZoneFilter('all');
                            setLocSearch('');
                          }}
                        >
                          Xóa bộ lọc
                        </button>
                      </>
                    ) : (
                      <>
                        <h4>Kho này chưa có vị trí kệ nào được khai báo</h4>
                        <p>Hãy chuyển sang tab "Quản lý Kệ & Khu vực" để thêm khu vực, dãy kệ và tầng cho kho hàng.</p>
                        {canManage && (
                          <button
                            type="button"
                            className="wh-btn wh-btn-primary"
                            style={{ marginTop: '14px' }}
                            onClick={() => setSubTab('master-data')}
                          >
                            Quản lý Kệ & Khu vực
                          </button>
                        )}
                      </>
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
                            <th>Khu vực</th>
                            <th>Dãy kệ</th>
                            <th>Tầng / Kệ</th>
                            <th style={{ minWidth: '180px' }}>Sức chứa & Tải trọng</th>
                            <th style={{ textAlign: 'center', width: '100px' }}>Mặt hàng</th>
                            <th style={{ textAlign: 'center', width: '130px' }}>Trạng thái</th>
                            {canManage && <th style={{ textAlign: 'center', width: '100px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedLocations.map((loc) => {
                            const maxCap = loc.max_capacity || 0;
                            const currQty = loc.total_quantity || 0;
                            const percent = maxCap > 0 ? Math.min(Math.round((currQty / maxCap) * 100), 100) : 0;
                            const barColor = percent >= 100 ? '#ef4444' : percent >= 80 ? '#f59e0b' : '#10b981';

                            return (
                              <tr key={loc.id}>
                                <td>
                                  <span className="wh-badge wh-badge-location">{loc.location_code}</span>
                                </td>
                                <td>
                                  <strong style={{ color: '#0f172a', fontWeight: 600 }}>{loc.location_name || loc.location_code}</strong>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 500, color: '#334155' }}>{loc.zone || '—'}</span>
                                </td>
                                <td>{loc.aisle || '—'}</td>
                                <td>{loc.rack || '—'}</td>
                                <td>
                                  <div className="wh-capacity-cell">
                                    <div className="wh-capacity-label">
                                      <span><strong>{currQty.toLocaleString('vi-VN')}</strong> / {maxCap.toLocaleString('vi-VN')} SP</span>
                                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{percent}%</span>
                                    </div>
                                    <div className="wh-progress-bar-bg">
                                      <div
                                        className="wh-progress-bar-fill"
                                        style={{
                                          width: `${percent}%`,
                                          backgroundColor: barColor,
                                        }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="wh-badge wh-badge-number">{loc.items_count} SP</span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="wh-badge wh-badge-active">
                                    <span className="wh-dot" />
                                    {loc.status || 'Đang sử dụng'}
                                  </span>
                                </td>
                                {canManage && (
                                  <td style={{ textAlign: 'center' }}>
                                    <div className="wh-action-group" style={{ justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        className="wh-action-btn-edit"
                                        title="Chỉnh sửa vị trí"
                                        onClick={() => handleOpenEditLocation(loc)}
                                      >
                                        Sửa
                                      </button>
                                      <button
                                        type="button"
                                        className="wh-action-btn-delete"
                                        title="Xóa vị trí"
                                        onClick={() => setDeletingLocation(loc)}
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View cho Danh sách vị trí kệ */}
                    <div className="loc-mobile-card-list">
                      {paginatedLocations.map((loc) => {
                        const maxCap = loc.max_capacity || 0;
                        const currQty = loc.total_quantity || 0;
                        const percent = maxCap > 0 ? Math.min(Math.round((currQty / maxCap) * 100), 100) : 0;
                        const barColor = percent >= 100 ? '#ef4444' : percent >= 80 ? '#f59e0b' : '#10b981';

                        return (
                          <div key={loc.id} className="loc-mobile-card">
                            <div className="loc-mobile-card-header">
                              <div>
                                <span className="wh-badge wh-badge-location">{loc.location_code}</span>
                                <div className="loc-mobile-card-name">{loc.location_name || loc.location_code}</div>
                              </div>
                              <span className="wh-badge wh-badge-active">
                                <span className="wh-dot" />
                                {loc.status || 'Đang sử dụng'}
                              </span>
                            </div>

                            <div className="loc-mobile-card-body">
                              <div className="wh-mobile-card-row">
                                <span className="wh-mobile-card-label">Khu vực:</span>
                                <span className="wh-mobile-card-val">{loc.zone || '—'}</span>
                              </div>
                              <div className="wh-mobile-card-row">
                                <span className="wh-mobile-card-label">Dãy kệ:</span>
                                <span className="wh-mobile-card-val">{loc.aisle || '—'}</span>
                              </div>
                              <div className="wh-mobile-card-row">
                                <span className="wh-mobile-card-label">Tầng / Kệ:</span>
                                <span className="wh-mobile-card-val">{loc.rack || '—'}</span>
                              </div>
                              <div className="wh-mobile-card-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                                  <span className="wh-mobile-card-label">Sức chứa & Tải trọng:</span>
                                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                    {currQty.toLocaleString('vi-VN')} / {maxCap.toLocaleString('vi-VN')} SP ({percent}%)
                                  </span>
                                </div>
                                <div className="wh-progress-bar-bg" style={{ height: '8px' }}>
                                  <div className="wh-progress-bar-fill" style={{ width: `${percent}%`, backgroundColor: barColor }} />
                                </div>
                              </div>
                              <div className="wh-mobile-card-row">
                                <span className="wh-mobile-card-label">Số mặt hàng:</span>
                                <span className="wh-badge wh-badge-number">{loc.items_count} SP</span>
                              </div>
                              {loc.note && (
                                <div className="wh-mobile-card-row">
                                  <span className="wh-mobile-card-label">Ghi chú:</span>
                                  <span className="wh-mobile-card-val">{loc.note}</span>
                                </div>
                              )}
                            </div>

                            {canManage && (
                              <div className="loc-mobile-card-actions">
                                <button
                                  type="button"
                                  className="wh-mobile-btn-edit"
                                  onClick={() => handleOpenEditLocation(loc)}
                                >
                                  Sửa vị trí
                                </button>
                                <button
                                  type="button"
                                  className="wh-mobile-btn-delete"
                                  onClick={() => setDeletingLocation(loc)}
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* TAB 2: QUẢN LÝ MASTER DATA KỆ & KHU VỰC */}
          {subTab === 'master-data' && (
            <>
              <div className="wh-filter-card">
                <div className="wh-filter-group">
                  <div className="wh-search-wrap">
                    <input
                      type="text"
                      className="wh-search-input"
                      placeholder="Tìm nhanh mã hoặc tên khu vực, kệ..."
                      value={masterSearch}
                      onChange={(e) => setMasterSearch(e.target.value)}
                    />
                  </div>

                  <select
                    className="wh-select"
                    value={masterRackFilter}
                    onChange={(e) => setMasterRackFilter(e.target.value)}
                  >
                    <option value="all">Tất cả phân loại kệ</option>
                    <option value="aisle">Chỉ Dãy kệ (Aisle)</option>
                    <option value="rack">Chỉ Tầng / Kệ (Rack)</option>
                  </select>
                </div>
              </div>

              {/* Bố cục 2 cột liên kết: Cột trái (Master: Khu vực) - Cột phải (Detail: Kệ & Dãy thuộc Khu vực) */}
              <div className="wh-master-grid">
                {/* CỘT TRÁI (MASTER): DANH MỤC KHU VỰC */}
                <div className="wh-master-card">
                  <div className="wh-master-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Danh mục Khu vực</span>
                      <span className="wh-badge wh-badge-code">{filteredZones.length}</span>
                    </h3>
                    {canManage && (
                      <button
                        type="button"
                        className="wh-btn wh-btn-primary"
                        style={{ fontSize: '13px', padding: '6px 12px' }}
                        onClick={handleOpenCreateZone}
                      >
                        Thêm khu vực
                      </button>
                    )}
                  </div>

                  <div className="wh-table-responsive" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    {isMasterLoading ? (
                      <div className="wh-state-box"><div>Đang tải danh mục khu vực...</div></div>
                    ) : filteredZones.length === 0 ? (
                      <div className="wh-state-box">
                        <h4>Chưa có khu vực nào</h4>
                        <p>Khai báo khu vực (Khu A, Khu B...) để nhóm các dãy kệ trong kho.</p>
                      </div>
                    ) : (
                      <table className="wh-table">
                        <thead>
                          <tr>
                            <th style={{ width: '90px' }}>Mã KV</th>
                            <th>Tên khu vực</th>
                            <th style={{ textAlign: 'center', width: '110px' }}>Số lượng kệ</th>
                            {canManage && <th style={{ textAlign: 'center', width: '90px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredZones.map((z) => {
                            const isSelected = activeZone?.id === z.id;
                            const racksCount = getZoneRacksCount(z);

                            return (
                              <tr
                                key={z.id}
                                className={`wh-master-row ${isSelected ? 'wh-master-row--active' : ''}`}
                                onClick={() => setSelectedZoneIdForDetail(z.id)}
                                title="Click để xem các kệ thuộc khu vực này"
                              >
                                <td><span className="wh-badge wh-badge-code">{z.zone_code}</span></td>
                                <td>
                                  <strong style={{ color: isSelected ? 'var(--wh-primary)' : '#0f172a' }}>{z.zone_name}</strong>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="wh-badge wh-badge-number">
                                    {racksCount} kệ
                                  </span>
                                </td>
                                {canManage && (
                                  <td style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        className="wh-action-btn-edit"
                                        title="Sửa khu vực"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenEditZone(z);
                                        }}
                                      >
                                        Sửa
                                      </button>
                                      <button
                                        type="button"
                                        className="wh-action-btn-delete"
                                        title="Xóa khu vực"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeletingZone(z);
                                        }}
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {/* Mobile Card List cho Khu vực */}
                    {!isMasterLoading && filteredZones.length > 0 && (
                      <div className="zone-mobile-card-list">
                        {filteredZones.map((z) => {
                          const isSelected = activeZone?.id === z.id;
                          const racksCount = getZoneRacksCount(z);
                          return (
                            <div
                              key={z.id}
                              className={`wh-mobile-card ${isSelected ? 'wh-mobile-card-active' : ''}`}
                              onClick={() => setSelectedZoneIdForDetail(z.id)}
                              style={{ cursor: 'pointer', border: isSelected ? '2px solid var(--wh-primary)' : undefined }}
                            >
                              <div className="wh-mobile-card-header">
                                <div>
                                  <span className="wh-badge wh-badge-code">{z.zone_code}</span>
                                  <div className="wh-mobile-card-name" style={{ color: isSelected ? 'var(--wh-primary)' : undefined }}>
                                    {z.zone_name}
                                  </div>
                                </div>
                                <span className="wh-badge wh-badge-number">{racksCount} kệ</span>
                              </div>
                              {canManage && (
                                <div className="wh-mobile-card-actions" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="wh-mobile-btn-edit"
                                    onClick={() => handleOpenEditZone(z)}
                                  >
                                    Sửa
                                  </button>
                                  <button
                                    type="button"
                                    className="wh-mobile-btn-delete"
                                    onClick={() => setDeletingZone(z)}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* CỘT PHẢI (DETAIL): DANH MỤC KỆ & DÃY THUỘC KHU VỰC ĐƯỢC CHỌN */}
                <div className="wh-master-card">
                  <div className="wh-master-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Danh mục Kệ & Dãy thuộc {activeZone ? activeZone.zone_name : 'Khu vực'}</span>
                      <span className="wh-badge wh-badge-code">{detailRacks.length}</span>
                    </h3>
                    {canManage && (
                      <button
                        type="button"
                        className="wh-btn wh-btn-primary"
                        style={{ fontSize: '13px', padding: '6px 12px' }}
                        onClick={() => handleOpenCreateRack(activeZone?.id)}
                      >
                        Thêm kệ vào khu vực này
                      </button>
                    )}
                  </div>

                  <div className="wh-table-responsive" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    {isMasterLoading ? (
                      <div className="wh-state-box"><div>Đang tải danh mục kệ...</div></div>
                    ) : detailRacks.length === 0 ? (
                      <div className="wh-state-box">
                        <h4>Chưa có kệ / dãy nào thuộc {activeZone ? activeZone.zone_name : 'khu vực này'}</h4>
                        <p>Khai báo Dãy kệ và Tầng/Kệ để chọn nhanh khi tạo vị trí.</p>
                      </div>
                    ) : (
                      <table className="wh-table">
                        <thead>
                          <tr>
                            <th style={{ width: '100px' }}>Mã kệ</th>
                            <th>Tên kệ / dãy</th>
                            <th style={{ width: '120px' }}>Phân loại</th>
                            <th style={{ textAlign: 'right', width: '140px' }}>Sức chứa tối đa</th>
                            {canManage && <th style={{ textAlign: 'center', width: '120px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {detailRacks.map((r) => (
                            <tr key={r.id}>
                              <td><span className="wh-badge wh-badge-code">{r.rack_code}</span></td>
                              <td><strong style={{ color: '#0f172a' }}>{r.rack_name}</strong></td>
                              <td>
                                <span className={`wh-badge-type ${r.rack_type === 'aisle' ? 'wh-badge-aisle' : 'wh-badge-rack'}`}>
                                  {r.rack_type === 'aisle' ? 'Dãy kệ' : 'Tầng / Kệ'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="wh-badge wh-badge-number">
                                  {r.max_capacity ? `${r.max_capacity.toLocaleString('vi-VN')} SP` : '500 SP'}
                                </span>
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="wh-action-btn-edit"
                                      title="Sửa kệ"
                                      onClick={() => handleOpenEditRack(r)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="wh-action-btn-delete"
                                      title="Xóa kệ"
                                      onClick={() => setDeletingRack(r)}
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
                    )}

                    {/* Mobile Card List cho Kệ & Dãy */}
                    {!isMasterLoading && detailRacks.length > 0 && (
                      <div className="rack-mobile-card-list">
                        {detailRacks.map((r) => (
                          <div key={r.id} className="wh-mobile-card">
                            <div className="wh-mobile-card-header">
                              <div>
                                <span className="wh-badge wh-badge-code">{r.rack_code}</span>
                                <div className="wh-mobile-card-name">{r.rack_name}</div>
                              </div>
                              <span className={`wh-badge-type ${r.rack_type === 'aisle' ? 'wh-badge-aisle' : 'wh-badge-rack'}`}>
                                {r.rack_type === 'aisle' ? 'Dãy kệ' : 'Tầng / Kệ'}
                              </span>
                            </div>
                            <div className="wh-mobile-card-body">
                              <div className="wh-mobile-card-row">
                                <span className="wh-mobile-card-label">Sức chứa:</span>
                                <span className="wh-mobile-card-val">
                                  {r.max_capacity ? `${r.max_capacity.toLocaleString('vi-VN')} SP` : '500 SP'}
                                </span>
                              </div>
                            </div>
                            {canManage && (
                              <div className="wh-mobile-card-actions">
                                <button
                                  type="button"
                                  className="wh-mobile-btn-edit"
                                  onClick={() => handleOpenEditRack(r)}
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="wh-mobile-btn-delete"
                                  onClick={() => setDeletingRack(r)}
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 3: GÁN SẢN PHẨM & TỒN THEO KỆ (PRODUCTS BY LOCATION) */}
          {subTab === 'products' && (
            <>
              <div className="wh-filter-card">
                <div className="wh-filter-group">
                  <div className="wh-search-wrap">
                    <input
                      type="text"
                      className="wh-search-input"
                      placeholder="Tìm theo mã SP, tên SP, vị trí kệ..."
                      value={prodSearch}
                      onChange={(e) => setProdSearch(e.target.value)}
                    />
                  </div>
                </div>

                {canManage && (
                  <button type="button" className="wh-btn wh-btn-primary" onClick={handleOpenAssignProduct}>
                    Gán sản phẩm vào kệ
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
                        Gán sản phẩm vào kệ
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="wh-table-responsive">
                      <table className="wh-table">
                        <thead>
                          <tr>
                            <th style={{ width: '110px' }}>Mã SP</th>
                            <th>Tên sản phẩm</th>
                            <th style={{ width: '70px' }}>ĐVT</th>
                            <th>Vị trí kệ lưu trữ</th>
                            <th>Khu vực / Dãy</th>
                            <th style={{ textAlign: 'right', width: '150px' }}>Số lượng tại kệ này</th>
                            <th style={{ textAlign: 'right', width: '150px' }}>Tổng tồn tại kho</th>
                            {canManage && <th style={{ textAlign: 'center', width: '220px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedLocationProducts.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <span className="wh-badge wh-badge-code">{item.product_code}</span>
                              </td>
                              <td>
                                <strong style={{ color: '#0f172a' }}>{item.product_name}</strong>
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
                                <span style={{ fontWeight: 500, color: '#334155' }}>
                                  {[item.zone, item.aisle].filter(Boolean).join(' - ') || '—'}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="wh-quantity-text">{item.quantity.toLocaleString('vi-VN')}</span>
                                <span className="wh-quantity-unit">{item.base_unit}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <span className="wh-quantity-text">{item.warehouse_total_stock.toLocaleString('vi-VN')}</span>
                                <span className="wh-quantity-unit">{item.base_unit}</span>
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="wh-action-btn-add-stock"
                                      title="Nhập thêm hàng vào vị trí kệ này"
                                      onClick={() => handleOpenAddStock(item)}
                                    >
                                      Thêm hàng
                                    </button>
                                    <button
                                      type="button"
                                      className="wh-action-btn-transfer"
                                      title="Chuyển một phần hoặc toàn bộ sang vị trí kệ khác"
                                      onClick={() => handleOpenTransferProduct(item)}
                                    >
                                      Chuyển kệ
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View cho Sản phẩm theo vị trí kệ */}
                    <div className="prod-mobile-card-list">
                      {paginatedLocationProducts.map((item) => (
                        <div key={item.id} className="prod-mobile-card">
                          <div className="prod-mobile-card-header">
                            <div>
                              <span className="wh-badge wh-badge-code">{item.product_code}</span>
                              <div className="prod-mobile-card-name">{item.product_name}</div>
                            </div>
                            <span className="wh-badge wh-badge-location">{item.location_code}</span>
                          </div>

                          <div className="prod-mobile-card-body">
                            <div className="wh-mobile-card-row">
                              <span className="wh-mobile-card-label">Khu vực / Dãy:</span>
                              <span className="wh-mobile-card-val">{[item.zone, item.aisle].filter(Boolean).join(' - ') || '—'}</span>
                            </div>
                            <div className="wh-mobile-card-row">
                              <span className="wh-mobile-card-label">Số lượng tại kệ:</span>
                              <span className="wh-mobile-card-val" style={{ color: '#0F8A5F', fontWeight: 700 }}>
                                {item.quantity.toLocaleString('vi-VN')} {item.base_unit || 'Cái'}
                              </span>
                            </div>
                            <div className="wh-mobile-card-row">
                              <span className="wh-mobile-card-label">Tổng tồn kho:</span>
                              <span className="wh-mobile-card-val">
                                {item.warehouse_total_stock.toLocaleString('vi-VN')} {item.base_unit || 'Cái'}
                              </span>
                            </div>
                          </div>

                          {canManage && (
                            <div className="prod-mobile-card-actions">
                              <button
                                type="button"
                                className="wh-mobile-btn-edit"
                                onClick={() => handleOpenAddStock(item)}
                              >
                                + Thêm hàng
                              </button>
                              <button
                                type="button"
                                className="wh-mobile-btn-manage"
                                onClick={() => handleOpenTransferProduct(item)}
                              >
                                Chuyển kệ
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* TAB 4: PHIẾU SOẠN HÀNG (WAVE / BATCH PICKING THEO LỘ TRÌNH KHO) */}
          {subTab === 'picking' && (
            <WarehousePickingView
              token={token}
              currentUser={currentUser}
              onBackToHome={() => setSubTab('locations')}
            />
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
                    <WarehouseKeeperSelectDropdown
                      token={token}
                      selectedManagerName={whFormData.manager_name}
                      onSelectKeeper={(keeper) => {
                        setWhFormData((prev) => ({
                          ...prev,
                          manager_name: keeper.full_name || keeper.username,
                          phone: keeper.phone || prev.phone,
                        }));
                      }}
                      onClearKeeper={() => {
                        setWhFormData((prev) => ({
                          ...prev,
                          manager_name: '',
                        }));
                      }}
                      placeholder="Chọn thủ kho phụ trách..."
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
                Lưu ý: Nếu kho đang có hàng tồn hoặc đang được phân công cho đại lý, hệ thống sẽ tự động chặn việc xóa để bảo vệ toàn vẹn dữ liệu.
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
                {/* Lựa chọn liên kết Bước 1: Kho hàng -> Khu vực */}
                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>Kho hàng</label>
                    <div className="wh-form-readonly-badge">
                      <strong>{selectedWarehouse?.name}</strong>
                    </div>
                  </div>

                  <div className="wh-form-group">
                    <label>
                      Khu vực <span className="wh-required-star">*</span>
                    </label>
                    <select
                      className="wh-form-select"
                      value={locFormData.zone}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocFormData((prev) => ({ ...prev, zone: val }));
                        handleAutoGenerateLocationCodeAndName(val, undefined, undefined);
                      }}
                    >
                      <option value="">-- Chọn khu vực lưu kho --</option>
                      {zonesList.length > 0 ? (
                        zonesList.map((z) => (
                          <option key={z.id} value={z.zone_name}>
                            {z.zone_name}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>Chưa có khu vực nào (vui lòng tạo khu vực trước)</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Lựa chọn liên kết Bước 2: Dãy kệ & Tầng/Kệ */}
                <div className="wh-form-group">
                  <label>
                    Dãy kệ và Tầng / Kệ <span className="wh-required-star">*</span>
                  </label>
                  <select
                    className="wh-form-select"
                    value={
                      locFormData.aisle && locFormData.rack
                        ? `${locFormData.aisle} - ${locFormData.rack}`
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setLocFormData((prev) => ({ ...prev, aisle: '', rack: '' }));
                        return;
                      }
                      const parts = val.split(' - ');
                      const newAisle = parts[0] || '';
                      const newRack = parts[1] || '';
                      setLocFormData((prev) => ({ ...prev, aisle: newAisle, rack: newRack }));
                      handleAutoGenerateLocationCodeAndName(undefined, newAisle, newRack);
                    }}
                  >
                    <option value="">-- Chọn dãy kệ và tầng --</option>
                    {[
                      'Dãy 1 - Tầng 1',
                      'Dãy 1 - Tầng 2',
                      'Dãy 2 - Tầng 1',
                      'Dãy 2 - Tầng 2',
                      'Dãy 3 - Tầng 1',
                      'Dãy 3 - Tầng 2',
                    ].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {locFormErrors.aisle_rack && (
                    <div className="wh-form-error">{locFormErrors.aisle_rack}</div>
                  )}
                </div>

                {/* Sức chứa tối đa & Đơn vị tính */}
                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Sức chứa tối đa <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      className="wh-form-input"
                      placeholder="VD: 500"
                      value={locFormData.max_capacity === 0 || locFormData.max_capacity === '' ? '' : locFormData.max_capacity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setLocFormData((prev) => ({ ...prev, max_capacity: '' }));
                          return;
                        }
                        const clean = raw.replace(/^0+(?=\d)/, '');
                        if (clean === '0') {
                          setLocFormData((prev) => ({ ...prev, max_capacity: '' }));
                          return;
                        }
                        setLocFormData((prev) => ({ ...prev, max_capacity: Number(clean) }));
                      }}
                    />
                    {locFormErrors.max_capacity && (
                      <div className="wh-form-error">{locFormErrors.max_capacity}</div>
                    )}
                  </div>

                  <div className="wh-form-group">
                    <label>Đơn vị tính</label>
                    <select
                      className="wh-form-select"
                      value={locFormData.unit}
                      onChange={(e) => setLocFormData((prev) => ({ ...prev, unit: e.target.value }))}
                    >
                      <option value="Cái">Cái</option>
                      <option value="Chiếc">Chiếc</option>
                      <option value="Thùng">Thùng</option>
                      <option value="Hộp">Hộp</option>
                    </select>
                  </div>
                </div>

                {/* Mã vị trí & Tên vị trí kệ */}
                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Mã vị trí / Kệ <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: KA-D1-T1-O01..."
                      value={locFormData.location_code}
                      onChange={(e) => setLocFormData((prev) => ({ ...prev, location_code: e.target.value }))}
                    />
                    {locFormErrors.location_code && <div className="wh-form-error">{locFormErrors.location_code}</div>}
                  </div>

                  <div className="wh-form-group">
                    <label>Tên vị trí kệ</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Khu A - Dãy 1 - Tầng 1 - Ô 01"
                      value={locFormData.location_name}
                      onChange={(e) => setLocFormData((prev) => ({ ...prev, location_name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>Trạng thái</label>
                    <select
                      className="wh-form-select"
                      value={locFormData.status}
                      onChange={(e) => setLocFormData((prev) => ({ ...prev, status: e.target.value }))}
                    >
                      <option value="Đang sử dụng">Đang sử dụng</option>
                      <option value="Tạm ngưng">Tạm ngưng</option>
                    </select>
                  </div>

                  <div className="wh-form-group">
                    <label>Ghi chú</label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="Ghi chú thêm về vị trí kệ này..."
                      value={locFormData.note}
                      onChange={(e) => setLocFormData((prev) => ({ ...prev, note: e.target.value }))}
                    />
                  </div>
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
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={isLocSubmitting || Number(locFormData.max_capacity) < 1}
                >
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
                Lưu ý: Vị trí chỉ được phép xóa khi số lượng sản phẩm lưu trữ tại vị trí này bằng 0.
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
      {isAssignModalOpen && (() => {
        const currentSelectedProd = allProducts.find((p) => p.id === assignFormData.product_id);
        const curUnit = currentSelectedProd?.base_unit || 'Cái';
        const curTotalStock =
          assignAllocationStatus?.warehouse_total_stock ??
          getProductWarehouseStock(assignFormData.product_id, currentSelectedProd?.stock || 0);
        const curAssignedAll = locationProducts
          .filter((lp) => lp.product_id === assignFormData.product_id)
          .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
        const curLocItem = locationProducts.find(
          (lp) => lp.location_id === assignFormData.location_id && lp.product_id === assignFormData.product_id
        );
        const curQtyAtThisLoc = curLocItem ? Number(curLocItem.quantity) || 0 : 0;
        const curAssignedOther = curAssignedAll - curQtyAtThisLoc;
        const curMaxAllowed = Math.max(0, curTotalStock - curAssignedOther);
        const isOverAssigned = Number(assignFormData.quantity) > curMaxAllowed;

        return (
          <div className="wh-modal-backdrop">
            <div className="wh-modal-card" style={{ maxWidth: '820px', width: '95%', maxHeight: '92vh' }}>
              <div className="wh-modal-header">
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Gán Sản Phẩm Vào Vị Trí Kệ</h3>
                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                    Kho: <strong style={{ color: '#0f172a' }}>{selectedWarehouse?.name}</strong>
                  </div>
                </div>
                <button type="button" className="wh-modal-close-btn" onClick={() => setIsAssignModalOpen(false)}>
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveAssignProduct}>
                <div className="wh-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
                  <div className="wh-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', margin: 0 }}>
                        Chọn sản phẩm <span className="wh-required-star">*</span>
                      </label>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {isFetchingAllocation ? 'Đang tải phân bổ...' : selectedDropdownProduct ? `Đang chọn: ${selectedDropdownProduct.name}` : 'Hiển thị 20 SP/lượt (cuộn xuống để xem thêm)'}
                      </span>
                    </div>

                    {/* Thanh tìm kiếm sản phẩm trong modal gán vị trí */}
                    <div style={{ position: 'relative', marginBottom: '8px' }}>
                      <input
                        type="text"
                        placeholder="Tìm theo tên hoặc mã sản phẩm (SP001, Áo khoác...)..."
                        value={assignProductSearch}
                        onChange={(e) => {
                          setAssignProductSearch(e.target.value);
                          setAssignProductDisplayLimit(20);
                        }}
                        style={{
                          width: '100%',
                          padding: '7px 30px 7px 10px',
                          fontSize: '12.5px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          outline: 'none',
                          color: '#0f172a',
                          background: '#ffffff',
                          boxSizing: 'border-box',
                        }}
                      />
                      {assignProductSearch && (
                        <button
                          type="button"
                          onClick={() => {
                            setAssignProductSearch('');
                            setAssignProductDisplayLimit(20);
                          }}
                          style={{
                            position: 'absolute',
                            right: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#94a3b8',
                            fontSize: '11px',
                            padding: '2px',
                            lineHeight: 1,
                          }}
                          title="Xóa tìm kiếm"
                        >
                          X
                        </button>
                      )}
                    </div>

                    {/* Danh sách sản phẩm dạng thẻ cuộn mượt mà có tải thêm 20 sản phẩm/lần */}
                    {(() => {
                      const filteredList = allProducts.filter((p) => {
                        if (!assignProductSearch.trim()) return true;
                        const q = assignProductSearch.trim().toLowerCase();
                        return (
                          (p.name || '').toLowerCase().includes(q) ||
                          (p.code || '').toLowerCase().includes(q)
                        );
                      });
                      const displayedList = filteredList.slice(0, assignProductDisplayLimit);

                      return (
                        <div
                          style={{
                            maxHeight: '210px',
                            overflowY: 'auto',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            background: '#ffffff',
                            padding: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '3px',
                          }}
                          onScroll={(e) => {
                            const target = e.currentTarget;
                            if (target.scrollHeight - target.scrollTop <= target.clientHeight + 30) {
                              if (assignProductDisplayLimit < filteredList.length) {
                                setAssignProductDisplayLimit((prev) => Math.min(prev + 20, filteredList.length));
                              }
                            }
                          }}
                        >
                          {displayedList.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                              Không tìm thấy sản phẩm nào phù hợp với &quot;{assignProductSearch}&quot;
                            </div>
                          ) : (
                            displayedList.map((p) => {
                              const pWhTotal = getProductWarehouseStock(p.id, p.stock || 0);
                              const pAssignedTotal = locationProducts
                                .filter((lp) => lp.product_id === p.id)
                                .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
                              const pAtThisLoc =
                                locationProducts.find(
                                  (lp) => lp.location_id === assignFormData.location_id && lp.product_id === p.id
                                )?.quantity || 0;
                              const pAssignedOther = pAssignedTotal - pAtThisLoc;
                              const pAvailableForLoc = Math.max(0, pWhTotal - pAssignedOther);
                              const isExhausted = pAvailableForLoc <= 0 && pAtThisLoc === 0;
                              const isSelected = assignFormData.product_id === p.id;

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (isExhausted) return;
                                    const otherAssigned = locationProducts
                                      .filter((lp) => lp.product_id === p.id && lp.location_id !== assignFormData.location_id)
                                      .reduce((sum, lp) => sum + (Number(lp.quantity) || 0), 0);
                                    const locQty = locationProducts.find(
                                      (lp) => lp.location_id === assignFormData.location_id && lp.product_id === p.id
                                    )?.quantity || 0;
                                    const unassigned = Math.max(0, pWhTotal - otherAssigned - locQty);
                                    setAssignFormData({
                                      ...assignFormData,
                                      product_id: p.id,
                                      quantity: locQty > 0 ? locQty : unassigned,
                                    });
                                    if (selectedWarehouse) {
                                      fetchAllocationStatus(selectedWarehouse.id, p.id);
                                    }
                                  }}
                                  style={{
                                    padding: '7px 10px',
                                    borderRadius: '5px',
                                    border: isSelected ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                                    background: isSelected ? '#f0f9ff' : isExhausted ? '#f8fafc' : '#ffffff',
                                    cursor: isExhausted ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.1s ease',
                                    opacity: isExhausted ? 0.6 : 1,
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isExhausted && !isSelected) {
                                      e.currentTarget.style.backgroundColor = '#f1f5f9';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isExhausted && !isSelected) {
                                      e.currentTarget.style.backgroundColor = '#ffffff';
                                    }
                                  }}
                                >
                                  <div style={{ minWidth: 0, flex: 1, paddingRight: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{ fontWeight: '700', color: isSelected ? '#0284c7' : '#0f172a', fontSize: '12px' }}>
                                        [{p.code}] {p.name}
                                      </span>
                                      {isSelected && (
                                        <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: '800' }}>
                                          Đang chọn
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                      Tồn tại kho: <strong style={{ color: '#0f172a' }}>{pWhTotal}</strong> | Chưa gán:{' '}
                                      <strong style={{ color: isExhausted ? '#dc2626' : '#16a34a' }}>
                                        {Math.max(0, pWhTotal - pAssignedTotal)} {p.base_unit || 'Cái'}
                                      </strong>
                                      {isExhausted && (
                                        <span style={{ color: '#dc2626', fontWeight: '600', marginLeft: '6px' }}>
                                          (Đã gán hết vào kệ)
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div style={{ flexShrink: 0 }}>
                                    <input
                                      type="radio"
                                      name="selected_assign_product"
                                      checked={isSelected}
                                      disabled={isExhausted}
                                      readOnly
                                      style={{ cursor: isExhausted ? 'not-allowed' : 'pointer' }}
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}

                          {/* Dòng tải thêm nếu còn sản phẩm */}
                          {assignProductDisplayLimit < filteredList.length && (
                            <div style={{ padding: '6px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setAssignProductDisplayLimit((prev) => Math.min(prev + 20, filteredList.length))
                                }
                                style={{
                                  background: '#f8fafc',
                                  border: '1px dashed #cbd5e1',
                                  borderRadius: '4px',
                                  padding: '4px 12px',
                                  fontSize: '11.5px',
                                  color: '#0284c7',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  width: '100%',
                                }}
                              >
                                Tải thêm 20 sản phẩm tiếp theo (Còn {filteredList.length - assignProductDisplayLimit} SP)...
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Bảng tóm tắt trạng thái phân bổ tồn kho của sản phẩm liền khối ngay cạnh nhau không có khoảng trống */}
                  {currentSelectedProd && (
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tồn kho tổng</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                          {curTotalStock} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                        </div>
                      </div>

                      <div style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0', background: '#ffffff' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Đã gán ở kệ khác</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#64748b', marginTop: '2px' }}>
                          {curAssignedOther} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                        </div>
                      </div>

                      <div style={{ padding: '8px 4px', borderRight: '1px solid #e2e8f0', background: '#f8fafc' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Hiện tại kệ này</div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>
                          {curQtyAtThisLoc} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                        </div>
                      </div>

                      <div style={{ padding: '8px 4px', background: (curTotalStock - curAssignedAll) > 0 ? '#f0fdf4' : '#ffffff' }}>
                        <div style={{ fontSize: '11px', color: (curTotalStock - curAssignedAll) > 0 ? '#166534' : '#64748b', fontWeight: '700' }}>
                          Tồn chưa gán
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: (curTotalStock - curAssignedAll) > 0 ? '#16a34a' : '#64748b', marginTop: '2px' }}>
                          {Math.max(0, curTotalStock - curAssignedAll)} <span style={{ fontSize: '11px', fontWeight: '500' }}>{curUnit}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="wh-form-group">
                    <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', marginBottom: '6px' }}>
                      Chọn vị trí kệ lưu trữ <span className="wh-required-star">*</span>
                    </label>
                    <select
                      className="wh-form-select"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        color: '#0f172a',
                        backgroundColor: '#ffffff'
                      }}
                      value={assignFormData.location_id}
                      onChange={(e) => {
                        const newLocId = Number(e.target.value);
                        const locQty = locationProducts.find(
                          (lp) => lp.location_id === newLocId && lp.product_id === assignFormData.product_id
                        )?.quantity || 0;
                        setAssignFormData({ ...assignFormData, location_id: newLocId, quantity: locQty });
                      }}
                    >
                      {locations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.location_code} — {l.location_name || l.zone || 'Kệ'} (Hiện có: {l.total_quantity} SP / Sức chứa: {l.max_capacity || 500} SP)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="wh-form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label style={{ fontWeight: '700', fontSize: '13px', color: '#1e293b', margin: 0 }}>
                        Số lượng gán tại vị trí này <span className="wh-required-star">*</span>
                      </label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => setAssignFormData((prev) => ({ ...prev, quantity: curMaxAllowed }))}
                          style={{
                            padding: '2px 8px',
                            background: '#e0f2fe',
                            border: '1px solid #bae6fd',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            color: '#0284c7',
                            cursor: 'pointer',
                          }}
                          title={`Gán tối đa có thể cho kệ này (${curQtyAtThisLoc} hiện có + ${Math.max(0, curTotalStock - curAssignedAll)} chưa gán)`}
                        >
                          Gán tối đa ({curMaxAllowed})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignFormData((prev) => ({ ...prev, quantity: 0 }))}
                          style={{
                            padding: '2px 8px',
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#475569',
                            cursor: 'pointer',
                          }}
                        >
                          0 (Gỡ khỏi kệ)
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        max={curMaxAllowed}
                        className="wh-form-input"
                        placeholder="Nhập số lượng..."
                        value={assignFormData.quantity === '' ? '' : assignFormData.quantity}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '') {
                            setAssignFormData((prev) => ({ ...prev, quantity: '' }));
                            return;
                          }
                          const clean = raw.replace(/^0+(?=\d)/, '');
                          setAssignFormData((prev) => ({ ...prev, quantity: clean === '' ? 0 : Number(clean) }));
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '14px',
                          fontWeight: '700',
                          borderRadius: '6px',
                          border: isOverAssigned ? '2px solid #dc2626' : '1px solid #cbd5e1',
                          outline: 'none',
                          color: '#0f172a',
                        }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {curUnit}
                      </span>
                    </div>

                    {isOverAssigned && (
                      <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700', marginTop: '4px' }}>
                        ⚠️ Cảnh báo: Số lượng nhập ({assignFormData.quantity}) vượt quá số lượng tối đa có thể gán ({curMaxAllowed} {curUnit}). Sản phẩm đã được gán hết tại các kệ khác!
                      </div>
                    )}
                    {!isOverAssigned && (
                      <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                        Nếu nhập 0, sản phẩm sẽ được gỡ khỏi vị trí kệ này (hàng trở về tồn chưa gán vị trí).
                      </div>
                    )}
                  </div>
                </div>

                <div className="wh-modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="wh-btn wh-btn-secondary"
                    onClick={() => setIsAssignModalOpen(false)}
                    disabled={isAssignSubmitting}
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="wh-btn wh-btn-primary"
                    disabled={isAssignSubmitting || isOverAssigned || (curMaxAllowed === 0 && curQtyAtThisLoc === 0)}
                    style={{
                      opacity: isAssignSubmitting || isOverAssigned || (curMaxAllowed === 0 && curQtyAtThisLoc === 0) ? 0.6 : 1,
                      cursor: isAssignSubmitting || isOverAssigned || (curMaxAllowed === 0 && curQtyAtThisLoc === 0) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isAssignSubmitting ? 'Đang lưu...' : 'Gán vào vị trí'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
                  Vị trí xuất hiện tại: <strong>{locations.find((l) => l.id === transferFormData.from_location_id)?.location_code}</strong> - Tồn tại kệ: {transferFormData.max_available}
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
                    placeholder="Nhập số lượng..."
                    value={transferFormData.quantity === 0 || transferFormData.quantity === '' ? '' : transferFormData.quantity}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setTransferFormData((prev) => ({ ...prev, quantity: '' }));
                        return;
                      }
                      const clean = raw.replace(/^0+(?=\d)/, '');
                      if (clean === '0') {
                        setTransferFormData((prev) => ({ ...prev, quantity: '' }));
                        return;
                      }
                      setTransferFormData((prev) => ({ ...prev, quantity: Number(clean) }));
                    }}
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

      {/* ==================================================== */}
      {/* MODAL 6B: THÊM HÀNG VÀO VỊ TRÍ KỆ                     */}
      {/* ==================================================== */}
      {isAddStockModalOpen && addStockItem && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card" style={{ maxWidth: '480px' }}>
            <div className="wh-modal-header">
              <h3>Thêm Hàng Vào Vị Trí Kệ</h3>
              <button
                type="button"
                className="wh-modal-close-btn"
                onClick={() => {
                  setIsAddStockModalOpen(false);
                  setAddStockItem(null);
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAddStock}>
              {(() => {
                const curProductShelfItems = locationProducts.filter((lp) => lp.product_id === addStockItem.product_id);
                const otherShelvesQty = curProductShelfItems
                  .filter((lp) => lp.location_id !== addStockItem.location_id)
                  .reduce((s, lp) => s + (Number(lp.quantity) || 0), 0);
                const maxAllowedOnThisShelf = Math.max(0, addStockItem.warehouse_total_stock - otherShelvesQty);
                const unallocatedStock = Math.max(0, maxAllowedOnThisShelf - addStockItem.quantity);
                const isAddStockExhausted = unallocatedStock <= 0;
                const enteredQty = Number(addStockQuantity) || 0;
                const isExceeded = enteredQty > unallocatedStock;

                return (
                  <>
                    <div className="wh-modal-body">
                      {/* Thông tin vị trí kệ hiện tại của sản phẩm */}
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '14px',
                          marginBottom: '16px',
                          fontSize: '13.5px',
                        }}
                      >
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#64748b' }}>Sản phẩm:</span>{' '}
                          <strong style={{ color: '#0f172a' }}>{addStockItem.product_name}</strong>{' '}
                          <span className="wh-badge wh-badge-code" style={{ fontSize: '11px', padding: '1px 6px' }}>
                            {addStockItem.product_code}
                          </span>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#64748b' }}>Vị trí kệ hiện tại:</span>{' '}
                          <span className="wh-badge wh-badge-location" style={{ fontWeight: 600 }}>
                            {addStockItem.location_code}
                          </span>{' '}
                          {addStockItem.location_name && (
                            <span style={{ color: '#475569' }}>({addStockItem.location_name})</span>
                          )}
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#64748b' }}>Khu vực / Dãy:</span>{' '}
                          <span style={{ fontWeight: 500, color: '#334155' }}>
                            {[addStockItem.zone, addStockItem.aisle, addStockItem.rack].filter(Boolean).join(' - ') || '—'}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: '8px',
                            marginTop: '10px',
                            paddingTop: '10px',
                            borderTop: '1px dashed #cbd5e1',
                          }}
                        >
                          <div>
                            <span style={{ color: '#64748b', fontSize: '11.5px' }}>Tại kệ này:</span>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                              {addStockItem.quantity.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', fontSize: '11.5px' }}>Chưa lên kệ:</span>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: isAddStockExhausted ? '#ef4444' : '#16a34a' }}>
                              {unallocatedStock.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                            </div>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', fontSize: '11.5px' }}>Tổng tại kho:</span>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                              {addStockItem.warehouse_total_stock.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Cảnh báo đỏ nếu đã phân bổ hết toàn bộ tồn kho */}
                      {isAddStockExhausted && (
                        <div
                          style={{
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            borderRadius: '8px',
                            padding: '12px 14px',
                            marginBottom: '16px',
                            color: '#991b1b',
                            fontSize: '13px',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                          }}
                        >
                          <span style={{ fontSize: '18px', lineHeight: 1 }}>⛔</span>
                          <div>
                            <strong style={{ fontSize: '13.5px' }}>Toàn bộ tồn kho đã được xếp hết lên các kệ!</strong>
                            <p style={{ margin: '4px 0 0 0', color: '#b91c1c', fontSize: '12.5px', lineHeight: 1.5 }}>
                              Kho hiện có <strong>{addStockItem.warehouse_total_stock.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}</strong> và toàn bộ đã được phân bổ (kệ này: {addStockItem.quantity.toLocaleString('vi-VN')}, các kệ khác: {otherShelvesQty.toLocaleString('vi-VN')}).
                              <br />
                              Số lượng chưa phân bổ còn <strong>0 {addStockItem.base_unit || 'Cái'}</strong>. Nếu muốn tăng thêm vào kệ này, vui lòng sử dụng chức năng <strong>"Chuyển kệ"</strong> từ kệ khác sang.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="wh-form-group">
                        <label>
                          Số lượng hàng cần xếp thêm vào kệ <span className="wh-required-star">*</span>
                          {!isAddStockExhausted && (
                            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500, marginLeft: '8px' }}>
                              (Tối đa có thể thêm: {unallocatedStock.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'})
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={unallocatedStock}
                          required
                          disabled={isAddStockExhausted}
                          className="wh-form-input"
                          placeholder={isAddStockExhausted ? 'Đã hết hàng chưa phân bổ trong kho' : `Tối đa ${unallocatedStock} ${addStockItem.base_unit || 'Cái'}...`}
                          value={addStockQuantity === 0 || addStockQuantity === '' ? '' : addStockQuantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                              setAddStockQuantity('');
                              return;
                            }
                            const clean = raw.replace(/^0+(?=\d)/, '');
                            if (clean === '0') {
                              setAddStockQuantity('');
                              return;
                            }
                            setAddStockQuantity(Number(clean));
                          }}
                        />
                        {isExceeded && !isAddStockExhausted && (
                          <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                            ⚠️ Số lượng nhập ({enteredQty}) vượt quá tồn chưa phân bổ ({unallocatedStock})!
                          </div>
                        )}
                      </div>

                      {/* Dự kiến cập nhật */}
                      <div
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '12px 14px',
                          fontSize: '13px',
                          color: '#334155',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: '#64748b' }}>Tại kệ này sau khi thêm:</span>
                          <strong style={{ color: '#0f172a' }}>
                            {(addStockItem.quantity + enteredQty).toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                          </strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: '#64748b' }}>Tồn chưa phân bổ còn lại:</span>
                          <strong style={{ color: Math.max(0, unallocatedStock - enteredQty) === 0 ? '#dc2626' : '#16a34a' }}>
                            {Math.max(0, unallocatedStock - enteredQty).toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                          </strong>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            borderTop: '1px dashed #cbd5e1',
                            paddingTop: '6px',
                            marginTop: '6px',
                          }}
                        >
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Tổng tồn tại kho (Cố định):</span>
                          <strong style={{ color: '#0f172a', fontWeight: 700 }}>
                            {addStockItem.warehouse_total_stock.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="wh-modal-footer">
                      <button
                        type="button"
                        className="wh-btn wh-btn-secondary"
                        onClick={() => {
                          setIsAddStockModalOpen(false);
                          setAddStockItem(null);
                        }}
                        disabled={isAddStockSubmitting}
                      >
                        Hủy bỏ
                      </button>
                      <button
                        type="submit"
                        className="wh-btn wh-btn-primary"
                        disabled={isAddStockSubmitting || isAddStockExhausted || enteredQty <= 0 || isExceeded}
                      >
                        {isAddStockSubmitting ? 'Đang lưu...' : 'Lưu và Cập nhật tồn'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}


      {/* ==================================================== */}
      {/* MODAL 7: THÊM / SỬA KHU VỰC                          */}
      {/* ==================================================== */}
      {isZoneModalOpen && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card">
            <div className="wh-modal-header">
              <h3>{editingZone ? 'Chỉnh Sửa Khu Vực' : 'Khai Báo Khu Vực Mới'}</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setIsZoneModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveZone}>
              <div className="wh-modal-body">
                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Mã khu vực <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: KHU-A, ZONE-01..."
                      value={zoneFormData.zone_code}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, zone_code: e.target.value })}
                    />
                    {zoneFormErrors.zone_code && <div className="wh-form-error">{zoneFormErrors.zone_code}</div>}
                  </div>

                  <div className="wh-form-group">
                    <label>
                      Tên khu vực <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Khu A - Thời trang nam..."
                      value={zoneFormData.zone_name}
                      onChange={(e) => setZoneFormData({ ...zoneFormData, zone_name: e.target.value })}
                    />
                    {zoneFormErrors.zone_name && <div className="wh-form-error">{zoneFormErrors.zone_name}</div>}
                  </div>
                </div>

                <div className="wh-form-group">
                  <label>Mô tả / Phạm vi hàng hóa</label>
                  <input
                    type="text"
                    className="wh-form-input"
                    placeholder="VD: Khu vực lưu kho quần áo, phụ kiện đóng thùng..."
                    value={zoneFormData.description}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setIsZoneModalOpen(false)}
                  disabled={isZoneSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="wh-btn wh-btn-primary" disabled={isZoneSubmitting}>
                  {isZoneSubmitting ? 'Đang lưu...' : editingZone ? 'Cập nhật khu vực' : 'Tạo khu vực'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 8: XÁC NHẬN XÓA KHU VỰC                        */}
      {/* ==================================================== */}
      {deletingZone && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card" style={{ maxWidth: '440px' }}>
            <div className="wh-modal-header" style={{ background: '#fef2f2' }}>
              <h3 style={{ color: '#dc2626' }}>Xác Nhận Xóa Khu Vực</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setDeletingZone(null)}>
                ✕
              </button>
            </div>
            <div className="wh-modal-body">
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#334155' }}>
                Bạn có chắc chắn muốn xóa khu vực <strong>{deletingZone.zone_name}</strong> (Mã: {deletingZone.zone_code}) không?
              </p>
              <div style={{ fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                Lưu ý: Nếu khu vực đang có vị trí kệ sử dụng ({deletingZone.locations_count} vị trí), hệ thống sẽ chặn việc xóa.
              </div>
            </div>
            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setDeletingZone(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="wh-btn wh-btn-danger"
                style={{ background: '#dc2626', color: '#ffffff' }}
                onClick={handleDeleteZoneConfirm}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 9: THÊM / SỬA KỆ & DÃY                         */}
      {/* ==================================================== */}
      {isRackModalOpen && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card">
            <div className="wh-modal-header">
              <h3>{editingRack ? 'Chỉnh Sửa Kệ / Dãy' : 'Khai Báo Kệ / Dãy Mới'}</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setIsRackModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRack}>
              <div className="wh-modal-body">
                <div className="wh-form-group" style={{ marginBottom: '14px' }}>
                  <label>Khu vực trực thuộc <span className="wh-required-star">*</span></label>
                  <select
                    className="wh-form-select"
                    value={rackFormData.zone_id}
                    onChange={(e) => {
                      const zId = Number(e.target.value);
                      const targetZ = zonesList.find((z) => z.id === zId);
                      const cleanZ = (targetZ?.zone_code || 'KC').replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || 'K';
                      setRackFormData((prev) => ({
                        ...prev,
                        zone_id: zId,
                        rack_code: prev.rack_code ? `${cleanZ}-${prev.rack_code.split('-').slice(1).join('-') || 'D1-T1'}` : `${cleanZ}-D1-T1`,
                      }));
                    }}
                  >
                    {zonesList.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.zone_name} ({z.zone_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Điền Dãy kệ và Tầng / Kệ thủ công */}
                <div className="wh-form-grid-2" style={{ marginBottom: '14px' }}>
                  <div className="wh-form-group">
                    <label>
                      Dãy kệ <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Dãy 1, Dãy 2, Dãy A..."
                      value={rackFormData.aisle_input}
                      onChange={(e) => {
                        const newAisle = e.target.value;
                        const newName = [newAisle.trim(), rackFormData.rack_input.trim()].filter(Boolean).join(' - ');
                        const activeZoneObj = zonesList.find((z) => z.id === rackFormData.zone_id) || zonesList[0];
                        const cleanZ = (activeZoneObj?.zone_code || 'KC').replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || 'K';
                        const dNum = newAisle.replace(/\D/g, '') || '1';
                        const tNum = rackFormData.rack_input.replace(/\D/g, '') || '1';
                        setRackFormData((prev) => ({
                          ...prev,
                          aisle_input: newAisle,
                          rack_name: newName,
                          rack_code: `${cleanZ}-D${dNum}-T${tNum}`,
                        }));
                      }}
                    />
                  </div>

                  <div className="wh-form-group">
                    <label>
                      Tầng / Kệ <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Tầng 1, Tầng 2, Kệ 01..."
                      value={rackFormData.rack_input}
                      onChange={(e) => {
                        const newRack = e.target.value;
                        const newName = [rackFormData.aisle_input.trim(), newRack.trim()].filter(Boolean).join(' - ');
                        const activeZoneObj = zonesList.find((z) => z.id === rackFormData.zone_id) || zonesList[0];
                        const cleanZ = (activeZoneObj?.zone_code || 'KC').replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || 'K';
                        const dNum = rackFormData.aisle_input.replace(/\D/g, '') || '1';
                        const tNum = newRack.replace(/\D/g, '') || '1';
                        setRackFormData((prev) => ({
                          ...prev,
                          rack_input: newRack,
                          rack_name: newName,
                          rack_code: `${cleanZ}-D${dNum}-T${tNum}`,
                        }));
                      }}
                    />
                  </div>
                </div>

                <div className="wh-form-group" style={{ marginBottom: '14px' }}>
                  <label style={{ color: '#64748b', fontSize: '12px' }}>Hoặc chọn nhanh cấu trúc chuẩn (gợi ý)</label>
                  <select
                    className="wh-form-select"
                    value={
                      ['Dãy 1 - Tầng 1', 'Dãy 1 - Tầng 2', 'Dãy 2 - Tầng 1', 'Dãy 2 - Tầng 2', 'Dãy 3 - Tầng 1', 'Dãy 3 - Tầng 2'].includes(rackFormData.rack_name)
                        ? rackFormData.rack_name
                        : ''
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const parts = val.split(' - ');
                      const aPart = parts[0]?.trim() || '';
                      const rPart = parts[1]?.trim() || '';
                      const activeZoneObj = zonesList.find((z) => z.id === rackFormData.zone_id) || zonesList[0];
                      const cleanZ = (activeZoneObj?.zone_code || 'KC').replace(/[^a-zA-Z0-9]/g, '').slice(-2).toUpperCase() || 'K';
                      const dNum = aPart.replace(/\D/g, '') || '1';
                      const tNum = rPart.replace(/\D/g, '') || '1';
                      const autoCode = `${cleanZ}-D${dNum}-T${tNum}`;
                      setRackFormData((prev) => ({
                        ...prev,
                        aisle_input: aPart,
                        rack_input: rPart,
                        rack_name: val,
                        rack_code: autoCode,
                        rack_type: 'rack',
                        max_capacity: 500,
                      }));
                    }}
                  >
                    <option value="">-- Tùy chọn: Chọn nhanh Dãy & Tầng chuẩn --</option>
                    <option value="Dãy 1 - Tầng 1">Dãy 1 - Tầng 1</option>
                    <option value="Dãy 1 - Tầng 2">Dãy 1 - Tầng 2</option>
                    <option value="Dãy 2 - Tầng 1">Dãy 2 - Tầng 1</option>
                    <option value="Dãy 2 - Tầng 2">Dãy 2 - Tầng 2</option>
                    <option value="Dãy 3 - Tầng 1">Dãy 3 - Tầng 1</option>
                    <option value="Dãy 3 - Tầng 2">Dãy 3 - Tầng 2</option>
                  </select>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Mã kệ / Dãy <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: KA-D1-T1, DAY-01..."
                      value={rackFormData.rack_code}
                      onChange={(e) => setRackFormData({ ...rackFormData, rack_code: e.target.value })}
                    />
                    {rackFormErrors.rack_code && <div className="wh-form-error">{rackFormErrors.rack_code}</div>}
                  </div>

                  <div className="wh-form-group">
                    <label>
                      Tên kệ / Dãy <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: Dãy 1 - Tầng 1..."
                      value={rackFormData.rack_name}
                      onChange={(e) => setRackFormData({ ...rackFormData, rack_name: e.target.value })}
                    />
                    {rackFormErrors.rack_name && <div className="wh-form-error">{rackFormErrors.rack_name}</div>}
                  </div>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>Phân loại</label>
                    <select
                      className="wh-form-select"
                      value={rackFormData.rack_type}
                      onChange={(e) => setRackFormData({ ...rackFormData, rack_type: e.target.value })}
                    >
                      <option value="rack">Tầng / Kệ</option>
                      <option value="aisle">Dãy kệ</option>
                    </select>
                  </div>

                  <div className="wh-form-group">
                    <label>Sức chứa & Tải trọng tối đa (ĐVT)</label>
                    <input
                      type="number"
                      min="1"
                      className="wh-form-input"
                      placeholder="VD: 500"
                      value={rackFormData.max_capacity === 0 || rackFormData.max_capacity === '' ? '' : rackFormData.max_capacity}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setRackFormData((prev) => ({ ...prev, max_capacity: '' }));
                          return;
                        }
                        const clean = raw.replace(/^0+(?=\d)/, '');
                        if (clean === '0') {
                          setRackFormData((prev) => ({ ...prev, max_capacity: '' }));
                          return;
                        }
                        setRackFormData((prev) => ({ ...prev, max_capacity: Number(clean) }));
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setIsRackModalOpen(false)}
                  disabled={isRackSubmitting}
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="wh-btn wh-btn-primary" disabled={isRackSubmitting}>
                  {isRackSubmitting ? 'Đang lưu...' : editingRack ? 'Cập nhật' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 10: XÁC NHẬN XÓA KỆ / DÃY                      */}
      {/* ==================================================== */}
      {deletingRack && (
        <div className="wh-modal-backdrop">
          <div className="wh-modal-card" style={{ maxWidth: '440px' }}>
            <div className="wh-modal-header" style={{ background: '#fef2f2' }}>
              <h3 style={{ color: '#dc2626' }}>Xác Nhận Xóa Kệ / Dãy</h3>
              <button type="button" className="wh-modal-close-btn" onClick={() => setDeletingRack(null)}>
                ✕
              </button>
            </div>
            <div className="wh-modal-body">
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#334155' }}>
                Bạn có chắc chắn muốn xóa <strong>{deletingRack.rack_name}</strong> (Mã: {deletingRack.rack_code}) không?
              </p>
              <div style={{ fontSize: '13px', color: '#64748b', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px' }}>
                Lưu ý: Nếu kệ đang được liên kết trong các vị trí ({deletingRack.locations_count} vị trí), hệ thống sẽ chặn việc xóa.
              </div>
            </div>
            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setDeletingRack(null)}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="wh-btn wh-btn-danger"
                style={{ background: '#dc2626', color: '#ffffff' }}
                onClick={handleDeleteRackConfirm}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseManagementView;
