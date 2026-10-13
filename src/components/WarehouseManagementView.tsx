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
import { emitStatusToast } from './StatusToast';

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
  const [subTab, setSubTab] = useState<'locations' | 'master-data' | 'products'>('locations');

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

  // State Danh mục Master Data: Kệ, Dãy, Khu vực
  const [, setMasterData] = useState<WarehouseMasterData>({
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
  const [addStockQuantity, setAddStockQuantity] = useState<number>(10);
  const [isAddStockSubmitting, setIsAddStockSubmitting] = useState<boolean>(false);

  // Modal Cảnh Báo Sức Chứa & Tải Trọng Kệ / Kho Đầy
  const [isCapacityWarningModalOpen, setIsCapacityWarningModalOpen] = useState<boolean>(false);
  const [capacityWarningData, setCapacityWarningData] = useState<{
    zoneName: string;
    locationCode?: string;
    currentStock: number;
    maxCapacity: number;
    attemptedAdd: number;
    availableSpace?: number;
    warningType?: 'rack' | 'zone';
    title?: string;
    message?: string;
  } | null>(null);

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
  const [rackFormData, setRackFormData] = useState({
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

  useEffect(() => {
    if (selectedWarehouse) {
      fetchMasterData(selectedWarehouse.id);
      fetchLocations(selectedWarehouse.id);
      if (subTab === 'products') {
        fetchLocationProducts(selectedWarehouse.id);
      }
    }
  }, [selectedWarehouse, subTab, fetchLocations, fetchLocationProducts, fetchMasterData]);

  // Danh sách các Zone độc nhất trong kho đang chọn
  const uniqueZones = useMemo(() => {
    const s = new Set<string>();
    locations.forEach((l) => {
      if (l.zone) s.add(l.zone);
    });
    return Array.from(s);
  }, [locations]);

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
    setIsLocModalOpen(true);
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
    setIsZoneModalOpen(true);
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
    setIsZoneModalOpen(true);
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
    setIsRackModalOpen(true);
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
    setIsRackModalOpen(true);
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

    if (netIncrease > 0) {
      // 1. Kiểm tra tải trọng và sức chứa của vị trí kệ
      const rackCheck = checkRackCapacity(assignFormData.location_id, assignFormData.product_id, targetQty);
      if (!rackCheck.ok) {
        setCapacityWarningData({
          warningType: 'rack',
          title: 'Vượt Tải Trọng Kệ! Cảnh Báo Sức Chứa',
          message: `Vị trí kệ ${targetLocCode} chỉ có sức chứa tối đa là ${rackCheck.maxCapacity} SP. Số lượng hàng vượt quá tải trọng cho phép. Vui lòng giảm số lượng nhập hoặc chuyển sang kệ khác.`,
          zoneName,
          locationCode: targetLocCode,
          currentStock: rackCheck.currentStock,
          maxCapacity: rackCheck.maxCapacity,
          attemptedAdd: netIncrease,
          availableSpace: rackCheck.availableSpace,
        });
        setIsCapacityWarningModalOpen(true);
        emitStatusToast({
          message: `Vượt quá sức chứa và tải trọng của kệ ${targetLocCode}! Chỉ còn chỗ cho ${rackCheck.availableSpace} SP.`,
          type: 'warning',
          title: 'Cảnh báo quá tải kệ',
        });
        return;
      }

      // 2. Kiểm tra sức chứa khu vực
      const capCheck = checkZoneCapacity(zoneName, netIncrease);
      if (!capCheck.ok) {
        setCapacityWarningData({
          warningType: 'zone',
          title: 'Kho Đầy! Cảnh Báo Vượt Sức Chứa',
          message: `Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa. Vui lòng sắp xếp vị trí khác hoặc mở thêm kho mới.`,
          zoneName,
          locationCode: targetLocCode,
          currentStock: capCheck.currentStock,
          maxCapacity: capCheck.maxCapacity,
          attemptedAdd: netIncrease,
        });
        setIsCapacityWarningModalOpen(true);
        emitStatusToast({
          message: `Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa. Vui lòng sắp xếp vị trí khác hoặc mở thêm kho mới.`,
          type: 'warning',
          title: 'Cảnh báo đầy kho',
        });
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
      await Promise.all([
        fetchLocationProducts(selectedWarehouse.id),
        fetchLocations(selectedWarehouse.id),
        fetchWarehouses(),
        fetchProductsList(),
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi gán sản phẩm';
      if (errMsg.includes('sức chứa') || errMsg.includes('tải trọng')) {
        setCapacityWarningData({
          warningType: 'rack',
          title: 'Vượt Tải Trọng Kệ! Cảnh Báo Sức Chứa',
          message: errMsg,
          zoneName,
          locationCode: targetLocCode,
          currentStock: targetLoc?.total_quantity || 0,
          maxCapacity: targetLoc?.max_capacity || 500,
          attemptedAdd: netIncrease,
          availableSpace: Math.max(0, (targetLoc?.max_capacity || 500) - (targetLoc?.total_quantity || 0)),
        });
        setIsCapacityWarningModalOpen(true);
      } else if (errMsg.includes('Kho đầy')) {
        setCapacityWarningData({
          warningType: 'zone',
          title: 'Kho Đầy! Cảnh Báo Vượt Sức Chứa',
          message: errMsg,
          zoneName,
          locationCode: targetLocCode,
          currentStock: targetLoc?.total_quantity || 0,
          maxCapacity: targetLoc?.max_capacity || 500,
          attemptedAdd: netIncrease,
        });
        setIsCapacityWarningModalOpen(true);
      }
      setErrorMsg(errMsg);
    } finally {
      setIsAssignSubmitting(false);
    }
  };

  // --- THAO TÁC THÊM HÀNG VÀO VỊ TRÍ KỆ HIỆN TẠI ---
  const handleOpenAddStock = (item: LocationProductStockItem) => {
    setAddStockItem(item);
    setAddStockQuantity(10);
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

    // 1. Kiểm tra sức chứa & tải trọng kệ cụ thể
    const rackCheck = checkRackCapacity(addStockItem.location_id, addStockItem.product_id, newTotalForThisProduct);
    if (!rackCheck.ok) {
      setCapacityWarningData({
        warningType: 'rack',
        title: 'Vượt Tải Trọng Kệ! Cảnh Báo Sức Chứa',
        message: `Vị trí kệ ${targetLocCode} chỉ có sức chứa tối đa là ${rackCheck.maxCapacity} SP (hiện đang chứa ${rackCheck.currentStock} SP, chỉ còn chỗ cho ${rackCheck.availableSpace} SP). Không thể nhập thêm ${qtyToAdd} SP vượt tải trọng.`,
        zoneName,
        locationCode: targetLocCode,
        currentStock: rackCheck.currentStock,
        maxCapacity: rackCheck.maxCapacity,
        attemptedAdd: qtyToAdd,
        availableSpace: rackCheck.availableSpace,
      });
      setIsCapacityWarningModalOpen(true);
      emitStatusToast({
        message: `Vượt quá sức chứa và tải trọng của kệ ${targetLocCode}! Vui lòng giảm số lượng nhập hoặc chuyển sang kệ khác.`,
        type: 'warning',
        title: 'Cảnh báo quá tải kệ',
      });
      return;
    }

    // 2. Kiểm tra giới hạn sức chứa toàn Khu vực
    const zoneCheck = checkZoneCapacity(zoneName, qtyToAdd);
    if (!zoneCheck.ok) {
      setCapacityWarningData({
        warningType: 'zone',
        title: 'Kho Đầy! Cảnh Báo Vượt Sức Chứa',
        message: `Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa. Vui lòng sắp xếp vị trí khác hoặc mở thêm kho mới.`,
        zoneName,
        locationCode: targetLocCode,
        currentStock: zoneCheck.currentStock,
        maxCapacity: zoneCheck.maxCapacity,
        attemptedAdd: qtyToAdd,
      });
      setIsCapacityWarningModalOpen(true);
      emitStatusToast({
        message: `Kho đầy! Khu vực ${zoneName} đã đạt giới hạn sức chứa tối đa. Vui lòng sắp xếp vị trí khác hoặc mở thêm kho mới.`,
        type: 'warning',
        title: 'Cảnh báo đầy kho',
      });
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
      if (errMsg.includes('sức chứa') || errMsg.includes('tải trọng')) {
        setCapacityWarningData({
          warningType: 'rack',
          title: 'Vượt Tải Trọng Kệ! Cảnh Báo Sức Chứa',
          message: errMsg,
          zoneName,
          locationCode: targetLocCode,
          currentStock: rackCheck.currentStock,
          maxCapacity: rackCheck.maxCapacity,
          attemptedAdd: qtyToAdd,
          availableSpace: rackCheck.availableSpace,
        });
        setIsCapacityWarningModalOpen(true);
      } else if (errMsg.includes('Kho đầy')) {
        setCapacityWarningData({
          warningType: 'zone',
          title: 'Kho Đầy! Cảnh Báo Vượt Sức Chứa',
          message: errMsg,
          zoneName,
          locationCode: targetLocCode,
          currentStock: zoneCheck.currentStock,
          maxCapacity: zoneCheck.maxCapacity,
          attemptedAdd: qtyToAdd,
        });
        setIsCapacityWarningModalOpen(true);
      }
      setErrorMsg(errMsg);
    } finally {
      setIsAddStockSubmitting(false);
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
            canManage && (
              <button type="button" className="wh-btn wh-btn-primary" onClick={handleOpenCreateWarehouse}>
                Thêm kho mới
              </button>
            )
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
              Danh sách vị trí kệ
              <span className="wh-tab-count">{locations.length}</span>
            </button>
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'master-data' ? 'active' : ''}`}
              onClick={() => setSubTab('master-data')}
            >
              Quản lý Kệ & Khu vực
              <span className="wh-tab-count">{racksList.length}</span>
            </button>
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'products' ? 'active' : ''}`}
              onClick={() => setSubTab('products')}
            >
              Sản phẩm theo vị trí kệ
              <span className="wh-tab-count">{locationProducts.length}</span>
            </button>
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

                  {uniqueZones.length > 0 && (
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
                </div>
              </div>

              <div className="wh-table-card">
                {isLocLoading ? (
                  <div className="wh-state-box">
                    <div>Đang tải danh sách vị trí kệ...</div>
                  </div>
                ) : locations.length === 0 ? (
                  <div className="wh-state-box">
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
                      value={locFormData.max_capacity}
                      onChange={(e) => setLocFormData((prev) => ({ ...prev, max_capacity: Number(e.target.value) }))}
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
                    Nếu nhập 0, sản phẩm sẽ được gỡ khỏi vị trí kệ này.
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
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      marginTop: '10px',
                      paddingTop: '10px',
                      borderTop: '1px dashed #cbd5e1',
                    }}
                  >
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Số lượng tại kệ này:</span>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                        {addStockItem.quantity.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Tổng tồn tại kho:</span>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>
                        {addStockItem.warehouse_total_stock.toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="wh-form-group">
                  <label>
                    Số lượng hàng cần nhập thêm <span className="wh-required-star">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="wh-form-input"
                    value={addStockQuantity}
                    onChange={(e) => setAddStockQuantity(Math.max(1, Number(e.target.value) || 0))}
                    placeholder="Nhập số lượng hàng..."
                  />
                </div>

                {/* Dự kiến cập nhật */}
                <div
                  style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    fontSize: '12.5px',
                    color: '#166534',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Số lượng tại kệ này sau khi thêm:</span>
                    <strong>{(addStockItem.quantity + Number(addStockQuantity || 0)).toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tổng tồn tại kho sau khi thêm:</span>
                    <strong>{(addStockItem.warehouse_total_stock + Number(addStockQuantity || 0)).toLocaleString('vi-VN')} {addStockItem.base_unit || 'Cái'}</strong>
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
                  disabled={isAddStockSubmitting || Number(addStockQuantity) <= 0}
                >
                  {isAddStockSubmitting ? 'Đang lưu...' : 'Lưu và Cập nhật tồn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 6C: CẢNH BÁO SỨC CHỨA & TẢI TRỌNG / ĐẦY KHO   */}
      {/* ==================================================== */}
      {isCapacityWarningModalOpen && capacityWarningData && (
        <div className="wh-modal-backdrop" style={{ zIndex: 1200 }}>
          <div className="wh-modal-card" style={{ maxWidth: '500px', borderTop: '4px solid #ef4444' }}>
            <div className="wh-modal-header" style={{ background: '#fef2f2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div>
                  <h3 style={{ margin: 0, color: '#b91c1c', fontSize: '16.5px' }}>
                    {capacityWarningData.warningType === 'rack'
                      ? 'Vượt Tải Trọng Kệ! Cảnh Báo Sức Chứa'
                      : 'Kho Đầy! Cảnh Báo Vượt Sức Chứa'}
                  </h3>
                  <span style={{ fontSize: '12px', color: '#7f1d1d' }}>
                    {capacityWarningData.warningType === 'rack'
                      ? 'Giới hạn sức chứa và tải trọng tối đa của vị trí kệ'
                      : 'Giới hạn dung lượng lưu trữ của toàn khu vực'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="wh-modal-close-btn"
                onClick={() => setIsCapacityWarningModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="wh-modal-body" style={{ padding: '20px' }}>
              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  marginBottom: '16px',
                  color: '#9f1239',
                  fontWeight: 600,
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {capacityWarningData.message ||
                  (capacityWarningData.warningType === 'rack'
                    ? `Vượt quá sức chứa và tải trọng của kệ! Vị trí ${capacityWarningData.locationCode || ''} chỉ có sức chứa tối đa là ${capacityWarningData.maxCapacity.toLocaleString('vi-VN')} SP. Vui lòng giảm số lượng nhập hoặc xếp sang kệ khác.`
                    : `Kho đầy! Khu vực ${capacityWarningData.zoneName} đã đạt giới hạn sức chứa tối đa. Vui lòng sắp xếp vị trí khác hoặc mở thêm kho mới.`)}
              </div>

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
                {capacityWarningData.locationCode && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Vị trí kệ kiểm tra:</span>
                    <strong style={{ color: '#0f172a' }}>{capacityWarningData.locationCode}</strong>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>
                    {capacityWarningData.warningType === 'rack' ? 'Tồn hiện tại trên kệ:' : 'Tồn hiện tại của Khu vực:'}
                  </span>
                  <strong>{capacityWarningData.currentStock.toLocaleString('vi-VN')} SP</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Số lượng cần nhập thêm:</span>
                  <strong style={{ color: '#dc2626' }}>+{capacityWarningData.attemptedAdd.toLocaleString('vi-VN')} SP</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>
                    {capacityWarningData.warningType === 'rack' ? 'Sức chứa / Tải trọng tối đa của kệ:' : 'Tổng sức chứa tối đa của Khu:'}
                  </span>
                  <strong>{capacityWarningData.maxCapacity.toLocaleString('vi-VN')} SP</strong>
                </div>
                {capacityWarningData.availableSpace !== undefined && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: '#166534' }}>
                    <span>Chỗ còn trống có thể nhận:</span>
                    <strong>{capacityWarningData.availableSpace.toLocaleString('vi-VN')} SP</strong>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px dashed #cbd5e1',
                    color: '#b91c1c',
                    fontWeight: 700,
                  }}
                >
                  <span>Vượt quá giới hạn tải trọng:</span>
                  <span>
                    +{(
                      capacityWarningData.currentStock +
                      capacityWarningData.attemptedAdd -
                      capacityWarningData.maxCapacity
                    ).toLocaleString('vi-VN')}{' '}
                    SP
                  </span>
                </div>
              </div>
            </div>

            <div className="wh-modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setIsCapacityWarningModalOpen(false)}
              >
                Đóng
              </button>
              {capacityWarningData.warningType === 'rack' ? (
                <button
                  type="button"
                  className="wh-btn wh-btn-primary"
                  style={{ background: '#2563eb' }}
                  onClick={() => {
                    setIsCapacityWarningModalOpen(false);
                    setIsAddStockModalOpen(false);
                    setIsAssignModalOpen(false);
                    handleOpenAssignProduct();
                  }}
                >
                  Chọn vị trí kệ khác
                </button>
              ) : (
                <button
                  type="button"
                  className="wh-btn wh-btn-primary"
                  style={{ background: '#2563eb' }}
                  onClick={() => {
                    setIsCapacityWarningModalOpen(false);
                    setIsAddStockModalOpen(false);
                    setIsAssignModalOpen(false);
                    handleOpenCreateWarehouse();
                  }}
                >
                  Mở thêm kho mới
                </button>
              )}
            </div>
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
                      value={rackFormData.max_capacity}
                      onChange={(e) => setRackFormData({ ...rackFormData, max_capacity: Number(e.target.value) })}
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
