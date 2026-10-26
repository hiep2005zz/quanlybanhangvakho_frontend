import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StockAudit,
  StockAuditItem,
  getStockAuditsApi,
  getStockAuditDetailApi,
  getAuditWarehousesApi,
  previewAuditProductsApi,
  createStockAuditApi,
  updateStockAuditResultsApi,
  confirmStockAuditApi,
  cancelStockAuditApi,
  User,
  Category,
  getCategoryTreeApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface StockAuditManagementViewProps {
  token: string;
  currentUser?: User | null;
  initialSearchCode?: string;
  initialSearchProduct?: string;
}

export function StockAuditManagementView({ token, currentUser, initialSearchCode, initialSearchProduct }: StockAuditManagementViewProps) {
  // Xác định vai trò
  const userRoles = useMemo(() => {
    if (currentUser?.roles && currentUser.roles.length > 0) {
      return currentUser.roles;
    }
    return [currentUser?.role || ''];
  }, [currentUser]);

  // Quyền duyệt/xác nhận kiểm kê (hoàn tất và điều chỉnh tồn kho) và hủy phiếu:
  // CHỈ Quản trị hệ thống (admin) và Quản lý kho (warehouse_manager).
  const canConfirmAudit = useMemo(() => {
    return userRoles.some((r) => ['warehouse_manager', 'admin'].includes(r));
  }, [userRoles]);

  // Quyền tạo phiếu kiểm kê và cập nhật số lượng kiểm đếm thực tế (lưu tạm):
  // Cả Thủ kho (warehouse), Quản lý kho (warehouse_manager) và Quản trị hệ thống (admin).
  const canManageAudit = useMemo(() => {
    return userRoles.some((r) => ['warehouse', 'warehouse_manager', 'admin'].includes(r));
  }, [userRoles]);

  // State danh sách phiếu
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Danh sách các số trang theo phong cách segmented pill: 1, 2, ... totalPages
  const paginationItems = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    return Array.from({ length: totalPages }, (_, index) => index + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
      .reduce<(number | string)[]>((acc, p, idx, arr) => {
        if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
          acc.push('...');
        }
        acc.push(p);
        return acc;
      }, []);
  }, [totalPages, page]);

  // Bộ lọc
  const [searchCode, setSearchCode] = useState(initialSearchCode || '');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScope, setFilterScope] = useState('');
  const autoOpenedCodeRef = useRef<string | null>(null);

  // Tự động đồng bộ khi initialSearchCode được truyền vào (từ Thẻ kho)
  useEffect(() => {
    if (initialSearchCode !== undefined && initialSearchCode !== '') {
      setSearchCode(initialSearchCode);
      setPage(1);
    }
  }, [initialSearchCode]);

  // Danh mục kho & nhóm hàng
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Chế độ xem: 'list' (Danh sách phiếu), 'create' (Trang tạo phiếu mới), 'detail' (Trang chi tiết & nhập kiểm đếm)
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'detail'>('list');
  const [createScopeType, setCreateScopeType] = useState<'WAREHOUSE' | 'CATEGORY'>('WAREHOUSE');
  const [createWarehouseId, setCreateWarehouseId] = useState('WH01');
  const [createCategoryId, setCreateCategoryId] = useState<number | ''>('');
  const [createNote, setCreateNote] = useState('');
  const [createSearchProduct, setCreateSearchProduct] = useState('');
  const [createPreviewLoading, setCreatePreviewLoading] = useState(false);
  const [createPreviewItems, setCreatePreviewItems] = useState<any[]>([]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createPage, setCreatePage] = useState(1);
  const createPageSize = 20;
  const [createTotalItems, setCreateTotalItems] = useState(0);
  const [createTotalPages, setCreateTotalPages] = useState(1);
  const previewCacheRef = useRef<Record<string, { items: any[]; total_items: number; total_pages: number }>>({});
  const lastSearchRef = useRef('');

  // Chi tiết & Nhập kết quả
  const [selectedAudit, setSelectedAudit] = useState<StockAudit | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [auditItemsState, setAuditItemsState] = useState<StockAuditItem[]>([]);
  const [detailSearchProduct, setDetailSearchProduct] = useState('');
  const [detailPage, setDetailPage] = useState(1);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Modal Xác nhận kiểm kê
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);

  // Modal Hủy phiếu
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Tải danh mục nhóm hàng (chỉ lấy các nhóm hàng chính cấp 1 theo giao diện phẳng chuẩn)
  const fetchCategories = useCallback(async () => {
    try {
      const tree = await getCategoryTreeApi(token);
      const rootCategories: Category[] = (tree || []).map((it: any) => ({
        id: it.id,
        name: it.name,
        code: it.code,
        description: it.description,
        parent_id: it.parent_id,
        product_count: it.product_count,
        status: it.status,
      }));
      setCategories(rootCategories);
    } catch (err) {
      console.error('Lỗi nạp danh mục nhóm hàng:', err);
    }
  }, [token]);

  // Tải danh mục kho và nhóm hàng khi khởi động
  useEffect(() => {
    getAuditWarehousesApi(token)
      .then((whs) => {
        setWarehouses(whs);
        if (whs.length > 0 && !createWarehouseId) {
          setCreateWarehouseId(whs[0].id);
        }
      })
      .catch(() => {});

    fetchCategories();
  }, [token, fetchCategories]);

  // Tự động tải lại danh mục nếu mở trang tạo phiếu mà chưa có dữ liệu nhóm hàng
  useEffect(() => {
    if (viewMode === 'create' && categories.length === 0) {
      fetchCategories();
    }
  }, [viewMode, categories.length, fetchCategories]);

  // Tải danh sách phiếu kiểm kê
  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStockAuditsApi(token, {
        search: searchCode.trim() || undefined,
        warehouse_id: filterWarehouse || undefined,
        status: filterStatus || undefined,
        scope_type: filterScope || undefined,
        page,
        page_size: pageSize,
      });
      setAudits(res.items);
      setTotalCount(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      emitStatusToast({
        title: 'Lỗi tải danh sách',
        message: err instanceof Error ? err.message : 'Không thể tải danh sách phiếu kiểm kê',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [token, searchCode, filterWarehouse, filterStatus, filterScope, page, pageSize]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  // Xem trước danh sách sản phẩm khi tạo phiếu (phân trang tức thì, có bộ nhớ đệm cache và prefetch)
  useEffect(() => {
    if (viewMode !== 'create' || !createWarehouseId) return;
    if (createScopeType === 'CATEGORY' && !createCategoryId) {
      setCreatePreviewItems([]);
      setCreateTotalItems(0);
      setCreateTotalPages(1);
      return;
    }

    const searchTrimmed = createSearchProduct.trim();
    const isSearchChange = lastSearchRef.current !== searchTrimmed;
    lastSearchRef.current = searchTrimmed;

    const cacheKey = `${createWarehouseId}_${createScopeType}_${createCategoryId}_${searchTrimmed}_${createPage}`;

    // 1. Nếu trang đã có sẵn trong cache -> Chuyển sang trang khác NGAY LẬP TỨC (0ms), không loading xoay tròn
    if (previewCacheRef.current[cacheKey]) {
      const cached = previewCacheRef.current[cacheKey];
      setCreatePreviewItems(cached.items);
      setCreateTotalItems(cached.total_items);
      setCreateTotalPages(cached.total_pages);
      setCreatePreviewLoading(false);
      return;
    }

    // 2. Nếu chưa có trong cache:
    // Nếu gõ ô tìm kiếm -> debounce 200ms; nếu bấm chuyển trang -> gửi request ngay lập tức (0ms)
    const delay = isSearchChange ? 200 : 0;
    setCreatePreviewLoading(true);

    const timer = setTimeout(() => {
      previewAuditProductsApi(token, {
        warehouse_id: createWarehouseId,
        scope_type: createScopeType,
        category_id: createCategoryId ? Number(createCategoryId) : undefined,
        page: createPage,
        page_size: createPageSize,
        search: searchTrimmed || undefined,
      })
        .then((res) => {
          const totalItems = res.total_items ?? 0;
          const totalPages = res.total_pages ?? Math.max(1, Math.ceil(totalItems / createPageSize));
          const items = res.items || [];

          previewCacheRef.current[cacheKey] = {
            items,
            total_items: totalItems,
            total_pages: totalPages,
          };

          setCreatePreviewItems(items);
          setCreateTotalItems(totalItems);
          setCreateTotalPages(totalPages);

          // Tải trước (Prefetch) trang kế tiếp và trang trước vào cache để người dùng bấm trang nào là hiện luôn trang đó
          const nextPage = createPage + 1;
          const nextKey = `${createWarehouseId}_${createScopeType}_${createCategoryId}_${searchTrimmed}_${nextPage}`;
          if (nextPage <= totalPages && !previewCacheRef.current[nextKey]) {
            previewAuditProductsApi(token, {
              warehouse_id: createWarehouseId,
              scope_type: createScopeType,
              category_id: createCategoryId ? Number(createCategoryId) : undefined,
              page: nextPage,
              page_size: createPageSize,
              search: searchTrimmed || undefined,
            }).then((nextRes) => {
              previewCacheRef.current[nextKey] = {
                items: nextRes.items || [],
                total_items: nextRes.total_items ?? 0,
                total_pages: nextRes.total_pages ?? Math.max(1, Math.ceil((nextRes.total_items ?? 0) / createPageSize)),
              };
            }).catch(() => {});
          }

          const prevPage = createPage - 1;
          const prevKey = `${createWarehouseId}_${createScopeType}_${createCategoryId}_${searchTrimmed}_${prevPage}`;
          if (prevPage >= 1 && !previewCacheRef.current[prevKey]) {
            previewAuditProductsApi(token, {
              warehouse_id: createWarehouseId,
              scope_type: createScopeType,
              category_id: createCategoryId ? Number(createCategoryId) : undefined,
              page: prevPage,
              page_size: createPageSize,
              search: searchTrimmed || undefined,
            }).then((prevRes) => {
              previewCacheRef.current[prevKey] = {
                items: prevRes.items || [],
                total_items: prevRes.total_items ?? 0,
                total_pages: prevRes.total_pages ?? Math.max(1, Math.ceil((prevRes.total_items ?? 0) / createPageSize)),
              };
            }).catch(() => {});
          }
        })
        .catch(() => {
          setCreatePreviewItems([]);
          setCreateTotalItems(0);
          setCreateTotalPages(1);
        })
        .finally(() => {
          setCreatePreviewLoading(false);
        });
    }, delay);

    return () => clearTimeout(timer);
  }, [viewMode, createWarehouseId, createScopeType, createCategoryId, createPage, createSearchProduct, token]);

  // Thống kê nhanh từ danh sách
  const stats = useMemo(() => {
    let inProgress = 0;
    let confirmed = 0;
    let withDiscrepancy = 0;
    audits.forEach((a) => {
      if (a.status === 'IN_PROGRESS') inProgress++;
      if (a.status === 'CONFIRMED') confirmed++;
      if ((a.discrepancy_items_count || 0) > 0) withDiscrepancy++;
    });
    return {
      total: totalCount,
      inProgress,
      confirmed,
      withDiscrepancy,
    };
  }, [audits, totalCount]);

  // Mở trang chi tiết phiếu kiểm kê
  const handleOpenDetail = async (auditId: number, filterProduct?: string) => {
    setDetailLoading(true);
    setViewMode('detail');
    setDetailPage(1);
    if (filterProduct !== undefined) {
      setDetailSearchProduct(filterProduct);
    }
    try {
      const detail = await getStockAuditDetailApi(token, auditId);
      setSelectedAudit(detail);
      setAuditItemsState(detail.items || []);
    } catch (err) {
      emitStatusToast({
        title: 'Lỗi',
        message: err instanceof Error ? err.message : 'Không thể tải chi tiết phiếu',
        type: 'error',
      });
      setViewMode('list');
      setSelectedAudit(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Tự động mở thẳng màn hình chi tiết phiếu kiểm kê và lọc sản phẩm tương ứng khi truy nguyên từ Thẻ kho
  useEffect(() => {
    if (!initialSearchCode || audits.length === 0) return;
    if (autoOpenedCodeRef.current === initialSearchCode) return;

    const matchedAudit = audits.find(
      (a) => a.code.trim().toUpperCase() === initialSearchCode.trim().toUpperCase()
    );

    if (matchedAudit) {
      autoOpenedCodeRef.current = initialSearchCode;
      handleOpenDetail(matchedAudit.id, initialSearchProduct || '');
    }
  }, [audits, initialSearchCode, initialSearchProduct]);

  // Cập nhật giá trị nhập thực tế trong bảng kiểm đếm
  const handleItemActualStockChange = (productId: number, valStr: string) => {
    const val = valStr === '' ? null : Math.max(0, parseInt(valStr, 10) || 0);
    setAuditItemsState((prev) =>
      prev.map((item) => {
        if (item.product_id !== productId) return item;
        const disc = val !== null ? val - item.system_stock : null;
        let resStatus: StockAuditItem['result_status'] = 'PENDING';
        let resLabel = 'Chưa kiểm';
        if (val !== null) {
          if (disc === 0) {
            resStatus = 'MATCH';
            resLabel = 'Khớp';
          } else if (disc! < 0) {
            resStatus = 'DEFICIT';
            resLabel = `Thiếu ${Math.abs(disc!)} ${item.base_unit}`;
          } else {
            resStatus = 'SURPLUS';
            resLabel = `Thừa ${disc} ${item.base_unit}`;
          }
        }
        return {
          ...item,
          actual_stock: val,
          discrepancy: disc,
          result_status: resStatus,
          result_label: resLabel,
        };
      })
    );
  };

  // Cập nhật lý do chênh lệch
  const handleItemReasonChange = (productId: number, reason: string) => {
    setAuditItemsState((prev) =>
      prev.map((item) => (item.product_id === productId ? { ...item, reason } : item))
    );
  };

  // Lưu nháp kết quả kiểm đếm
  const handleSaveDraft = async () => {
    if (!selectedAudit || isSavingDraft) return;
    setIsSavingDraft(true);
    try {
      const itemsPayload = auditItemsState.map((it) => ({
        product_id: it.product_id,
        actual_stock: it.actual_stock ?? null,
        reason: it.reason || undefined,
      }));
      const updated = await updateStockAuditResultsApi(token, selectedAudit.id, {
        items: itemsPayload,
      });
      setSelectedAudit(updated);
      setAuditItemsState(updated.items || []);
      emitStatusToast({
        title: 'Thành công',
        message: 'Đã lưu kết quả kiểm đếm tạm thời.',
        type: 'success',
      });
      fetchAudits();
    } catch (err) {
      emitStatusToast({
        title: 'Lỗi lưu nháp',
        message: err instanceof Error ? err.message : 'Không thể lưu kết quả',
        type: 'error',
      });
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Xử lý tạo phiếu mới
  const handleCreateAudit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmittingCreate) return;
    if (createScopeType === 'CATEGORY' && !createCategoryId) {
      emitStatusToast({
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn nhóm hàng cần kiểm kê.',
        type: 'warning',
      });
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const newAudit = await createStockAuditApi(token, {
        scope_type: createScopeType,
        warehouse_id: createWarehouseId,
        category_id: createCategoryId ? Number(createCategoryId) : null,
        note: createNote.trim() || undefined,
      });

      emitStatusToast({
        title: 'Tạo phiếu thành công',
        message: `Đã tạo phiếu kiểm kê ${newAudit.code} với ${newAudit.total_items} sản phẩm.`,
        type: 'success',
      });

      setViewMode('list');
      setCreateNote('');
      setCreateSearchProduct('');
      fetchAudits();

      // Mở ngay chi tiết phiếu vừa tạo
      handleOpenDetail(newAudit.id);
    } catch (err) {
      emitStatusToast({
        title: 'Lỗi tạo phiếu',
        message: err instanceof Error ? err.message : 'Không thể tạo phiếu kiểm kê',
        type: 'error',
      });
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Kiểm tra trước khi mở popup xác nhận điều chỉnh
  const handlePreConfirm = () => {
    if (!selectedAudit) return;

    // Kiểm tra đã kiểm đếm ít nhất 1 sản phẩm chưa
    const countedItems = auditItemsState.filter(
      (it) => it.actual_stock !== null && it.actual_stock !== undefined
    );
    if (countedItems.length === 0) {
      emitStatusToast({
        title: 'Chưa có sản phẩm kiểm đếm',
        message: 'Vui lòng nhập số lượng thực tế cho ít nhất 1 sản phẩm trước khi xác nhận!',
        type: 'warning',
      });
      return;
    }

    // Kiểm tra các dòng có chênh lệch đã có lý do chưa (chỉ xét các sản phẩm ĐÃ KIỂM ĐẾM)
    const missingReason = countedItems.filter(
      (it) => it.discrepancy !== null && it.discrepancy !== 0 && (!it.reason || !it.reason.trim())
    );
    if (missingReason.length > 0) {
      emitStatusToast({
        title: 'Thiếu lý do chênh lệch',
        message: `Bắt buộc nhập lý do cho ${missingReason.length} sản phẩm có chênh lệch đã kiểm đếm.`,
        type: 'warning',
      });
      return;
    }

    setIsConfirmModalOpen(true);
  };

  // Xác nhận điều chỉnh tồn kho
  const handleConfirmAudit = async () => {
    if (!selectedAudit || isSubmittingConfirm) return;
    setIsSubmittingConfirm(true);
    try {
      const itemsPayload = auditItemsState.map((it) => ({
        product_id: it.product_id,
        // Nếu chưa kiểm đếm, gửi đúng system_stock để giữ nguyên tồn kho hệ thống (không chênh lệch)
        actual_stock: it.actual_stock !== null && it.actual_stock !== undefined ? it.actual_stock : it.system_stock,
        reason: it.reason || undefined,
      }));

      const confirmedAudit = await confirmStockAuditApi(token, selectedAudit.id, {
        items: itemsPayload,
      });

      setSelectedAudit(confirmedAudit);
      setAuditItemsState(confirmedAudit.items || []);
      setIsConfirmModalOpen(false);

      emitStatusToast({
        title: 'Xác nhận kiểm kê thành công',
        message: `Phiếu ${confirmedAudit.code} đã hoàn tất và điều chỉnh tồn kho thành công!`,
        type: 'success',
      });

      fetchAudits();
    } catch (err) {
      emitStatusToast({
        title: 'Lỗi xác nhận kiểm kê',
        message: err instanceof Error ? err.message : 'Không thể xác nhận phiếu',
        type: 'error',
      });
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // Hủy phiếu kiểm kê
  const handleCancelAudit = async () => {
    if (!selectedAudit || isSubmittingCancel) return;
    setIsSubmittingCancel(true);
    try {
      const cancelledAudit = await cancelStockAuditApi(token, selectedAudit.id, cancelReason);
      setSelectedAudit(cancelledAudit);
      setAuditItemsState(cancelledAudit.items || []);
      setIsCancelModalOpen(false);
      setCancelReason('');

      emitStatusToast({
        title: 'Đã hủy phiếu',
        message: `Phiếu kiểm kê ${cancelledAudit.code} đã được chuyển sang trạng thái Hủy.`,
        type: 'success',
      });

      fetchAudits();
    } catch (err) {
      emitStatusToast({
        title: 'Lỗi hủy phiếu',
        message: err instanceof Error ? err.message : 'Không thể hủy phiếu',
        type: 'error',
      });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  // Lọc sản phẩm trong modal chi tiết
  const filteredDetailItems = useMemo(() => {
    if (!detailSearchProduct.trim()) return auditItemsState;
    const kw = detailSearchProduct.toLowerCase().trim();
    return auditItemsState.filter(
      (it) =>
        it.product_name.toLowerCase().includes(kw) ||
        it.product_code.toLowerCase().includes(kw) ||
        (it.category_name && it.category_name.toLowerCase().includes(kw))
    );
  }, [auditItemsState, detailSearchProduct]);

  const detailPageSize = 10;
  const detailTotalPages = Math.max(1, Math.ceil(filteredDetailItems.length / detailPageSize));
  const safeDetailPage = Math.min(detailPage, detailTotalPages);

  const paginatedDetailItems = useMemo(() => {
    const start = (safeDetailPage - 1) * detailPageSize;
    return filteredDetailItems.slice(start, start + detailPageSize);
  }, [filteredDetailItems, safeDetailPage]);

  // Phân trang segmented pill trong chi tiết phiếu
  const detailPaginationItems = useMemo(() => {
    if (detailTotalPages <= 5) {
      return Array.from({ length: detailTotalPages }, (_, index) => index + 1);
    }
    return Array.from({ length: detailTotalPages }, (_, index) => index + 1)
      .filter((p) => p === 1 || p === detailTotalPages || Math.abs(p - safeDetailPage) <= 1)
      .reduce<(number | string)[]>((acc, p, idx, arr) => {
        if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
          acc.push('...');
        }
        acc.push(p);
        return acc;
      }, []);
  }, [detailTotalPages, safeDetailPage]);

  // Thống kê trong modal chi tiết
  const detailStats = useMemo(() => {
    let matchCount = 0;
    let deficitCount = 0;
    let surplusCount = 0;
    let pendingCount = 0;
    let totalDeficitQty = 0;
    let totalSurplusQty = 0;

    auditItemsState.forEach((it) => {
      if (it.actual_stock === null || it.actual_stock === undefined) {
        pendingCount++;
      } else if (it.discrepancy === 0) {
        matchCount++;
      } else if (it.discrepancy! < 0) {
        deficitCount++;
        totalDeficitQty += Math.abs(it.discrepancy!);
      } else {
        surplusCount++;
        totalSurplusQty += it.discrepancy!;
      }
    });

    const countedCount = auditItemsState.length - pendingCount;

    return {
      total: auditItemsState.length,
      matchCount,
      deficitCount,
      surplusCount,
      pendingCount,
      countedCount,
      totalDeficitQty,
      totalSurplusQty,
    };
  }, [auditItemsState]);

  // =========================================================
  // GIAO DIỆN TRANG TẠO PHIẾU KIỂM KÊ (FULL PAGE VIEW)
  // =========================================================
  if (viewMode === 'create') {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '1680px',
          margin: '0 auto',
          padding: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          gap: '12px',
        }}
      >
        {/* Header Trang Tạo Phiếu */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-200 shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setCreateNote('');
                setCreatePreviewItems([]);
                setCreateSearchProduct('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer border-0"
              title="Quay lại danh sách phiếu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Quay lại</span>
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0fad89]" />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Tạo phiếu kiểm kê kho
                </h1>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Chốt số lượng tồn kho căn cứ tại thời điểm tạo phiếu cho phạm vi được chọn làm căn cứ đối soát
              </p>
            </div>
          </div>

          {/* Action buttons góc trên */}
          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setCreateNote('');
                setCreatePreviewItems([]);
                setCreateSearchProduct('');
              }}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer border border-gray-300 bg-white transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              id="btn-submit-create-audit-page"
              onClick={() => handleCreateAudit()}
              disabled={isSubmittingCreate || createTotalItems === 0}
              className="px-5 py-2 text-xs font-bold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-lg shadow-sm disabled:opacity-50 cursor-pointer border-0 transition-all flex items-center gap-2"
            >
              {isSubmittingCreate ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang tạo phiếu...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Xác nhận tạo phiếu</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Thân trang: 2 Cột */}
        <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 pb-2">
          {/* Cột trái: Cấu hình phiếu kiểm kê (4 cột) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                <span className="w-2 h-2 rounded-full bg-[#0fad89]" />
                <h3 className="text-sm font-bold text-gray-900">1. Thông tin đợt kiểm kê</h3>
              </div>

              {/* 1. Chọn phạm vi kiểm kê */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Phạm vi kiểm kê <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      createScopeType === 'WAREHOUSE'
                        ? 'border-[#0fad89] bg-emerald-50/60 text-[#0fad89] font-bold shadow-xs ring-1 ring-[#0fad89]'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope_type_page"
                      value="WAREHOUSE"
                      checked={createScopeType === 'WAREHOUSE'}
                      onChange={() => {
                        setCreateScopeType('WAREHOUSE');
                        setCreatePage(1);
                      }}
                      className="text-[#0fad89] focus:ring-[#0fad89] mt-0.5"
                    />
                    <div>
                      <div className="font-bold">Theo kho</div>
                      <div className="text-[11px] text-gray-500 font-normal mt-0.5">Kiểm kê toàn bộ sản phẩm trong kho</div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      createScopeType === 'CATEGORY'
                        ? 'border-[#0fad89] bg-emerald-50/60 text-[#0fad89] font-bold shadow-xs ring-1 ring-[#0fad89]'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scope_type_page"
                      value="CATEGORY"
                      checked={createScopeType === 'CATEGORY'}
                      onChange={() => {
                        setCreateScopeType('CATEGORY');
                        setCreateCategoryId('');
                        setCreatePreviewItems([]);
                        setCreateTotalItems(0);
                        setCreatePage(1);
                      }}
                      className="text-[#0fad89] focus:ring-[#0fad89] mt-0.5"
                    />
                    <div>
                      <div className="font-bold">Theo nhóm hàng</div>
                      <div className="text-[11px] text-gray-500 font-normal mt-0.5">Chỉ kiểm kê một nhóm hàng cụ thể</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* 2. Chọn kho áp dụng */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Kho áp dụng kiểm kê <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-create-warehouse-page"
                  value={createWarehouseId}
                  onChange={(e) => {
                    setCreateWarehouseId(e.target.value);
                    setCreatePage(1);
                  }}
                  required
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white font-medium text-gray-800"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.id})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-500 mt-1.5">
                  Số lượng tồn căn cứ sẽ được chốt trực tiếp từ số liệu tại kho này.
                </p>
              </div>

              {/* 3. Chọn nhóm hàng (nếu CATEGORY) */}
              {createScopeType === 'CATEGORY' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Nhóm hàng cần kiểm kê <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-create-category-page"
                    value={createCategoryId}
                    onChange={(e) => {
                      setCreateCategoryId(e.target.value ? Number(e.target.value) : '');
                      setCreatePage(1);
                    }}
                    required
                    className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white text-gray-800"
                  >
                    <option value="">-- Chọn nhóm hàng --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* 4. Thông tin người lập & thời điểm */}
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-xs flex flex-col gap-1.5 text-gray-600">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Người lập phiếu:</span>
                  <span className="font-semibold text-gray-900">{currentUser?.full_name || currentUser?.username || 'Thủ kho'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Vai trò:</span>
                  <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {currentUser?.role_title || currentUser?.role || 'Thủ kho'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Thời điểm chốt tồn:</span>
                  <span className="font-medium text-gray-800">{new Date().toLocaleString('vi-VN')}</span>
                </div>
              </div>

              {/* 5. Ghi chú chung */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Ghi chú đợt kiểm kê
                </label>
                <textarea
                  id="textarea-create-note-page"
                  value={createNote}
                  onChange={(e) => setCreateNote(e.target.value)}
                  placeholder="Ví dụ: Kiểm kê định kỳ tháng 10, kiểm tra nhóm hàng gia dụng..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Cột phải: Xem trước danh sách sản phẩm thuộc phạm vi (8 cột) */}
          <div className="lg:col-span-8 flex flex-col min-h-0 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            {/* Header của bảng xem trước */}
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50/60 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-[#0fad89]" />
                <h3 className="text-sm font-bold text-gray-900">2. Danh sách sản phẩm chốt tồn căn cứ</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {createTotalItems} mặt hàng
                </span>
              </div>

              {/* Ô tìm kiếm trong danh sách xem trước */}
              <div className="relative w-full sm:w-72">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Tìm mã hoặc tên sản phẩm..."
                  value={createSearchProduct}
                  onChange={(e) => {
                    setCreateSearchProduct(e.target.value);
                    setCreatePage(1);
                  }}
                  style={{ paddingLeft: '36px' }}
                  className="w-full pr-8 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-[#0fad89] bg-white transition-all shadow-xs"
                />
                {createSearchProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateSearchProduct('');
                      setCreatePage(1);
                    }}
                    className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                    title="Xóa tìm kiếm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Bảng danh sách sản phẩm */}
            <div className="flex-1 min-h-[300px] overflow-y-auto relative">
              {/* Thanh tiến trình loading mảnh ở mép trên (không che bảng hay xoay tròn) */}
              {createPreviewLoading && (
                <div className="sticky top-0 left-0 right-0 h-0.5 bg-[#0fad89] animate-pulse z-20" />
              )}
              {createPreviewItems.length === 0 ? (
                <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center h-full">
                  <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <span className="text-xs font-medium">
                    {createScopeType === 'CATEGORY' && !createCategoryId
                      ? 'Vui lòng chọn nhóm hàng để xem danh sách sản phẩm cần kiểm kê'
                      : 'Không có sản phẩm nào thuộc phạm vi đã chọn'}
                  </span>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-100 text-gray-700 uppercase font-semibold text-[11px] sticky top-0 z-10 border-b border-gray-200">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-12">STT</th>
                      <th className="py-2.5 px-3 w-28">Mã SP</th>
                      <th className="py-2.5 px-3">Tên sản phẩm</th>
                      <th className="py-2.5 px-3 w-24 text-center">ĐVT</th>
                      <th className="py-2.5 px-3 w-28 text-center bg-emerald-50 text-emerald-900 font-bold">Tồn chốt</th>
                      <th className="py-2.5 px-3 w-24 text-center text-gray-600">Giữ chỗ</th>
                      <th className="py-2.5 px-3 w-24 text-center text-gray-600">Khả dụng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {createPreviewItems.map((p, idx) => {
                      const stt = (createPage - 1) * createPageSize + idx + 1;
                      return (
                        <tr key={p.product_id} className="hover:bg-emerald-50/30 transition-colors">
                          <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">{stt}</td>
                          <td className="py-2.5 px-3 font-semibold text-gray-900 font-mono">{p.product_code}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-gray-900">{p.product_name}</div>
                            {p.category_name && (
                              <div className="text-[10px] text-gray-500 mt-0.5">{p.category_name}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center text-gray-600 font-medium">{p.base_unit || 'Cái'}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-gray-900 bg-emerald-50/40 text-sm">
                            {p.system_stock}
                          </td>
                          <td className="py-2.5 px-3 text-center text-gray-500 font-medium">
                            {p.reserved_stock ?? 0}
                          </td>
                          <td className="py-2.5 px-3 text-center font-semibold text-emerald-700">
                            {p.available_stock ?? p.system_stock}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer của bảng xem trước kèm bộ phân trang 20 SP/trang */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 text-xs flex items-center justify-between gap-3 text-gray-600 shrink-0">
              <div className="text-[11px] text-gray-500 font-medium">
                Trang {createPage} / {createTotalPages} ({createTotalItems.toLocaleString('vi-VN')} mặt hàng)
              </div>

              {/* Điều khiển phân trang */}
              {createTotalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCreatePage(1)}
                    disabled={createPage <= 1}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 transition-colors font-mono cursor-pointer"
                    title="Trang đầu"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatePage((p) => Math.max(1, p - 1))}
                    disabled={createPage <= 1}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 transition-colors cursor-pointer"
                    title="Trang trước"
                  >
                    ‹ Trước
                  </button>

                  {/* Danh sách các nút số trang */}
                  {Array.from({ length: createTotalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === createTotalPages || Math.abs(p - createPage) <= 2)
                    .reduce((acc: (number | string)[], p, i, arr) => {
                      if (i > 0 && p - (arr[i - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      typeof item === 'string' ? (
                        <span key={`dots-${idx}`} className="px-1 text-gray-400">
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCreatePage(item)}
                          className={`min-w-[28px] h-7 px-1.5 text-xs rounded border transition-colors font-medium cursor-pointer ${
                            createPage === item
                              ? 'bg-[#0fad89] text-white border-[#0fad89] font-bold shadow-xs'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}

                  <button
                    type="button"
                    onClick={() => setCreatePage((p) => Math.min(createTotalPages, p + 1))}
                    disabled={createPage >= createTotalPages}
                    className="px-2.5 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 transition-colors cursor-pointer"
                    title="Trang sau"
                  >
                    Sau ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatePage(createTotalPages)}
                    disabled={createPage >= createTotalPages}
                    className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed bg-gray-100 transition-colors font-mono cursor-pointer"
                    title="Trang cuối"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // GIAO DIỆN TRANG CHI TIẾT & KIỂM ĐẾM (FULL PAGE VIEW)
  // =========================================================
  if (viewMode === 'detail' && selectedAudit) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '1680px',
          margin: '0 auto',
          padding: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          gap: '12px',
        }}
      >
        {/* Header Trang Chi Tiết */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-200 shrink-0 bg-white px-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setViewMode('list');
                setSelectedAudit(null);
                setDetailSearchProduct('');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer border-0"
              title="Quay lại danh sách phiếu"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Quay lại</span>
            </button>
            <div className="h-6 w-px bg-gray-200 hidden sm:block" />
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Phiếu kiểm kê {selectedAudit.code}
                </h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    selectedAudit.status === 'CONFIRMED'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : selectedAudit.status === 'CANCELLED'
                      ? 'bg-gray-100 text-gray-700 border border-gray-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {selectedAudit.status_label}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                <span><strong>Kho:</strong> {selectedAudit.warehouse_name}</span>
                <span><strong>Phạm vi:</strong> {selectedAudit.scope_type === 'CATEGORY' ? `Nhóm hàng: ${selectedAudit.category_name}` : 'Toàn kho'}</span>
                <span><strong>Người tạo:</strong> {selectedAudit.created_by} ({new Date(selectedAudit.created_at).toLocaleString('vi-VN')})</span>
                {selectedAudit.confirmed_by && (
                  <span className="text-emerald-700 font-semibold">
                    <strong>Người xác nhận:</strong> {selectedAudit.confirmed_by} ({new Date(selectedAudit.confirmed_at!).toLocaleString('vi-VN')})
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Khung nội dung chi tiết: Thanh tìm kiếm/thống kê và Bảng kiểm đếm gộp chung 1 khối */}
        <div className="flex-1 min-h-0 bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
          {/* Thanh tìm kiếm sản phẩm & Thẻ tóm tắt nhanh kết quả */}
          <div className="p-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs shrink-0 bg-white">
            {/* Ô tìm kiếm được đưa lên trước */}
            <div className="relative w-full sm:w-80 shrink-0">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm trong phiếu..."
                value={detailSearchProduct}
                onChange={(e) => setDetailSearchProduct(e.target.value)}
                style={{ paddingLeft: '36px' }}
                className="w-full h-9 pr-8 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white text-gray-800 placeholder-gray-400 transition-all shadow-2xs"
              />
              {detailSearchProduct && (
                <button
                  type="button"
                  onClick={() => setDetailSearchProduct('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Thẻ tóm tắt nhanh kết quả */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 sm:justify-end">
              <span className="font-semibold text-gray-700">
                Tổng: <strong>{detailStats.total} SP</strong>
              </span>
              <span className="text-green-600 font-semibold">
                Khớp: <strong>{detailStats.matchCount}</strong>
              </span>
              <span className="text-rose-600 font-semibold">
                Thiếu: <strong>{detailStats.deficitCount} SP</strong> ({detailStats.totalDeficitQty} ĐVT)
              </span>
              <span className="text-blue-600 font-semibold">
                Thừa: <strong>{detailStats.surplusCount} SP</strong> (+{detailStats.totalSurplusQty} ĐVT)
              </span>
              {detailStats.pendingCount > 0 && (
                <span className="text-amber-600 font-bold">
                  Chưa đếm: {detailStats.pendingCount} SP
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {detailLoading ? (
              <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                <div className="w-8 h-8 border-3 border-[#0fad89] border-t-transparent rounded-full animate-spin mb-3" />
                <span className="text-xs font-semibold">Đang nạp dữ liệu chi tiết phiếu...</span>
              </div>
            ) : (
              <table className="w-full divide-y divide-gray-200 text-xs text-left">
                <thead className="bg-gray-100 text-gray-700 font-bold uppercase tracking-wider text-[11px] sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="py-2.5 px-3 w-28">Mã SP</th>
                    <th className="py-2.5 px-3">Tên sản phẩm</th>
                    <th className="py-2.5 px-3 text-center w-24">ĐVT cơ sở</th>
                    <th className="py-2.5 px-3 text-center bg-gray-200/70 w-28 font-bold">Tồn đã chốt</th>
                    <th className="py-2.5 px-3 text-center w-36">SL thực tế</th>
                    <th className="py-2.5 px-3 text-center w-28">Chênh lệch</th>
                    <th className="py-2.5 px-3 text-center w-28">Kết quả</th>
                    <th className="py-2.5 px-3">Lý do chênh lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedDetailItems.map((itm) => {
                    const isDeficit = typeof itm.discrepancy === 'number' && itm.discrepancy < 0;
                    const isSurplus = typeof itm.discrepancy === 'number' && itm.discrepancy > 0;
                    const isMatch = itm.discrepancy === 0;
                    const isPending = itm.actual_stock === null || itm.actual_stock === undefined;
                    const isReadOnly = selectedAudit.status !== 'IN_PROGRESS' || !canManageAudit;

                    return (
                      <tr
                        key={itm.product_id}
                        className={`transition-colors ${
                          isDeficit
                            ? 'bg-rose-50/60 hover:bg-rose-100/50'
                            : isSurplus
                            ? 'bg-blue-50/60 hover:bg-blue-100/50'
                            : isMatch
                            ? 'hover:bg-gray-50'
                            : 'hover:bg-amber-50/40'
                        }`}
                      >
                        <td className="py-2.5 px-3 font-semibold text-gray-900 font-mono">
                          {itm.product_code}
                        </td>
                        <td className="py-2.5 px-3 text-gray-800 font-medium">
                          <div>{itm.product_name}</div>
                          {itm.category_name && (
                            <div className="text-[10px] text-gray-400 mt-0.5">{itm.category_name}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center text-gray-600 font-medium">
                          {itm.base_unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-gray-900 bg-gray-50 text-sm">
                          {itm.system_stock}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isReadOnly ? (
                            <span className="font-bold text-gray-900 text-sm">
                              {itm.actual_stock ?? '-'}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              placeholder="Nhập SL"
                              value={itm.actual_stock ?? ''}
                              onChange={(e) => handleItemActualStockChange(itm.product_id, e.target.value)}
                              className={`w-28 px-2 py-1 text-center font-bold text-sm border rounded-md focus:outline-none focus:ring-2 ${
                                isDeficit
                                  ? 'border-rose-300 text-rose-700 bg-rose-50'
                                  : isSurplus
                                  ? 'border-blue-300 text-blue-700 bg-blue-50'
                                  : 'border-gray-300 text-gray-900 focus:ring-[#0fad89]'
                              }`}
                            />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-sm">
                          {itm.discrepancy === null ? (
                            <span className="text-gray-400">-</span>
                          ) : isMatch ? (
                            <span className="text-gray-500">0</span>
                          ) : isDeficit ? (
                            <span className="text-rose-600 font-extrabold">{itm.discrepancy}</span>
                          ) : (
                            <span className="text-blue-600 font-extrabold">+{itm.discrepancy}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {isPending ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
                              Chưa kiểm
                            </span>
                          ) : isMatch ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800">
                              Khớp
                            </span>
                          ) : isDeficit ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                              Thiếu {Math.abs(itm.discrepancy!)} {itm.base_unit}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                              Thừa {itm.discrepancy} {itm.base_unit}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {isReadOnly ? (
                            <span className="text-gray-700 italic">
                              {itm.reason || (isMatch ? 'Khớp kiểm kê' : '-')}
                            </span>
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                placeholder={
                                  isDeficit || isSurplus
                                    ? 'Bắt buộc nhập lý do...'
                                    : 'Ghi chú (không bắt buộc)...'
                                }
                                value={itm.reason || ''}
                                onChange={(e) => handleItemReasonChange(itm.product_id, e.target.value)}
                                className={`w-full px-2 py-1 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                                  (isDeficit || isSurplus) && (!itm.reason || !itm.reason.trim())
                                    ? 'border-rose-400 bg-rose-50/50 focus:ring-rose-500'
                                    : 'border-gray-300 focus:ring-[#0fad89]'
                                }`}
                              />
                              {(isDeficit || isSurplus) && (!itm.reason || !itm.reason.trim()) && (
                                <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                                  * Bắt buộc nhập lý do
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer bảng chi tiết */}
          <div className="p-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
            <div>
              {selectedAudit.status === 'IN_PROGRESS' && (canConfirmAudit || canManageAudit) && (
                <button
                  type="button"
                  id="btn-cancel-stock-audit-footer"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-300 cursor-pointer bg-white transition-colors"
                >
                  Hủy phiếu kiểm kê
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Phân trang segmented pill trong chi tiết phiếu */}
              {filteredDetailItems.length > 0 && (
                <div className="inline-flex items-stretch border border-gray-300 rounded-[5px] overflow-hidden bg-white shadow-2xs divide-x divide-gray-200 h-7 text-xs">
                  {/* Nút lùi trang (<) - Chỉ hiện khi safeDetailPage > 1 */}
                  {safeDetailPage > 1 && (
                    <button
                      type="button"
                      onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                      title="Trang trước"
                      className="px-2.5 min-w-[28px] bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer border-0 font-medium text-xs select-none"
                    >
                      &lt;
                    </button>
                  )}

                  {/* Danh sách các số trang */}
                  {detailPaginationItems.map((p, idx) => {
                    if (typeof p === 'string') {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2 min-w-[26px] bg-white text-gray-500 flex items-center justify-center text-xs select-none"
                        >
                          ...
                        </span>
                      );
                    }

                    const isActive = p === safeDetailPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDetailPage(p as number)}
                        className={`px-2.5 min-w-[28px] flex items-center justify-center transition-colors border-0 text-xs ${
                          isActive
                            ? 'bg-[#0fad89] text-white font-bold cursor-default'
                            : 'bg-white text-gray-800 hover:bg-gray-50 hover:text-gray-900 font-medium cursor-pointer'
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}

                  {/* Nút tiến trang (>) - Chỉ hiện khi safeDetailPage < detailTotalPages */}
                  {safeDetailPage < detailTotalPages && (
                    <button
                      type="button"
                      onClick={() => setDetailPage((p) => Math.min(detailTotalPages, p + 1))}
                      title="Trang sau"
                      className="px-2.5 min-w-[28px] bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer border-0 font-medium text-xs select-none"
                    >
                      &gt;
                    </button>
                  )}
                </div>
              )}

              {selectedAudit.status === 'IN_PROGRESS' && (
                <>
                  {canManageAudit && (
                    <button
                      type="button"
                      id="btn-save-draft-footer"
                      onClick={handleSaveDraft}
                      disabled={isSavingDraft}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSavingDraft ? 'Đang lưu...' : 'Lưu tạm kết quả'}
                    </button>
                  )}

                  {canConfirmAudit ? (
                    <button
                      type="button"
                      id="btn-confirm-stock-audit-footer"
                      onClick={handlePreConfirm}
                      disabled={detailStats.countedCount === 0}
                      className={`px-5 py-2 text-xs font-bold rounded-lg shadow-sm border-0 transition-all ${
                        detailStats.countedCount === 0
                          ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-60'
                          : 'bg-[#0fad89] hover:bg-[#0c8a6d] text-white cursor-pointer shadow-sm'
                      }`}
                      title={
                        detailStats.countedCount === 0
                          ? 'Vui lòng nhập SL thực tế cho ít nhất 1 sản phẩm để xác nhận'
                          : detailStats.pendingCount > 0
                          ? `Đã kiểm đếm ${detailStats.countedCount}/${detailStats.total} SP (${detailStats.pendingCount} SP chưa đếm giữ nguyên tồn kho)`
                          : 'Xác nhận kiểm kê & Điều chỉnh kho'
                      }
                    >
                      Xác nhận kiểm kê & Điều chỉnh kho
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium">
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span>Phiếu chờ Admin hoặc Quản lý kho duyệt</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL 3: XÁC NHẬN ĐIỀU CHỈNH TỒN KHO                      */}
        {/* ========================================================= */}
        {isConfirmModalOpen && selectedAudit && (
          <ModalPortal>
            <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col">
                <div className="mb-4 shrink-0">
                  <h3 className="text-lg font-bold text-gray-900">
                    Xác nhận kết quả & Điều chỉnh tồn kho
                  </h3>
                  <p className="text-xs text-gray-500">Phiếu kiểm kê: {selectedAudit.code}</p>
                </div>

                {/* Tóm tắt kết quả kiểm kê chi tiết theo từng sản phẩm */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm mb-4 border border-gray-200 overflow-y-auto flex-1">
                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-gray-600 font-medium">Tổng sản phẩm trong phiếu:</span>
                    <span className="font-bold text-gray-900">{detailStats.total} SP</span>
                  </div>

                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-blue-700 font-medium">Đã kiểm đếm thực tế:</span>
                    <span className="font-bold text-blue-700">{detailStats.countedCount} SP</span>
                  </div>

                  {detailStats.pendingCount > 0 && (
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200 bg-amber-50/80 px-2.5 py-1.5 rounded-lg text-amber-800 text-xs">
                      <span className="font-medium">Chưa kiểm đếm (giữ nguyên tồn kho):</span>
                      <span className="font-bold">{detailStats.pendingCount} SP</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                    <span className="text-green-700 font-medium">Khớp số lượng:</span>
                    <span className="font-bold text-green-700">{detailStats.matchCount} SP</span>
                  </div>

                  {/* Chi tiết từng sản phẩm Thiếu hàng */}
                  <div className="pb-2 border-b border-gray-200">
                    <div className="mb-1">
                      <span className="text-rose-700 font-bold">Thiếu hàng:</span>
                    </div>
                    {auditItemsState.filter((it) => typeof it.discrepancy === 'number' && it.discrepancy < 0).length > 0 ? (
                      <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {auditItemsState
                          .filter((it) => typeof it.discrepancy === 'number' && it.discrepancy < 0)
                          .map((itm) => (
                            <div
                              key={itm.product_id}
                              className="flex justify-between items-center text-xs py-1.5 px-3 rounded-lg bg-rose-50 border border-rose-200"
                            >
                              <span className="text-gray-800 font-medium truncate mr-2">
                                <strong className="font-mono text-gray-900 font-bold">{itm.product_code}</strong> - {itm.product_name}
                              </span>
                              <span className="font-bold text-rose-700 whitespace-nowrap">
                                thiếu {Math.abs(itm.discrepancy!)} {itm.base_unit}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic mt-1">Không có sản phẩm thiếu</div>
                    )}
                  </div>

                  {/* Chi tiết từng sản phẩm Thừa hàng */}
                  <div>
                    <div className="mb-1">
                      <span className="text-blue-700 font-bold">Thừa hàng:</span>
                    </div>
                    {auditItemsState.filter((it) => typeof it.discrepancy === 'number' && it.discrepancy > 0).length > 0 ? (
                      <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {auditItemsState
                          .filter((it) => typeof it.discrepancy === 'number' && it.discrepancy > 0)
                          .map((itm) => (
                            <div
                              key={itm.product_id}
                              className="flex justify-between items-center text-xs py-1.5 px-3 rounded-lg bg-blue-50 border border-blue-200"
                            >
                              <span className="text-gray-800 font-medium truncate mr-2">
                                <strong className="font-mono text-gray-900 font-bold">{itm.product_code}</strong> - {itm.product_name}
                              </span>
                              <span className="font-bold text-blue-700 whitespace-nowrap">
                                thừa {itm.discrepancy} {itm.base_unit}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic mt-1">Không có sản phẩm thừa</div>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs border border-amber-200 mb-5 leading-relaxed">
                  <strong>Lưu ý quan trọng:</strong> Hệ thống sẽ điều chỉnh tồn kho cho <strong>{detailStats.countedCount} sản phẩm</strong> đã kiểm đếm.{' '}
                  {detailStats.pendingCount > 0 && (
                    <span>
                      Đối với <strong>{detailStats.pendingCount} sản phẩm chưa đếm</strong>, hệ thống sẽ <strong>giữ nguyên theo tồn kho hiện tại</strong> (không điều chỉnh).{' '}
                    </span>
                  )}
                  Ghi nhận lịch sử biến động kho và khóa phiếu kiểm kê. <strong>Thao tác này không thể hoàn tác!</strong>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsConfirmModalOpen(false)}
                    disabled={isSubmittingConfirm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer border-0 bg-transparent"
                  >
                    Quay lại kiểm tra
                  </button>
                  <button
                    type="button"
                    id="btn-confirm-adjust-now"
                    onClick={handleConfirmAudit}
                    disabled={isSubmittingConfirm}
                    className="px-5 py-2 text-sm font-bold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-lg shadow-sm cursor-pointer border-0 disabled:opacity-50"
                  >
                    {isSubmittingConfirm ? 'Đang điều chỉnh...' : 'Đồng ý điều chỉnh kho'}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}

        {/* ========================================================= */}
        {/* MODAL 4: HỦY PHIẾU KIỂM KÊ                                */}
        {/* ========================================================= */}
        {isCancelModalOpen && selectedAudit && (
          <ModalPortal>
            <div style={{ zIndex: 99999 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Hủy phiếu kiểm kê {selectedAudit.code}
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Phiếu sau khi hủy sẽ không thể tiếp tục kiểm đếm hay xác nhận điều chỉnh tồn kho.
                </p>

                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Lý do hủy phiếu
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do hủy phiếu..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCancelModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer border-0 bg-transparent"
                  >
                    Quay lại
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelAudit}
                    disabled={isSubmittingCancel}
                    className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm cursor-pointer border-0 disabled:opacity-50"
                  >
                    {isSubmittingCancel ? 'Đang hủy...' : 'Xác nhận hủy phiếu'}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1680px',
        margin: '0 auto',
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        gap: '12px',
      }}
    >
      {/* Header khu vực kiểm kê */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Kiểm kê kho
          </h1>
        </div>

        {/* Nút Tạo phiếu kiểm kê - Cho phép cả Thủ kho, Quản lý kho và Admin */}
        {canManageAudit && (
          <button
            type="button"
            id="btn-create-stock-audit"
            onClick={() => {
              setCreateScopeType('WAREHOUSE');
              setCreateCategoryId('');
              setCreatePreviewItems([]);
              setCreateSearchProduct('');
              setViewMode('create');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0fad89] hover:bg-[#0c8a6d] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:ring-offset-2 cursor-pointer border-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            Tạo phiếu kiểm kê
          </button>
        )}
      </div>

      {/* Thẻ thống kê tổng quan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Tổng số phiếu</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Đang kiểm kê</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.inProgress}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Đã hoàn tất</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.confirmed}</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-medium">Có chênh lệch</p>
          <p className="text-2xl font-bold text-rose-600 mt-1">{stats.withDiscrepancy}</p>
        </div>
      </div>

      {/* Khung danh sách phiếu kiểm kê: Gộp Bộ lọc và Bảng dữ liệu thành 1 khối duy nhất */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        {/* Thanh tìm kiếm & bộ lọc ở đầu khung */}
        <div className="p-3 border-b border-gray-200 shrink-0 bg-white">
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. Tìm kiếm mã phiếu */}
            <div className="relative flex-1 min-w-[240px]">
              <input
                type="text"
                id="input-search-audit-code"
                placeholder="Tìm kiếm theo mã phiếu..."
                value={searchCode}
                onChange={(e) => {
                  setSearchCode(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white text-gray-800 placeholder-gray-400 transition-all"
              />
            </div>

            {/* 2. Lọc theo kho */}
            <div className="w-full sm:w-auto min-w-[170px]">
              <select
                id="select-filter-warehouse"
                value={filterWarehouse}
                onChange={(e) => {
                  setFilterWarehouse(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white text-gray-700 cursor-pointer transition-all"
              >
                <option value="">Tất cả các kho</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Lọc theo trạng thái */}
            <div className="w-full sm:w-auto min-w-[160px]">
              <select
                id="select-filter-status"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white text-gray-700 cursor-pointer transition-all"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="IN_PROGRESS">Đang kiểm kê</option>
                <option value="CONFIRMED">Hoàn tất</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>

            {/* 4. Lọc theo phạm vi */}
            <div className="w-full sm:w-auto min-w-[160px]">
              <select
                id="select-filter-scope"
                value={filterScope}
                onChange={(e) => {
                  setFilterScope(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 px-3 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white text-gray-700 cursor-pointer transition-all"
              >
                <option value="">Tất cả phạm vi</option>
                <option value="WAREHOUSE">Kiểm kê theo kho</option>
                <option value="CATEGORY">Kiểm kê theo nhóm hàng</option>
              </select>
            </div>

            {/* 5. Nút Làm mới */}
            <button
              type="button"
              onClick={() => fetchAudits()}
              title="Làm mới danh sách phiếu kiểm kê"
              className="h-10 px-4 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 flex items-center justify-center cursor-pointer transition-colors shrink-0 shadow-2xs"
            >
              <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
            </button>
          </div>
        </div>

        {/* Bảng danh sách phiếu kiểm kê */}
        <div className="overflow-x-auto overflow-y-auto flex-1 min-h-0">
          <table className="w-full divide-y divide-gray-200 text-xs whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider text-[11px] whitespace-nowrap sticky top-0 z-20 shadow-xs">
              <tr>
                <th className="py-2.5 px-3 text-left whitespace-nowrap bg-gray-50">Mã phiếu</th>
                <th className="py-2.5 px-3 text-left whitespace-nowrap bg-gray-50">Kho / Phạm vi</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap bg-gray-50">Thời điểm tạo</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap bg-gray-50">Người tạo</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-gray-50">Tổng SP</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap bg-gray-50">SP lệch</th>
                <th className="py-2.5 px-2.5 text-center whitespace-nowrap bg-gray-50">Trạng thái</th>
                <th className="py-2.5 px-2.5 text-left whitespace-nowrap bg-gray-50">Người xác nhận</th>
                <th className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-gray-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] z-30">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800 whitespace-nowrap text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500 whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#0fad89] border-t-transparent rounded-full animate-spin" />
                      <span>Đang tải dữ liệu kiểm kê...</span>
                    </div>
                  </td>
                </tr>
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500 whitespace-nowrap">
                    <p className="font-medium text-gray-600">Chưa có phiếu kiểm kê nào phù hợp</p>
                  </td>
                </tr>
              ) : (
                audits.map((a) => {
                  const isDone = a.status === 'CONFIRMED';
                  const isCancelled = a.status === 'CANCELLED';
                  const hasDisc = (a.discrepancy_items_count || 0) > 0;

                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors whitespace-nowrap group">
                      {/* Mã phiếu */}
                      <td className="py-2.5 px-3 font-bold text-gray-900 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(a.id)}
                          className="text-[#0fad89] hover:underline font-bold cursor-pointer bg-transparent border-0 p-0 text-left whitespace-nowrap"
                          title="Xem chi tiết phiếu kiểm kê"
                        >
                          {a.code}
                        </button>
                      </td>

                      {/* Kho & Phạm vi */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <span className="font-semibold text-gray-900 whitespace-nowrap">{a.warehouse_name}</span>
                          {a.scope_type === 'CATEGORY' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 whitespace-nowrap">
                              Nhóm: {a.category_name || 'Tất cả'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 whitespace-nowrap">
                              Toàn kho
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Thời điểm tạo */}
                      <td className="py-2.5 px-2.5 text-gray-600 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Người tạo */}
                      <td className="py-2.5 px-2.5 text-gray-700 font-medium whitespace-nowrap">{a.created_by}</td>

                      {/* Tổng SP */}
                      <td className="py-2.5 px-2 text-center font-bold text-gray-800 whitespace-nowrap">
                        {a.total_items}
                      </td>

                      {/* SP lệch */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {hasDisc ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">
                            {a.discrepancy_items_count} SP lệch
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-700 whitespace-nowrap">
                            0 lệch
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                        {isDone ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                            Hoàn tất
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 whitespace-nowrap">
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">
                            Đang kiểm kê
                          </span>
                        )}
                      </td>

                      {/* Người xác nhận */}
                      <td className="py-2.5 px-2.5 text-gray-600 text-xs whitespace-nowrap">
                        {a.confirmed_by ? (
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            <span className="font-semibold text-gray-900 whitespace-nowrap">{a.confirmed_by}</span>
                            {a.confirmed_at && (
                              <span className="text-gray-400 whitespace-nowrap text-[11px]">
                                ({new Date(a.confirmed_at).toLocaleDateString('vi-VN')})
                              </span>
                            )}
                          </div>
                        ) : isCancelled ? (
                          <span className="text-gray-400 italic whitespace-nowrap">Đã hủy</span>
                        ) : (
                          <span className="text-gray-400 italic whitespace-nowrap">Chờ xác nhận</span>
                        )}
                      </td>

                      {/* Thao tác (Cố định ở mép phải - Luôn hiển thị không bị trôi) */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap sticky right-0 bg-white group-hover:bg-gray-50 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)] transition-colors z-10">
                        {a.status === 'IN_PROGRESS' && canConfirmAudit ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(a.id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0fad89] hover:bg-[#0c8a6d] text-white shadow-xs transition-colors cursor-pointer border-0 whitespace-nowrap inline-flex items-center justify-center"
                            title="Kiểm đếm & Duyệt điều chỉnh kho"
                          >
                            Kiểm đếm & Duyệt
                          </button>
                        ) : a.status === 'IN_PROGRESS' && canManageAudit ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(a.id)}
                            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer border-0 whitespace-nowrap inline-flex items-center justify-center"
                            title="Nhập kết quả kiểm đếm thực tế"
                          >
                            Kiểm đếm & Nhập kết quả
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(a.id)}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer border-0 whitespace-nowrap inline-flex items-center justify-center"
                            title="Xem chi tiết phiếu kiểm kê"
                          >
                            Xem chi tiết
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang segmented pill: 1, 2, ... totalPages */}
        {totalCount > 0 && (
          <div className="p-3 border-t border-gray-200 flex items-center justify-end text-sm shrink-0 bg-white">
            <div className="inline-flex items-stretch border border-gray-300 rounded-[5px] overflow-hidden bg-white shadow-2xs divide-x divide-gray-200 h-7 text-xs">
              {/* Nút lùi trang (<) - Chỉ hiện khi page > 1 */}
              {page > 1 && (
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  title="Trang trước"
                  className="px-2.5 min-w-[28px] bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer border-0 font-medium text-xs select-none"
                >
                  &lt;
                </button>
              )}

              {/* Danh sách các số trang */}
              {paginationItems.map((p, idx) => {
                if (typeof p === 'string') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 min-w-[26px] bg-white text-gray-500 flex items-center justify-center text-xs select-none"
                    >
                      ...
                    </span>
                  );
                }

                const isActive = p === page;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`px-2.5 min-w-[28px] flex items-center justify-center transition-colors border-0 text-xs ${
                      isActive
                        ? 'bg-[#0fad89] text-white font-bold cursor-default'
                        : 'bg-white text-gray-800 hover:bg-gray-50 hover:text-gray-900 font-medium cursor-pointer'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              {/* Nút tiến trang (>) - Chỉ hiện khi page < totalPages */}
              {page < totalPages && (
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  title="Trang sau"
                  className="px-2.5 min-w-[28px] bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer border-0 font-medium text-xs select-none"
                >
                  &gt;
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StockAuditManagementView;
