// frontend/src/components/DealerProfileManagementView.tsx
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  DealerSearchItem,
  DealerStats,
  DealerTransactionItem,
  searchDealers,
  getDealerFilters,
  getDealerStats,
  getDealerTransactions,
  createDealer,
  CreateDealerPayload,
  updateDealerProfile,
  updateDealerStatus,
  deleteDealer,
  getAppliedPriceBookPreview,
  AppliedPriceBookInfo,
} from '../services/dealerSearchApi';
import { User, getWarehousesApi, WarehouseItem } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ReceiptVoucherPrintModal } from './ReceiptVoucherPrintModal';
import { CreateReceiptVoucherModal } from './CreateReceiptVoucherModal';
import { ReceiptVoucherData } from '../services/dealerSearchApi';
import { convertNumberToVietnameseWords } from '../utils/numberToWords';
import './dealer-profile-management.css';

interface DealerProfileManagementProps {
  currentUser?: User;
  token?: string;
  onBackToHome?: () => void;
  onOpenDebtStatement?: (dealerId: number) => void;
}

const CUSTOMER_GROUP_OPTIONS = [
  { value: 'Đại lý cấp 1', label: 'Đại lý cấp 1' },
  { value: 'Đại lý cấp 2', label: 'Đại lý cấp 2' },
  { value: 'Khách sỉ', label: 'Khách sỉ' },
  { value: 'Khách lẻ', label: 'Khách lẻ' },
];

