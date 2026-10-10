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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  // Tùy chọn nhập tay khi chọn "+ Tùy chỉnh..." trong Modal Vị trí
  const [isCustomZone, setIsCustomZone] = useState<boolean>(false);
  const [isCustomAisle, setIsCustomAisle] = useState<boolean>(false);
  const [isCustomRack, setIsCustomRack] = useState<boolean>(false);
  const [isCustomBin, setIsCustomBin] = useState<boolean>(false);

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
    max_capacity: 1000,
    is_active: true,
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
      .catch(() => { });
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
      if (subTab === 'locations') {
        fetchLocations(selectedWarehouse.id);
      } else if (subTab === 'products') {
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
    rVal?: string,
    bVal?: string
  ) => {
    const zone = zVal !== undefined ? zVal : locFormData.zone;
    const aisle = aVal !== undefined ? aVal : locFormData.aisle;
    const rack = rVal !== undefined ? rVal : locFormData.rack;
    const bin = bVal !== undefined ? bVal : locFormData.bin;

    const whPrefix = selectedWarehouse?.code?.replace(/^KHO_/, '') || 'KHO';

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

    let bPart = '';
    if (bin) {
      const mo = bin.match(/ô\s+([a-zA-Z0-9]+)/i);
      const mh = bin.match(/hộc\s+([a-zA-Z0-9]+)/i);
      if (mo) bPart = `O${mo[1].toUpperCase()}`;
      else if (mh) bPart = `H${mh[1].toUpperCase()}`;
      else bPart = bin.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();
    }

    const codeParts = [whPrefix, zPart, aPart, rPart, bPart].filter(Boolean);
    const genCode = codeParts.join('-');

    const nameParts = [zone, aisle, rack, bin ? `(${bin})` : ''].filter(Boolean);
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
    setIsCustomZone(false);
    setIsCustomAisle(false);
    setIsCustomRack(false);
    setIsCustomBin(false);

    const defaultZone = masterData.zones[0]?.name || '';
    const defaultAisle = masterData.aisles[0]?.name || '';
    const defaultRack = masterData.racks[0]?.name || '';
    const defaultBin = masterData.bins[0]?.name || '';

    setLocFormData({
      location_code: '',
      location_name: '',
      zone: defaultZone,
      aisle: defaultAisle,
      rack: defaultRack,
      bin: defaultBin,
      max_capacity: 1000,
      status: 'Đang sử dụng',
      note: '',
    });
    setLocFormErrors({});
    setIsLocModalOpen(true);

    setTimeout(() => {
      handleAutoGenerateLocationCodeAndName(defaultZone, defaultAisle, defaultRack, defaultBin);
    }, 0);
  };

  const handleOpenEditLocation = (loc: WarehouseLocationItem) => {
    setEditingLocation(loc);
    setIsCustomZone(Boolean(loc.zone && !masterData.zones.some((z) => z.name === loc.zone)));
    setIsCustomAisle(Boolean(loc.aisle && !masterData.aisles.some((a) => a.name === loc.aisle)));
    setIsCustomRack(Boolean(loc.rack && !masterData.racks.some((r) => r.name === loc.rack)));
    setIsCustomBin(Boolean(loc.bin && !masterData.bins.some((b) => b.name === loc.bin)));

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
  const handleOpenCreateRack = () => {
    setEditingRack(null);
    const nextCode = `KE-${String(racksList.length + 1).padStart(2, '0')}`;
    setRackFormData({
      rack_code: nextCode,
      rack_name: '',
      rack_type: 'rack',
      zone_id: zonesList[0]?.id || 0,
      max_capacity: 1000,
      is_active: true,
    });
    setRackFormErrors({});
    setIsRackModalOpen(true);
  };

  const handleOpenEditRack = (rack: WarehouseRackItem) => {
    setEditingRack(rack);
    setRackFormData({
      rack_code: rack.rack_code,
      rack_name: rack.rack_name,
      rack_type: rack.rack_type,
      zone_id: rack.zone_id || 0,
      max_capacity: rack.max_capacity || 1000,
      is_active: rack.is_active,
    });
    setRackFormErrors({});
    setIsRackModalOpen(true);
  };

  const handleSaveRack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouse) return;
    const errors: Record<string, string> = {};
    if (!rackFormData.rack_code.trim()) errors.rack_code = 'Mã kệ/dãy không được để trống.';
    if (!rackFormData.rack_name.trim()) errors.rack_name = 'Tên kệ/dãy không được để trống.';
    if (Object.keys(errors).length > 0) {
      setRackFormErrors(errors);
      return;
    }
    setIsRackSubmitting(true);
    try {
      if (editingRack) {
        await updateWarehouseRackApi(token, editingRack.id, {
          rack_code: rackFormData.rack_code.trim().toUpperCase(),
          rack_name: rackFormData.rack_name.trim(),
          rack_type: rackFormData.rack_type,
          zone_id: rackFormData.zone_id > 0 ? rackFormData.zone_id : undefined,
          max_capacity: Number(rackFormData.max_capacity) || 1000,
          is_active: rackFormData.is_active,
        });
        setSuccessMsg(`Cập nhật kệ/dãy '${rackFormData.rack_name}' thành công.`);
      } else {
        await createWarehouseRackApi(token, selectedWarehouse.id, {
          rack_code: rackFormData.rack_code.trim().toUpperCase(),
          rack_name: rackFormData.rack_name.trim(),
          rack_type: rackFormData.rack_type,
          zone_id: rackFormData.zone_id > 0 ? rackFormData.zone_id : undefined,
          max_capacity: Number(rackFormData.max_capacity) || 1000,
          is_active: rackFormData.is_active,
        });
        setSuccessMsg(`Thêm kệ/dãy mới '${rackFormData.rack_name}' thành công.`);
      }
      setIsRackModalOpen(false);
      fetchMasterData(selectedWarehouse.id);
      fetchLocations(selectedWarehouse.id);
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
      fetchMasterData(selectedWarehouse.id);
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
          <strong>{successMsg}</strong>
        </div>
      )}
      {errorMsg && (
        <div className="wh-info-banner" style={{ background: '#fef2f2', borderColor: '#fca5a5', color: '#b91c1c' }}>
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
                onChange={(e) => setWhSearch(e.target.value)}
              />

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
                {selectedWarehouse.name} {selectedWarehouse.code ? `- ${selectedWarehouse.code}` : ''}
              </h2>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                Địa chỉ: {selectedWarehouse.address || 'Chưa cập nhật'} | Phụ trách: {selectedWarehouse.manager_name || '—'} {selectedWarehouse.phone ? `| SĐT: ${selectedWarehouse.phone}` : ''}
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
              Danh sách vị trí kệ
            </button>
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'master-data' ? 'active' : ''}`}
              onClick={() => setSubTab('master-data')}
            >
              Quản lý Kệ & Khu vực
            </button>
            <button
              type="button"
              className={`wh-tab-btn ${subTab === 'products' ? 'active' : ''}`}
              onClick={() => setSubTab('products')}
            >
              Sản phẩm theo vị trí kệ
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
                    onChange={(e) => setLocSearch(e.target.value)}
                  />

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
                            <th>Khu vực</th>
                            <th>Dãy kệ</th>
                            <th>Tầng/Kệ</th>
                            <th>Ô chứa</th>
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
                  <input
                    type="text"
                    className="wh-search-input"
                    placeholder="Tìm nhanh mã hoặc tên khu vực, kệ..."
                    value={masterSearch}
                    onChange={(e) => setMasterSearch(e.target.value)}
                  />

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

                <div style={{ display: 'flex', gap: '8px' }}>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        className="wh-btn wh-btn-primary"
                        onClick={handleOpenCreateZone}
                      >
                        + Thêm khu vực mới
                      </button>
                      <button
                        type="button"
                        className="wh-btn wh-btn-primary"
                        onClick={handleOpenCreateRack}
                      >
                        + Thêm kệ / dãy mới
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Bố cục 2 cột: Cột 1 = Quản lý Khu vực, Cột 2 = Quản lý Kệ & Dãy */}
              <div className="wh-master-grid">
                {/* CỘT 1: DANH MỤC KHU VỰC */}
                <div className="wh-master-card">
                  <div className="wh-master-card-header">
                    <h3>
                      <span>Danh mục Khu vực (Zones)</span>
                      <span className="wh-badge wh-badge-code">{filteredZones.length}</span>
                    </h3>
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
                            <th>Mô tả / Hàng hóa</th>
                            <th style={{ textAlign: 'center' }}>Vị trí dùng</th>
                            {canManage && <th style={{ textAlign: 'center', width: '110px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredZones.map((z) => (
                            <tr key={z.id}>
                              <td><span className="wh-badge wh-badge-code">{z.zone_code}</span></td>
                              <td><strong>{z.zone_name}</strong></td>
                              <td style={{ fontSize: '12.5px', color: '#64748b' }}>{z.description || '—'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="wh-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                                  {z.locations_count} vị trí
                                </span>
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="wh-action-btn edit"
                                      title="Sửa khu vực"
                                      onClick={() => handleOpenEditZone(z)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="wh-action-btn delete"
                                      title="Xóa khu vực"
                                      onClick={() => setDeletingZone(z)}
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

                {/* CỘT 2: DANH MỤC KỆ & DÃY */}
                <div className="wh-master-card">
                  <div className="wh-master-card-header">
                    <h3>
                      <span>Danh mục Kệ & Dãy (Aisles / Racks)</span>
                      <span className="wh-badge wh-badge-code">{filteredRacks.length}</span>
                    </h3>
                  </div>

                  <div className="wh-table-responsive" style={{ maxHeight: 'calc(100vh - 280px)' }}>
                    {isMasterLoading ? (
                      <div className="wh-state-box"><div>Đang tải danh mục kệ...</div></div>
                    ) : filteredRacks.length === 0 ? (
                      <div className="wh-state-box">
                        <h4>Chưa có kệ / dãy nào</h4>
                        <p>Khai báo Dãy kệ và Tầng/Kệ để chọn nhanh khi tạo vị trí.</p>
                      </div>
                    ) : (
                      <table className="wh-table">
                        <thead>
                          <tr>
                            <th style={{ width: '90px' }}>Mã kệ</th>
                            <th>Tên kệ / dãy</th>
                            <th>Loại</th>
                            <th>Khu vực</th>
                            <th style={{ textAlign: 'center' }}>Vị trí dùng</th>
                            {canManage && <th style={{ textAlign: 'center', width: '110px' }}>Thao tác</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRacks.map((r) => (
                            <tr key={r.id}>
                              <td><span className="wh-badge wh-badge-code">{r.rack_code}</span></td>
                              <td><strong>{r.rack_name}</strong></td>
                              <td>
                                <span className={`wh-badge-type ${r.rack_type === 'aisle' ? 'wh-badge-aisle' : 'wh-badge-rack'}`}>
                                  {r.rack_type === 'aisle' ? 'Dãy kệ' : 'Tầng / Kệ'}
                                </span>
                              </td>
                              <td style={{ fontSize: '12.5px', color: '#475569' }}>{r.zone_name || 'Dùng chung'}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className="wh-badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                                  {r.locations_count} vị trí
                                </span>
                              </td>
                              {canManage && (
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="wh-action-btn edit"
                                      title="Sửa kệ"
                                      onClick={() => handleOpenEditRack(r)}
                                    >
                                      Sửa
                                    </button>
                                    <button
                                      type="button"
                                      className="wh-action-btn delete"
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
                  <input
                    type="text"
                    className="wh-search-input"
                    placeholder="Tìm theo mã SP, tên SP, vị trí kệ..."
                    value={prodSearch}
                    onChange={(e) => setProdSearch(e.target.value)}
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
                {/* Thanh tiện ích tự động sinh mã */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    Chọn nhanh <strong>Khu vực, Dãy kệ, Tầng, Ô chứa</strong> bên dưới, hệ thống sẽ tự động điền:
                  </div>
                  <button
                    type="button"
                    className="wh-helper-btn"
                    onClick={() => handleAutoGenerateLocationCodeAndName()}
                  >
                    Tự động tạo mã & tên gợi nhớ
                  </button>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Khu vực (Zone) {!isCustomZone && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>• Chọn danh mục</span>}
                    </label>
                    {!isCustomZone ? (
                      <select
                        className="wh-form-select"
                        value={locFormData.zone}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setIsCustomZone(true);
                            setLocFormData({ ...locFormData, zone: '' });
                          } else {
                            setLocFormData({ ...locFormData, zone: val });
                            handleAutoGenerateLocationCodeAndName(val, undefined, undefined, undefined);
                          }
                        }}
                      >
                        <option value="">-- Chọn khu vực lưu kho --</option>
                        {masterData.zones.map((z) => (
                          <option key={z.code} value={z.name}>
                            {z.name} ({z.code})
                          </option>
                        ))}
                        <option value="__custom__">+ Nhập khu vực khác (Tùy chỉnh)...</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="wh-form-input"
                          placeholder="Nhập tên khu vực mới..."
                          value={locFormData.zone}
                          onChange={(e) => {
                            setLocFormData({ ...locFormData, zone: e.target.value });
                            handleAutoGenerateLocationCodeAndName(e.target.value, undefined, undefined, undefined);
                          }}
                        />
                        <button
                          type="button"
                          className="wh-btn wh-btn-sm wh-btn-secondary"
                          title="Quay lại chọn từ danh mục"
                          onClick={() => {
                            setIsCustomZone(false);
                            const def = masterData.zones[0]?.name || '';
                            setLocFormData({ ...locFormData, zone: def });
                            handleAutoGenerateLocationCodeAndName(def, undefined, undefined, undefined);
                          }}
                        >
                          Chọn
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="wh-form-group">
                    <label>
                      Dãy kệ (Aisle) {!isCustomAisle && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>• Chọn danh mục</span>}
                    </label>
                    {!isCustomAisle ? (
                      <select
                        className="wh-form-select"
                        value={locFormData.aisle}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setIsCustomAisle(true);
                            setLocFormData({ ...locFormData, aisle: '' });
                          } else {
                            setLocFormData({ ...locFormData, aisle: val });
                            handleAutoGenerateLocationCodeAndName(undefined, val, undefined, undefined);
                          }
                        }}
                      >
                        <option value="">-- Chọn dãy kệ --</option>
                        {masterData.aisles.map((a) => (
                          <option key={a.code} value={a.name}>
                            {a.name}
                          </option>
                        ))}
                        <option value="__custom__">+ Nhập dãy khác (Tùy chỉnh)...</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="wh-form-input"
                          placeholder="VD: Dãy A1, Dãy 02..."
                          value={locFormData.aisle}
                          onChange={(e) => {
                            setLocFormData({ ...locFormData, aisle: e.target.value });
                            handleAutoGenerateLocationCodeAndName(undefined, e.target.value, undefined, undefined);
                          }}
                        />
                        <button
                          type="button"
                          className="wh-btn wh-btn-sm wh-btn-secondary"
                          title="Quay lại chọn từ danh mục"
                          onClick={() => {
                            setIsCustomAisle(false);
                            const def = masterData.aisles[0]?.name || '';
                            setLocFormData({ ...locFormData, aisle: def });
                            handleAutoGenerateLocationCodeAndName(undefined, def, undefined, undefined);
                          }}
                        >
                          Chọn
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Tầng/Kệ (Rack) {!isCustomRack && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>• Chọn danh mục</span>}
                    </label>
                    {!isCustomRack ? (
                      <select
                        className="wh-form-select"
                        value={locFormData.rack}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setIsCustomRack(true);
                            setLocFormData({ ...locFormData, rack: '' });
                          } else {
                            setLocFormData({ ...locFormData, rack: val });
                            handleAutoGenerateLocationCodeAndName(undefined, undefined, val, undefined);
                          }
                        }}
                      >
                        <option value="">-- Chọn tầng / kệ --</option>
                        {masterData.racks.map((r) => (
                          <option key={r.code} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                        <option value="__custom__">+ Nhập tầng/kệ khác...</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="wh-form-input"
                          placeholder="VD: Tầng 1, Tầng 2..."
                          value={locFormData.rack}
                          onChange={(e) => {
                            setLocFormData({ ...locFormData, rack: e.target.value });
                            handleAutoGenerateLocationCodeAndName(undefined, undefined, e.target.value, undefined);
                          }}
                        />
                        <button
                          type="button"
                          className="wh-btn wh-btn-sm wh-btn-secondary"
                          title="Quay lại chọn từ danh mục"
                          onClick={() => {
                            setIsCustomRack(false);
                            const def = masterData.racks[0]?.name || '';
                            setLocFormData({ ...locFormData, rack: def });
                            handleAutoGenerateLocationCodeAndName(undefined, undefined, def, undefined);
                          }}
                        >
                          Chọn
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="wh-form-group">
                    <label>
                      Ô chứa hàng / Hộc (Bin) {!isCustomBin && <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>• Chọn danh mục</span>}
                    </label>
                    {!isCustomBin ? (
                      <select
                        className="wh-form-select"
                        value={locFormData.bin}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setIsCustomBin(true);
                            setLocFormData({ ...locFormData, bin: '' });
                          } else {
                            setLocFormData({ ...locFormData, bin: val });
                            handleAutoGenerateLocationCodeAndName(undefined, undefined, undefined, val);
                          }
                        }}
                      >
                        <option value="">-- Chọn ô chứa / hộc --</option>
                        {masterData.bins.map((b) => (
                          <option key={b.code} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                        <option value="__custom__">+ Nhập ô khác...</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          className="wh-form-input"
                          placeholder="VD: Ô 01, Hộc B..."
                          value={locFormData.bin}
                          onChange={(e) => {
                            setLocFormData({ ...locFormData, bin: e.target.value });
                            handleAutoGenerateLocationCodeAndName(undefined, undefined, undefined, e.target.value);
                          }}
                        />
                        <button
                          type="button"
                          className="wh-btn wh-btn-sm wh-btn-secondary"
                          title="Quay lại chọn từ danh mục"
                          onClick={() => {
                            setIsCustomBin(false);
                            const def = masterData.bins[0]?.name || '';
                            setLocFormData({ ...locFormData, bin: def });
                            handleAutoGenerateLocationCodeAndName(undefined, undefined, undefined, def);
                          }}
                        >
                          Chọn
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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
                    <label>Sức chứa tối đa</label>
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
                <div className="wh-form-grid-2">
                  <div className="wh-form-group">
                    <label>
                      Mã kệ / Dãy <span className="wh-required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="wh-form-input"
                      placeholder="VD: DAY-01, TANG-1, KE-01..."
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
                      placeholder="VD: Dãy 1, Tầng 1, Kệ 01..."
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
                      <option value="aisle">Dãy kệ </option>
                      <option value="rack">Tầng / Kệ </option>
                    </select>
                  </div>

                  <div className="wh-form-group">
                    <label>Khu vực trực thuộc</label>
                    <select
                      className="wh-form-select"
                      value={rackFormData.zone_id}
                      onChange={(e) => setRackFormData({ ...rackFormData, zone_id: Number(e.target.value) })}
                    >
                      <option value={0}>Dùng chung toàn kho</option>
                      {zonesList.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.zone_name} ({z.zone_code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="wh-form-group">
                  <label>Sức chứa khuyến nghị (ĐVT)</label>
                  <input
                    type="number"
                    min="0"
                    className="wh-form-input"
                    value={rackFormData.max_capacity}
                    onChange={(e) => setRackFormData({ ...rackFormData, max_capacity: Number(e.target.value) })}
                  />
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
