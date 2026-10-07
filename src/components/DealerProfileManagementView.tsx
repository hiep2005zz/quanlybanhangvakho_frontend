// frontend/src/components/DealerProfileManagementView.tsx
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  DealerSearchItem,
  searchDealers,
  getDealerFilters,
  createDealer,
  CreateDealerPayload,
  updateDealerProfile,
  updateDealerStatus,
  deleteDealer,
  getAppliedPriceBookPreview,
  AppliedPriceBookInfo,
} from '../services/dealerSearchApi';
import { User } from '../services/api';
import { emitStatusToast } from './StatusToast';
import './dealer-profile-management.css';

interface DealerProfileManagementProps {
  currentUser?: User;
  token?: string;
  onBackToHome?: () => void;
}

const CUSTOMER_GROUP_OPTIONS = [
  { value: 'Đại lý cấp 1', label: 'Đại lý cấp 1 (Chiết khấu cao)' },
  { value: 'Đại lý cấp 2', label: 'Đại lý cấp 2' },
  { value: 'Khách sỉ', label: 'Khách sỉ (Mua số lượng lớn)' },
  { value: 'Khách lẻ', label: 'Khách lẻ' },
];

export const formatCustomerGroup = (grp?: string | null): string => {
  if (!grp) return 'Khách lẻ';
  const g = grp.toLowerCase().replace(/_/g, ' ').trim();
  if (g.includes('cấp 1') || g.includes('cap 1')) return 'Đại lý cấp 1';
  if (g.includes('cấp 2') || g.includes('cap 2')) return 'Đại lý cấp 2';
  if (g.includes('sỉ') || g.includes('si')) return 'Khách sỉ';
  if (g.includes('lẻ') || g.includes('le')) return 'Khách lẻ';
  return grp;
};

const DEFAULT_REGIONS = [
  'Hà Nội',
  'TP. HCM',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Miền Bắc',
  'Miền Trung',
  'Miền Nam',
];

