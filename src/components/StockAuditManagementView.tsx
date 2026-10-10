import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
}

export function StockAuditManagementView({ token, currentUser }: StockAuditManagementViewProps) {
  // Xác định vai trò
  const userRoles = useMemo(() => {
    if (currentUser?.roles && currentUser.roles.length > 0) {
      return currentUser.roles;
    }
    return [currentUser?.role || ''];
  }, [currentUser]);

  // Chỉ Quản lý kho (warehouse_manager) và Quản trị hệ thống (admin) được tạo, sửa, xác nhận, hủy phiếu
  const isWarehouseManager = userRoles.some((r) => ['warehouse_manager', 'admin'].includes(r));

  // State danh sách phiếu
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Bộ lọc
  const [searchCode, setSearchCode] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScope, setFilterScope] = useState('');

  // Danh mục kho & nhóm hàng
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modal Tạo phiếu
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createScopeType, setCreateScopeType] = useState<'WAREHOUSE' | 'CATEGORY'>('WAREHOUSE');
  const [createWarehouseId, setCreateWarehouseId] = useState('WH01');
  const [createCategoryId, setCreateCategoryId] = useState<number | ''>('');
  const [createNote, setCreateNote] = useState('');
  const [createPreviewLoading, setCreatePreviewLoading] = useState(false);
  const [createPreviewItems, setCreatePreviewItems] = useState<any[]>([]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Modal Chi tiết & Nhập kết quả
  const [selectedAudit, setSelectedAudit] = useState<StockAudit | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [auditItemsState, setAuditItemsState] = useState<StockAuditItem[]>([]);
  const [detailSearchProduct, setDetailSearchProduct] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // Modal Xác nhận kiểm kê
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState(false);

  // Modal Hủy phiếu
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);

  // Tải danh mục nhóm hàng
  const fetchCategories = useCallback(async () => {
    try {
      const tree = await getCategoryTreeApi(token);
      const flat: (Category & { level: number })[] = [];
      const traverse = (items: any[], level = 0) => {
        for (const it of items) {
          flat.push({ ...it, level });
          if (it.sub_categories && Array.isArray(it.sub_categories) && it.sub_categories.length > 0) {
            traverse(it.sub_categories, level + 1);
          }
        }
      };
      traverse(tree || [], 0);
      setCategories(flat);
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

  // Tự động tải lại danh mục nếu mở modal tạo phiếu mà chưa có dữ liệu nhóm hàng
  useEffect(() => {
    if (isCreateModalOpen && categories.length === 0) {
      fetchCategories();
    }
  }, [isCreateModalOpen, categories.length, fetchCategories]);

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

  // Xem trước danh sách sản phẩm khi tạo phiếu
  useEffect(() => {
    if (!isCreateModalOpen || !createWarehouseId) return;
    if (createScopeType === 'CATEGORY' && !createCategoryId) {
      setCreatePreviewItems([]);
      return;
    }

    setCreatePreviewLoading(true);
    previewAuditProductsApi(token, {
      warehouse_id: createWarehouseId,
      scope_type: createScopeType,
      category_id: createCategoryId ? Number(createCategoryId) : undefined,
    })
      .then((res) => {
        setCreatePreviewItems(res.items || []);
      })
      .catch(() => {
        setCreatePreviewItems([]);
      })
      .finally(() => {
        setCreatePreviewLoading(false);
      });
  }, [isCreateModalOpen, createWarehouseId, createScopeType, createCategoryId, token]);

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

  // Mở modal chi tiết phiếu
  const handleOpenDetail = async (auditId: number) => {
    setDetailLoading(true);
    setIsDetailModalOpen(true);
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
      setIsDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

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
  const handleCreateAudit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      setIsCreateModalOpen(false);
      setCreateNote('');
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

    // Kiểm tra tất cả dòng đã nhập thực tế chưa
    const missingActual = auditItemsState.filter((it) => it.actual_stock === null || it.actual_stock === undefined);
    if (missingActual.length > 0) {
      emitStatusToast({
        title: 'Chưa hoàn tất kiểm đếm',
        message: `Còn ${missingActual.length} sản phẩm chưa được nhập số lượng thực tế. Vui lòng kiểm đếm đầy đủ!`,
        type: 'warning',
      });
      return;
    }

    // Kiểm tra các dòng có chênh lệch đã có lý do chưa
    const missingReason = auditItemsState.filter(
      (it) => it.discrepancy !== null && it.discrepancy !== 0 && (!it.reason || !it.reason.trim())
    );
    if (missingReason.length > 0) {
      emitStatusToast({
        title: 'Thiếu lý do chênh lệch',
        message: `Bắt buộc nhập lý do cho ${missingReason.length} sản phẩm có chênh lệch (ví dụ: '${missingReason[0].product_name}').`,
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
        actual_stock: it.actual_stock ?? 0,
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

    return {
      total: auditItemsState.length,
      matchCount,
      deficitCount,
      surplusCount,
      pendingCount,
      totalDeficitQty,
      totalSurplusQty,
    };
  }, [auditItemsState]);

  return (
    <div className="space-y-6">
      {/* Header khu vực kiểm kê */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <svg
              className="w-7 h-7 text-[#0fad89]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Kiểm kê kho
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Đối chiếu số lượng thực tế với tồn kho hệ thống và điều chỉnh chênh lệch chính xác
          </p>
        </div>

        {/* Nút Tạo phiếu kiểm kê */}
        {isWarehouseManager && (
          <button
            type="button"
            id="btn-create-stock-audit"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0fad89] hover:bg-[#0c8a6d] shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:ring-offset-2 cursor-pointer border-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo phiếu kiểm kê
          </button>
        )}
      </div>

      {/* Thẻ thống kê tổng quan */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Tổng số phiếu</p>
            <p className="text-xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Đang kiểm kê</p>
            <p className="text-xl font-bold text-amber-600">{stats.inProgress}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Đã hoàn tất</p>
            <p className="text-xl font-bold text-green-600">{stats.confirmed}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Có chênh lệch</p>
            <p className="text-xl font-bold text-rose-600">{stats.withDiscrepancy}</p>
          </div>
        </div>
      </div>

      {/* Thanh tìm kiếm & bộ lọc */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Tìm kiếm mã phiếu */}
          <div className="relative">
            <input
              type="text"
              id="input-search-audit-code"
              placeholder="Tìm kiếm theo mã phiếu..."
              value={searchCode}
              onChange={(e) => {
                setSearchCode(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Lọc theo kho */}
          <div>
            <select
              id="select-filter-warehouse"
              value={filterWarehouse}
              onChange={(e) => {
                setFilterWarehouse(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white"
            >
              <option value="">Tất cả các kho</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc theo trạng thái */}
          <div>
            <select
              id="select-filter-status"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="IN_PROGRESS">Đang kiểm kê</option>
              <option value="CONFIRMED">Hoàn tất</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>

          {/* Lọc theo phạm vi */}
          <div>
            <select
              id="select-filter-scope"
              value={filterScope}
              onChange={(e) => {
                setFilterScope(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] focus:border-transparent bg-white"
            >
              <option value="">Tất cả phạm vi</option>
              <option value="WAREHOUSE">Kiểm kê theo kho</option>
              <option value="CATEGORY">Kiểm kê theo nhóm hàng</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bảng danh sách phiếu kiểm kê */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-gray-700 font-semibold">
              <tr>
                <th className="py-3 px-4 text-left">Mã phiếu</th>
                <th className="py-3 px-4 text-left">Kho / Phạm vi</th>
                <th className="py-3 px-4 text-left">Thời điểm tạo</th>
                <th className="py-3 px-4 text-left">Người tạo</th>
                <th className="py-3 px-4 text-center">Tổng SP</th>
                <th className="py-3 px-4 text-center">SP lệch</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-left">Người xác nhận</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-[#0fad89] border-t-transparent rounded-full animate-spin" />
                      <span>Đang tải dữ liệu kiểm kê...</span>
                    </div>
                  </td>
                </tr>
              ) : audits.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <p className="font-medium text-gray-600">Chưa có phiếu kiểm kê nào phù hợp</p>
                    <p className="text-xs text-gray-400 mt-1">Nhấn &quot;Tạo phiếu kiểm kê&quot; để bắt đầu đợt kiểm kho mới</p>
                  </td>
                </tr>
              ) : (
                audits.map((a) => {
                  const isDone = a.status === 'CONFIRMED';
                  const isCancelled = a.status === 'CANCELLED';
                  const hasDisc = (a.discrepancy_items_count || 0) > 0;

                  return (
                    <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                      {/* Mã phiếu */}
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(a.id)}
                          className="text-[#0fad89] hover:underline font-bold cursor-pointer bg-transparent border-0 p-0 text-left"
                        >
                          {a.code}
                        </button>
                      </td>

                      {/* Kho & Phạm vi */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-gray-900">{a.warehouse_name}</div>
                        <div className="text-xs text-gray-500">
                          {a.scope_type === 'CATEGORY' ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                              Nhóm: {a.category_name || 'Tất cả'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                              Toàn kho
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Thời điểm tạo */}
                      <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString('vi-VN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      {/* Người tạo */}
                      <td className="py-3 px-4 text-gray-700 font-medium">{a.created_by}</td>

                      {/* Tổng SP */}
                      <td className="py-3 px-4 text-center font-semibold text-gray-800">
                        {a.total_items}
                      </td>

                      {/* SP lệch */}
                      <td className="py-3 px-4 text-center">
                        {hasDisc ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            {a.discrepancy_items_count} SP lệch
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            0 lệch
                          </span>
                        )}
                      </td>

                      {/* Trạng thái */}
                      <td className="py-3 px-4 text-center">
                        {isDone ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                            Hoàn tất
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                            Đã hủy
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
                            Đang kiểm kê
                          </span>
                        )}
                      </td>

                      {/* Người xác nhận */}
                      <td className="py-3 px-4 text-gray-600 text-xs">
                        {a.confirmed_by ? (
                          <div>
                            <div className="font-medium text-gray-900">{a.confirmed_by}</div>
                            {a.confirmed_at && (
                              <div className="text-gray-400">
                                {new Date(a.confirmed_at).toLocaleDateString('vi-VN')}
                              </div>
                            )}
                          </div>
                        ) : isCancelled ? (
                          <span className="text-gray-400 italic">Đã hủy</span>
                        ) : (
                          <span className="text-gray-400 italic">Chờ xác nhận</span>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(a.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors cursor-pointer border-0"
                        >
                          {a.status === 'IN_PROGRESS' && isWarehouseManager
                            ? 'Kiểm đếm & Xác nhận'
                            : 'Xem chi tiết'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-200 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Hiển thị trang {page} / {totalPages} (Tổng {totalCount} phiếu)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 cursor-pointer bg-white"
              >
                Trang trước
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 cursor-pointer bg-white"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: TẠO PHIẾU KIỂM KÊ                                */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Tạo phiếu kiểm kê kho</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Chốt tồn kho căn cứ tại thời điểm tạo phiếu cho phạm vi được chọn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer bg-transparent border-0"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleCreateAudit} className="p-6 space-y-5">
                {/* 1. Chọn phạm vi kiểm kê */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Phạm vi kiểm kê <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        createScopeType === 'WAREHOUSE'
                          ? 'border-[#0fad89] bg-emerald-50/50 text-[#0fad89] font-semibold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope_type"
                        value="WAREHOUSE"
                        checked={createScopeType === 'WAREHOUSE'}
                        onChange={() => setCreateScopeType('WAREHOUSE')}
                        className="text-[#0fad89] focus:ring-[#0fad89]"
                      />
                      <span>A. Kiểm kê theo kho</span>
                    </label>

                    <label
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        createScopeType === 'CATEGORY'
                          ? 'border-[#0fad89] bg-emerald-50/50 text-[#0fad89] font-semibold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="scope_type"
                        value="CATEGORY"
                        checked={createScopeType === 'CATEGORY'}
                        onChange={() => setCreateScopeType('CATEGORY')}
                        className="text-[#0fad89] focus:ring-[#0fad89]"
                      />
                      <span>B. Kiểm kê theo nhóm hàng</span>
                    </label>
                  </div>
                </div>

                {/* 2. Chọn kho kiểm kê */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                    Kho áp dụng <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="select-create-warehouse"
                    value={createWarehouseId}
                    onChange={(e) => setCreateWarehouseId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.id})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Số tồn kho căn cứ sẽ được lấy chính xác từ dữ liệu của kho này.
                  </p>
                </div>

                {/* 3. Chọn nhóm hàng (nếu phạm vi CATEGORY) */}
                {createScopeType === 'CATEGORY' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                      Nhóm hàng cần kiểm kê <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="select-create-category"
                      value={createCategoryId}
                      onChange={(e) => setCreateCategoryId(e.target.value ? Number(e.target.value) : '')}
                      required
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89] bg-white"
                    >
                      <option value="">-- Chọn nhóm hàng --</option>
                      {categories.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.level ? `${'\u00A0'.repeat(c.level * 4)}└─ ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 4. Ghi chú chung */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">Ghi chú chung</label>
                  <textarea
                    id="textarea-create-note"
                    value={createNote}
                    onChange={(e) => setCreateNote(e.target.value)}
                    placeholder="Lý do kiểm kê, đợt kiểm kê cuối quý..."
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0fad89]"
                  />
                </div>

                {/* 5. Xem trước danh sách sản phẩm thuộc phạm vi */}
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50/70">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Xem trước sản phẩm ({createPreviewItems.length} mặt hàng)
                    </span>
                    {createPreviewLoading && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <div className="w-3 h-3 border-2 border-[#0fad89] border-t-transparent rounded-full animate-spin" />
                        Đang lấy dữ liệu tồn kho...
                      </span>
                    )}
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-gray-200 text-xs bg-white rounded-lg border border-gray-200">
                    {createPreviewItems.length === 0 ? (
                      <div className="p-4 text-center text-gray-400">
                        {createScopeType === 'CATEGORY' && !createCategoryId
                          ? 'Vui lòng chọn nhóm hàng để xem danh sách sản phẩm'
                          : 'Không có sản phẩm nào thuộc phạm vi đã chọn'}
                      </div>
                    ) : (
                      createPreviewItems.map((p) => (
                        <div key={p.product_id} className="p-2.5 flex items-center justify-between">
                          <div>
                            <span className="font-semibold text-gray-900">{p.product_name}</span>
                            <span className="text-gray-400 ml-2">({p.product_code})</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-gray-800">Tồn chốt: {p.system_stock}</span>{' '}
                            <span className="text-gray-500">{p.base_unit}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Các nút hành động */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg cursor-pointer border-0 bg-transparent"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCreate || createPreviewItems.length === 0}
                    className="px-5 py-2 text-sm font-semibold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-lg shadow-sm disabled:opacity-50 cursor-pointer border-0"
                  >
                    {isSubmittingCreate ? 'Đang tạo...' : 'Xác nhận tạo phiếu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CHI TIẾT & NHẬP KẾT QUẢ KIỂM ĐẾM                */}
      {/* ========================================================= */}
      {isDetailModalOpen && selectedAudit && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6">
            <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
              {/* Header chi tiết */}
              <div className="p-5 border-b border-gray-200 bg-gray-50 flex items-start justify-between flex-shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-gray-900">
                      Phiếu kiểm kê {selectedAudit.code}
                    </h2>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedAudit.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedAudit.status === 'CANCELLED'
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedAudit.status_label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>
                      <strong>Kho:</strong> {selectedAudit.warehouse_name}
                    </span>
                    <span>
                      <strong>Phạm vi:</strong>{' '}
                      {selectedAudit.scope_type === 'CATEGORY'
                        ? `Nhóm hàng: ${selectedAudit.category_name}`
                        : 'Toàn kho'}
                    </span>
                    <span>
                      <strong>Người tạo:</strong> {selectedAudit.created_by} (
                      {new Date(selectedAudit.created_at).toLocaleString('vi-VN')})
                    </span>
                    {selectedAudit.confirmed_by && (
                      <span className="text-emerald-700 font-semibold">
                        <strong>Người xác nhận:</strong> {selectedAudit.confirmed_by} (
                        {new Date(selectedAudit.confirmed_at!).toLocaleString('vi-VN')})
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 bg-transparent border-0 cursor-pointer"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tóm tắt nhanh kết quả kiểm kê */}
              <div className="px-5 py-3 bg-white border-b border-gray-200 flex flex-wrap items-center justify-between gap-4 text-xs flex-shrink-0">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-gray-700">
                    Tổng: <strong>{detailStats.total} SP</strong>
                  </span>
                  <span className="text-green-600 font-semibold">
                    Khớp: <strong>{detailStats.matchCount}</strong>
                  </span>
                  <span className="text-rose-600 font-semibold">
                    Thiếu: <strong>{detailStats.deficitCount} SP</strong> (
                    {detailStats.totalDeficitQty} ĐVT)
                  </span>
                  <span className="text-blue-600 font-semibold">
                    Thừa: <strong>{detailStats.surplusCount} SP</strong> (+
                    {detailStats.totalSurplusQty} ĐVT)
                  </span>
                  {detailStats.pendingCount > 0 && (
                    <span className="text-amber-600 font-bold">
                      Chưa đếm: {detailStats.pendingCount} SP
                    </span>
                  )}
                </div>

                {/* Tìm kiếm sản phẩm trong phiếu */}
                <div className="w-64">
                  <input
                    type="text"
                    placeholder="Tìm sản phẩm trong phiếu..."
                    value={detailSearchProduct}
                    onChange={(e) => setDetailSearchProduct(e.target.value)}
                    className="w-full px-2.5 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#0fad89]"
                  />
                </div>
              </div>

              {/* Bảng chi tiết sản phẩm kiểm đếm */}
              <div className="p-5 overflow-y-auto flex-1">
                {detailLoading ? (
                  <div className="py-12 text-center text-gray-500">Đang tải chi tiết...</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 text-gray-700 font-bold uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Mã SP</th>
                          <th className="py-2.5 px-3 text-left">Tên sản phẩm</th>
                          <th className="py-2.5 px-3 text-center">ĐVT cơ sở</th>
                          <th className="py-2.5 px-3 text-center bg-gray-100">Tồn đã chốt</th>
                          <th className="py-2.5 px-3 text-center">SL thực tế</th>
                          <th className="py-2.5 px-3 text-center">Chênh lệch</th>
                          <th className="py-2.5 px-3 text-center">Kết quả</th>
                          <th className="py-2.5 px-3 text-left">Lý do chênh lệch</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredDetailItems.map((itm) => {
                          const isDeficit = typeof itm.discrepancy === 'number' && itm.discrepancy < 0;
                          const isSurplus = typeof itm.discrepancy === 'number' && itm.discrepancy > 0;
                          const isMatch = itm.discrepancy === 0;
                          const isPending = itm.actual_stock === null || itm.actual_stock === undefined;
                          const isReadOnly =
                            selectedAudit.status !== 'IN_PROGRESS' || !isWarehouseManager;

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
                              {/* 1. Mã SP */}
                              <td className="py-2.5 px-3 font-semibold text-gray-900">
                                {itm.product_code}
                              </td>

                              {/* 2. Tên SP */}
                              <td className="py-2.5 px-3 text-gray-800 font-medium">
                                <div>{itm.product_name}</div>
                                {itm.category_name && (
                                  <div className="text-[10px] text-gray-400">
                                    {itm.category_name}
                                  </div>
                                )}
                              </td>

                              {/* 3. ĐVT cơ sở */}
                              <td className="py-2.5 px-3 text-center text-gray-600 font-medium">
                                {itm.base_unit}
                              </td>

                              {/* 4. Tồn chốt */}
                              <td className="py-2.5 px-3 text-center font-bold text-gray-900 bg-gray-50">
                                {itm.system_stock}
                              </td>

                              {/* 5. Số lượng thực tế */}
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
                                    onChange={(e) =>
                                      handleItemActualStockChange(itm.product_id, e.target.value)
                                    }
                                    className={`w-24 px-2 py-1 text-center font-bold text-sm border rounded-md focus:outline-none focus:ring-2 ${
                                      isDeficit
                                        ? 'border-rose-300 text-rose-700 bg-rose-50'
                                        : isSurplus
                                        ? 'border-blue-300 text-blue-700 bg-blue-50'
                                        : 'border-gray-300 text-gray-900 focus:ring-[#0fad89]'
                                    }`}
                                  />
                                )}
                              </td>

                              {/* 6. Chênh lệch */}
                              <td className="py-2.5 px-3 text-center font-bold text-sm">
                                {itm.discrepancy === null ? (
                                  <span className="text-gray-400">-</span>
                                ) : isMatch ? (
                                  <span className="text-gray-500">0</span>
                                ) : isDeficit ? (
                                  <span className="text-rose-600 font-extrabold">
                                    {itm.discrepancy}
                                  </span>
                                ) : (
                                  <span className="text-blue-600 font-extrabold">
                                    +{itm.discrepancy}
                                  </span>
                                )}
                              </td>

                              {/* 7. Kết quả */}
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

                              {/* 8. Lý do chênh lệch */}
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
                                      onChange={(e) =>
                                        handleItemReasonChange(itm.product_id, e.target.value)
                                      }
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
                  </div>
                )}
              </div>

              {/* Footer hành động của Modal Chi tiết */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
                <div>
                  {selectedAudit.status === 'IN_PROGRESS' && isWarehouseManager && (
                    <button
                      type="button"
                      onClick={() => setIsCancelModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg border border-rose-300 cursor-pointer bg-white"
                    >
                      Hủy phiếu kiểm kê
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg cursor-pointer border-0 bg-transparent"
                  >
                    Đóng
                  </button>

                  {selectedAudit.status === 'IN_PROGRESS' && isWarehouseManager && (
                    <>
                      <button
                        type="button"
                        onClick={handleSaveDraft}
                        disabled={isSavingDraft}
                        className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                      >
                        {isSavingDraft ? 'Đang lưu...' : 'Lưu tạm kết quả'}
                      </button>

                      <button
                        type="button"
                        id="btn-confirm-stock-audit"
                        onClick={handlePreConfirm}
                        className="px-5 py-2 text-sm font-bold text-white bg-[#0fad89] hover:bg-[#0c8a6d] rounded-lg shadow-sm cursor-pointer border-0"
                      >
                        Xác nhận kiểm kê & Điều chỉnh kho
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: XÁC NHẬN ĐIỀU CHỈNH TỒN KHO                      */}
      {/* ========================================================= */}
      {isConfirmModalOpen && selectedAudit && (
        <ModalPortal>
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Xác nhận kết quả & Điều chỉnh tồn kho
                  </h3>
                  <p className="text-xs text-gray-500">Phiếu kiểm kê: {selectedAudit.code}</p>
                </div>
              </div>

              {/* Tóm tắt kết quả kiểm kê */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-4 border border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tổng sản phẩm kiểm kê:</span>
                  <span className="font-bold text-gray-900">{detailStats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-green-700">Khớp số lượng:</span>
                  <span className="font-bold text-green-700">{detailStats.matchCount} SP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-rose-700">Thiếu hàng:</span>
                  <span className="font-bold text-rose-700">
                    {detailStats.deficitCount} SP (-{detailStats.totalDeficitQty})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Thừa hàng:</span>
                  <span className="font-bold text-blue-700">
                    {detailStats.surplusCount} SP (+{detailStats.totalSurplusQty})
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs border border-amber-200 mb-5 leading-relaxed">
                <strong>Lưu ý quan trọng:</strong> Hệ thống sẽ tự động cập nhật số lượng tồn kho thực
                tế theo các chênh lệch đã kiểm đếm, ghi nhận lịch sử biến động kho và khóa phiếu kiểm
                kê. <strong>Thao tác này không thể hoàn tác!</strong>
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
          <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
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

export default StockAuditManagementView;