const formatCustomerGroup = (grp?: string | null): string => {
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

const STATUS_OPTIONS = [
  'Đang hoạt động',
  'Tạm ngừng',
  'Ngừng giao dịch',
  'Chưa kích hoạt',
];

export default function DealerProfileManagementView({
  currentUser: _currentUser,
  token,
  onBackToHome,
  onOpenDebtStatement,
}: DealerProfileManagementProps) {
  // Data list & loading
  const [dealers, setDealers] = useState<DealerSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 4 Stat Cards from Backend
  const [stats, setStats] = useState<DealerStats>({
    total: 0,
    active: 0,
    stopped: 0,
    paused: 0,
    pending_activation: 0,
    with_transactions: 0,
    without_transactions: 0,
  });
  // Active stat card filter: '' | 'all' | 'active' | 'stopped' | 'with_tx'
  const [selectedStatFilter, setSelectedStatFilter] = useState<string>('');

  // Search state with debounce
  const [keywordInput, setKeywordInput] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');

  // Dropdown Filters state
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [hasTxFilter, setHasTxFilter] = useState<boolean | undefined>(undefined);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [, setTotalMatches] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter options from API
  const [regions, setRegions] = useState<string[]>(DEFAULT_REGIONS);
  const [salesList, setSalesList] = useState<{ id: number; name: string }[]>([]);
  const [activeWarehouses, setActiveWarehouses] = useState<WarehouseItem[]>([]);

  // Chế độ trang: Danh sách hoặc Khai báo/Sửa hồ sơ đại lý (Trang riêng biệt)
  const [isFormPageActive, setIsFormPageActive] = useState(false);
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
    warehouse_id: '',
    warehouse_name: '',
  });
  const setFormError = useCallback((msg: string) => {
    if (msg) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: msg,
        type: 'warning',
      });
    }
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic applied price book preview in form modal
  const [modalAppliedPriceBook, setModalAppliedPriceBook] = useState<AppliedPriceBookInfo | null>(null);
  const [loadingPriceBookPreview, setLoadingPriceBookPreview] = useState(false);

  // Modal Xem chi tiết bảng giá
  const [isPriceBookModalOpen, setIsPriceBookModalOpen] = useState(false);
  const [priceBookModalTarget, setPriceBookModalTarget] = useState<AppliedPriceBookInfo | null>(null);

  // Modal Lịch sử giao dịch của đại lý
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalDealer, setTxModalDealer] = useState<DealerSearchItem | null>(null);
  const [txList, setTxList] = useState<DealerTransactionItem[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [txError, setTxError] = useState('');

  // Modal Cảnh báo không thể xóa (Đã phát sinh giao dịch)
  const [isCannotDeleteModalOpen, setIsCannotDeleteModalOpen] = useState(false);
  const [cannotDeleteTarget, setCannotDeleteTarget] = useState<DealerSearchItem | null>(null);

  // Action Menu Popover (Nút 3 chấm thao tác)
  const [actionMenuState, setActionMenuState] = useState<{
    dealer: DealerSearchItem;
    top: number;
    right: number;
    isDropup: boolean;
  } | null>(null);

  const handleToggleActionMenu = (e: React.MouseEvent<HTMLButtonElement>, dealer: DealerSearchItem) => {
    e.stopPropagation();
    if (actionMenuState?.dealer.id === dealer.id) {
      setActionMenuState(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const isDropup = spaceBelow < 220;
      setActionMenuState({
        dealer,
        top: isDropup ? rect.top - 6 : rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
        isDropup,
      });
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dealer-action-menu-portal') && !target.closest('.btn-action-dots')) {
        setActionMenuState(null);
      }
    };
    const handleScrollOrResize = () => {
      setActionMenuState(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

  // Modal Xác nhận xóa an toàn (Chưa phát sinh giao dịch)
  const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<DealerSearchItem | null>(null);

  // Modal Phiếu thu tiền cho Kế toán công nợ
  const [printVoucherTarget, setPrintVoucherTarget] = useState<ReceiptVoucherData | null>(null);
  const [isPrintVoucherOpen, setIsPrintVoucherOpen] = useState(false);
  const [createReceiptTargetDealer, setCreateReceiptTargetDealer] = useState<DealerSearchItem | null>(null);
  const [createReceiptOrderCode, setCreateReceiptOrderCode] = useState<string | undefined>(undefined);
  const [createReceiptDefaultAmount, setCreateReceiptDefaultAmount] = useState<number | undefined>(undefined);
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);



  // ==========================================
  // Debounce tìm kiếm (350ms)
  // ==========================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keywordInput.trim());
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  // ==========================================
  // 1. Tải danh mục bộ lọc từ API
  // ==========================================
  const loadFilters = useCallback(async () => {
    try {
      const res = await getDealerFilters(token);
      if (res.regions && res.regions.length > 0) {
        setRegions(Array.from(new Set([...DEFAULT_REGIONS, ...res.regions])));
      }
      if (res.sales && res.sales.length > 0) {
        setSalesList(res.sales);
      }
      if (token) {
        getWarehousesApi(token, '', 'Đang hoạt động')
          .then((whs) => setActiveWarehouses(whs))
          .catch(() => {});
      }
    } catch {
      // Backend error fallback
    }
  }, [token]);

  // ==========================================
  // 2. Tải số liệu thống kê thực tế từ Backend
  // ==========================================
  const loadStats = useCallback(async () => {
    try {
      const s = await getDealerStats(token);
      setStats(s);
    } catch {
      // ignore
    }
  }, [token]);

  // ==========================================
  // 3. Tải danh sách hồ sơ đại lý từ Backend
  // ==========================================
  const loadDealers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await searchDealers(
        {
          keyword: debouncedKeyword || undefined,
          region: selectedRegion || undefined,
          customer_group: selectedGroup || undefined,
          assigned_sale_id: selectedSaleId ? Number(selectedSaleId) : undefined,
          status: selectedStatus || undefined,
          has_transactions: hasTxFilter,
          page: currentPage,
          page_size: pageSize,
        },
        token
      );
      setDealers(res.items || []);
      setTotalMatches(res.total ?? 0);
      setTotalPages(res.total_pages ?? Math.max(1, Math.ceil((res.total ?? 0) / pageSize)));

      if (res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách đại lý từ máy chủ.');
      setDealers([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [
    debouncedKeyword,
    selectedRegion,
    selectedGroup,
    selectedSaleId,
    selectedStatus,
    hasTxFilter,
    currentPage,
    pageSize,
    token,
  ]);

  // Khởi chạy khi mount
  useEffect(() => {
    loadFilters();
    loadStats();
  }, [loadFilters, loadStats]);

  // Tải danh sách khi các tham số tìm kiếm/lọc thay đổi
  useEffect(() => {
    loadDealers();
  }, [loadDealers]);

  // Nút Làm mới thủ công
  const handleManualRefresh = () => {
    setIsRefreshing(true);
    loadStats();
    loadDealers();
  };

  // ==========================================
  // Tương tác bấm vào 4 ô thống kê để lọc
  // ==========================================
  const handleStatCardClick = (cardType: 'all' | 'active' | 'stopped' | 'with_tx') => {
    setCurrentPage(1);

    if (selectedStatFilter === cardType) {
      // Bấm lại chính ô đang lọc -> Hủy lọc
      setSelectedStatFilter('');
      setSelectedStatus('');
      setHasTxFilter(undefined);
      return;
    }

    setSelectedStatFilter(cardType);

    if (cardType === 'all') {
      setSelectedStatus('');
      setHasTxFilter(undefined);
    } else if (cardType === 'active') {
      setSelectedStatus('Đang hoạt động');
      setHasTxFilter(undefined);
    } else if (cardType === 'stopped') {
      setSelectedStatus('Ngừng giao dịch');
      setHasTxFilter(undefined);
    } else if (cardType === 'with_tx') {
      setSelectedStatus('');
      setHasTxFilter(true);
    }
  };

  // ==========================================
  // Xóa toàn bộ bộ lọc
  // ==========================================
  const handleResetFilters = () => {
    setKeywordInput('');
    setDebouncedKeyword('');
    setSelectedGroup('');
    setSelectedRegion('');
    setSelectedSaleId('');
    setSelectedStatus('');
    setHasTxFilter(undefined);
    setSelectedStatFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    debouncedKeyword ||
      selectedGroup ||
      selectedRegion ||
      selectedSaleId ||
      selectedStatus ||
      hasTxFilter !== undefined ||
      selectedStatFilter
  );

  // ==========================================
  // Tự động xem trước bảng giá theo nhóm khách hàng trong Form Trang Riêng
  // ==========================================
  useEffect(() => {
    if (!isFormPageActive) return;
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
  }, [formData.customer_group, isFormPageActive, token]);

  // ==========================================
  // Mở modal Thêm mới
  // ==========================================
  const handleOpenCreateModal = () => {
    setEditingDealer(null);
    setFormError('');
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
      warehouse_id: activeWarehouses[0]?.id ? String(activeWarehouses[0].id) : '',
      warehouse_name: activeWarehouses[0]?.name || '',
    });
    setIsFormPageActive(true);
  };

  // ==========================================
  // Mở trang Chỉnh sửa hồ sơ đại lý
  // ==========================================
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
      transaction_count:
        dealer.transaction_count !== undefined && dealer.transaction_count !== null
          ? String(dealer.transaction_count)
          : '0',
      warehouse_id: dealer.warehouse_id ? String(dealer.warehouse_id) : '',
      warehouse_name: dealer.warehouse_name || '',
    });
    setIsFormPageActive(true);
  };

  // ==========================================
  // Submit Form Khai báo / Sửa hồ sơ đại lý
  // ==========================================
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

    const cleanPhone = formData.phone.trim();
    if (!cleanPhone) {
      setFormError('Vui lòng điền số điện thoại liên hệ của đại lý.');
      return;
    }
    if (!/^0[2-9][0-9]{8}$/.test(cleanPhone)) {
      setFormError('Số điện thoại không hợp lệ (phải gồm đúng 10 chữ số, bắt đầu bằng số 0, ví dụ: 0912345678).');
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
            warehouse_id: formData.warehouse_id || null,
            warehouse_name: formData.warehouse_name || null,
          },
          token
        );
        emitStatusToast({
          message: `Đã cập nhật hồ sơ đại lý ${cleanName} (${cleanCode}) thành công!`,
          type: 'success',
        });
      } else {
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
          warehouse_id: formData.warehouse_id || null,
          warehouse_name: formData.warehouse_name || null,
        };
        await createDealer(payload, token);
        emitStatusToast({
          message: `Đã khai báo hồ sơ đại lý ${cleanName} (${cleanCode}) thành công!`,
          type: 'success',
        });
      }

      setIsFormPageActive(false);
      setEditingDealer(null);
      setCurrentPage(1);
      loadDealers();
      loadStats();
    } catch (err) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu hồ sơ đại lý.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  // ==========================================
  // Xử lý nút Xóa (Kiểm tra phát sinh giao dịch)
  // ==========================================
  const handleDeleteClick = (dealer: DealerSearchItem) => {
    const txCount = dealer.transaction_count ?? 0;
    if (txCount > 0 || dealer.has_transactions) {
      // ĐÃ PHÁT SINH GIAO DỊCH: Chặn xóa trực tiếp, chỉ cho chuyển sang Ngừng giao dịch
      setCannotDeleteTarget(dealer);
      setIsCannotDeleteModalOpen(true);
    } else {
      // CHƯA PHÁT SINH GIAO DỊCH: Cho phép xóa sau khi xác nhận
      setConfirmDeleteTarget(dealer);
      setIsConfirmDeleteModalOpen(true);
    }
  };

  // Chuyển sang Ngừng giao dịch khi không thể xóa
  const handleQuickStopTransaction = async () => {
    if (!cannotDeleteTarget) return;
    try {
      await updateDealerStatus(cannotDeleteTarget.id, 'Ngừng giao dịch', undefined, token);
      emitStatusToast({
        message: `Đã chuyển đại lý ${cannotDeleteTarget.name} sang trạng thái 'Ngừng giao dịch'!`,
        type: 'success',
      });
      setIsCannotDeleteModalOpen(false);
      setCannotDeleteTarget(null);
      loadDealers();
      loadStats();
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
      loadStats();
    } catch (err) {
      emitStatusToast({
        message: err instanceof Error ? err.message : 'Lỗi khi xóa đại lý',
        type: 'error',
      });
    }
  };

  // ==========================================
  // Xem lịch sử giao dịch của đại lý
  // ==========================================
  const handleOpenTransactionsModal = async (dealer: DealerSearchItem) => {
    setTxModalDealer(dealer);
    setIsTxModalOpen(true);
    setLoadingTx(true);
    setTxError('');
    setTxList([]);
    try {
      const res = await getDealerTransactions(dealer.id, token);
      setTxList(res.items || []);
    } catch (err) {
      setTxError(err instanceof Error ? err.message : 'Không thể tải lịch sử giao dịch của đại lý.');
    } finally {
      setLoadingTx(false);
    }
  };

  const handleOpenPrintReceiptForTx = (tx: DealerTransactionItem, dealer: DealerSearchItem) => {
    const voucher: ReceiptVoucherData = {
      receipt_code: `PT-${dealer.code}-${tx.order_code}`,
      dealer_id: dealer.id,
      dealer_code: dealer.code,
      dealer_name: dealer.name,
      dealer_address: dealer.address || '—',
      dealer_phone: dealer.phone || '—',
      dealer_tax_code: dealer.tax_code || '—',
      order_code: tx.order_code,
      amount: tx.total_amount,
      amount_in_words: convertNumberToVietnameseWords(tx.total_amount),
      payment_method: 'Tiền mặt',
      reason: `Thu tiền thanh toán đơn hàng ${tx.order_code}`,
      payer_name: `Đại diện ${dealer.name}`,
      collector_name: _currentUser?.full_name || _currentUser?.username || 'Kế toán công nợ',
      collector_role: 'Kế toán công nợ',
      created_at: tx.created_at || new Date().toISOString(),
    };
    setPrintVoucherTarget(voucher);
    setIsPrintVoucherOpen(true);
  };

  const handleOpenCreateReceipt = (dealer: DealerSearchItem, orderCode?: string, defaultAmount?: number) => {
    setCreateReceiptTargetDealer(dealer);
    setCreateReceiptOrderCode(orderCode);
    setCreateReceiptDefaultAmount(defaultAmount);
    setIsCreateReceiptOpen(true);
  };

  const handleCreateReceiptSuccess = (voucher: ReceiptVoucherData) => {
    setIsCreateReceiptOpen(false);
    setPrintVoucherTarget(voucher);
    setIsPrintVoucherOpen(true);
    emitStatusToast({
      title: 'Ghi nhận phiếu thu thành công',
      message: `Đã lập phiếu thu ${voucher.receipt_code} (${(voucher.amount || 0).toLocaleString('vi-VN')} đ).`,
    });
  };

  const getGroupBadgeClass = (grp?: string | null) => {
    if (!grp) return 'badge-group-le';
    const g = grp.toLowerCase().replace(/_/g, ' ').trim();
    if (g.includes('cấp 1') || g.includes('cap 1')) return 'badge-group-cap1';
    if (g.includes('cấp 2') || g.includes('cap 2')) return 'badge-group-cap2';
    if (g.includes('sỉ') || g.includes('si')) return 'badge-group-si';
    return 'badge-group-le';
  };

  const getStatusBadgeInfo = (st?: string | null) => {
    const s = st || 'Đang hoạt động';
    if (s === 'Đang hoạt động') {
      return { className: 'status-pill-active', dotColor: '#16a34a', text: 'Đang hoạt động' };
    }
    if (s === 'Tạm ngừng') {
      return { className: 'status-pill-paused', dotColor: '#d97706', text: 'Tạm ngừng' };
    }
    if (s === 'Ngừng giao dịch') {
      return { className: 'status-pill-stopped', dotColor: '#dc2626', text: 'Ngừng giao dịch' };
    }
    return { className: 'status-pill-pending', dotColor: '#64748b', text: 'Chưa kích hoạt' };
  };


  if (isFormPageActive) {
    return (
      <div className="dealer-profiles-container dealer-form-page-scrollable">
        {/* Top Header Section of Form Page */}
        <div className="dealer-profiles-header">
          <div className="dealer-header-title-wrap" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="btn-secondary-white"
              onClick={() => {
                setIsFormPageActive(false);
                setEditingDealer(null);
                setFormError('');
              }}
              title="Quay lại danh sách hồ sơ đại lý"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Quay lại danh sách
            </button>
            <h2 className="dealer-header-title">
              {editingDealer ? `Cập nhật hồ sơ: ${editingDealer.name}` : 'Khai báo hồ sơ đại lý mới'}
            </h2>
          </div>
        </div>

        {/* Bảng hồ sơ đại lý duy nhất (Unified Card) - Gọn đẹp, hiện đại, tối ưu 100% trên điện thoại & máy tính */}
        <form onSubmit={handleSubmitForm} className="dealer-unified-form-wrap">
          <div className="dealer-unified-card">
            {/* 1. Header thẻ thống nhất: Tiêu đề + Icon + Trạng thái hồ sơ */}
            <div className="dealer-unified-card-header">
              <div className="dealer-unified-header-left">
                <div className="dealer-unified-icon-box">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21h18" />
                    <path d="M5 21V7l8-4v18" />
                    <path d="M19 21V11l-6-3" />
                    <path d="M9 9v.01" />
                    <path d="M9 12v.01" />
                    <path d="M9 15v.01" />
                    <path d="M9 18v.01" />
                  </svg>
                </div>
                <div>
                  <h2 className="dealer-unified-card-title">
                    {editingDealer ? `Hồ sơ đại lý: ${editingDealer.name}` : 'Thông tin hồ sơ đại lý'}
                  </h2>
                  <p className="dealer-unified-card-subtitle">
                    {editingDealer
                      ? `Mã: ${formData.code} • Cập nhật thông tin đại lý, chính sách & kho phục vụ`
                      : 'Thiết lập thông tin pháp lý, chính sách chiết khấu & kho hàng phục vụ'}
                  </p>
                </div>
              </div>

              {/* Trạng thái hồ sơ được tích hợp gọn gàng ở góc trên phải */}
              <div className="dealer-unified-status-wrap">
                <label className="dealer-unified-status-label">Trạng thái hồ sơ:</label>
                <div className="dealer-unified-status-select-wrap">
                  <span
                    className="dealer-unified-status-dot"
                    style={{ backgroundColor: getStatusBadgeInfo(formData.status).dotColor }}
                  />
                  <select
                    className="dealer-unified-status-select"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Thân thẻ: 2 Cột dữ liệu + Banner bảng giá + Dải tóm tắt */}
            <div className="dealer-unified-card-body">
              {/* Lưới trường liền mạch (Seamless Form Grid) - 1 bảng duy nhất, cân đối tuyệt đối */}
              <div className="dealer-seamless-grid">

                {/* Phân mục 1: Thông tin đại lý */}
                <div className="dealer-seamless-section-divider" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <span>1. Thông tin liên hệ & Pháp lý</span>
                </div>

                {/* Hàng 1: Mã đại lý & Tên đại lý */}
                <div className="dealer-order-like-field">
                  <span>Mã đại lý <b>*</b></span>
                  <div className="dealer-order-code-input-wrap">
                    <input
                      type="text"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="VD: DL1883"
                      required
                    />
                    {!editingDealer && (
                      <button
                        type="button"
                        className="btn-code-generate"
                        onClick={() => {
                          const rand = Math.floor(1000 + Math.random() * 9000);
                          setFormData({ ...formData, code: `DL${rand}` });
                        }}
                        title="Sinh ngẫu nhiên mã đại lý mới"
                      >
                        Sinh mã
                      </button>
                    )}
                  </div>
                </div>

                <div className="dealer-order-like-field">
                  <span>Tên đại lý / Khách hàng <b>*</b></span>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="VD: Đại Lý Thời Trang Sao Mai"
                    required
                  />
                </div>

                {/* Hàng 2: Số điện thoại & MST */}
                <div className="dealer-order-like-field">
                  <span>Số điện thoại liên hệ <b>*</b></span>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: val });
                    }}
                    placeholder="VD: 0912345678 (10 số)"
                    required
                  />
                </div>

                <div className="dealer-order-like-field">
                  <span>Mã số thuế (MST)</span>
                  <input
                    type="text"
                    value={formData.tax_code}
                    onChange={(e) => setFormData({ ...formData, tax_code: e.target.value })}
                    placeholder="VD: 0101234567"
                  />
                </div>

                {/* Hàng 3: Địa chỉ đại lý (Trải dài toàn hàng) */}
                <div className="dealer-order-like-field dealer-seamless-field-full">
                  <span>Địa chỉ đại lý / văn phòng</span>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="VD: Số 120 Cầu Giấy, Hà Nội"
                  />
                </div>

                {/* Phân mục 2: Chính sách & Kho phục vụ */}
                <div className="dealer-seamless-section-divider">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span>2. Chính sách bán hàng & Kho phục vụ</span>
                </div>

                {/* Hàng 4: Nhóm khách hàng & Khu vực địa lý */}
                <div className="dealer-order-like-field">
                  <span>Nhóm khách hàng <b>*</b></span>
                  <select
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

                <div className="dealer-order-like-field">
                  <span>Khu vực địa lý <b>*</b></span>
                  <select
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

                {/* Hàng 5: Người phụ trách Sales & Kho phục vụ */}
                <div className="dealer-order-like-field">
                  <span>Người phụ trách (Sales) <b>*</b></span>
                  <select
                    value={formData.assigned_sale_id}
                    onChange={(e) => setFormData({ ...formData, assigned_sale_id: e.target.value })}
                  >
                    <option value="">-- Chưa phân công --</option>
                    {salesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="dealer-order-like-field">
                  <span>
                    Kho phục vụ {formData.warehouse_name ? <span style={{ color: '#16a34a', fontWeight: 600 }}>: {formData.warehouse_name}</span> : null}
                  </span>
                  <select
                    value={formData.warehouse_id}
                    onChange={(e) => {
                      const selId = e.target.value;
                      const selWh = activeWarehouses.find((w) => (w.code && w.code === selId) || String(w.id) === selId);
                      setFormData({
                        ...formData,
                        warehouse_id: selWh ? (selWh.code || String(selWh.id)) : selId,
                        warehouse_name: selWh ? selWh.name : '',
                      });
                    }}
                  >
                    <option value="">-- Tự động theo khu vực --</option>
                    {activeWarehouses.map((wh) => {
                      const val = wh.code || String(wh.id);
                      return (
                        <option key={wh.id} value={val}>
                          {wh.code} - {wh.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Hàng 6 (Nếu sửa): Số giao dịch */}
                {editingDealer && (
                  <div className="dealer-order-like-field dealer-seamless-field-full">
                    <span>Số giao dịch <b>*</b></span>
                    <input
                      type="number"
                      min="0"
                      value={formData.transaction_count}
                      onChange={(e) => setFormData({ ...formData, transaction_count: e.target.value })}
                      placeholder="0"
                      required
                    />
                  </div>
                )}

              </div>

              {/* Live Preview Card: Bảng giá áp dụng theo nhóm */}
              <div className="dealer-order-price-banner">
                {loadingPriceBookPreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontSize: '11.5px' }}>
                    <svg className="icon-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Đang tra cứu bảng giá hiệu lực cho nhóm {formData.customer_group}...</span>
                  </div>
                ) : modalAppliedPriceBook ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11.5px', color: '#166534' }}>
                    <span style={{ fontWeight: 700 }}>Bảng giá theo nhóm:</span>
                    <strong style={{ color: '#0f172a' }}>
                      {(modalAppliedPriceBook.name || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()}
                    </strong>
                    {modalAppliedPriceBook.valid_from && modalAppliedPriceBook.valid_to && (
                      <span style={{ color: '#64748b', fontSize: '11px' }}>
                        • Hiệu lực: {modalAppliedPriceBook.valid_from.substring(0, 10)} đến {modalAppliedPriceBook.valid_to.substring(0, 10)}
                      </span>
                    )}
                    <span style={{ color: '#15803d', fontSize: '11px', marginLeft: 'auto', fontWeight: 600 }}>
                      ✓ Tự động áp dụng khi lên đơn hàng
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>ℹ️ Chưa có bảng giá riêng cho nhóm {formData.customer_group} (sử dụng giá niêm yết mặc định).</span>
                  </div>
                )}
              </div>

              {/* Dải TỔNG KẾT HỒ SƠ trực quan */}
              <div className="dealer-unified-summary-strip">
                <div className="dealer-unified-summary-item">
                  <span className="summary-label">Nhóm KH</span>
                  <strong className="summary-value">{formData.customer_group}</strong>
                </div>
                <div className="dealer-unified-summary-item">
                  <span className="summary-label">Khu vực</span>
                  <strong className="summary-value">{formData.region || '—'}</strong>
                </div>
                <div className="dealer-unified-summary-item">
                  <span className="summary-label">Kho phục vụ</span>
                  <strong className="summary-value">{formData.warehouse_name || 'Tự động'}</strong>
                </div>
                <div className="dealer-unified-summary-item">
                  <span className="summary-label">Phụ trách</span>
                  <strong className="summary-value">
                    {salesList.find((s) => String(s.id) === String(formData.assigned_sale_id))?.name || 'Chưa chọn'}
                  </strong>
                </div>
                <div className="dealer-unified-summary-item">
                  <span className="summary-label">Bảng giá</span>
                  <strong className="summary-value" style={{ color: modalAppliedPriceBook ? '#059669' : '#475569' }}>
                    {modalAppliedPriceBook
                      ? (modalAppliedPriceBook.name || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()
                      : 'Giá niêm yết'}
                  </strong>
                </div>
                <div className="dealer-unified-summary-item">
                  <span className="summary-label">Trạng thái</span>
                  <strong className="summary-value" style={{ color: getStatusBadgeInfo(formData.status).dotColor }}>
                    ● {formData.status}
                  </strong>
                </div>
              </div>
            </div>

            {/* 3. Đáy thẻ: Nút hành động */}
            <div className="dealer-unified-card-footer">
              <button
                type="button"
                className="dealer-unified-btn-secondary"
                onClick={() => {
                  setIsFormPageActive(false);
                  setEditingDealer(null);
                  setFormError('');
                }}
                disabled={isSubmitting}
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                className="dealer-unified-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <svg className="icon-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Đang lưu...</span>
                  </>
                ) : editingDealer ? (
                  'Lưu thay đổi'
                ) : (
                  'Khai báo hồ sơ'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="dealer-profiles-container">
      {/* 1. Header Section */}
      <div className="dealer-profiles-header">
        <div className="dealer-header-title-wrap">
          <h2 className="dealer-header-title">Quản lý Hồ sơ Đại lý</h2>
        </div>

        <div className="dealer-header-actions">
          {onBackToHome && (
            <button className="btn-secondary-white" onClick={onBackToHome} title="Quay lại trang chủ">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              Trở về
            </button>
          )}

          <button
            className="btn-secondary-white"
            onClick={handleManualRefresh}
            disabled={loading || isRefreshing}
            title="Làm mới dữ liệu từ hệ thống"
          >
            <svg
              className={loading || isRefreshing ? 'icon-spin' : ''}
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            {loading || isRefreshing ? 'Đang làm mới...' : 'Làm mới'}
          </button>

          {onOpenDebtStatement && (
            <button
              type="button"
              className="btn-secondary-white"
              onClick={() => onOpenDebtStatement(dealers[0]?.id || 0)}
              title="Xem Sổ chi tiết công nợ đại lý (Mẫu S31-DN)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Sổ chi tiết công nợ
            </button>
          )}

          <button
            className="btn-primary-gradient"
            id="btn-create-dealer-profile"
            onClick={handleOpenCreateModal}
            disabled={loading || isSubmitting}
            title="Khai báo hồ sơ đại lý mới vào hệ thống"
          >
            Khai báo hồ sơ đại lý
          </button>
        </div>
      </div>

      {/* 2. 4 Ô Thống Kê (Bố cục hiện đại, không dùng icon, trực quan và sang trọng) */}
      <div className="dealer-stats-grid">
        {/* Ô 1: Tổng số hồ sơ đại lý */}
        <div
          className={`dealer-stat-card stat-card-blue ${selectedStatFilter === 'all' ? 'stat-card-active' : ''}`}
          onClick={() => handleStatCardClick('all')}
          title="Bấm để xem toàn bộ danh sách đại lý (bỏ lọc trạng thái)"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Tổng số hồ sơ đại lý</span>
            {selectedStatFilter === 'all' && (
              <span className="stat-filter-tag">Đang lọc</span>
            )}
          </div>
          <div className="stat-number stat-num-blue">{stats.total}</div>
          <div className="stat-subtext">Hồ sơ đối tác trên hệ thống</div>
        </div>

        {/* Ô 2: Đang hoạt động */}
        <div
          className={`dealer-stat-card stat-card-green ${selectedStatFilter === 'active' || selectedStatus === 'Đang hoạt động' ? 'stat-card-active' : ''}`}
          onClick={() => handleStatCardClick('active')}
          title="Bấm để lọc các đại lý đang hoạt động giao dịch"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Đang hoạt động</span>
            {(selectedStatFilter === 'active' || selectedStatus === 'Đang hoạt động') && (
              <span className="stat-filter-tag">Đang lọc</span>
            )}
          </div>
          <div className="stat-number stat-num-green">{stats.active}</div>
          <div className="stat-subtext">Sẵn sàng giao dịch & tạo đơn</div>
        </div>

        {/* Ô 3: Ngừng giao dịch */}
        <div
          className={`dealer-stat-card stat-card-red ${selectedStatFilter === 'stopped' || selectedStatus === 'Ngừng giao dịch' ? 'stat-card-active' : ''}`}
          onClick={() => handleStatCardClick('stopped')}
          title="Bấm để lọc các đại lý đã ngừng giao dịch / tạm dừng"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Ngừng giao dịch / Tạm dừng</span>
            {(selectedStatFilter === 'stopped' || selectedStatus === 'Ngừng giao dịch') && (
              <span className="stat-filter-tag">Đang lọc</span>
            )}
          </div>
          <div className="stat-number stat-num-red">{stats.stopped}</div>
          <div className="stat-subtext">Đã khóa hoặc ngưng giao dịch</div>
        </div>

        {/* Ô 4: Đã phát sinh GD (Khóa xóa) */}
        <div
          className={`dealer-stat-card stat-card-amber ${selectedStatFilter === 'with_tx' || hasTxFilter === true ? 'stat-card-active' : ''}`}
          onClick={() => handleStatCardClick('with_tx')}
          title="Bấm để lọc các đại lý đã phát sinh giao dịch (không thể xóa trực tiếp)"
        >
          <div className="stat-card-top">
            <span className="stat-card-label">Đã phát sinh GD</span>
            {(selectedStatFilter === 'with_tx' || hasTxFilter === true) && (
              <span className="stat-filter-tag">Đang lọc</span>
            )}
          </div>
          <div className="stat-number stat-num-amber">{stats.with_transactions}</div>
          <div className="stat-subtext">Có dữ liệu đơn hàng (Khóa xóa)</div>
        </div>
      </div>

      {/* 3. Filter Card */}
      <div className="dealer-filter-card">
        <div className="dealer-filter-grid">
          {/* Keyword Search có Debounce */}
          <div className="search-input-wrapper">
            <input
              type="text"
              className="search-input"
              style={{ paddingLeft: '44px' }}
              placeholder="Tìm theo Mã đại lý, Tên, Mã số thuế, SĐT..."
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
            {keywordInput && (
              <button
                type="button"
                className="btn-clear-search"
                onClick={() => setKeywordInput('')}
                title="Xóa từ khóa"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          {/* Customer Group Filter */}
          <select
            className="filter-select"
            value={selectedGroup}
            onChange={(e) => {
              setSelectedGroup(e.target.value);
              setCurrentPage(1);
            }}
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
            onChange={(e) => {
              setSelectedRegion(e.target.value);
              setCurrentPage(1);
            }}
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
            onChange={(e) => {
              setSelectedSaleId(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">-- Người phụ trách --</option>
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
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setSelectedStatFilter('');
              setCurrentPage(1);
            }}
          >
            <option value="">-- Tất cả trạng thái --</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Table List */}
      <div className="dealer-table-card">
        {loading ? (
          <div className="empty-state-box">
            <div
              style={{
                display: 'inline-block',
                width: '36px',
                height: '36px',
                border: '3.5px solid #e2e8f0',
                borderTopColor: '#2563eb',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            ></div>
            <h4 style={{ marginTop: '16px' }}>Đang nạp danh sách hồ sơ đại lý...</h4>
            <p>Vui lòng đợi trong giây lát khi hệ thống kết nối với máy chủ.</p>
          </div>
        ) : error ? (
          <div className="error-state-box">
            <div className="error-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h4>Không thể tải dữ liệu đại lý</h4>
            <p style={{ margin: '0 auto 16px auto', maxWidth: '500px' }}>{error}</p>
            <button className="btn-secondary-white" onClick={loadDealers}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              Thử lại
            </button>
          </div>
        ) : dealers.length === 0 ? (
          <div className="empty-state-box">
            <div className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <h4>Không tìm thấy đại lý, vui lòng thay đổi từ khóa hoặc bộ lọc.</h4>
            <p>Hệ thống không tìm thấy hồ sơ nào khớp với các tiêu chí tìm kiếm hiện tại.</p>
            {hasActiveFilters && (
              <button className="btn-secondary-white" onClick={handleResetFilters} style={{ marginTop: '8px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Xóa tất cả bộ lọc
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="dealer-table">
                <thead>
                  <tr>
                    <th style={{ width: '6%', whiteSpace: 'nowrap' }} title="Mã định danh duy nhất của đại lý">Mã đại lý</th>
                    <th style={{ width: '15%' }} title="Tên đại lý và thông tin liên hệ">Tên đại lý</th>
                    <th style={{ width: '8.5%', whiteSpace: 'nowrap' }} title="Kho hàng được gán phục vụ mặc định">Kho phục vụ</th>
                    <th style={{ width: '8.5%', whiteSpace: 'nowrap' }} title="Mã số thuế doanh nghiệp">Mã số thuế</th>
                    <th style={{ width: '8%', whiteSpace: 'nowrap' }} title="Phân loại nhóm khách hàng">Nhóm KH</th>
                    <th style={{ width: '11%', whiteSpace: 'nowrap' }} title="Bảng giá bán đang áp dụng theo nhóm">Bảng giá áp dụng</th>
                    <th style={{ width: '7%', whiteSpace: 'nowrap' }} title="Khu vực địa lý của đại lý">Khu vực</th>
                    <th style={{ width: '11%', whiteSpace: 'nowrap' }} title="Nhân viên kinh doanh phụ trách">Người phụ trách</th>
                    <th style={{ width: '5%', whiteSpace: 'nowrap', textAlign: 'center' }} title="Số lượng đơn hàng/giao dịch đã phát sinh">Giao dịch</th>
                    <th style={{ width: '14%', minWidth: '120px', whiteSpace: 'nowrap', textAlign: 'center' }} title="Trạng thái hoạt động giao dịch">Trạng thái</th>
                    <th style={{ width: '6%', whiteSpace: 'nowrap', textAlign: 'center' }} title="Các thao tác quản lý hồ sơ">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {dealers.map((dealer) => {
                    const txCount = dealer.transaction_count ?? 0;
                    const hasTx = txCount > 0 || Boolean(dealer.has_transactions);
                    const statusInfo = getStatusBadgeInfo(dealer.status);

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
                          <div className="dealer-name-title" title={dealer.name}>
                            {dealer.name}
                          </div>
                          {dealer.phone && (
                            <div className="dealer-phone-sub">
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                              </svg>
                              <span>{dealer.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* 2b. Kho phục vụ mặc định */}
                        <td>
                          {dealer.warehouse_name ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '10.5px',
                                fontWeight: '600',
                                border: '1px solid #bfdbfe',
                                maxWidth: '100%',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={`Kho mặc định cấp hàng cho đại lý: ${dealer.warehouse_name}`}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                                <path d="M3 21V9l9-7 9 7v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                              </svg>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {dealer.warehouse_name}
                              </span>
                            </span>
                          ) : (
                            <span className="empty-subtext" style={{ fontSize: '11px' }} title="Chưa thiết lập kho phục vụ mặc định">Tự động</span>
                          )}
                        </td>

                        {/* 3. Mã số thuế */}
                        <td>
                          {dealer.tax_code ? (
                            <span className="tax-code-text" style={{ fontSize: '11px' }} title={`Mã số thuế: ${dealer.tax_code}`}>
                              {dealer.tax_code}
                            </span>
                          ) : (
                            <span className="empty-subtext" style={{ fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 4. Nhóm khách hàng */}
                        <td>
                          <span className={`badge-group ${getGroupBadgeClass(dealer.customer_group)}`}>
                            {formatCustomerGroup(dealer.customer_group)}
                          </span>
                        </td>

                        {/* 5. Bảng giá áp dụng (Không icon, không hiển thị mã trong ngoặc) */}
                        <td>
                          {dealer.applied_price_book ? (
                            <button
                              type="button"
                              className="price-book-pill-btn"
                              onClick={() => {
                                setPriceBookModalTarget(dealer.applied_price_book || null);
                                setIsPriceBookModalOpen(true);
                              }}
                              title={`Bảng giá: ${(dealer.applied_price_book.name || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()}`}
                            >
                              <span className="price-book-clean-name" title={dealer.applied_price_book.name}>
                                {(dealer.applied_price_book.name || '').replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()}
                              </span>
                            </button>
                          ) : (
                            <span className="empty-subtext" style={{ fontSize: '11px' }} title="Chưa có bảng giá được gán cho nhóm này">
                              —
                            </span>
                          )}
                        </td>

                        {/* 6. Khu vực (Hiển thị nguyên dòng, không ngắt chữ) */}
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: '600', color: '#334155' }}>
                            {dealer.region || '—'}
                          </span>
                        </td>

                        {/* 7. Người phụ trách (Cột gọn gàng, tên không bị xuống dòng) */}
                        <td>
                          {dealer.assigned_sale_name ? (
                            <div className="sale-staff-cell" title={`Nhân viên phụ trách: ${dealer.assigned_sale_name}`}>
                              <div className="sale-avatar-mini">
                                {dealer.assigned_sale_name.charAt(0)}
                              </div>
                              <span className="sale-staff-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75px' }}>
                                {dealer.assigned_sale_name}
                              </span>
                            </div>
                          ) : (
                            <span className="empty-subtext" style={{ fontSize: '11px' }}>—</span>
                          )}
                        </td>

                        {/* 8. Lịch sử giao dịch: Hiển thị rõ số lượng và bấm để xem chi tiết */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className={`tx-badge-btn ${hasTx ? 'has-tx' : 'no-tx'}`}
                            onClick={() => handleOpenTransactionsModal(dealer)}
                            title={`Nhấp để xem lịch sử ${txCount} đơn hàng/giao dịch của đại lý`}
                            style={{ padding: '2.5px 7px', fontSize: '11px' }}
                          >
                            <span>{txCount} GD</span>
                          </button>
                        </td>

                        {/* 9. Trạng thái đại lý: Badge hiển thị thông tin tĩnh (Thay đổi trạng thái tại thao tác Sửa) */}
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              background:
                                dealer.status === 'Đang hoạt động'
                                  ? '#dcfce7'
                                  : dealer.status === 'Tạm ngừng'
                                  ? '#fef3c7'
                                  : dealer.status === 'Ngừng giao dịch'
                                  ? '#fee2e2'
                                  : '#f1f5f9',
                              color:
                                dealer.status === 'Đang hoạt động'
                                  ? '#15803d'
                                  : dealer.status === 'Tạm ngừng'
                                  ? '#b45309'
                                  : dealer.status === 'Ngừng giao dịch'
                                  ? '#b91c1c'
                                  : '#475569',
                              border: `1.5px solid ${
                                dealer.status === 'Đang hoạt động'
                                  ? '#86efac'
                                  : dealer.status === 'Tạm ngừng'
                                  ? '#fde68a'
                                  : dealer.status === 'Ngừng giao dịch'
                                  ? '#fca5a5'
                                  : '#cbd5e1'
                              }`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              fontSize: '11px',
                              fontWeight: 700,
                              userSelect: 'none',
                              cursor: 'default',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: statusInfo.dotColor,
                                flexShrink: 0,
                              }}
                            />
                            <span>{dealer.status || 'Đang hoạt động'}</span>
                          </span>
                        </td>

                        {/* 10. Thao tác: Gom toàn bộ chức năng vào nút 3 chấm */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-action-dots"
                            onClick={(e) => handleToggleActionMenu(e, dealer)}
                            title="Thao tác chức năng đại lý"
                            aria-label="Thao tác"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2.2" />
                              <circle cx="12" cy="12" r="2.2" />
                              <circle cx="12" cy="19" r="2.2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View cho giao diện điện thoại (Không thanh lướt ngang, thu phóng 100%, đủ thông tin) */}
            <div className="dealer-mobile-card-list">
              {dealers.map((dealer) => {
                const cleanPriceName = (dealer.applied_price_book?.name || '')
                  .replace(/\s*\([^)]*\)/g, '')
                  .replace(/\s*\[[^\]]*\]/g, '')
                  .trim();
                const txCount = dealer.transaction_count ?? 0;
                const hasTx = txCount > 0;
                return (
                  <div key={dealer.id} className="dealer-mobile-card">
                    <div className="dealer-mobile-card-header">
                      <div>
                        <span className="dealer-code-badge">{dealer.code}</span>
                        <div className="dealer-mobile-card-name">{dealer.name}</div>
                      </div>
                      <span
                        className="badge-status"
                        style={{
                          background:
                            dealer.status === 'Đang hoạt động'
                              ? '#dcfce7'
                              : dealer.status === 'Tạm ngừng'
                              ? '#fef3c7'
                              : '#fee2e2',
                          color:
                            dealer.status === 'Đang hoạt động'
                              ? '#166534'
                              : dealer.status === 'Tạm ngừng'
                              ? '#92400e'
                              : '#991b1b',
                        }}
                      >
                        <span className="dot" />
                        {dealer.status || 'Đang hoạt động'}
                      </span>
                    </div>

                    <div className="dealer-mobile-card-body">
                      {dealer.phone && (
                        <div className="dealer-mobile-card-row">
                          <span className="dealer-mobile-card-label">SĐT:</span>
                          <a href={`tel:${dealer.phone}`} className="dealer-mobile-card-val" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 600 }}>
                            {dealer.phone}
                          </a>
                        </div>
                      )}
                      {dealer.tax_code && (
                        <div className="dealer-mobile-card-row">
                          <span className="dealer-mobile-card-label">Mã số thuế:</span>
                          <span className="dealer-mobile-card-val" style={{ fontFamily: 'monospace' }}>{dealer.tax_code}</span>
                        </div>
                      )}
                      <div className="dealer-mobile-card-row">
                        <span className="dealer-mobile-card-label">Nhóm KH:</span>
                        <span className="badge-customer-group">{formatCustomerGroup(dealer.customer_group)}</span>
                      </div>
                      {cleanPriceName && (
                        <div className="dealer-mobile-card-row">
                          <span className="dealer-mobile-card-label">Bảng giá:</span>
                          <button
                            type="button"
                            className="price-book-pill-btn"
                            style={{ padding: '2px 8px' }}
                            onClick={() => {
                              setPriceBookModalTarget(dealer.applied_price_book || null);
                              setIsPriceBookModalOpen(true);
                            }}
                          >
                            <span className="price-book-clean-name">{cleanPriceName}</span>
                          </button>
                        </div>
                      )}
                      <div className="dealer-mobile-card-row">
                        <span className="dealer-mobile-card-label">Khu vực:</span>
                        <span className="dealer-mobile-card-val">{dealer.region || '—'}</span>
                      </div>
                      <div className="dealer-mobile-card-row">
                        <span className="dealer-mobile-card-label">Kho phục vụ:</span>
                        <span className="dealer-mobile-card-val">{dealer.warehouse_name || 'Tự động'}</span>
                      </div>
                      <div className="dealer-mobile-card-row">
                        <span className="dealer-mobile-card-label">Phụ trách:</span>
                        <span className="dealer-mobile-card-val">{dealer.assigned_sale_name || '—'}</span>
                      </div>
                      <div className="dealer-mobile-card-row">
                        <span className="dealer-mobile-card-label">Giao dịch:</span>
                        <button
                          type="button"
                          className={`tx-badge-btn ${hasTx ? 'has-tx' : 'no-tx'}`}
                          onClick={() => handleOpenTransactionsModal(dealer)}
                          style={{ padding: '2px 8px' }}
                        >
                          {txCount} GD
                        </button>
                      </div>
                    </div>

                    <div className="dealer-mobile-card-actions">
                      <button
                        type="button"
                        className="btn-action-mobile-edit"
                        onClick={() => handleOpenEditModal(dealer)}
                      >
                        Sửa hồ sơ
                      </button>
                      <button
                        type="button"
                        className="btn-action-mobile-tx"
                        style={{ background: '#16a34a', color: '#ffffff' }}
                        onClick={() => handleOpenCreateReceipt(dealer)}
                      >
                        Lập phiếu thu
                      </button>
                      <button
                        type="button"
                        className="btn-action-mobile-tx"
                        onClick={() => handleOpenTransactionsModal(dealer)}
                      >
                        Xem GD
                      </button>
                      <button
                        type="button"
                        className="btn-action-mobile-delete"
                        disabled={hasTx}
                        onClick={() => handleDeleteClick(dealer)}
                        title={hasTx ? 'Đã phát sinh giao dịch, hệ thống khóa xóa' : 'Xóa đại lý'}
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 5. Pagination Bar */}
            <div className="dealer-pagination-bar">
              <div className="pagination-controls-wrap">
                <div className="pagination-size-select-wrap">
                  <span>Số dòng mỗi trang:</span>
                  <select
                    className="pagination-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="btn-page"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    title="Trang trước"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                    // Hiển thị gọn nếu nhiều trang
                    if (
                      totalPages > 7 &&
                      pageNum !== 1 &&
                      pageNum !== totalPages &&
                      Math.abs(pageNum - currentPage) > 2
                    ) {
                      if (Math.abs(pageNum - currentPage) === 3) {
                        return <span key={pageNum} style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>;
                      }
                      return null;
                    }

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        className={`btn-page ${pageNum === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className="btn-page"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    title="Trang tiếp"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>



      {/* ============================================================ */}
      {/* 7. MODAL CẢNH BÁO: ĐẠI LÝ ĐÃ PHÁT SINH GIAO DỊCH (KHÔNG ĐƯỢC XÓA) */}
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
                  <span>Quy định kế toán & kiểm toán hệ thống:</span>
                </div>
                <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                  <li>Đại lý đã phát sinh giao dịch thì <strong>không được phép xóa trực tiếp</strong> nhằm bảo toàn toàn vẹn lịch sử sổ sách, hóa đơn và công nợ.</li>
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
      {/* 8. MODAL XÁC NHẬN XÓA AN TOÀN (CHƯA PHÁT SINH GIAO DỊCH) */}
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
      {/* 9. MODAL CHI TIẾT BẢNG GIÁ ĐƯỢC ÁP DỤNG */}
      {/* ============================================================ */}
      {isPriceBookModalOpen && priceBookModalTarget && (
        <div className="modal-overlay" onClick={() => setIsPriceBookModalOpen(false)}>
          <div className="modal-content-card" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <span>Chi tiết Bảng giá</span>
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

      {/* ============================================================ */}
      {/* 10. MODAL LỊCH SỬ GIAO DỊCH CỦA ĐẠI LÝ */}
      {/* ============================================================ */}
      {isTxModalOpen && txModalDealer && (
        <div className="modal-overlay" onClick={() => setIsTxModalOpen(false)}>
          <div className="modal-content-card" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span>Lịch sử giao dịch: {txModalDealer.name} ({txModalDealer.code})</span>
              </h3>
              <button
                className="modal-close-btn"
                onClick={() => setIsTxModalOpen(false)}
                title="Đóng"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              {loadingTx ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      width: '32px',
                      height: '32px',
                      border: '3px solid #e2e8f0',
                      borderTopColor: '#2563eb',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  ></div>
                  <p style={{ marginTop: '12px', fontWeight: '600' }}>Đang nạp lịch sử giao dịch từ hệ thống...</p>
                </div>
              ) : txError ? (
                <div style={{ padding: '20px', color: '#dc2626', background: '#fef2f2', borderRadius: '10px', textAlign: 'center' }}>
                  {txError}
                </div>
              ) : txList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" style={{ margin: '0 auto 12px auto' }}>
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <line x1="2" y1="10" x2="22" y2="10" />
                  </svg>
                  <h4 style={{ margin: '0 0 6px 0', color: '#1e293b' }}>Chưa phát sinh giao dịch nào</h4>
                  <p style={{ margin: '0 0 16px 0' }}>Đại lý này chưa có đơn hàng hoặc chứng từ nào được ghi nhận trên hệ thống.</p>
                  <button
                    type="button"
                    onClick={() => handleOpenCreateReceipt(txModalDealer)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '7px',
                      border: 'none',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Lập phiếu thu tại chỗ
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '13.5px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ color: '#64748b' }}>
                      Tổng cộng <strong>{txList.length}</strong> giao dịch / đơn hàng đã phát sinh
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ color: '#15803d', fontWeight: '700' }}>
                        Tổng giá trị:{' '}
                        {txList
                          .reduce((sum, item) => sum + (item.total_amount || 0), 0)
                          .toLocaleString('vi-VN')}{' '}
                        đ
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenCreateReceipt(txModalDealer)}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#16a34a',
                          color: '#ffffff',
                          fontSize: '12.5px',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        Lập phiếu thu tại chỗ
                      </button>
                      {onOpenDebtStatement && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsTxModalOpen(false);
                            onOpenDebtStatement(txModalDealer.id);
                          }}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            border: '1px solid #2563eb',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: '12.5px',
                            fontWeight: '600',
                            cursor: 'pointer',
                          }}
                        >
                          Sổ công nợ
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="tx-modal-table-wrap">
                    <table className="tx-modal-table">
                      <thead>
                        <tr>
                          <th>Mã đơn hàng</th>
                          <th>Ngày tạo</th>
                          <th>Số mặt hàng</th>
                          <th style={{ textAlign: 'right' }}>Tổng tiền</th>
                          <th style={{ textAlign: 'center' }}>Trạng thái</th>
                          <th>Nhân viên</th>
                          <th style={{ textAlign: 'center' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txList.map((tx) => (
                          <tr key={tx.id || tx.order_code}>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#1e40af' }}>
                                {tx.order_code}
                              </span>
                            </td>
                            <td>
                              {tx.created_at ? tx.created_at.substring(0, 10) : '—'}
                            </td>
                            <td>{tx.items_count ?? 1} SP</td>
                            <td style={{ textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                              {(tx.total_amount || 0).toLocaleString('vi-VN')} đ
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  background:
                                    tx.status === 'CONFIRMED' || tx.status === 'COMPLETED' || tx.status === 'PAID'
                                      ? '#dcfce7'
                                      : tx.status === 'CANCELLED'
                                      ? '#fee2e2'
                                      : '#fef3c7',
                                  color:
                                    tx.status === 'CONFIRMED' || tx.status === 'COMPLETED' || tx.status === 'PAID'
                                      ? '#15803d'
                                      : tx.status === 'CANCELLED'
                                      ? '#b91c1c'
                                      : '#b45309',
                                }}
                              >
                                {tx.status === 'CONFIRMED'
                                  ? 'Đã xác nhận'
                                  : tx.status === 'COMPLETED'
                                  ? 'Hoàn thành'
                                  : tx.status === 'PAID'
                                  ? 'Đã thanh toán'
                                  : tx.status === 'CANCELLED'
                                  ? 'Đã hủy'
                                  : tx.status === 'PENDING_APPROVAL'
                                  ? 'Chờ duyệt'
                                  : tx.status}
                              </span>
                            </td>
                            <td>{tx.assigned_sale_name || '—'}</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => handleOpenPrintReceiptForTx(tx, txModalDealer)}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#1e40af',
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                }}
                                title={`In phiếu thu cho đơn ${tx.order_code}`}
                              >
                                In phiếu thu
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary-white" onClick={() => setIsTxModalOpen(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal In phiếu thu cho Kế toán công nợ */}
      {isPrintVoucherOpen && printVoucherTarget && (
        <ReceiptVoucherPrintModal
          voucher={printVoucherTarget}
          currentUser={_currentUser}
          onClose={() => {
            setIsPrintVoucherOpen(false);
            setPrintVoucherTarget(null);
          }}
        />
      )}

      {/* Modal Lập phiếu thu tiền tại chỗ */}
      {isCreateReceiptOpen && createReceiptTargetDealer && (
        <CreateReceiptVoucherModal
          isOpen={isCreateReceiptOpen}
          dealer={createReceiptTargetDealer}
          orderCode={createReceiptOrderCode}
          defaultAmount={createReceiptDefaultAmount}
          currentUser={_currentUser}
          token={token}
          onClose={() => {
            setIsCreateReceiptOpen(false);
            setCreateReceiptTargetDealer(null);
          }}
          onSuccess={handleCreateReceiptSuccess}
        />
      )}

      {/* Menu thao tác 3 chấm Popover qua Portal */}
      {actionMenuState &&
        createPortal(
          <div
            className="dealer-action-menu-portal"
            style={{
              position: 'fixed',
              top: actionMenuState.isDropup ? undefined : `${actionMenuState.top}px`,
              bottom: actionMenuState.isDropup ? `${window.innerHeight - actionMenuState.top}px` : undefined,
              right: `${actionMenuState.right}px`,
              zIndex: 999999,
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              minWidth: '220px',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1. Lập phiếu thu tiền */}
            <button
              type="button"
              className="dealer-action-menu-item"
              onClick={() => {
                const d = actionMenuState.dealer;
                setActionMenuState(null);
                handleOpenCreateReceipt(d);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
              <span>Lập phiếu thu tiền</span>
            </button>

            {/* 2. Sổ chi tiết công nợ */}
            {onOpenDebtStatement && (
              <button
                type="button"
                className="dealer-action-menu-item"
                onClick={() => {
                  const d = actionMenuState.dealer;
                  setActionMenuState(null);
                  onOpenDebtStatement(d.id);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                <span>Sổ chi tiết công nợ</span>
              </button>
            )}

            {/* 3. Chỉnh sửa */}
            <button
              type="button"
              className="dealer-action-menu-item"
              onClick={() => {
                const d = actionMenuState.dealer;
                setActionMenuState(null);
                handleOpenEditModal(d);
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2">
                <path d="M11 4H4a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>Chỉnh sửa hồ sơ</span>
            </button>

            {/* Divider */}
            <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />

            {/* 4. Xóa hoặc Ngừng giao dịch */}
            {(() => {
              const d = actionMenuState.dealer;
              const txCount = d.transaction_count ?? 0;
              const hasTx = txCount > 0 || Boolean(d.has_transactions);
              return (
                <button
                  type="button"
                  className={`dealer-action-menu-item ${hasTx ? 'text-amber' : 'text-danger'}`}
                  onClick={() => {
                    setActionMenuState(null);
                    handleDeleteClick(d);
                  }}
                >
                  {hasTx ? (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <span>Ngừng giao dịch ({txCount} GD)</span>
                    </>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      <span>Xóa đại lý</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>,
          document.body
        )}
    </div>
  );
}
