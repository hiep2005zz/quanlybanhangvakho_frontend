import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StockTransfer,
  getStockTransfersApi,
  getStockTransferDetailApi,
  createStockTransferApi,
  receiveStockTransferApi,
  cancelStockTransferApi,
  getAuditWarehousesApi,
  getStockBookApi,
  User,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface StockTransferManagementViewProps {
  token: string;
  currentUser?: User | null;
  onBackToHome?: () => void;
}

interface TransferItemDraft {
  product_id: number;
  product_code: string;
  product_name: string;
  category: string;
  unit: string;
  available_stock: number;
  transfer_qty: number;
}

interface ReceiveItemDraft {
  product_id: number;
  product_code: string;
  product_name: string;
  unit: string;
  transfer_qty: number;
  received_qty: number | string;
  reason: string;
}

interface CompensateItemDraft {
  product_id: number;
  product_code: string;
  product_name: string;
  unit: string;
  shortage_qty: number;
  compensate_qty: number;
  available_stock: number;
}

export function StockTransferManagementView({
  token,
  currentUser,
}: StockTransferManagementViewProps) {
  // Quyền người dùng
  const userRoles = useMemo(() => {
    if (currentUser?.roles && currentUser.roles.length > 0) {
      return currentUser.roles;
    }
    return [currentUser?.role || ''];
  }, [currentUser]);

  // Thủ kho, Quản lý kho, Admin có quyền ghi kho
  const canWriteInventory = userRoles.some((r) =>
    ['admin', 'warehouse_manager', 'warehouse'].includes(r)
  );

  // Danh sách kho
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [loading, setLoading] = useState(true);

  // Bộ lọc
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Trạng thái hiển thị trang tạo phiếu (đồng bộ Clean URL /stock-transfers/create)
  const [isCreatingPage, setIsCreatingPage] = useState(() => {
    return window.location.pathname.toLowerCase().includes('/create');
  });
  const [fromWarehouseId, setFromWarehouseId] = useState<string>('WH01');
  const [toWarehouseId, setToWarehouseId] = useState<string>('WH02');
  const [transferItems, setTransferItems] = useState<TransferItemDraft[]>([]);
  const [availableProducts, setAvailableProducts] = useState<
    {
      product_id: number;
      product_code: string;
      product_name: string;
      category_name: string;
      base_unit: string;
      available_stock: number;
    }[]
  >([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [transferNote, setTransferNote] = useState('');
  const [creating, setCreating] = useState(false);

  // Dropdown chọn sản phẩm phân trang từ máy chủ (Server-side pagination & SQL search)
  const PRODUCT_PAGE_SIZE = 10;
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [totalProductsCount, setTotalProductsCount] = useState(0);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const productDropdownRef = useRef<HTMLDivElement | null>(null);

  // Debounce 300ms khi người dùng gõ từ khóa tìm kiếm
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(productSearchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearchTerm]);

  // Nạp thêm 10 sản phẩm tiếp theo từ Backend
  const handleLoadMoreProducts = useCallback(async () => {
    if (loadingProducts || loadingMoreProducts) return;
    if (availableProducts.length >= totalProductsCount) return;

    const nextPage = productPage + 1;
    setLoadingMoreProducts(true);
    try {
      const res = await getStockBookApi(token, {
        warehouse_id: fromWarehouseId,
        page: nextPage,
        page_size: PRODUCT_PAGE_SIZE,
        search: debouncedSearchTerm.trim() || undefined,
      });
      const mapped = (res.items || []).map((it) => ({
        product_id: it.product_id,
        product_code: it.product_code,
        product_name: it.product_name,
        category_name: it.category,
        base_unit: it.base_unit || 'Cái',
        available_stock: it.available_stock ?? 0,
      }));
      setAvailableProducts((prev) => {
        const existingIds = new Set(prev.map((p) => p.product_id));
        const filteredNew = mapped.filter((p) => !existingIds.has(p.product_id));
        return [...prev, ...filteredNew];
      });
      setProductPage(nextPage);
      if (res.total !== undefined) {
        setTotalProductsCount(res.total);
      }
    } catch (err) {
      console.error('Lỗi nạp thêm sản phẩm từ backend:', err);
    } finally {
      setLoadingMoreProducts(false);
    }
  }, [
    loadingProducts,
    loadingMoreProducts,
    availableProducts.length,
    totalProductsCount,
    productPage,
    token,
    fromWarehouseId,
    debouncedSearchTerm,
  ]);

  // Cuộn xuống gần đáy danh sách để tự động nạp thêm (Infinite scroll từ backend)
  const handleProductListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      handleLoadMoreProducts();
    }
  };

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        productDropdownRef.current &&
        !productDropdownRef.current.contains(e.target as Node)
      ) {
        setProductDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProductDropdownOpen(false);
      }
    };
    if (productDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [productDropdownOpen]);

  // Đồng bộ URL popstate khi người dùng bấm Back/Forward
  useEffect(() => {
    const handlePop = () => {
      const isCreate = window.location.pathname.toLowerCase().includes('/create');
      setIsCreatingPage(isCreate);
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Tự động cuộn ô chọn vào tầm nhìn thuận tiện khi mở dropdown
  useEffect(() => {
    if (productDropdownOpen && productDropdownRef.current) {
      const timer = setTimeout(() => {
        productDropdownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [productDropdownOpen]);

  // Modal nhận hàng
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receivingTransfer, setReceivingTransfer] = useState<StockTransfer | null>(null);
  const [receiveItems, setReceiveItems] = useState<ReceiveItemDraft[]>([]);
  const [discrepancyReason, setDiscrepancyReason] = useState('');
  const [submittingReceive, setSubmittingReceive] = useState(false);

  // Modal chi tiết phiếu
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTransfer, setDetailTransfer] = useState<StockTransfer | null>(null);

  // Modal giao bù hàng thiếu
  const [showCompensateModal, setShowCompensateModal] = useState(false);
  const [compensatingTransfer, setCompensatingTransfer] = useState<StockTransfer | null>(null);
  const [compensateItems, setCompensateItems] = useState<CompensateItemDraft[]>([]);
  const [compensateNote, setCompensateNote] = useState('');
  const [loadingCompensateStock, setLoadingCompensateStock] = useState(false);
  const [submittingCompensate, setSubmittingCompensate] = useState(false);

  // Modal xác nhận hủy
  const [cancellingCode, setCancellingCode] = useState<string | null>(null);
  const [cancelReasonInput, setCancelReasonInput] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Tải danh sách kho
  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await getAuditWarehousesApi(token);
      setWarehouses(res);
    } catch {
      setWarehouses([
        { id: 'WH01', name: 'Kho Tổng Hà Nội' },
        { id: 'WH02', name: 'Kho Chi Nhánh TP. Hồ Chí Minh' },
        { id: 'WH03', name: 'Kho Chi Nhánh Đà Nẵng' },
      ]);
    }
  }, [token]);

  // Tải danh sách phiếu chuyển kho
  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const s = statusFilter !== 'ALL' ? statusFilter : undefined;
      const w = warehouseFilter !== 'ALL' ? warehouseFilter : undefined;
      const data = await getStockTransfersApi(token, s, w);
      setTransfers(data);
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi tải danh sách',
        message: err.message || 'Không thể tải danh sách phiếu chuyển kho.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, warehouseFilter]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Tải sản phẩm trang 1 và tổng số tồn khả dụng khi đổi kho đi hoặc đổi từ khóa tìm kiếm (Server-side)
  useEffect(() => {
    if (!isCreatingPage || !fromWarehouseId) return;
    let isCancelled = false;
    setLoadingProducts(true);
    setProductPage(1);

    getStockBookApi(token, {
      warehouse_id: fromWarehouseId,
      page: 1,
      page_size: PRODUCT_PAGE_SIZE,
      search: debouncedSearchTerm.trim() || undefined,
    })
      .then((res) => {
        if (isCancelled) return;
        const mapped = (res.items || []).map((it) => ({
          product_id: it.product_id,
          product_code: it.product_code,
          product_name: it.product_name,
          category_name: it.category,
          base_unit: it.base_unit || 'Cái',
          available_stock: it.available_stock ?? 0,
        }));
        setAvailableProducts(mapped);
        setTotalProductsCount(res.total ?? res.summary?.total_skus ?? mapped.length);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.error('Lỗi tải sản phẩm theo kho từ backend:', err);
        setAvailableProducts([]);
        setTotalProductsCount(0);
      })
      .finally(() => {
        if (!isCancelled) {
          setLoadingProducts(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [token, isCreatingPage, fromWarehouseId, debouncedSearchTerm]);

  // Hàm phân loại chênh lệch Dư / Hụt của phiếu chuyển kho
  const getTransferDiscrepancyInfo = useCallback((t: StockTransfer) => {
    let surplus = 0;
    let shortage = 0;

    if (t.items && t.items.length > 0) {
      for (const it of t.items) {
        if (it.received_qty !== null && it.received_qty !== undefined) {
          const d = it.received_qty - it.transfer_qty;
          if (d > 0) surplus += d;
          else if (d < 0) shortage += Math.abs(d);
        }
      }
    } else if (t.total_received_qty !== null && t.total_received_qty !== undefined) {
      const diff = t.total_received_qty - t.total_transfer_qty;
      if (diff > 0) surplus = diff;
      else if (diff < 0) shortage = Math.abs(diff);
    } else if (t.discrepancy_qty > 0) {
      shortage = t.discrepancy_qty;
    }

    return { surplus, shortage, hasDiscrepancy: surplus > 0 || shortage > 0 };
  }, []);

  // Hàm kiểm tra tình trạng giao bù của một phiếu chuyển kho (chỉ áp dụng cho hàng HỤT)
  const getTransferCompensationStatus = useCallback(
    (transfer: StockTransfer) => {
      let shortage = 0;
      if (transfer.items && transfer.items.length > 0) {
        for (const it of transfer.items) {
          if (it.received_qty !== null && it.received_qty !== undefined && it.transfer_qty > it.received_qty) {
            shortage += (it.transfer_qty - it.received_qty);
          }
        }
      } else if (transfer.total_received_qty !== null && transfer.total_received_qty !== undefined) {
        if (transfer.total_transfer_qty > transfer.total_received_qty) {
          shortage = transfer.total_transfer_qty - transfer.total_received_qty;
        }
      } else if (transfer.discrepancy_qty > 0) {
        shortage = transfer.discrepancy_qty;
      }

      if (shortage <= 0) {
        return {
          hasShortage: false,
          shortage: 0,
          compensatedQty: 0,
          inTransitCompensateQty: 0,
          isFullyCompensated: false,
          isCompensating: false,
        };
      }

      // Tìm các phiếu giao bù liên quan đến transfer.code
      const relatedComps = transfers.filter((other) => {
        if (other.id === transfer.id || other.code === transfer.code) return false;
        if (!other.note) return false;
        return (
          other.note.includes(`[GIAO_BU:${transfer.code}]`) ||
          other.note.toLowerCase().includes(transfer.code.toLowerCase())
        );
      });

      // Phiếu bù đã hoàn tất nhận hàng và đã nhận đủ/thực nhận
      const completedComps = relatedComps.filter((c) => c.status === 'COMPLETED');
      const compensatedQty = completedComps.reduce(
        (sum, c) => sum + (c.total_received_qty || 0),
        0
      );

      // Phiếu bù đang trên đường chuyển
      const inTransitComps = relatedComps.filter((c) => c.status === 'IN_TRANSIT');
      const inTransitCompensateQty = inTransitComps.reduce(
        (sum, c) => sum + (c.total_transfer_qty || 0),
        0
      );

      const isFullyCompensated = compensatedQty >= shortage;
      const isCompensating = !isFullyCompensated && inTransitCompensateQty > 0;

      return {
        hasShortage: true,
        shortage,
        compensatedQty,
        inTransitCompensateQty,
        isFullyCompensated,
        isCompensating,
        relatedComps,
      };
    },
    [transfers]
  );

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = transfers.length;
    const inTransit = transfers.filter((t) => t.status === 'IN_TRANSIT').length;
    const completed = transfers.filter((t) => t.status === 'COMPLETED').length;
    const cancelled = transfers.filter((t) => t.status === 'CANCELLED').length;
    const withDiscrepancy = transfers.filter((t) => {
      if (t.status !== 'COMPLETED' || t.discrepancy_qty <= 0) return false;
      const comp = getTransferCompensationStatus(t);
      return !comp.isFullyCompensated;
    }).length;
    return { total, inTransit, completed, cancelled, withDiscrepancy };
  }, [transfers, getTransferCompensationStatus]);

  // Lọc theo từ khóa tìm kiếm
  const filteredTransfers = useMemo(() => {
    if (!searchTerm.trim()) return transfers;
    const q = searchTerm.toLowerCase().trim();
    return transfers.filter(
      (t) =>
        t.code.toLowerCase().includes(q) ||
        t.from_warehouse_name.toLowerCase().includes(q) ||
        t.to_warehouse_name.toLowerCase().includes(q) ||
        t.created_by.toLowerCase().includes(q) ||
        (t.items &&
          t.items.some(
            (it) =>
              it.product_code.toLowerCase().includes(q) ||
              it.product_name.toLowerCase().includes(q)
          ))
    );
  }, [transfers, searchTerm]);

  // Phân trang (15 dòng / trang)
  const pageSize = 15;
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, warehouseFilter]);

  const totalItems = filteredTransfers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = filteredTransfers.slice(startIndex, endIndex);

  // Mở trang tạo phiếu mới
  const handleOpenCreatePage = () => {
    const defaultFrom = warehouses[0]?.id || 'WH01';
    const defaultTo = warehouses.find((w) => w.id !== defaultFrom)?.id || 'WH02';
    setFromWarehouseId(defaultFrom);
    setToWarehouseId(defaultTo);
    setTransferItems([]);
    setTransferNote('');
    setProductDropdownOpen(false);
    setProductSearchTerm('');
    setDebouncedSearchTerm('');
    try {
      window.history.pushState({}, '', '/stock-transfers/create');
    } catch {}
    setIsCreatingPage(true);
  };

  // Đóng trang tạo phiếu, quay lại danh sách
  const handleCloseCreatePage = () => {
    setProductDropdownOpen(false);
    setProductSearchTerm('');
    setDebouncedSearchTerm('');
    try {
      window.history.pushState({}, '', '/stock-transfers');
    } catch {}
    setIsCreatingPage(false);
  };

  // Thêm một sản phẩm vào danh sách chuyển
  const handleAddProductToTransfer = (prodIdStr: string) => {
    const pid = parseInt(prodIdStr, 10);
    if (!pid) return;
    const found = availableProducts.find((p) => p.product_id === pid);
    if (!found) return;

    if (transferItems.some((it) => it.product_id === pid)) {
      emitStatusToast({
        title: 'Trùng mặt hàng',
        message: 'Sản phẩm này đã có trong danh sách điều chuyển.',
        type: 'warning',
      });
      return;
    }

    setTransferItems((prev) => [
      ...prev,
      {
        product_id: found.product_id,
        product_code: found.product_code,
        product_name: found.product_name,
        category: found.category_name,
        unit: found.base_unit || 'Cái',
        available_stock: found.available_stock,
        transfer_qty: Math.min(1, found.available_stock),
      },
    ]);
  };

  const handleUpdateTransferQty = (index: number, qty: number) => {
    setTransferItems((prev) => {
      const next = [...prev];
      next[index].transfer_qty = Math.max(1, qty);
      return next;
    });
  };

  const handleRemoveTransferItem = (index: number) => {
    setTransferItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Xác nhận tạo và xuất chuyển kho
  const handleSubmitCreateTransfer = async () => {
    if (fromWarehouseId === toWarehouseId) {
      emitStatusToast({
        title: 'Kho không hợp lệ',
        message: 'Kho chuyển đi và kho tiếp nhận không được trùng nhau.',
        type: 'error',
      });
      return;
    }

    if (transferItems.length === 0) {
      emitStatusToast({
        title: 'Chưa chọn hàng',
        message: 'Vui lòng chọn ít nhất 1 sản phẩm để điều chuyển.',
        type: 'warning',
      });
      return;
    }

    // Kiểm tra tồn
    for (const it of transferItems) {
      if (it.transfer_qty > it.available_stock) {
        emitStatusToast({
          title: 'Vượt tồn khả dụng',
          message: `Sản phẩm '${it.product_name}' chỉ còn ${it.available_stock} tồn tại kho xuất, không thể chuyển ${it.transfer_qty}.`,
          type: 'error',
        });
        return;
      }
    }

    setCreating(true);
    try {
      await createStockTransferApi(token, {
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        items: transferItems.map((it) => ({
          product_id: it.product_id,
          transfer_qty: it.transfer_qty,
        })),
        note: transferNote.trim() || undefined,
      });

      emitStatusToast({
        title: 'Tạo phiếu thành công',
        message: 'Đã lập phiếu chuyển kho và trừ tồn kho xuất. Hàng đang trên đường!',
        type: 'success',
      });

      try {
        window.history.pushState({}, '', '/stock-transfers');
      } catch {}
      setIsCreatingPage(false);
      fetchTransfers();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lập phiếu thất bại',
        message: err.message || 'Đã xảy ra lỗi khi tạo phiếu chuyển kho.',
        type: 'error',
      });
    } finally {
      setCreating(false);
    }
  };

  // Mở modal nhận hàng (Kho đích)
  const handleOpenReceiveModal = (transfer: StockTransfer) => {
    setReceivingTransfer(transfer);
    setReceiveItems(
      (transfer.items || []).map((it) => ({
        product_id: it.product_id,
        product_code: it.product_code,
        product_name: it.product_name,
        unit: it.unit || 'Cái',
        transfer_qty: it.transfer_qty,
        received_qty: it.transfer_qty, // mặc định điền đủ
        reason: '',
      }))
    );
    setDiscrepancyReason('');
    setShowReceiveModal(true);
  };


  // Tính tổng chênh lệch hiện tại trong modal nhận
  const totalReceiveDiscrepancy = useMemo(() => {
    return receiveItems.reduce((acc, it) => {
      const numReceived = typeof it.received_qty === 'number' ? it.received_qty : (parseInt(it.received_qty || '0', 10) || 0);
      return acc + Math.abs(it.transfer_qty - numReceived);
    }, 0);
  }, [receiveItems]);

  // Xác nhận nhập hàng vào kho đích
  const handleSubmitReceiveTransfer = async () => {
    if (!receivingTransfer) return;

    if (totalReceiveDiscrepancy > 0 && !discrepancyReason.trim()) {
      emitStatusToast({
        title: 'Bắt buộc nhập lý do',
        message: `Phát hiện chênh lệch ${totalReceiveDiscrepancy} sản phẩm. Bạn bắt buộc phải nhập lý do chênh lệch!`,
        type: 'error',
      });
      return;
    }

    setSubmittingReceive(true);
    try {
      await receiveStockTransferApi(token, receivingTransfer.code, {
        items: receiveItems.map((it) => ({
          product_id: it.product_id,
          received_qty: typeof it.received_qty === 'number' ? it.received_qty : (parseInt(it.received_qty || '0', 10) || 0),
          reason: it.reason.trim() || undefined,
        })),
        discrepancy_reason: discrepancyReason.trim() || undefined,
      });

      emitStatusToast({
        title: 'Tiếp nhận thành công',
        message: `Đã nhập hàng thành công vào ${receivingTransfer.to_warehouse_name}! Số liệu tồn kho đã được cộng.`,
        type: 'success',
      });

      setShowReceiveModal(false);
      fetchTransfers();
    } catch (err: any) {
      emitStatusToast({
        title: 'Xác nhận thất bại',
        message: err.message || 'Lỗi trong quá trình tiếp nhận chuyển kho.',
        type: 'error',
      });
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Hủy phiếu chuyển kho
  const handleConfirmCancelTransfer = async () => {
    if (!cancellingCode) return;
    setCancelling(true);
    try {
      await cancelStockTransferApi(token, cancellingCode, cancelReasonInput.trim() || undefined);
      emitStatusToast({
        title: 'Đã hủy phiếu',
        message: `Phiếu chuyển kho ${cancellingCode} đã được hủy và hoàn trả tồn kho xuất.`,
        type: 'info',
      });
      setCancellingCode(null);
      setCancelReasonInput('');
      fetchTransfers();
    } catch (err: any) {
      emitStatusToast({
        title: 'Hủy phiếu thất bại',
        message: err.message || 'Không thể hủy phiếu chuyển kho này.',
        type: 'error',
      });
    } finally {
      setCancelling(false);
    }
  };

  // Mở modal xem chi tiết phiếu
  const handleOpenDetailModal = async (code: string) => {
    try {
      const data = await getStockTransferDetailApi(token, code);
      setDetailTransfer(data);
      setShowDetailModal(true);
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Không thể tải chi tiết phiếu.',
        type: 'error',
      });
    }
  };

  // Tính danh sách và số lượng hàng thiếu/dư trong modal chi tiết
  const detailShortages = useMemo(() => {
    if (!detailTransfer || !detailTransfer.items) return [];
    return detailTransfer.items.filter((it) => {
      if (it.received_qty !== null && it.received_qty !== undefined) {
        return it.transfer_qty > it.received_qty;
      }
      return it.discrepancy_qty > 0;
    });
  }, [detailTransfer]);

  const detailTotalShortage = useMemo(() => {
    return detailShortages.reduce((acc, it) => {
      if (it.received_qty !== null && it.received_qty !== undefined) {
        return acc + Math.max(0, it.transfer_qty - it.received_qty);
      }
      return acc + (it.discrepancy_qty > 0 ? it.discrepancy_qty : 0);
    }, 0);
  }, [detailShortages]);

  const detailTotalSurplus = useMemo(() => {
    if (!detailTransfer || !detailTransfer.items) return 0;
    return detailTransfer.items.reduce((acc, it) => {
      if (it.received_qty !== null && it.received_qty !== undefined && it.received_qty > it.transfer_qty) {
        return acc + (it.received_qty - it.transfer_qty);
      }
      return acc;
    }, 0);
  }, [detailTransfer]);

  // Khởi tạo modal giao bù hàng thiếu đúng số lượng thiếu
  const handleOpenCompensateModal = async (transfer: StockTransfer) => {
    const shortages = (transfer.items || []).filter((it) => {
      const shortage = it.discrepancy_qty > 0
        ? it.discrepancy_qty
        : (it.received_qty !== null && it.received_qty !== undefined && it.transfer_qty > it.received_qty
            ? it.transfer_qty - it.received_qty
            : 0);
      return shortage > 0;
    });

    if (shortages.length === 0) {
      emitStatusToast({
        title: 'Không có hàng thiếu',
        message: 'Đơn này đã nhận đủ 100%, không cần giao bù.',
        type: 'info',
      });
      return;
    }

    const totalShort = shortages.reduce((acc, it) => {
      const shortage = it.discrepancy_qty > 0
        ? it.discrepancy_qty
        : (it.received_qty !== null && it.received_qty !== undefined && it.transfer_qty > it.received_qty
            ? it.transfer_qty - it.received_qty
            : 0);
      return acc + shortage;
    }, 0);

    setCompensatingTransfer(transfer);
    setCompensateNote(`Giao bù hàng thiếu cho phiếu ${transfer.code} (${totalShort} SP)`);
    setShowCompensateModal(true);
    setLoadingCompensateStock(true);

    try {
      const stockBook = await getStockBookApi(token, { warehouse_id: transfer.from_warehouse_id });
      const stockMap = new Map<number, number>();
      (stockBook.items || []).forEach((sb) => {
        stockMap.set(sb.product_id, sb.available_stock);
      });

      const drafts: CompensateItemDraft[] = shortages.map((it) => {
        const shortage = it.discrepancy_qty > 0
          ? it.discrepancy_qty
          : (it.received_qty !== null && it.received_qty !== undefined && it.transfer_qty > it.received_qty
              ? it.transfer_qty - it.received_qty
              : 0);
        const avail = stockMap.get(it.product_id) ?? 0;
        return {
          product_id: it.product_id,
          product_code: it.product_code,
          product_name: it.product_name,
          unit: it.unit || 'Cái',
          shortage_qty: shortage,
          compensate_qty: shortage, // Đúng số lượng thiếu
          available_stock: avail,
        };
      });

      setCompensateItems(drafts);
    } catch {
      const drafts: CompensateItemDraft[] = shortages.map((it) => {
        const shortage = it.discrepancy_qty > 0
          ? it.discrepancy_qty
          : (it.received_qty !== null && it.received_qty !== undefined && it.transfer_qty > it.received_qty
              ? it.transfer_qty - it.received_qty
              : 0);
        return {
          product_id: it.product_id,
          product_code: it.product_code,
          product_name: it.product_name,
          unit: it.unit || 'Cái',
          shortage_qty: shortage,
          compensate_qty: shortage,
          available_stock: 999,
        };
      });
      setCompensateItems(drafts);
    } finally {
      setLoadingCompensateStock(false);
    }
  };

  const handleUpdateCompensateQty = (index: number, qty: number) => {
    setCompensateItems((prev) => {
      const next = [...prev];
      next[index].compensate_qty = Math.max(1, qty);
      return next;
    });
  };

  const handleSubmitCompensateTransfer = async () => {
    if (!compensatingTransfer) return;

    const validItems = compensateItems.filter((it) => it.compensate_qty > 0);
    if (validItems.length === 0) {
      emitStatusToast({
        title: 'Chưa có sản phẩm',
        message: 'Vui lòng nhập số lượng giao bù lớn hơn 0.',
        type: 'warning',
      });
      return;
    }

    for (const it of validItems) {
      if (it.compensate_qty > it.available_stock) {
        emitStatusToast({
          title: 'Vượt tồn khả dụng',
          message: `Sản phẩm '${it.product_name}' chỉ còn ${it.available_stock} tồn tại kho xuất, không thể giao bù ${it.compensate_qty}.`,
          type: 'error',
        });
        return;
      }
    }

    setSubmittingCompensate(true);
    try {
      const compNote = compensateNote.trim() || `Giao bù hàng thiếu cho phiếu ${compensatingTransfer.code}`;
      const finalNote = compNote.includes(`[GIAO_BU:${compensatingTransfer.code}]`)
        ? compNote
        : `[GIAO_BU:${compensatingTransfer.code}] ${compNote}`;

      const created = await createStockTransferApi(token, {
        from_warehouse_id: compensatingTransfer.from_warehouse_id,
        to_warehouse_id: compensatingTransfer.to_warehouse_id,
        items: validItems.map((it) => ({
          product_id: it.product_id,
          transfer_qty: it.compensate_qty,
        })),
        note: finalNote,
      });

      emitStatusToast({
        title: 'Lập phiếu giao bù thành công',
        message: `Đã tạo phiếu chuyển kho ${created.code} giao bù cho phiếu ${compensatingTransfer.code}! Hàng đang trên đường.`,
        type: 'success',
      });

      setShowCompensateModal(false);
      setShowDetailModal(false);
      fetchTransfers();
    } catch (err: any) {
      emitStatusToast({
        title: 'Giao bù thất bại',
        message: err.message || 'Lỗi khi tạo phiếu giao bù.',
        type: 'error',
      });
    } finally {
      setSubmittingCompensate(false);
    }
  };

  // Render badge trạng thái
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_TRANSIT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            Đang trên đường
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            Hoàn tất
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
            Bản nháp
          </span>
        );
    }
  };

  // NẾU ĐANG Ở CHẾ ĐỘ TRANG TẠO PHIẾU CHUYỂN KHO NỘI BỘ (FULL PAGE VIEW)
  if (isCreatingPage) {
    const fromWarehouseObj = warehouses.find((w) => w.id === fromWarehouseId);
    const toWarehouseObj = warehouses.find((w) => w.id === toWarehouseId);
    const totalItems = transferItems.length;
    const totalQty = transferItems.reduce((acc, it) => acc + (it.transfer_qty || 0), 0);
    const hasAnyOverStock = transferItems.some((it) => it.transfer_qty > it.available_stock);

    return (
      <div className="w-full min-h-full flex-1 flex flex-col p-4 md:p-6 bg-slate-100/60 overflow-y-auto">
        {/* ======================================================== */}
        {/* TOÀN BỘ PHIẾU CHUYỂN KHO LIỀN TRONG 1 KHUNG DUY NHẤT    */}
        {/* ======================================================== */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          {/* HEADER NẰM TRÊN CÙNG CỦA KHUNG */}
          <div className="px-6 py-4.5 border-b border-slate-200/80 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xs shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                  Lập phiếu chuyển kho nội bộ
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Điều chuyển hàng hóa giữa các kho • Người lập: <strong className="text-slate-700">{currentUser?.full_name || currentUser?.username || 'admin'}</strong> • Ngày lập: <strong className="text-slate-700">{new Date().toLocaleDateString('vi-VN')}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCloseCreatePage}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                <span>Quay lại</span>
              </button>
            </div>
          </div>

          {/* BỐ CỤC CHÍNH BÊN TRONG KHUNG: CỘT NHẬP LIỆU (1, 2, 3) VÀ CỘT TÓM TẮT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
            {/* CỘT TRÁI (8 CỘT): CÁC BƯỚC 1 -> 2 -> 3 LIỀN MẠCH */}
            <div className="lg:col-span-8 p-6 space-y-6">
              
              {/* 1. TUYẾN ĐIỀU CHUYỂN HÀNG HÓA */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-extrabold">1</span>
                    Tuyến điều chuyển hàng hóa
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* KHO GỬI */}
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 flex flex-col gap-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Kho gửi (Xuất đi) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-full border border-blue-200">
                        Kho xuất
                      </span>
                    </div>
                    <select
                      value={fromWarehouseId}
                      onChange={(e) => {
                        const newFrom = e.target.value;
                        setFromWarehouseId(newFrom);
                        setTransferItems([]);
                        if (toWarehouseId === newFrom) {
                          const nextTo = warehouses.find((w) => w.id !== newFrom);
                          if (nextTo) setToWarehouseId(nextTo.id);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer text-slate-900"
                    >
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.id})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Tồn kho thực tế tại kho này sẽ bị <b>trừ ngay</b> khi lập phiếu.
                    </p>
                  </div>

                  {/* KHO NHẬN */}
                  <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 flex flex-col gap-2 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Kho nhận (Đích đến) <span className="text-rose-500">*</span>
                      </label>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                        Kho nhận
                      </span>
                    </div>
                    <select
                      value={toWarehouseId}
                      onChange={(e) => setToWarehouseId(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs cursor-pointer text-slate-900"
                    >
                      {warehouses
                        .filter((w) => w.id !== fromWarehouseId)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} ({w.id})
                          </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                      <b>Chưa cộng tồn kho nhận</b> cho đến khi thủ kho đến bấm xác nhận đủ.
                    </p>
                  </div>
                </div>
              </div>

              {/* PHÂN CÁCH NHẸ GIỮA PHẦN 1 VÀ 2 */}
              <div className="border-t border-slate-100" />

              {/* 2. DANH SÁCH HÀNG HÓA ĐIỀU CHUYỂN */}
              <div className="space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-extrabold">2</span>
                    <h2 className="text-sm font-bold text-slate-800">Danh sách hàng hóa điều chuyển</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {totalItems} mặt hàng / {totalQty} sản phẩm
                    </span>
                  </div>
                  {loadingProducts && (
                    <span className="text-xs font-medium text-blue-600 flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                      Đang nạp tồn kho tại {fromWarehouseObj?.name || fromWarehouseId}...
                    </span>
                  )}
                </div>

                {/* Ô CHỌN SẢN PHẨM */}
                <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 flex flex-col gap-2.5 shadow-2xs" ref={productDropdownRef}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="w-full sm:w-auto text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap pl-1">
                      Chọn sản phẩm:
                    </div>
                    {/* Thanh chọn sản phẩm mở đổ xuống */}
                    <div
                      role="button"
                      tabIndex={0}
                      id="page-select-add-product"
                      className={`flex-1 w-full px-3.5 py-2.5 text-sm border rounded-xl bg-white focus:outline-none transition-all flex items-center justify-between cursor-pointer select-none text-slate-800 ${
                        productDropdownOpen
                          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                          : 'border-slate-300 hover:border-slate-400 shadow-2xs'
                      }`}
                      onClick={() => {
                        setProductDropdownOpen((prev) => !prev);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setProductDropdownOpen((prev) => !prev);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="text-slate-700 truncate text-xs sm:text-sm font-medium">
                          {productDropdownOpen
                            ? `Đang chọn sản phẩm tại ${fromWarehouseObj?.name || fromWarehouseId}`
                            : `-- Bấm vào đây để tìm và chọn sản phẩm tại ${fromWarehouseObj?.name || fromWarehouseId} --`}
                        </span>
                        {totalProductsCount > 0 && (
                          <span className="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2 py-0.5 rounded-full shrink-0">
                            {totalProductsCount} mặt hàng
                          </span>
                        )}
                      </div>
                      <svg
                        className={`w-4 h-4 text-slate-500 transition-transform flex-shrink-0 ml-2 ${
                          productDropdownOpen ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Danh sách sản phẩm: Tối ưu hiển thị rộng rãi, cuộn mượt mà, không bị che khuất cạnh màn hình */}
                  {productDropdownOpen && (
                    <div
                      className="w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col animate-in fade-in duration-150"
                    >
                      {/* Ô tìm kiếm nhanh với thông tin số lượng sản phẩm */}
                      <div className="p-3 border-b border-slate-200/80 bg-slate-50/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0 rounded-t-xl">
                        <div className="relative flex-1 flex items-center">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 z-10 text-slate-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            style={{ paddingLeft: '38px', paddingRight: '32px' }}
                            className="w-full py-2 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900 placeholder-slate-400 font-medium"
                            placeholder="Tìm nhanh theo mã SKU hoặc tên sản phẩm..."
                            value={productSearchTerm}
                            onChange={(e) => {
                              setProductSearchTerm(e.target.value);
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                          {productSearchTerm && (
                            <button
                              type="button"
                              className="absolute right-2.5 text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 cursor-pointer font-bold rounded z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                setProductSearchTerm('');
                                setDebouncedSearchTerm('');
                              }}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-2 text-[11px] text-slate-600 font-medium px-1">
                          <span>
                            Khả dụng: <b className="text-blue-700 font-bold">{totalProductsCount}</b> mặt hàng
                          </span>
                          <button
                            type="button"
                            onClick={() => setProductDropdownOpen(false)}
                            className="text-xs text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
                          >
                            Đóng lại ✕
                          </button>
                        </div>
                      </div>

                      {/* Danh sách sản phẩm cuộn mượt, chiều cao linh hoạt, không bị che khuất */}
                      <div
                        className="overflow-y-auto divide-y divide-slate-100"
                        style={{ maxHeight: '340px', minHeight: availableProducts.length === 0 ? '120px' : '160px' }}
                        onScroll={handleProductListScroll}
                      >
                        {loadingProducts ? (
                          <div className="p-8 flex items-center justify-center text-center text-xs text-slate-500 gap-2">
                            <span className="w-5 h-5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                            <span>
                              {debouncedSearchTerm
                                ? `Đang tìm kiếm "${debouncedSearchTerm}" từ máy chủ...`
                                : `Đang nạp tồn kho tại ${fromWarehouseObj?.name || fromWarehouseId}...`}
                            </span>
                          </div>
                        ) : availableProducts.length === 0 ? (
                          <div className="p-8 flex flex-col items-center justify-center text-center text-xs text-slate-500 gap-1.5">
                            <span className="text-2xl">📦</span>
                            <span className="font-semibold text-slate-700">
                              {debouncedSearchTerm
                                ? `Không tìm thấy sản phẩm nào khớp từ khóa "${debouncedSearchTerm}".`
                                : `Kho ${fromWarehouseObj?.name || fromWarehouseId} hiện không có sản phẩm nào khả dụng.`}
                            </span>
                            {productSearchTerm && (
                              <button
                                type="button"
                                onClick={() => {
                                  setProductSearchTerm('');
                                  setDebouncedSearchTerm('');
                                }}
                                className="text-blue-600 hover:underline mt-1 font-medium"
                              >
                                Xóa từ khóa tìm kiếm
                              </button>
                            )}
                          </div>
                        ) : (
                          availableProducts.map((p) => {
                            const isOut = p.available_stock <= 0;
                            const isAlreadyAdded = transferItems.some((it) => it.product_id === p.product_id);

                            return (
                              <div
                                key={p.product_id}
                                className={`px-4 py-3 text-xs flex items-center justify-between gap-3 transition-colors group cursor-pointer ${
                                  isOut
                                    ? 'bg-slate-50/70 opacity-60 cursor-not-allowed text-slate-400'
                                    : isAlreadyAdded
                                    ? 'bg-blue-50/50 hover:bg-blue-50/80 text-slate-800'
                                    : 'hover:bg-slate-50/90 text-slate-800'
                                }`}
                                onClick={() => {
                                  if (isOut) {
                                    emitStatusToast({
                                      title: 'Hết tồn kho',
                                      message: `Sản phẩm ${p.product_name} đã hết tồn tại kho này.`,
                                      type: 'warning',
                                    });
                                    return;
                                  }
                                  handleAddProductToTransfer(String(p.product_id));
                                  setProductDropdownOpen(false);
                                  setProductSearchTerm('');
                                  setDebouncedSearchTerm('');
                                }}
                              >
                                <div className="flex flex-col min-w-0 pr-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-emerald-700 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      {p.product_code}
                                    </span>
                                    <span className="font-bold text-slate-800 text-xs sm:text-sm" title={p.product_name}>
                                      {p.product_name}
                                    </span>
                                    {p.category_name && (
                                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                        {p.category_name}
                                      </span>
                                    )}
                                    {isAlreadyAdded && (
                                      <span className="text-[10px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded font-bold border border-blue-200">
                                        ✓ Đã có trong phiếu
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 flex-shrink-0 text-right">
                                  <div className="flex flex-col items-end">
                                    <span
                                      className={`font-bold text-xs ${
                                        isOut ? 'text-rose-500' : 'text-slate-800'
                                      }`}
                                    >
                                      Tồn: <b className="text-blue-700 text-sm">{p.available_stock}</b> {p.base_unit || 'Cái'}
                                    </span>
                                    {isOut && (
                                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded mt-0.5">
                                        Hết hàng
                                      </span>
                                    )}
                                  </div>

                                  {!isOut && (
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                                        isAlreadyAdded
                                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                          : 'bg-blue-600 text-white hover:bg-blue-700 group-hover:scale-105'
                                      }`}
                                    >
                                      {isAlreadyAdded ? 'Đã thêm' : '+ Thêm'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Thanh đếm số lượng & nút tải thêm */}
                      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 shrink-0 rounded-b-xl">
                        <span>
                          Đang hiển thị <b className="text-slate-800 font-bold">{availableProducts.length}</b> / <b className="text-slate-800 font-bold">{totalProductsCount}</b> sản phẩm
                        </span>
                        {availableProducts.length < totalProductsCount ? (
                          <button
                            type="button"
                            disabled={loadingMoreProducts}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoadMoreProducts();
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 hover:underline cursor-pointer bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {loadingMoreProducts ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                                <span>Đang tải thêm sản phẩm...</span>
                              </>
                            ) : (
                              <>
                                <span>Tải thêm sản phẩm</span>
                                <svg className="w-3.5 h-3.5 inline animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                </svg>
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            ✓ Đã hiển thị toàn bộ {totalProductsCount} sản phẩm
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* BẢNG CÁC SẢN PHẨM ĐÃ CHỌN */}
                {transferItems.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center flex flex-col items-center justify-center bg-slate-50/40">
                    <div className="font-semibold text-slate-700 text-sm">
                      Chưa có sản phẩm nào trong phiếu chuyển kho
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50/90 text-xs font-semibold text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-3.5 text-center w-12">#</th>
                            <th className="py-3 px-3.5 text-left">Sản phẩm</th>
                            <th className="py-3 px-3 text-center w-24">Đơn vị</th>
                            <th className="py-3 px-3 text-center w-28">Tồn khả dụng</th>
                            <th className="py-3 px-3 text-center w-36">SL chuyển</th>
                            <th className="py-3 px-3 text-center w-28">Tồn còn lại</th>
                            <th className="py-3 px-3 text-center w-16">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {transferItems.map((it, idx) => {
                            const isOver = it.transfer_qty > it.available_stock;
                            const remainingStock = Math.max(0, it.available_stock - it.transfer_qty);
                            return (
                              <tr key={it.product_id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 px-3.5 text-center text-xs text-slate-400 font-medium">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3.5">
                                  <div className="font-semibold text-slate-800 text-sm">
                                    {it.product_name}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                                      {it.product_code}
                                    </span>
                                    {it.category && (
                                      <span className="text-[11px] text-slate-400">
                                        • {it.category}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-center text-xs text-slate-700 font-semibold">
                                  {it.unit || 'Cái'}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                                    {it.available_stock}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <div className="inline-flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTransferQty(idx, Math.max(1, it.transfer_qty - 1))}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      max={it.available_stock}
                                      value={it.transfer_qty}
                                      onChange={(e) =>
                                        handleUpdateTransferQty(idx, parseInt(e.target.value, 10) || 1)
                                      }
                                      className={`w-20 text-center px-2 py-1.5 text-sm border rounded-lg font-bold focus:outline-none focus:ring-2 ${
                                        isOver
                                          ? 'border-rose-400 text-rose-600 bg-rose-50 ring-rose-200'
                                          : 'border-slate-300 focus:ring-blue-500 text-slate-900'
                                      }`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTransferQty(idx, it.transfer_qty + 1)}
                                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-sm transition-colors cursor-pointer"
                                    >
                                      +
                                    </button>
                                  </div>
                                  {isOver && (
                                    <div className="text-[11px] text-rose-600 font-bold mt-1">
                                      ⚠️ Vượt tồn ({it.available_stock})!
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center text-xs font-semibold text-slate-700">
                                  {isOver ? (
                                    <span className="text-rose-500 font-bold">0</span>
                                  ) : (
                                    remainingStock
                                  )}
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTransferItem(idx)}
                                    className="w-7 h-7 inline-flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors text-base font-bold cursor-pointer"
                                    title="Xóa khỏi phiếu"
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* PHÂN CÁCH NHẸ GIỮA PHẦN 2 VÀ 3 */}
              <div className="border-t border-slate-100" />

              {/* 3. GHI CHÚ ĐIỀU CHUYỂN */}
              <div className="space-y-2.5">
                <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-extrabold">3</span>
                  Ghi chú điều chuyển
                </h2>
                <textarea
                  rows={3}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="Nhập lý do điều chuyển hàng, thông tin lái xe, biển số xe vận chuyển hoặc các lưu ý khác..."
                  className="w-full p-3.5 text-xs text-slate-800 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-2xs font-medium"
                />
              </div>

            </div>

            {/* CỘT PHẢI (4 CỘT): TÓM TẮT PHIẾU CHUYỂN KHO */}
            <div className="lg:col-span-4 p-6 bg-slate-50/50 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-3 border-b border-slate-200/80">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  Tóm tắt phiếu chuyển kho
                </h2>

                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Kho xuất (gửi):</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {fromWarehouseObj?.name || fromWarehouseId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Kho nhập (nhận):</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {toWarehouseObj?.name || toWarehouseId}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Người lập phiếu:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {currentUser?.full_name || currentUser?.username || 'admin'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Ngày lập:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {new Date().toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Tổng mặt hàng:</span>
                    <span className="font-bold text-blue-700 text-sm">
                      {totalItems} mặt hàng
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-slate-200/60">
                    <span className="text-slate-500">Tổng số lượng xuất:</span>
                    <span className="font-bold text-indigo-700 text-base">
                      {totalQty} sản phẩm
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5">
                    <span className="text-slate-500">Trạng thái sau tạo:</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Đang trên đường
                    </span>
                  </div>
                </div>
              </div>

              {/* NÚT THAO TÁC CỘT PHẢI */}
              <div className="pt-4 border-t border-slate-200/80 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleSubmitCreateTransfer}
                  disabled={
                    creating ||
                    fromWarehouseId === toWarehouseId ||
                    transferItems.length === 0 ||
                    hasAnyOverStock
                  }
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {creating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Đang xử lý...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Xuất kho chuyển hàng</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCreatePage}
                  className="w-full py-2 px-4 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100/80 border border-slate-200 rounded-xl transition-all text-center cursor-pointer shadow-2xs"
                >
                  Hủy bỏ / Quay lại
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        margin: '0 auto',
        padding: '14px 18px',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        gap: '12px',
      }}
    >
      {/* HEADER SECTION */}
      <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">
            Chuyển kho nội bộ
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchTransfers()}
            className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-sm"
          >
            Làm mới
          </button>
          {canWriteInventory && (
            <button
              onClick={handleOpenCreatePage}
              className="px-4 py-2 text-xs font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg transition-all shadow-md hover:shadow-lg"
            >
              Lập phiếu chuyển kho
            </button>
          )}
        </div>
      </div>

      {/* METRICS STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
            Tổng số phiếu
          </div>
          <div className="text-xl font-bold text-slate-800 mt-0.5">{stats.total}</div>
        </div>
        <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-200/60 shadow-sm">
          <div className="text-[11px] font-medium text-amber-700 uppercase tracking-wider">
            Đang trên đường
          </div>
          <div className="text-xl font-bold text-amber-800 mt-0.5 flex items-center gap-2">
            {stats.inTransit}
            <span className="text-xs font-normal text-amber-600">chuyến</span>
          </div>
        </div>
        <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200/60 shadow-sm">
          <div className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider">
            Hoàn tất nhận hàng
          </div>
          <div className="text-xl font-bold text-emerald-800 mt-0.5">{stats.completed}</div>
        </div>
        <div className="bg-rose-50/50 p-3.5 rounded-xl border border-rose-200/60 shadow-sm">
          <div className="text-[11px] font-medium text-rose-700 uppercase tracking-wider">
            Có chênh lệch / Thất thoát
          </div>
          <div className="text-xl font-bold text-rose-800 mt-0.5 flex items-center gap-2">
            {stats.withDiscrepancy}
            <span className="text-xs font-normal text-rose-600">(phiếu)</span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
        <div className="flex-1 w-full md:w-auto relative">
          <input
            type="text"
            placeholder="Tìm theo mã phiếu, tên kho, sản phẩm hoặc người lập..."
            title="Tìm theo mã phiếu, tên kho, sản phẩm hoặc người lập..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              paddingLeft: '34px',
              paddingRight: '12px',
              height: '34px',
              fontSize: '12px',
              fontFamily: 'inherit',
              color: '#334155',
              backgroundColor: '#ffffff',
              borderColor: '#e2e8f0',
              borderRadius: '8px',
              boxSizing: 'border-box',
            }}
            className="w-full border focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              minWidth: '170px',
              height: '34px',
              fontSize: '12px',
              fontFamily: 'inherit',
              color: '#334155',
              backgroundColor: '#ffffff',
              borderColor: '#e2e8f0',
              borderRadius: '8px',
              padding: '0 12px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            className="border focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="IN_TRANSIT">Đang trên đường</option>
            <option value="COMPLETED">Hoàn tất</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            style={{
              minWidth: '170px',
              height: '34px',
              fontSize: '12px',
              fontFamily: 'inherit',
              color: '#334155',
              backgroundColor: '#ffffff',
              borderColor: '#e2e8f0',
              borderRadius: '8px',
              padding: '0 12px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
            className="border focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Tất cả các kho</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TRANSFERS DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
          <table className="w-full table-fixed text-left text-xs">
            <colgroup>
              <col style={{ width: '14%' }} />
              <col style={{ width: '19%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '15%' }} />
            </colgroup>
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="py-2.5 px-2.5 bg-slate-50">Mã phiếu</th>
                <th className="py-2.5 px-2.5 bg-slate-50">Tuyến điều chuyển</th>
                <th className="py-2.5 px-2 bg-slate-50 text-center">SL chuyển</th>
                <th className="py-2.5 px-2 bg-slate-50 text-center">Trạng thái</th>
                <th className="py-2.5 px-2.5 bg-slate-50">Người tạo & Ngày</th>
                <th className="py-2.5 px-2.5 bg-slate-50">Chênh lệch</th>
                <th className="py-2.5 px-2.5 bg-slate-50 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="animate-spin text-2xl mb-2">⏳</div>
                    Đang tải danh sách phiếu chuyển kho...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Không tìm thấy phiếu chuyển kho nào.
                  </td>
                </tr>
              ) : (
                pageItems.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-2.5 font-semibold text-blue-600">
                      <button
                        onClick={() => handleOpenDetailModal(t.code)}
                        className="hover:underline font-mono text-xs block truncate max-w-full text-left"
                        title={t.code}
                      >
                        {t.code}
                      </button>
                      {t.note && (
                        <div className="text-[11px] text-slate-400 font-normal mt-0.5 truncate max-w-full" title={t.note}>
                          {t.note}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5">
                      <div className="font-medium text-slate-800 text-xs truncate max-w-full" title={t.from_warehouse_name}>
                        {t.from_warehouse_name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate max-w-full" title={t.to_warehouse_name}>
                        <span className="text-slate-400 font-bold shrink-0">➔</span>
                        <span className="truncate">{t.to_warehouse_name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span className="font-semibold text-slate-800 text-xs">{t.total_transfer_qty}</span>
                      <span className="text-[11px] text-slate-400 ml-1">
                        ({t.total_items} SP)
                      </span>
                      {t.status === 'COMPLETED' && (
                        <div className="text-[11px] text-emerald-600 font-medium">
                          Đã nhận: {t.total_received_qty}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {renderStatusBadge(t.status)}
                    </td>
                    <td className="py-2.5 px-2.5 text-slate-600">
                      <div className="font-medium text-xs truncate max-w-full" title={t.created_by}>{t.created_by}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-full" title={new Date(t.created_at).toLocaleString('vi-VN')}>
                        {new Date(t.created_at).toLocaleString('vi-VN')}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5">
                      {t.status === 'COMPLETED' ? (
                        (() => {
                          const disc = getTransferDiscrepancyInfo(t);
                          if (!disc.hasDiscrepancy) {
                            return (
                              <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">
                                ✓ Nhận đủ 100%
                              </span>
                            );
                          }
                          const comp = getTransferCompensationStatus(t);
                          return (
                            <div className="text-xs flex flex-col gap-1 items-start">
                              {disc.shortage > 0 && (
                                comp.isFullyCompensated ? (
                                  <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block text-[11px]">
                                    Đã giao bù {disc.shortage} SP
                                  </span>
                                ) : comp.isCompensating ? (
                                  <span className="font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block text-[11px]">
                                    Đang giao bù {comp.inTransitCompensateQty} SP
                                  </span>
                                ) : (
                                  <span className="font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 inline-block text-[11px]">
                                    Hụt {disc.shortage} SP
                                  </span>
                                )
                              )}

                              {disc.surplus > 0 && (
                                <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block text-[11px]">
                                  Dư {disc.surplus} SP
                                </span>
                              )}

                              {t.discrepancy_reason && (
                                <div className="text-slate-600 mt-0.5 italic text-[11px] truncate max-w-full" title={t.discrepancy_reason}>
                                  "{t.discrepancy_reason}"
                                </div>
                              )}
                            </div>
                          );
                        })()
                      ) : t.status === 'IN_TRANSIT' ? (
                        <span className="text-xs text-amber-600 italic whitespace-nowrap">
                          Chờ kiểm đếm
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenDetailModal(t.code)}
                          className="px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Chi tiết
                        </button>

                        {canWriteInventory && t.status === 'IN_TRANSIT' && (
                          <>
                            <button
                              onClick={() => handleOpenReceiveModal(t)}
                              className="px-2 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm"
                            >
                              Nhận hàng
                            </button>
                            <button
                              onClick={() => setCancellingCode(t.code)}
                              className="px-2 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
                            >
                              Hủy
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Chân trang bảng: Khối phân trang liền thanh chuẩn theo thiết kế thu nhỏ giống hình 3 */}
        <div
          style={{
            padding: '8px 18px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'stretch',
              border: '1px solid #d1d5db',
              borderRadius: '5px',
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
              height: '24px',
            }}
          >
            {/* Danh sách các số trang */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push('...');
                }
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx, arr) => {
                const isLastItem = idx === arr.length - 1;
                if (typeof p === 'string') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      style={{
                        minWidth: '22px',
                        height: '100%',
                        padding: '0 4px',
                        borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                        background: '#ffffff',
                        color: '#6b7280',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        userSelect: 'none',
                      }}
                    >
                      ...
                    </span>
                  );
                }

                const isActive = p === safePage;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    style={{
                      minWidth: '24px',
                      height: '100%',
                      padding: '0 7px',
                      border: 'none',
                      borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                      background: isActive ? '#2ba1f4' : '#ffffff',
                      color: isActive ? '#ffffff' : '#374151',
                      cursor: isActive ? 'default' : 'pointer',
                      fontSize: '11.5px',
                      fontWeight: isActive ? '700' : '500',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    {p}
                  </button>
                );
              })}
          </div>
        </div>
      </div>



      {/* ============================================================== */}
      {/* MODAL 2: TIẾP NHẬN & XÁC NHẬN HÀNG (KHO ĐẾN)                  */}
      {/* ============================================================== */}
      {showReceiveModal && receivingTransfer && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Xác nhận nhận hàng chuyển kho: {receivingTransfer.code}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Tuyến: <b>{receivingTransfer.from_warehouse_name}</b> ➔{' '}
                    <b>{receivingTransfer.to_warehouse_name}</b>
                  </p>
                </div>
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto py-4 space-y-4 flex-1">

                {/* BẢNG KIỂM ĐẾM SỐ LƯỢNG */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Sản phẩm</th>
                        <th className="py-2.5 px-3 text-center">SL gửi đi</th>
                        <th className="py-2.5 px-3 text-center w-36">SL thực nhận</th>
                        <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {receiveItems.map((it, idx) => {
                        const numReceived = typeof it.received_qty === 'number' ? it.received_qty : (parseInt(it.received_qty || '0', 10) || 0);
                        const diff = numReceived - it.transfer_qty;
                        return (
                          <tr key={it.product_id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-800">
                                {it.product_name}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">
                                {it.product_code} ({it.unit})
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center font-semibold text-slate-700">
                              {it.transfer_qty}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={it.received_qty}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') {
                                    setReceiveItems((prev) => {
                                      const next = [...prev];
                                      next[idx].received_qty = '';
                                      return next;
                                    });
                                    return;
                                  }
                                  let clean = raw.replace(/\D/g, '');
                                  if (clean.length > 1 && clean.startsWith('0')) {
                                    clean = clean.replace(/^0+/, '') || '0';
                                  }
                                  setReceiveItems((prev) => {
                                    const next = [...prev];
                                    next[idx].received_qty = clean;
                                    return next;
                                  });
                                }}
                                onBlur={() => {
                                  setReceiveItems((prev) => {
                                    const next = [...prev];
                                    if (next[idx].received_qty === '') {
                                      next[idx].received_qty = 0;
                                    }
                                    return next;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    const current = typeof it.received_qty === 'number' ? it.received_qty : (parseInt(it.received_qty || '0', 10) || 0);
                                    setReceiveItems((prev) => {
                                      const next = [...prev];
                                      next[idx].received_qty = current + 1;
                                      return next;
                                    });
                                  } else if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    const current = typeof it.received_qty === 'number' ? it.received_qty : (parseInt(it.received_qty || '0', 10) || 0);
                                    setReceiveItems((prev) => {
                                      const next = [...prev];
                                      next[idx].received_qty = Math.max(0, current - 1);
                                      return next;
                                    });
                                  }
                                }}
                                className="w-24 text-center px-2 py-1 text-sm border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {diff === 0 ? (
                                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                  Đủ
                                </span>
                              ) : diff < 0 ? (
                                <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                  Hụt {Math.abs(diff)}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                  Dư +{diff}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* CẢNH BÁO VÀ Ô NHẬP LÝ DO CHÊNH LỆCH */}
                {totalReceiveDiscrepancy > 0 && (
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                      <span>⚠️</span> Phát hiện chênh lệch {totalReceiveDiscrepancy} sản phẩm!
                    </div>
                    <p className="text-xs text-rose-600">
                      Theo quy định kế toán & kho, bạn <b>bắt buộc phải giải trình lý do chênh lệch</b> (ví dụ: bị vỡ hỏng trong lúc chở, xe giao thiếu...) mới có thể hoàn tất nhận hàng.
                    </p>
                    <textarea
                      rows={2}
                      required
                      value={discrepancyReason}
                      onChange={(e) => setDiscrepancyReason(e.target.value)}
                      placeholder="* Nhập lý do chênh lệch chi tiết tại đây (BẮT BUỘC)..."
                      className="w-full px-3 py-2 text-sm border-2 border-rose-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Tồn kho sẽ được cộng chính xác bằng số lượng thực nhận vào{' '}
                  <b>{receivingTransfer.to_warehouse_name}</b>.
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowReceiveModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    onClick={handleSubmitReceiveTransfer}
                    disabled={
                      submittingReceive ||
                      (totalReceiveDiscrepancy > 0 && !discrepancyReason.trim())
                    }
                    className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-all shadow-md"
                  >
                    {submittingReceive ? 'Đang lưu...' : '✓ Xác nhận nhập kho'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: XEM CHI TIẾT PHIẾU CHUYỂN KHO                        */}
      {/* ============================================================== */}
      {showDetailModal && detailTransfer && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-slate-800">
                    Phiếu chuyển kho: {detailTransfer.code}
                  </h3>
                  {renderStatusBadge(detailTransfer.status)}
                </div>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto py-4 space-y-4 flex-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-xs">
                  <div>
                    <span className="text-slate-400 block">Kho xuất:</span>
                    <span className="font-semibold text-slate-800">
                      {detailTransfer.from_warehouse_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Kho nhận:</span>
                    <span className="font-semibold text-slate-800">
                      {detailTransfer.to_warehouse_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Người tạo phiếu:</span>
                    <span className="font-semibold text-slate-800">
                      {detailTransfer.created_by}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Ngày tạo:</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(detailTransfer.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  {detailTransfer.received_by && (
                    <div>
                      <span className="text-slate-400 block">Người tiếp nhận:</span>
                      <span className="font-semibold text-slate-800">
                        {detailTransfer.received_by}
                      </span>
                    </div>
                  )}
                  {detailTransfer.received_at && (
                    <div>
                      <span className="text-slate-400 block">Thời gian nhận:</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(detailTransfer.received_at).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  )}
                  {detailTransfer.note && (
                    <div className="col-span-2 md:col-span-4">
                      <span className="text-slate-400 block">Ghi chú xuất:</span>
                      <span className="text-slate-700 italic">{detailTransfer.note}</span>
                    </div>
                  )}
                  {detailTransfer.discrepancy_reason && (
                    <div className="col-span-2 md:col-span-4 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
                      <b>Lý do chênh lệch khi nhận:</b> "{detailTransfer.discrepancy_reason}"
                    </div>
                  )}

                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Mặt hàng</th>
                        <th className="py-2.5 px-3 text-center">SL gửi đi</th>
                        <th className="py-2.5 px-3 text-center">SL thực nhận</th>
                        <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(detailTransfer.items || []).map((it) => (
                        <tr key={it.product_id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{it.product_name}</div>
                            <div className="text-xs text-slate-400 font-mono">
                              {it.product_code} ({it.unit})
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold">
                            {it.transfer_qty}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {it.received_qty !== null && it.received_qty !== undefined ? (
                              <span className="font-semibold text-emerald-700">
                                {it.received_qty}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa nhận</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {(() => {
                              if (it.received_qty === null || it.received_qty === undefined) {
                                return <span className="text-slate-400">-</span>;
                              }
                              const diff = it.received_qty - it.transfer_qty;
                              if (diff > 0) {
                                return (
                                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    +{diff} (Dư)
                                  </span>
                                );
                              }
                              if (diff < 0) {
                                const shortageQty = Math.abs(diff);
                                return getTransferCompensationStatus(detailTransfer).isFullyCompensated ? (
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    Đã bù {shortageQty}
                                  </span>
                                ) : (
                                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    -{shortageQty} (Hụt)
                                  </span>
                                );
                              }
                              return <span className="text-xs text-emerald-600 font-medium">✓ Đủ</span>;
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {(() => {
                const comp = getTransferCompensationStatus(detailTransfer);
                return (
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {comp.isFullyCompensated ? (
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                          ✓ Đã giao bù đủ {detailTotalShortage} sản phẩm
                        </span>
                      ) : comp.isCompensating ? (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                          Đang giao bù {comp.inTransitCompensateQty} sản phẩm
                        </span>
                      ) : detailTotalShortage > 0 ? (
                        <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                          Thiếu {detailTotalShortage} sản phẩm
                        </span>
                      ) : null}

                      {detailTotalSurplus > 0 && (
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                          Dư {detailTotalSurplus} sản phẩm
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDetailModal(false)}
                        className="px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                      >
                        Đóng
                      </button>
                      {canWriteInventory &&
                        detailTransfer.status === 'COMPLETED' &&
                        detailTotalShortage > 0 &&
                        !comp.isFullyCompensated && (
                          <button
                            onClick={() => handleOpenCompensateModal(detailTransfer)}
                            className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 12h14" />
                              <path d="M12 5l7 7-7 7" />
                            </svg>
                            Giao bù hàng thiếu ({detailTotalShortage} SP)
                          </button>
                        )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: GIAO BÙ HÀNG THIẾU                                  */}
      {/* ============================================================== */}
      {showCompensateModal && compensatingTransfer && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200/80 p-6 max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Lập phiếu chuyển kho giao bù
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Giao bù hàng thiếu cho phiếu <b>{compensatingTransfer.code}</b>
                  </p>
                </div>
                <button
                  onClick={() => setShowCompensateModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto py-4 space-y-4 flex-1">
                {/* TUYẾN GIAO BÙ */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Kho gửi (Xuất bù)
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {compensatingTransfer.from_warehouse_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Kho nhận (Đang thiếu hàng)
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {compensatingTransfer.to_warehouse_name}
                    </span>
                  </div>
                </div>

                {/* BẢNG SẢN PHẨM GIAO BÙ */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Danh sách sản phẩm giao bù
                    </label>
                    {loadingCompensateStock && (
                      <span className="text-xs text-blue-600">Đang kiểm tra tồn kho xuất...</span>
                    )}
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Mặt hàng</th>
                          <th className="py-2.5 px-3 text-center">SL thiếu</th>
                          <th className="py-2.5 px-3 text-center">Tồn khả dụng kho gửi</th>
                          <th className="py-2.5 px-3 text-center w-32">SL giao bù</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {compensateItems.map((it, idx) => {
                          const isOver = it.compensate_qty > it.available_stock;
                          return (
                            <tr key={it.product_id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3">
                                <div className="font-semibold text-slate-800">{it.product_name}</div>
                                <div className="text-xs text-slate-400 font-mono">
                                  {it.product_code} ({it.unit})
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className="font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                                  {it.shortage_qty}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span className={`font-semibold ${it.available_stock < it.compensate_qty ? 'text-rose-600' : 'text-blue-600'}`}>
                                  {loadingCompensateStock ? '...' : it.available_stock}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  max={it.available_stock}
                                  value={it.compensate_qty}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) =>
                                    handleUpdateCompensateQty(idx, parseInt(e.target.value, 10) || 1)
                                  }
                                  className={`w-24 text-center px-2 py-1 text-sm border rounded-lg font-semibold focus:outline-none focus:ring-2 ${
                                    isOver
                                      ? 'border-rose-400 text-rose-600 bg-rose-50 ring-rose-200'
                                      : 'border-slate-200 focus:ring-blue-500'
                                  }`}
                                />
                                {isOver && (
                                  <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                                    Vượt tồn kho!
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* GHI CHÚ XUẤT BÙ */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Ghi chú phiếu giao bù
                  </label>
                  <input
                    type="text"
                    value={compensateNote}
                    onChange={(e) => setCompensateNote(e.target.value)}
                    placeholder="Nhập ghi chú giao bù..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* FOOTER */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCompensateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={loadingCompensateStock || submittingCompensate}
                  onClick={handleSubmitCompensateTransfer}
                  className="px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  {submittingCompensate ? 'Đang xuất chuyển bù...' : 'Xác nhận xuất giao bù'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: XÁC NHẬN HỦY PHIẾU CHUYỂN KHO                        */}
      {/* ============================================================== */}
      {cancellingCode && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                Xác nhận hủy phiếu chuyển kho?
              </h3>
              <p className="text-sm text-slate-600 mt-2">
                Bạn có chắc chắn muốn hủy phiếu <b>{cancellingCode}</b>? Số lượng hàng hóa đã xuất
                sẽ được <b>hoàn trả ngay lập tức</b> lại vào kho xuất ban đầu.
              </p>
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Lý do hủy (tùy chọn)
                </label>
                <input
                  type="text"
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Nhập lý do hủy điều chuyển..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setCancellingCode(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Không, quay lại
                </button>
                <button
                  onClick={handleConfirmCancelTransfer}
                  disabled={cancelling}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md"
                >
                  {cancelling ? 'Đang hủy...' : 'Đồng ý hủy'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default StockTransferManagementView;