export default function DealerProfileManagementView({
  currentUser: _currentUser,
  token,
  onBackToHome,
}: DealerProfileManagementProps) {
  const [dealers, setDealers] = useState<DealerSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters state
  const [keyword, setKeyword] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Filter options from API
  const [regions, setRegions] = useState<string[]>(DEFAULT_REGIONS);
  const [salesList, setSalesList] = useState<{ id: number; name: string }[]>([]);

  // Modal Khai báo / Sửa đại lý
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState<DealerSearchItem | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    tax_code: '',
    customer_group: 'Đại lý cấp 1',
    region: 'Hà Nội',
    assigned_sale_id: '',
    phone: '',
    email: '',
    address: '',
    status: 'Đang hoạt động',
    transaction_count: '',
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic applied price book preview in form modal
  const [modalAppliedPriceBook, setModalAppliedPriceBook] = useState<AppliedPriceBookInfo | null>(null);
  const [loadingPriceBookPreview, setLoadingPriceBookPreview] = useState(false);

  // Modal Xem chi tiết bảng giá
  const [isPriceBookModalOpen, setIsPriceBookModalOpen] = useState(false);
  const [priceBookModalTarget, setPriceBookModalTarget] = useState<AppliedPriceBookInfo | null>(null);

  // Modal Cảnh báo không thể xóa (Đã phát sinh giao dịch)
  const [isCannotDeleteModalOpen, setIsCannotDeleteModalOpen] = useState(false);
  const [cannotDeleteTarget, setCannotDeleteTarget] = useState<DealerSearchItem | null>(null);

  // Modal Xác nhận xóa an toàn (Chưa phát sinh giao dịch)
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<DealerSearchItem | null>(null);

  // 1. Tải danh sách bộ lọc
  const loadFilters = useCallback(async () => {
    try {
      const res = await getDealerFilters(token);
      if (res.regions && res.regions.length > 0) {
        setRegions(Array.from(new Set([...DEFAULT_REGIONS, ...res.regions])));
      }
      if (res.sales && res.sales.length > 0) {
        setSalesList(res.sales);
      }
    } catch {
      // ignore
    }
  }, [token]);

  // 2. Tải danh sách hồ sơ đại lý
  const loadDealers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await searchDealers(
        {
          keyword: keyword || undefined,
          region: selectedRegion || undefined,
          customer_group: selectedGroup || undefined,
          assigned_sale_id: selectedSaleId ? Number(selectedSaleId) : undefined,
          status: selectedStatus || undefined,
        },
        token
      );
      setDealers(res.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đại lý');
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedRegion, selectedGroup, selectedSaleId, selectedStatus, token]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDealers();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadDealers]);

  // Tự động xem trước bảng giá tương ứng khi người dùng đổi Nhóm khách hàng trong Form
  useEffect(() => {
    if (!isFormModalOpen) return;
    let isCancelled = false;
    setLoadingPriceBookPreview(true);

    getAppliedPriceBookPreview(formData.customer_group, token)
      .then((res) => {
        if (!isCancelled) {
          setModalAppliedPriceBook(res.applied_price_book);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setModalAppliedPriceBook(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingPriceBookPreview(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [formData.customer_group, isFormModalOpen, token]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = dealers.length;
    const active = dealers.filter((d) => d.status === 'Đang hoạt động').length;
    const stopped = dealers.filter((d) => d.status === 'Ngừng giao dịch').length;
    const withTx = dealers.filter((d) => (d.transaction_count ?? 0) > 0).length;
    return { total, active, stopped, withTx };
  }, [dealers]);

  // Mở modal Thêm mới
  const handleOpenCreateModal = () => {
    setEditingDealer(null);
    setFormError('');
    // Gợi ý mã ngẫu nhiên dạng DL-XXXX
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    setFormData({
      code: `DL${randomSuffix}`,
      name: '',
      tax_code: '',
      customer_group: 'Đại lý cấp 1',
      region: regions[0] || 'Hà Nội',
      assigned_sale_id: salesList[0]?.id ? String(salesList[0].id) : '',
      phone: '',
      email: '',
      address: '',
      status: 'Đang hoạt động',
      transaction_count: '',
    });
    setIsFormModalOpen(true);
  };

  // Mở modal Chỉnh sửa
  const handleOpenEditModal = (dealer: DealerSearchItem) => {
    setEditingDealer(dealer);
    setFormError('');
    setFormData({
      code: dealer.code,
      name: dealer.name,
      tax_code: dealer.tax_code || '',
      customer_group: formatCustomerGroup(dealer.customer_group),
      region: dealer.region || 'Hà Nội',
      assigned_sale_id: dealer.assigned_sale_id ? String(dealer.assigned_sale_id) : '',
      phone: dealer.phone || '',
      email: dealer.email || '',
      address: dealer.address || '',
      status: dealer.status || 'Đang hoạt động',
      transaction_count: dealer.transaction_count !== undefined && dealer.transaction_count !== null ? String(dealer.transaction_count) : '0',
    });
    setIsFormModalOpen(true);
  };

  // Submit Form Khai báo / Sửa hồ sơ đại lý
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanCode = formData.code.trim().toUpperCase();
    const cleanName = formData.name.trim();
    const cleanTaxCode = formData.tax_code.trim();

    if (!cleanCode) {
      setFormError('Mã đại lý là bắt buộc và phải là duy nhất.');
      return;
    }
    if (!cleanName) {
      setFormError('Tên đại lý không được để trống.');
      return;
    }

    // Kiểm tra tính duy nhất của Mã đại lý ở client
    const isDuplicate = dealers.some(
      (d) => d.code.toUpperCase() === cleanCode && (!editingDealer || d.id !== editingDealer.id)
    );
    if (isDuplicate) {
      setFormError(`Mã đại lý '${cleanCode}' đã tồn tại trên hệ thống. Mã đại lý phải là duy nhất.`);
      return;
    }

    // Ràng buộc số lượng giao dịch: khi cập nhật phải điền và lớn hơn hoặc bằng 0
    let validatedTxCount: number | undefined = undefined;
    if (editingDealer) {
      const txCountStr = formData.transaction_count.trim();
      if (!txCountStr) {
        setFormError('Vui lòng điền số lượng giao dịch (ràng buộc lớn hơn hoặc bằng 0).');
        return;
      }
      const txNum = Number(txCountStr);
      if (isNaN(txNum) || !Number.isInteger(txNum) || txNum < 0) {
        setFormError('Số lượng giao dịch phải là số nguyên lớn hơn hoặc bằng 0.');
        return;
      }
      validatedTxCount = txNum;
    }

    setIsSubmitting(true);
    try {
      if (editingDealer) {
        // Cập nhật
        await updateDealerProfile(
          editingDealer.id,
          {
            code: cleanCode,
            name: cleanName,
            tax_code: cleanTaxCode || null,
            customer_group: formData.customer_group,
            region: formData.region,
            assigned_sale_id: formData.assigned_sale_id ? Number(formData.assigned_sale_id) : null,
            phone: formData.phone.trim() || null,
            email: formData.email.trim() || null,
            address: formData.address.trim() || null,
            status: formData.status,
            transaction_count: validatedTxCount,
          },
          token
        );
        emitStatusToast({
          message: `Đã cập nhật hồ sơ đại lý ${cleanName} (${cleanCode}) thành công!`,
          type: 'success',
        });
      } else {
        // Tạo mới
        const payload: CreateDealerPayload = {
          code: cleanCode,
          name: cleanName,
          tax_code: cleanTaxCode || null,
          customer_group: formData.customer_group,
          region: formData.region,
          assigned_sale_id: formData.assigned_sale_id ? Number(formData.assigned_sale_id) : null,
          phone: formData.phone.trim() || undefined,
          email: formData.email.trim() || undefined,
          address: formData.address.trim() || undefined,
          status: formData.status,
        };
        await createDealer(payload, token);
        emitStatusToast({
          message: `Đã khai báo hồ sơ đại lý ${cleanName} (${cleanCode}) thành công!`,
          type: 'success',
        });
      }

      setIsFormModalOpen(false);
      loadDealers();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu hồ sơ đại lý.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Đổi trạng thái nhanh (Đang hoạt động <-> Ngừng giao dịch)
  const handleToggleStatus = async (dealer: DealerSearchItem) => {
    const nextStatus = dealer.status === 'Đang hoạt động' ? 'Ngừng giao dịch' : 'Đang hoạt động';
    try {
      await updateDealerStatus(dealer.id, nextStatus, token);
      emitStatusToast({
        message: `Đã chuyển trạng thái đại lý ${dealer.name} sang '${nextStatus}'!`,
        type: 'success',
      });
      loadDealers();
    } catch (err) {
      emitStatusToast({
        message: err instanceof Error ? err.message : 'Không thể cập nhật trạng thái',
        type: 'error',
      });
    }
  };

  // Xử lý nút Xóa (Kiểm tra xem đại lý đã phát sinh giao dịch chưa)
  const handleDeleteClick = (dealer: DealerSearchItem) => {
    const txCount = dealer.transaction_count ?? 0;
    if (txCount > 0 || dealer.has_transactions) {
      // ĐÃ PHÁT SINH GIAO DỊCH: Chặn xóa, hiển thị modal giải thích quy tắc kế toán
      setCannotDeleteTarget(dealer);
      setIsCannotDeleteModalOpen(true);
    } else {
      // CHƯA PHÁT SINH GIAO DỊCH: Hiển thị modal xác nhận xóa
      setConfirmDeleteTarget(dealer);
      setIsConfirmDeleteModalOpen(true);
    }
  };

  // Thực hiện chuyển nhanh sang Ngừng giao dịch khi không thể xóa
  const handleQuickStopTransaction = async () => {
    if (!cannotDeleteTarget) return;
    try {
      await updateDealerStatus(cannotDeleteTarget.id, 'Ngừng giao dịch', token);
      emitStatusToast({
        message: `Đã chuyển đại lý ${cannotDeleteTarget.name} sang trạng thái 'Ngừng giao dịch'!`,
        type: 'success',
      });
      setIsCannotDeleteModalOpen(false);
      setCannotDeleteTarget(null);
      loadDealers();
    } catch (err) {
      emitStatusToast({
        message: err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái',
        type: 'error',
      });
    }
  };

  // Thực hiện Xóa thật (chỉ khi 0 giao dịch)
  const handleExecuteDelete = async () => {
    if (!confirmDeleteTarget) return;
    try {
      await deleteDealer(confirmDeleteTarget.id, token);
      emitStatusToast({
        message: `Đã xóa hồ sơ đại lý ${confirmDeleteTarget.name} (${confirmDeleteTarget.code})!`,
        type: 'success',
      });
      setIsConfirmDeleteModalOpen(false);
      setConfirmDeleteTarget(null);
      loadDealers();
    } catch (err) {
      emitStatusToast({
        message: err instanceof Error ? err.message : 'Lỗi khi xóa đại lý',
        type: 'error',
      });
    }
  };

  const getGroupBadgeClass = (grp?: string | null) => {
    if (!grp) return 'badge-group-le';
    const g = grp.toLowerCase().replace(/_/g, ' ').trim();
    if (g.includes('cấp 1') || g.includes('cap 1')) return 'badge-group-cap1';
    if (g.includes('cấp 2') || g.includes('cap 2')) return 'badge-group-cap2';
    if (g.includes('sỉ') || g.includes('si')) return 'badge-group-si';
    return 'badge-group-le';
  };

  return (
    <div className="dealer-profiles-container">
      {/* 1. Header Section */}
      <div className="dealer-profiles-header">
        <div className="dealer-header-title-wrap">
          <h2 className="dealer-header-title">
            Quản Lý Hồ Sơ Đại Lý
          </h2>
        </div>

        <div className="dealer-header-actions">
          {onBackToHome && (
            <button className="btn-secondary-white" onClick={onBackToHome}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Trở về
            </button>
          )}

          <button className="btn-secondary-white" onClick={loadDealers} disabled={loading} title="Làm mới dữ liệu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            Làm mới
          </button>

          <button className="btn-primary-gradient" id="btn-create-dealer-profile" onClick={handleOpenCreateModal}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Khai báo hồ sơ đại lý
          </button>
        </div>
      </div>

      {/* 2. Stat Cards */}
      <div className="dealer-stats-grid">
        <div className="dealer-stat-card">
          <div className="stat-icon-box" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Tổng số hồ sơ đại lý</div>
          </div>
        </div>

        <div className="dealer-stat-card">
          <div className="stat-icon-box" style={{ background: '#dcfce7', color: '#15803d' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <div className="stat-number">{stats.active}</div>
            <div className="stat-label">Đang hoạt động giao dịch</div>
          </div>
        </div>

        <div className="dealer-stat-card">
          <div className="stat-icon-box" style={{ background: '#fee2e2', color: '#b91c1c' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <div>
            <div className="stat-number">{stats.stopped}</div>
            <div className="stat-label">Ngừng giao dịch</div>
          </div>
        </div>

        <div className="dealer-stat-card">
          <div className="stat-icon-box" style={{ background: '#fef3c7', color: '#b45309' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
          </div>
          <div>
            <div className="stat-number">{stats.withTx}</div>
            <div className="stat-label">Đã phát sinh GD (Khóa xóa)</div>
          </div>
        </div>
      </div>

      {/* 3. Filter Card */}
      <div className="dealer-filter-card">
        <div className="dealer-filter-grid">
          {/* Keyword Search */}
          <div className="search-input-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Tìm theo Mã đại lý, Tên, Mã số thuế, SĐT..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          {/* Customer Group Filter */}
          <select
            className="filter-select"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="">-- Tất cả nhóm khách hàng --</option>
            {CUSTOMER_GROUP_OPTIONS.map((g) => (
              <option key={g.value} value={g.value}>
                {g.label}
              </option>
            ))}
          </select>

          {/* Region Filter */}
          <select
            className="filter-select"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <option value="">-- Tất cả khu vực --</option>
            {regions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          {/* Sales Staff Filter */}
          <select
            className="filter-select"
            value={selectedSaleId}
            onChange={(e) => setSelectedSaleId(e.target.value)}
          >
            <option value="">-- Người phụ trách (Sales) --</option>
            {salesList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            className="filter-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">-- Tất cả trạng thái --</option>
            <option value="Đang hoạt động">Đang hoạt động</option>
            <option value="Ngừng giao dịch">Ngừng giao dịch</option>
          </select>
        </div>
      </div>

      {/* 4. Table List */}
      <div className="dealer-table-card">
        {loading ? (
          <div className="empty-state-box">
            <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <p style={{ marginTop: '12px', fontWeight: '600' }}>Đang nạp danh sách hồ sơ đại lý...</p>
          </div>
        ) : error ? (
          <div className="empty-state-box" style={{ color: '#ef4444' }}>
            <p>{error}</p>
            <button className="btn-secondary-white" onClick={loadDealers} style={{ marginTop: '8px' }}>
              Thử lại
            </button>
          </div>
        ) : dealers.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h4>Không tìm thấy đại lý nào phù hợp</h4>
            <p>Vui lòng thử điều chỉnh lại từ khóa tìm kiếm hoặc bộ lọc.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="dealer-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Mã đại lý</th>
                  <th>Tên đại lý</th>
                  <th style={{ width: '130px' }}>Mã số thuế</th>
                  <th>Nhóm khách hàng</th>
                  <th>Bảng giá áp dụng</th>
                  <th>Khu vực</th>
                  <th>Người phụ trách</th>
                  <th style={{ textAlign: 'center' }}>Giao dịch</th>
                  <th style={{ textAlign: 'center', width: '150px' }}>Trạng thái</th>
                  <th style={{ textAlign: 'center', width: '160px' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {dealers.map((dealer) => {
                  const hasTx = (dealer.transaction_count ?? 0) > 0 || Boolean(dealer.has_transactions);
                  const isStopped = dealer.status === 'Ngừng giao dịch';

                  return (
                    <tr key={dealer.id}>
                      {/* 1. Mã đại lý (Duy nhất) */}
                      <td>
                        <span className="dealer-code-pill" title="Mã đại lý duy nhất trên toàn hệ thống">
                          {dealer.code}
                        </span>
                      </td>

                      {/* 2. Tên đại lý */}
                      <td>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{dealer.name}</div>
                        {dealer.phone && (
                          <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                            </svg>
                            <span>{dealer.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* 3. Mã số thuế */}
                      <td>
                        {dealer.tax_code ? (
                          <span className="tax-code-text">{dealer.tax_code}</span>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Chưa khai báo
                          </span>
                        )}
                      </td>

                      {/* 4. Nhóm khách hàng */}
                      <td>
                        <span className={`badge-group ${getGroupBadgeClass(dealer.customer_group)}`}>
                          {formatCustomerGroup(dealer.customer_group)}
                        </span>
                      </td>

                      {/* 5. Bảng giá áp dụng (Quyết định bởi nhóm KH) */}
                      <td>
                        {dealer.applied_price_book ? (
                          <div
                            className="price-book-cell-card"
                            onClick={() => {
                              setPriceBookModalTarget(dealer.applied_price_book || null);
                              setIsPriceBookModalOpen(true);
                            }}
                            title="Nhấp để xem chi tiết bảng giá được áp dụng"
                          >
                            <span className="price-book-cell-name" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                              </svg>
                              <span>{dealer.applied_price_book.name}</span>
                            </span>
                            <span className="price-book-cell-sub">
                              Mã: {dealer.applied_price_book.code} • {dealer.applied_price_book.items_count ?? 0} SP
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Chưa gán bảng giá
                          </span>
                        )}
                      </td>

                      {/* 6. Khu vực */}
                      <td>
                        <span style={{ fontWeight: '600', color: '#334155' }}>
                          {dealer.region || 'Chưa xác định'}
                        </span>
                      </td>

                      {/* 7. Người phụ trách */}
                      <td>
                        {dealer.assigned_sale_name ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {dealer.assigned_sale_name.charAt(0)}
                            </div>
                            <span style={{ fontWeight: '600', color: '#1e293b' }}>
                              {dealer.assigned_sale_name}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#f59e0b', fontStyle: 'italic' }}>
                            Chưa phân công
                          </span>
                        )}
                      </td>

                      {/* 8. Lịch sử giao dịch */}
                      <td style={{ textAlign: 'center' }}>
                        {hasTx ? (
                          <span
                            className="tx-badge-has"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            title={`Đã phát sinh ${dealer.transaction_count} đơn hàng/chứng từ - Khóa xóa, chỉ ngừng giao dịch`}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>{dealer.transaction_count} GD</span>
                          </span>
                        ) : (
                          <span className="tx-badge-none" title="Chưa có giao dịch nào">
                            0 GD
                          </span>
                        )}
                      </td>

                      {/* 9. Trạng thái: Nút bấm trực tiếp chuyển giữa 'Đang hoạt động' và 'Ngừng giao dịch' */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`status-pill-btn ${isStopped ? 'status-pill-stopped' : 'status-pill-active'}`}
                          onClick={() => handleToggleStatus(dealer)}
                          title={isStopped ? "Bấm để kích hoạt lại sang 'Đang hoạt động'" : "Bấm để chuyển sang 'Ngừng giao dịch'"}
                        >
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isStopped ? '#dc2626' : '#16a34a' }} />
                          <span>{isStopped ? 'Ngừng giao dịch' : 'Đang hoạt động'}</span>
                        </button>
                      </td>

                      {/* 10. Thao tác: Nút dạng icon không có tên chữ */}
                      <td style={{ textAlign: 'center' }}>
                        <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                          {/* Sửa hồ sơ */}
                          <button
                            type="button"
                            className="btn-icon-action edit"
                            onClick={() => handleOpenEditModal(dealer)}
                            title="Sửa hồ sơ đại lý"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>

                          {/* Xóa (Chặn nếu đã phát sinh giao dịch) */}
                          <button
                            type="button"
                            className={`btn-icon-action delete ${hasTx ? 'has-tx-locked' : ''}`}
                            onClick={() => handleDeleteClick(dealer)}
                            title={
                              hasTx
                                ? `Đại lý đã có ${dealer.transaction_count} giao dịch: Không thể xóa, chỉ ngừng giao dịch`
                                : 'Xóa đại lý'
                            }
                          >
                            {hasTx ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. MODAL KHAI BÁO / CHỈNH SỬA HỒ SƠ ĐẠI LÝ */}
      {/* ============================================================ */}
      {isFormModalOpen && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setIsFormModalOpen(false)}>
          <div className="modal-content-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  {editingDealer ? (
                    <>
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </>
                  ) : (
                    <>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </>
                  )}
                </svg>
                <span>{editingDealer ? `Cập nhật hồ sơ đại lý [${editingDealer.code}]` : 'Khai báo hồ sơ đại lý mới'}</span>
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => !isSubmitting && setIsFormModalOpen(false)}
                title="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className="modal-body">
                {formError && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '12px 16px', borderRadius: '10px', marginBottom: '18px', fontSize: '13.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{formError}</span>
                  </div>
                )}

                {/* Hàng 1: Mã đại lý (Duy nhất) & Tên đại lý */}
                <div className="form-grid-2">
                  <div className="form-group-item">
                    <label>
                      Mã đại lý <span className="required">*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="VD: DL001"
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        required
                        style={{ fontFamily: 'monospace', fontWeight: '700' }}
                      />
                      {!editingDealer && (
                        <button
                          type="button"
                          className="btn-secondary-white"
                          style={{ padding: '0 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                          onClick={() => {
                            const rand = Math.floor(1000 + Math.random() * 9000);
                            setFormData({ ...formData, code: `DL${rand}` });
                          }}
                          title="Tự động sinh mã mới"
                        >
                          Sinh mã
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="form-group-item">
                    <label>
                      Tên đại lý / Khách hàng <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: Đại Lý Thời Trang Sao Mai"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Hàng 2: Mã số thuế & Nhóm khách hàng */}
                <div className="form-grid-2">
                  <div className="form-group-item">
                    <label>
                      Mã số thuế (MST) <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Khai báo chuẩn)</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: 0101234567 hoặc 0101234567-001"
                      value={formData.tax_code}
                      onChange={(e) => setFormData({ ...formData, tax_code: e.target.value.trim() })}
                    />
                  </div>

                  <div className="form-group-item">
                    <label>
                      Nhóm khách hàng <span className="required">*</span>
                    </label>
                    <select
                      className="form-input"
                      value={formData.customer_group}
                      onChange={(e) => setFormData({ ...formData, customer_group: e.target.value })}
                    >
                      {CUSTOMER_GROUP_OPTIONS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Hộp hiển thị BẢNG GIÁ ÁP DỤNG (Quyết định bởi Nhóm khách hàng) */}
                <div className="price-book-decision-card">
                  <div className="decision-card-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
                    </svg>
                  </div>
                  <div className="decision-card-content" style={{ flex: 1 }}>
                    <h5>
                      Bảng giá áp dụng theo nhóm: {formData.customer_group}
                    </h5>
                    {loadingPriceBookPreview ? (
                      <p>Đang kiểm tra bảng giá tương ứng...</p>
                    ) : modalAppliedPriceBook ? (
                      <div>
                        <p>
                          <strong>{modalAppliedPriceBook.name}</strong> ({modalAppliedPriceBook.code})
                          {modalAppliedPriceBook.valid_from && modalAppliedPriceBook.valid_to && (
                            <span> • Hiệu lực: {modalAppliedPriceBook.valid_from.substring(0, 10)} đến {modalAppliedPriceBook.valid_to.substring(0, 10)}</span>
                          )}
                        </p>
                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#15803d', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Đại lý thuộc nhóm này sẽ tự động được áp dụng mức giá và chiết khấu theo bảng giá trên khi tạo đơn hàng.</span>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: '#b45309', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span>Chưa có bảng giá đang hiệu lực cho nhóm này. Hệ thống sẽ áp dụng mức giá niêm yết mặc định.</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Hàng 3: Khu vực & Người phụ trách */}
                <div className="form-grid-2">
                  <div className="form-group-item">
                    <label>
                      Khu vực địa lý <span className="required">*</span>
                    </label>
                    <select
                      className="form-input"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    >
                      {regions.map((reg) => (
                        <option key={reg} value={reg}>
                          {reg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group-item">
                    <label>
                      Người phụ trách (Nhân viên kinh doanh) <span className="required">*</span>
                    </label>
                    <select
                      className="form-input"
                      value={formData.assigned_sale_id}
                      onChange={(e) => setFormData({ ...formData, assigned_sale_id: e.target.value })}
                      required
                    >
                      <option value="">-- Chọn nhân viên kinh doanh --</option>
                      {salesList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (ID: {s.id})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Hàng 4: Số điện thoại & Trạng thái */}
                <div className="form-grid-2">
                  <div className="form-group-item">
                    <label>Số điện thoại liên hệ</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: 0912345678"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  <div className="form-group-item">
                    <label>Trạng thái giao dịch</label>
                    <select
                      className="form-input"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="Đang hoạt động">Đang hoạt động (Cho phép tạo đơn & xuất hàng)</option>
                      <option value="Ngừng giao dịch">Ngừng giao dịch (Tạm khóa phát sinh đơn mới)</option>
                    </select>
                  </div>
                </div>

                {/* Hàng 5: Số lượng giao dịch (khi cập nhật có ràng buộc >= 0) & Địa chỉ */}
                <div className={editingDealer ? "form-grid-2" : "form-group-item"}>
                  {editingDealer && (
                    <div className="form-group-item">
                      <label>
                        Số lượng giao dịch <span className="required">*</span>{' '}
                        <span style={{ color: '#2563eb', fontSize: '12px', fontWeight: '500' }}>
                          (Ràng buộc &ge; 0)
                        </span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="form-input"
                        id="input-dealer-transaction-count"
                        placeholder="VD: 0, 1, 2... (lớn hơn hoặc bằng 0)"
                        value={formData.transaction_count}
                        onChange={(e) => setFormData({ ...formData, transaction_count: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="form-group-item">
                    <label>Địa chỉ đại lý / văn phòng</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: Số 120 Cầu Giấy, Phường Dịch Vọng, Quận Cầu Giấy, Hà Nội"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary-white"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn-primary-gradient"
                  id="btn-submit-dealer-profile"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Đang lưu...' : editingDealer ? 'Cập nhật hồ sơ' : 'Khai báo hồ sơ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 6. MODAL CẢNH BÁO: ĐẠI LÝ ĐÃ PHÁT SINH GIAO DỊCH (KHÔNG ĐƯỢC XÓA) */}
      {/* ============================================================ */}
      {isCannotDeleteModalOpen && cannotDeleteTarget && (
        <div className="modal-overlay" onClick={() => setIsCannotDeleteModalOpen(false)}>
          <div className="modal-content-card" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ background: '#fef2f2', borderBottomColor: '#fecaca' }}>
              <h3 style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Không Thể Xóa Đại Lý Đã Phát Sinh Giao Dịch
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsCannotDeleteModalOpen(false)}
                title="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '16px', lineHeight: 1.6, fontSize: '14.5px', color: '#1f2937' }}>
                Đại lý <strong>{cannotDeleteTarget.name}</strong> ({cannotDeleteTarget.code})
                đã có <strong>{cannotDeleteTarget.transaction_count ?? 1} giao dịch (đơn hàng)</strong> phát sinh trên hệ thống.
              </div>

              <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#fffbeb', border: '1.5px solid #fef08a', color: '#92400e', fontSize: '13.5px', lineHeight: 1.5, marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Nguyên tắc kế toán & kiểm toán:</span>
                </div>
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>Đại lý đã phát sinh giao dịch thì <strong>không được phép xóa</strong> nhằm bảo toàn toàn vẹn lịch sử sổ sách, hóa đơn và công nợ.</li>
                  <li>Nếu đại lý không còn hợp tác, quy trình chuẩn là chuyển sang trạng thái <strong>'Ngừng giao dịch'</strong>.</li>
                </ul>
              </div>

              <p style={{ margin: 0, fontSize: '14px', color: '#475569' }}>
                Bạn có muốn chuyển đại lý <strong>{cannotDeleteTarget.name}</strong> sang trạng thái <strong>'Ngừng giao dịch'</strong> ngay bây giờ không?
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary-white" onClick={() => setIsCannotDeleteModalOpen(false)}>
                Đóng
              </button>
              <button
                className="btn-primary-gradient"
                id="btn-confirm-stop-dealer-tx"
                style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}
                onClick={handleQuickStopTransaction}
              >
                Chuyển sang Ngừng giao dịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 7. MODAL XÁC NHẬN XÓA AN TOÀN (CHƯA PHÁT SINH GIAO DỊCH) */}
      {/* ============================================================ */}
      {isConfirmDeleteModalOpen && confirmDeleteTarget && (
        <div className="modal-overlay" onClick={() => setIsConfirmDeleteModalOpen(false)}>
          <div className="modal-content-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận xóa hồ sơ đại lý</h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsConfirmDeleteModalOpen(false)}
                title="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '14.5px', lineHeight: 1.5, margin: 0 }}>
                Đại lý <strong>{confirmDeleteTarget.name}</strong> ({confirmDeleteTarget.code}) <strong>chưa phát sinh bất kỳ giao dịch nào</strong>.
              </p>
              <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '10px' }}>
                Thao tác xóa này là vĩnh viễn và không thể hoàn tác. Bạn có chắc chắn muốn xóa đại lý này không?
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary-white" onClick={() => setIsConfirmDeleteModalOpen(false)}>
                Hủy bỏ
              </button>
              <button
                className="btn-primary-gradient"
                id="btn-confirm-delete-dealer-safe"
                style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}
                onClick={handleExecuteDelete}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 8. MODAL CHI TIẾT BẢNG GIÁ ĐƯỢC ÁP DỤNG */}
      {/* ============================================================ */}
      {isPriceBookModalOpen && priceBookModalTarget && (
        <div className="modal-overlay" onClick={() => setIsPriceBookModalOpen(false)}>
          <div className="modal-content-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                </svg>
                <span>Chi tiết Bảng giá áp dụng</span>
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsPriceBookModalOpen(false)}
                title="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>
                  {priceBookModalTarget.name}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#475569' }}>
                  <div><strong>Mã bảng giá:</strong> {priceBookModalTarget.code}</div>
                  <div><strong>Nhóm áp dụng:</strong> {priceBookModalTarget.customer_group}</div>
                  <div><strong>Trạng thái:</strong> {priceBookModalTarget.status}</div>
                </div>
                {priceBookModalTarget.valid_from && priceBookModalTarget.valid_to && (
                  <div style={{ fontSize: '13px', color: '#16a34a', marginTop: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Thời hạn áp dụng: Từ {priceBookModalTarget.valid_from.substring(0, 10)} đến {priceBookModalTarget.valid_to.substring(0, 10)}</span>
                  </div>
                )}
                {priceBookModalTarget.note && (
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
                    Ghi chú: {priceBookModalTarget.note}
                  </div>
                )}
              </div>

              <div style={{ padding: '14px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', fontSize: '13.5px', lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <div>
                  <strong>Quy tắc hệ thống:</strong> Nhóm khách hàng của đại lý quyết định bảng giá được tự động kích hoạt. Khi nhân viên bán hàng lập đơn cho đại lý này, hệ thống sẽ tự động đối chiếu giá bán và giá sàn theo bảng giá này để đảm bảo chính xác.
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary-white" onClick={() => setIsPriceBookModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
