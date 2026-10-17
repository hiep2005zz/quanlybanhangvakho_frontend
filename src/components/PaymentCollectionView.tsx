import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  PaymentCollectionItem,
  PaymentCollectionListResponse,
  DailyReconciliationResponse,
  DailyReconciliationItem,
  User,
  getPaymentCollectionsApi,
  getDailyReconciliationApi,
  submitRemittanceApi,
  bulkSubmitRemittanceApi,
  confirmPaymentCollectionApi,
  bulkConfirmPaymentCollectionApi,
  rejectPaymentCollectionApi,
} from '../services/api';
import { RouteCollectionModal } from './RouteCollectionModal';
import { RouteCollectionFormView } from './RouteCollectionFormView';
import { RouteCollectionDetailView } from './RouteCollectionDetailView';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';
import { convertNumberToVietnameseWords } from '../utils/numberToWords';

interface PaymentCollectionViewProps {
  currentUser: User | null;
  token: string;
}

export const PaymentCollectionView: React.FC<PaymentCollectionViewProps> = ({
  currentUser,
  token,
}) => {
  // Dedicated subpage create view ("Trang riêng bảng ngang")
  const [isCreateView, setIsCreateView] = useState(() => {
    try {
      return (
        window.location.pathname === '/payment-collections/create' ||
        window.location.pathname.startsWith('/payment-collections/create')
      );
    } catch {
      return false;
    }
  });

  const handleOpenCreateView = () => {
    setIsCreateView(true);
    try {
      window.history.pushState({}, '', '/payment-collections/create');
    } catch { }
  };

  const handleBackFromCreateView = () => {
    setIsCreateView(false);
    try {
      window.history.pushState({}, '', '/payment-collections');
    } catch { }
  };

  // Dedicated subpage detail view ("Trang riêng xem chi tiết")
  const [detailItem, setDetailItem] = useState<PaymentCollectionItem | null>(null);
  const [detailId, setDetailId] = useState<number | null>(() => {
    try {
      const m = window.location.pathname.match(/^\/payment-collections\/(\d+)$/);
      return m ? parseInt(m[1], 10) : null;
    } catch {
      return null;
    }
  });

  const handleOpenDetail = (item: PaymentCollectionItem) => {
    setDetailItem(item);
    setDetailId(item.id);
    try {
      window.history.pushState({}, '', `/payment-collections/${item.id}`);
    } catch { }
  };

  const handleBackFromDetail = () => {
    setDetailItem(null);
    setDetailId(null);
    try {
      window.history.pushState({}, '', '/payment-collections');
    } catch { }
  };

  useEffect(() => {
    const handlePopState = () => {
      const isCreate =
        window.location.pathname === '/payment-collections/create' ||
        window.location.pathname.startsWith('/payment-collections/create');
      setIsCreateView(isCreate);

      const m = window.location.pathname.match(/^\/payment-collections\/(\d+)$/);
      setDetailId(m ? parseInt(m[1], 10) : null);
      if (!m) setDetailItem(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Modal create collection (fallback)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Detail item modal
  const [selectedDetailItem, setSelectedDetailItem] = useState<PaymentCollectionItem | null>(null);

  // Lightbox for receipt photo
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Single action modals
  const [remitModalItem, setRemitModalItem] = useState<PaymentCollectionItem | null>(null);
  const [remitNote, setRemitNote] = useState('');
  const [confirmModalItem, setConfirmModalItem] = useState<PaymentCollectionItem | null>(null);
  const [confirmNote, setConfirmNote] = useState('');
  const [rejectModalItem, setRejectModalItem] = useState<PaymentCollectionItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [balancedOnly, setBalancedOnly] = useState<boolean | undefined>(undefined);

  // Data states & pagination (mỗi trang hiển thị 10 bản ghi, bấm sang trang khác load tiếp 10 bản ghi)
  const [reconciliationData, setReconciliationData] = useState<DailyReconciliationResponse | null>(null);
  const [listData, setListData] = useState<PaymentCollectionListResponse | null>(null);
  const [reconPage, setReconPage] = useState(1);
  const [collectionsPage, setCollectionsPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Tab chuyển đổi: chỉ hiển thị đúng 1 bảng duy nhất tại một thời điểm
  const [activeTab, setActiveTab] = useState<'reconciliation' | 'all_collections'>('reconciliation');
  // Đợt đối chiếu được chọn để xem bảng chi tiết ("bấm chi tiết thì sang một bảng chi tiết")
  const [selectedBatch, setSelectedBatch] = useState<DailyReconciliationItem | null>(null);

  // Quản lý Hộp Menu Thao tác thả xuống (Action Dropdown Box)
  const [openActionId, setOpenActionId] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.payment-action-menu-container')) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Kéo chuột để lướt ngang mượt mà (Mouse Drag-to-Scroll UX)
  const collectionsTableRef = useRef<HTMLDivElement>(null);
  const [isDragScrolling, setIsDragScrolling] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragScrollLeft, setDragScrollLeft] = useState(0);

  const handleTableMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, a, select, textarea, [role="button"]')) return;
    if (!collectionsTableRef.current) return;
    setIsDragScrolling(true);
    setDragStartX(e.pageX - collectionsTableRef.current.offsetLeft);
    setDragScrollLeft(collectionsTableRef.current.scrollLeft);
  };

  const handleTableMouseLeave = () => setIsDragScrolling(false);
  const handleTableMouseUp = () => setIsDragScrolling(false);

  const handleTableMouseMove = (e: React.MouseEvent) => {
    if (!isDragScrolling || !collectionsTableRef.current) return;
    e.preventDefault();
    const x = e.pageX - collectionsTableRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    collectionsTableRef.current.scrollLeft = dragScrollLeft - walk;
  };

  // Đồng bộ selectedBatch khi reconciliationData được tải lại
  useEffect(() => {
    if (selectedBatch && reconciliationData) {
      const updated = reconciliationData.items.find(
        (it) => it.date === selectedBatch.date && it.sales_id === selectedBatch.sales_id
      );
      if (updated) {
        setSelectedBatch(updated);
      }
    }
  }, [reconciliationData]);

  // Role permissions
  const isAdmin = currentUser?.role === 'admin';
  const isAccountant = currentUser?.role === 'accountant';
  const isSalesManager = currentUser?.role === 'sales_manager';
  const isSales = currentUser?.role === 'sales';
  const canConfirm = isAdmin || isAccountant;
  const canCollect = isAdmin || isSales || isSalesManager;

  // Format currency VND
  const formatMoney = (val?: number | null) => {
    if (val === undefined || val === null) return '0 đ';
    return `${Number(val).toLocaleString('vi-VN')} đ`;
  };

  // Reusable Pagination Bar ERP chuẩn đẹp
  const renderPaginationBar = (
    page: number,
    totalPages: number,
    totalItems: number,
    pageSize: number,
    onPageChange: (newPage: number) => void,
    itemName: string = 'bản ghi'
  ) => {
    if (totalItems <= 0) return null;
    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, totalItems);

    const pageNumbers: number[] = [];
    const maxButtons = 5;
    let startPage = Math.max(1, page - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ fontSize: '13px', color: '#475569' }}>
          Hiển thị <strong>{startItem} - {endItem}</strong> / <strong>{totalItems}</strong> {itemName}{' '}
          <span style={{ color: '#94a3b8' }}>•</span> Trang <strong>{page}</strong> / <strong>{totalPages || 1}</strong>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            title="Về trang đầu"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: page <= 1 ? '#f1f5f9' : '#ffffff',
              color: page <= 1 ? '#94a3b8' : '#334155',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            &laquo;
          </button>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: page <= 1 ? '#f1f5f9' : '#ffffff',
              color: page <= 1 ? '#94a3b8' : '#334155',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            &lsaquo; Trước
          </button>

          {startPage > 1 && (
            <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px' }}>...</span>
          )}

          {pageNumbers.map((p) => {
            const isActive = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                style={{
                  minWidth: '32px',
                  height: '32px',
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: isActive ? '#2563eb' : '#ffffff',
                  color: isActive ? '#ffffff' : '#334155',
                  cursor: isActive ? 'default' : 'pointer',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {p}
              </button>
            );
          })}

          {endPage < totalPages && (
            <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '12px' }}>...</span>
          )}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: page >= totalPages ? '#f1f5f9' : '#ffffff',
              color: page >= totalPages ? '#94a3b8' : '#334155',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            Sau &rsaquo;
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            title="Đến trang cuối"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: page >= totalPages ? '#f1f5f9' : '#ffffff',
              color: page >= totalPages ? '#94a3b8' : '#334155',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            &raquo;
          </button>
        </div>
      </div>
    );
  };

  // Fetch Daily Reconciliation Table (Tiêu chí 3: phân trang 10 dòng/trang)
  const fetchReconciliation = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getDailyReconciliationApi(
        {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          search: searchQuery || undefined,
          balanced_only: balancedOnly === true ? true : undefined,
          unbalanced_only: balancedOnly === false ? true : undefined,
          page: reconPage,
          page_size: 10,
        },
        token
      );
      setReconciliationData(res);
    } catch (err: any) {
      console.error('Lỗi tải bảng đối chiếu:', err);
      emitStatusToast({
        title: 'Lỗi tải dữ liệu đối chiếu',
        message: err.message || 'Không thể tải bảng đối chiếu tiền thu theo ngày.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate, searchQuery, balancedOnly, reconPage]);

  // Fetch Collections List (Tiêu chí 1 & 2: phân trang 10 dòng/trang)
  const fetchCollections = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await getPaymentCollectionsApi(
        {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          search: searchQuery || undefined,
          page: collectionsPage,
          limit: 10,
        },
        token
      );
      setListData(res);
      setSelectedIds([]);
    } catch (err: any) {
      console.error('Lỗi tải danh sách khoản thu:', err);
      emitStatusToast({
        title: 'Lỗi tải danh sách khoản thu',
        message: err.message || 'Không thể tải danh sách khoản thu.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, fromDate, toDate, searchQuery, collectionsPage]);

  useEffect(() => {
    fetchReconciliation();
  }, [fetchReconciliation]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  // Handler Nộp tiền về công ty
  const handleRemitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remitModalItem) return;
    setActionLoading(true);
    try {
      await submitRemittanceApi(remitModalItem.id, { remittance_note: remitNote }, token);
      emitStatusToast({
        title: 'Nộp tiền thành công',
        message: `Đã chuyển khoản thu ${remitModalItem.code} sang trạng thái "Đã nộp", chờ Kế toán đối chiếu xác nhận.`,
        type: 'success',
      });
      setRemitModalItem(null);
      setRemitNote('');
      fetchCollections();
      fetchReconciliation();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi nộp tiền',
        message: err.message || 'Không thể nộp tiền về công ty.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler Nộp nhiều khoản cùng lúc
  const handleBulkRemit = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xác nhận nộp ${selectedIds.length} khoản thu đã chọn về công ty?`)) return;
    setActionLoading(true);
    try {
      const res = await bulkSubmitRemittanceApi({ collection_ids: selectedIds }, token);
      emitStatusToast({
        title: 'Nộp tiền theo lô thành công',
        message: `Đã nộp thành công ${res.updated_count} khoản thu với tổng số tiền ${formatMoney(res.total_amount)}.`,
        type: 'success',
      });
      setSelectedIds([]);
      fetchCollections();
      fetchReconciliation();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi nộp theo lô',
        message: err.message || 'Không thể nộp theo lô.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler Kế toán xác nhận nhận tiền
  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModalItem) return;
    setActionLoading(true);
    try {
      await confirmPaymentCollectionApi(confirmModalItem.id, { confirmation_note: confirmNote }, token);
      emitStatusToast({
        title: 'Xác nhận thu tiền thành công',
        message: `Khoản thu ${confirmModalItem.code} (${formatMoney(confirmModalItem.amount)}) đã được Kế toán duyệt khớp quỹ.`,
        type: 'success',
      });
      setConfirmModalItem(null);
      setConfirmNote('');
      fetchCollections();
      fetchReconciliation();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi xác nhận nhận tiền',
        message: err.message || 'Không thể xác nhận nhận tiền.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler Kế toán duyệt nhận tiền theo lô
  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Xác nhận đã nhận và khớp quỹ cho ${selectedIds.length} khoản thu đã chọn?`)) return;
    setActionLoading(true);
    try {
      const res = await bulkConfirmPaymentCollectionApi({ collection_ids: selectedIds }, token);
      emitStatusToast({
        title: 'Duyệt nhận tiền thành công',
        message: `Đã xác nhận ${res.updated_count} khoản thu với tổng tiền ${formatMoney(res.total_amount)}.`,
        type: 'success',
      });
      setSelectedIds([]);
      fetchCollections();
      fetchReconciliation();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi duyệt theo lô',
        message: err.message || 'Không thể duyệt nhận tiền theo lô.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handler Kế toán từ chối khoản thu (báo lệch)
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalItem) return;
    if (!rejectReason.trim()) {
      emitStatusToast({
        title: 'Cần nhập lý do',
        message: 'Vui lòng nêu rõ lý do chênh lệch hoặc từ chối để NVKD kiểm tra đối chiếu lại.',
        type: 'warning',
      });
      return;
    }
    setActionLoading(true);
    try {
      await rejectPaymentCollectionApi(
        rejectModalItem.id,
        { rejection_reason: rejectReason.trim(), reason: rejectReason.trim() },
        token
      );
      emitStatusToast({
        title: 'Đã từ chối khoản thu',
        message: `Đã trả về khoản thu ${rejectModalItem.code} với lý do: "${rejectReason.trim()}".`,
        type: 'warning',
      });
      setRejectModalItem(null);
      setRejectReason('');
      fetchCollections();
      fetchReconciliation();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi từ chối khoản thu',
        message: err.message || 'Không thể từ chối khoản thu.',
        type: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Trạng thái badge hiển thị
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_REMITTANCE':
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde68a',
              display: 'inline-block',
            }}
          >
            Chờ nộp
          </span>
        );
      case 'SUBMITTED':
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              border: '1px solid #bae6fd',
              display: 'inline-block',
            }}
          >
            Đã nộp (Chờ duyệt)
          </span>
        );
      case 'CONFIRMED':
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#dcfce7',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              display: 'inline-block',
            }}
          >
            Đã khớp quỹ
          </span>
        );
      case 'REJECTED':
        return (
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              display: 'inline-block',
            }}
          >
            Bị từ chối / Lệch
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  if (isCreateView) {
    return (
      <RouteCollectionFormView
        token={token}
        currentUser={currentUser}
        onBack={handleBackFromCreateView}
        onSuccess={() => {
          fetchCollections();
          fetchReconciliation();
          handleBackFromCreateView();
        }}
      />
    );
  }

  if (detailId !== null || detailItem !== null) {
    return (
      <RouteCollectionDetailView
        collection={detailItem}
        collectionId={detailId || undefined}
        token={token}
        currentUser={currentUser}
        onBack={handleBackFromDetail}
        onUpdated={() => {
          fetchCollections();
          fetchReconciliation();
        }}
      />
    );
  }

  const summary = reconciliationData?.summary;

  // Phân trang 10 dòng/trang cho bảng chi tiết đợt đối chiếu (Tiêu chí 3)
  const batchPageSize = 10;
  const batchTotal = selectedBatch?.collections ? selectedBatch.collections.length : 0;
  const batchTotalPages = Math.max(1, Math.ceil(batchTotal / batchPageSize));
  const batchStartIndex = (batchPage - 1) * batchPageSize;
  const visibleBatchCollections = selectedBatch?.collections
    ? selectedBatch.collections.slice(batchStartIndex, batchStartIndex + batchPageSize)
    : [];

  return (
    <div style={{ padding: '20px 24px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', color: '#0f172a' }}>
      {/* 1. KHI Ở CHẾ ĐỘ DANH SÁCH CHÍNH (KHÔNG XEM CHI TIẾT ĐỢT): HIỂN THỊ BANNER, 4 KPI VÀ FILTER */}
      {!selectedBatch && (
        <>
          {/* Top Banner & Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 800,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}
          >
            Thu Tiền Tuyến & Đối Chiếu Quỹ
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Ghi nhận thu tiền tại cửa hàng kèm ảnh biên lai • Trạng thái Chờ nộp • Bảng đối chiếu minh bạch theo nhân viên & ngày
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {canCollect && (
            <button
              type="button"
              onClick={handleOpenCreateView}
              style={{
                padding: '10px 18px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.25)',
              }}
            >
              Ghi nhận khoản thu mới
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              fetchReconciliation();
              fetchCollections();
            }}
            style={{
              padding: '10px 14px',
              backgroundColor: '#f1f5f9',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Tải lại
          </button>
        </div>
      </div>

      {/* 4 Summary KPI Cards (Tiêu chí 3) - Thu nhỏ gọn gàng chuẩn ERP */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '10px 14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Tổng tiền đã thu tại tuyến
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#0f172a',
              marginTop: '2px',
            }}
          >
            {formatMoney(summary?.grand_total_collected || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
            {summary?.total_sales_staff || 0} nhân viên thu trong {summary?.total_days || 0} ngày
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '10px 14px',
            border: '1px solid #fef3c7',
            borderLeft: '3px solid #f59e0b',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Chờ nộp về công ty (Còn ở NVKD)
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#b45309',
              marginTop: '2px',
            }}
          >
            {formatMoney(summary?.grand_total_pending_remittance || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#92400e', marginTop: '2px' }}>
            NVKD chưa chuyển tiền về thủ quỹ
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '10px 14px',
            border: '1px solid #bae6fd',
            borderLeft: '3px solid #0284c7',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Đã nộp (Chờ KT xác nhận)
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#0284c7',
              marginTop: '2px',
            }}
          >
            {formatMoney(summary?.grand_total_submitted || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#0369a1', marginTop: '2px' }}>
            NVKD đã nộp, chờ Kế toán khớp
          </div>
        </div>

        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '10px 14px',
            border: '1px solid #bbf7d0',
            borderLeft: '3px solid #16a34a',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Đã khớp tiền vào quỹ công ty
          </div>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 800,
              color: '#15803d',
              marginTop: '2px',
            }}
          >
            {formatMoney(summary?.grand_total_confirmed || 0)}
          </div>
          <div style={{ fontSize: '11px', color: '#15803d', marginTop: '2px' }}>
            Đã kiểm đếm và ghi sổ quỹ cty
          </div>
        </div>
      </div>
      </>
      )}

      {/* 2. TRANG CHI TIẾT ĐỢT ĐỐI CHIẾU: CHỈ CÓ 1 BẢNG DUY NHẤT */}
      {selectedBatch && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
            marginBottom: '32px',
          }}
        >
          {/* Header Bảng: Nút quay lại, Tiêu đề đợt, Trạng thái & Thao tác hàng loạt */}
          <div
            style={{
              padding: '14px 20px',
              backgroundColor: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatch(null);
                  setSelectedIds([]);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  backgroundColor: '#ffffff',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                }}
              >
                &larr; Quay lại Bảng tổng hợp đối chiếu
              </button>
              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: '18px',
                    fontWeight: 800,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  Chi Tiết Đợt Thu: {selectedBatch.sales_name} • Ngày {selectedBatch.date}
                </h1>
              </div>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '6px',
                  backgroundColor: selectedBatch.is_balanced ? '#dcfce7' : '#fef3c7',
                  color: selectedBatch.is_balanced ? '#15803d' : '#92400e',
                  border: selectedBatch.is_balanced ? '1px solid #bbf7d0' : '1px solid #fde68a',
                }}
              >
                {selectedBatch.is_balanced ? 'Cân bằng 100%' : 'Chờ khớp quỹ / Còn lệch'}
              </span>
            </div>

            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>
                  Đã chọn: {selectedIds.length} khoản
                </span>
                {canCollect && (
                  <button
                    type="button"
                    onClick={handleBulkRemit}
                    disabled={actionLoading}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                    }}
                  >
                    Nộp tiền về Cty ({selectedIds.length})
                  </button>
                )}
                {canConfirm && (
                  <button
                    type="button"
                    onClick={handleBulkConfirm}
                    disabled={actionLoading}
                    style={{
                      padding: '7px 14px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    Duyệt nhận tiền ({selectedIds.length})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sub-Header Bảng: Tóm tắt 4 chỉ số trên 1 hàng ngang thẳng tắp, không ngắt dòng */}
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px 32px',
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Tổng thu đợt này:
              </span>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{formatMoney(selectedBatch.total_collected)}</strong>
              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>({selectedBatch.collections_count} khoản)</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>
                Chờ nộp về Cty:
              </span>
              <strong style={{ fontSize: '15px', color: '#b45309' }}>{formatMoney(selectedBatch.total_pending_remittance)}</strong>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase' }}>
                Đã nộp (Chờ duyệt):
              </span>
              <strong style={{ fontSize: '15px', color: '#0284c7' }}>{formatMoney(selectedBatch.total_submitted)}</strong>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                Đã khớp quỹ Cty:
              </span>
              <strong style={{ fontSize: '15px', color: '#15803d' }}>{formatMoney(selectedBatch.total_confirmed)}</strong>
            </div>
          </div>

          {/* Bảng Chi Tiết Toàn Bộ Khoản Thu: Full width 100% */}
          <div
            style={{
              width: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              borderBottom: '1px solid #e2e8f0',
              scrollbarWidth: 'thin',
              scrollbarColor: '#94a3b8 #f1f5f9',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '950px',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
                tableLayout: 'auto',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 6px', width: '36px', minWidth: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        Boolean(visibleBatchCollections.length) &&
                        visibleBatchCollections.every((it) => selectedIds.includes(it.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          const pageIds = visibleBatchCollections.map((it) => it.id);
                          setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
                        } else {
                          const pageIds = new Set(visibleBatchCollections.map((it) => it.id));
                          setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
                        }
                      }}
                    />
                  </th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, width: '135px', minWidth: '135px', whiteSpace: 'nowrap' }}>Mã Khoản Thu</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, minWidth: '150px' }}>Cửa Hàng / Đại Lý</th>
                  <th style={{ padding: '10px 6px', fontWeight: 700, width: '90px', minWidth: '90px', whiteSpace: 'nowrap' }}>Mã Đơn</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>Số Tiền</th>
                  <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'center', width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>Biên Lai</th>
                  <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'center', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, minWidth: '120px' }}>Ghi Chú</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '105px', minWidth: '105px', whiteSpace: 'nowrap' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {!visibleBatchCollections || visibleBatchCollections.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      Không có khoản thu chi tiết trong đợt đối chiếu này.
                    </td>
                  </tr>
                ) : (
                  visibleBatchCollections.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isOwnCollection = currentUser?.id === item.sales_id;
                    const canUserConfirmThis = canConfirm && (!isOwnCollection || isAdmin);

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        }}
                      >
                        <td style={{ padding: '10px 6px', textAlign: 'center', width: '36px', minWidth: '36px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds((prev) => [...prev, item.id]);
                              } else {
                                setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 8px', width: '135px', minWidth: '135px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              fontWeight: 700,
                              color: '#1e3a8a',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontSize: '12.5px',
                              textAlign: 'left',
                            }}
                            title="Bấm để xem chi tiết khoản thu"
                          >
                            {item.code}
                          </button>
                        </td>
                        <td style={{ padding: '10px 8px', minWidth: '150px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>{item.dealer_name}</div>
                          {item.route_name && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{item.route_name}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 6px', color: '#64748b', width: '90px', minWidth: '90px', whiteSpace: 'nowrap', fontSize: '12px' }}>
                          {item.order_code || '—'}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>
                          {formatMoney(item.amount)}
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
                            {item.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>
                          {item.receipt_image_url ? (
                            <div
                              onClick={() =>
                                setLightboxImage({
                                  url: item.receipt_image_url,
                                  title: `Biên lai ${item.code} - ${item.dealer_name}`,
                                })
                              }
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <img
                                src={item.receipt_image_url}
                                alt="Biên lai"
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '6px',
                                  objectFit: 'cover',
                                  border: '1px solid #cbd5e1',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                }}
                              />
                              <span style={{ fontSize: '10.5px', color: '#2563eb', textDecoration: 'underline' }}>
                                Xem ảnh
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#ef4444', fontSize: '11.5px' }}>Thiếu ảnh</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(item.status)}
                          {item.rejection_reason && (
                            <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>
                              Lý do: {item.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', color: '#64748b', minWidth: '120px', fontSize: '12px' }}>
                          {item.note || item.remittance_note || item.confirmation_note || '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', width: '105px', minWidth: '105px', position: 'relative' }}>
                          <div className="payment-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionId((prev) => (prev === item.id ? null : item.id));
                              }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: openActionId === item.id ? '#f1f5f9' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#1e293b',
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>Thao tác</span>
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#64748b"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  transform: openActionId === item.id ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.15s ease',
                                }}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>

                            {openActionId === item.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 'calc(100% + 4px)',
                                  zIndex: 100,
                                  backgroundColor: '#ffffff',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                                  minWidth: '155px',
                                  padding: '5px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left',
                                }}
                              >
                                {/* 1. Chi tiết */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDetail(item);
                                    setOpenActionId(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    borderRadius: '5px',
                                    fontSize: '12.5px',
                                    color: '#334155',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    whiteSpace: 'nowrap',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>Xem chi tiết</span>
                                </button>

                                {/* 2. Nộp Cty */}
                                {(item.status === 'PENDING_REMITTANCE' || item.status === 'REJECTED') && canCollect && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRemitModalItem(item);
                                      setRemitNote('');
                                      setOpenActionId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '7px 10px',
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      borderRadius: '5px',
                                      fontSize: '12.5px',
                                      color: '#0284c7',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                    <span>Nộp tiền về Cty</span>
                                  </button>
                                )}

                                {/* 3. Duyệt & Từ chối */}
                                {canUserConfirmThis && item.status === 'SUBMITTED' && (
                                  <>
                                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '3px 0' }} />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmModalItem(item);
                                        setConfirmNote('');
                                        setOpenActionId(null);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderRadius: '5px',
                                        fontSize: '12.5px',
                                        color: '#16a34a',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        whiteSpace: 'nowrap',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      <span>Duyệt nhận tiền</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRejectModalItem(item);
                                        setRejectReason('');
                                        setOpenActionId(null);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderRadius: '5px',
                                        fontSize: '12.5px',
                                        color: '#dc2626',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        whiteSpace: 'nowrap',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                      <span>Từ chối / Báo lệch</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang 10 dòng/trang cho bảng chi tiết đợt đối chiếu (Tiêu chí 3) */}
          {renderPaginationBar(
            batchPage,
            batchTotalPages,
            batchTotal,
            batchPageSize,
            setBatchPage,
            'khoản thu trong đợt'
          )}
        </div>
      )}

      {/* 2. THANH TAB CHUYỂN ĐỔI: Chỉ hiện khi ở chế độ danh sách chính (Đảm bảo chỉ có 1 bảng xuất hiện) */}
      {!selectedBatch && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('reconciliation')}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: activeTab === 'reconciliation' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: activeTab === 'reconciliation' ? '#eff6ff' : '#ffffff',
              color: activeTab === 'reconciliation' ? '#1d4ed8' : '#64748b',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
            }}
          >
            Bảng Tổng Hợp Đối Chiếu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('all_collections')}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: activeTab === 'all_collections' ? '2px solid #2563eb' : '1px solid #cbd5e1',
              backgroundColor: activeTab === 'all_collections' ? '#eff6ff' : '#ffffff',
              color: activeTab === 'all_collections' ? '#1d4ed8' : '#64748b',
              fontWeight: 700,
              fontSize: '13.5px',
              cursor: 'pointer',
            }}
          >
            Danh Sách Tất Cả Khoản Thu
          </button>
        </div>
      )}

      {/* 3. THANH FILTER TOOLBAR: NẰM NGAY TRÊN CÁC BẢNG, Ô TÌM KIẾM ĐỨNG ĐẦU TIÊN */}
      {!selectedBatch && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '10px 14px',
            border: '1px solid #e2e8f0',
            marginBottom: '16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          {/* Ô 1: TÌM KIẾM ĐỨNG ĐẦU TIÊN */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Tìm kiếm
            </label>
            <input
              type="text"
              placeholder="Mã thu, tên đại lý, mã đơn..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setReconPage(1);
                setCollectionsPage(1);
              }}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                minWidth: '220px',
                height: '32px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Ô 2: TỪ NGÀY */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Từ ngày
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setReconPage(1);
                setCollectionsPage(1);
              }}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                height: '32px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Ô 3: ĐẾN NGÀY */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Đến ngày
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setReconPage(1);
                setCollectionsPage(1);
              }}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                height: '32px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Ô 4: TRẠNG THÁI KHOẢN THU */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Trạng thái khoản thu
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCollectionsPage(1);
              }}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                height: '32px',
                boxSizing: 'border-box',
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="PENDING_REMITTANCE">Chờ nộp về công ty</option>
              <option value="SUBMITTED">Đã nộp (Chờ KT duyệt)</option>
              <option value="CONFIRMED">Đã khớp quỹ</option>
              <option value="REJECTED">Bị từ chối / Lệch</option>
            </select>
          </div>

          {/* Ô 5: TRẠNG THÁI ĐỐI CHIẾU */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '2px' }}>
              Trạng thái đối chiếu
            </label>
            <select
              value={balancedOnly === undefined ? 'all' : balancedOnly ? 'balanced' : 'unbalanced'}
              onChange={(e) => {
                if (e.target.value === 'all') setBalancedOnly(undefined);
                else if (e.target.value === 'balanced') setBalancedOnly(true);
                else setBalancedOnly(false);
                setReconPage(1);
              }}
              style={{
                padding: '5px 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                backgroundColor: '#ffffff',
                height: '32px',
                boxSizing: 'border-box',
              }}
            >
              <option value="all">Tất cả bản ghi đối chiếu</option>
              <option value="unbalanced">Có chênh lệch / Chưa khớp 100%</option>
              <option value="balanced">Đã khớp 100% không lệch</option>
            </select>
          </div>

          {/* NÚT XÓA BỘ LỌC KHI ĐANG CÓ LỌC */}
          {(fromDate || toDate || searchQuery || statusFilter !== 'all' || balancedOnly !== undefined) && (
            <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', alignSelf: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setSearchQuery('');
                  setStatusFilter('all');
                  setBalancedOnly(undefined);
                  setReconPage(1);
                  setCollectionsPage(1);
                }}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f1f5f9',
                  fontSize: '12px',
                  color: '#475569',
                  cursor: 'pointer',
                  height: '32px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600,
                }}
                title="Đặt lại bộ lọc để xem toàn bộ ngày"
              >
                ✕ Xóa lọc
              </button>
            </div>
          )}
        </div>
      )}

      {/* KHỐI 1: BẢNG TỔNG HỢP ĐỐI CHIẾU TIỀN THU - TIỀN NỘP THEO NGÀY & NHÂN VIÊN */}
      {!selectedBatch && activeTab === 'reconciliation' && (
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
              padding: '14px 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
                Bảng Tổng Hợp Đối Chiếu Tiền Thu - Tiền Nộp
              </span>
              <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>
                (Tổng thu = Đã nộp + Chờ nộp. Chênh lệch = Tổng thu - Tiền KT đã khớp)
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#64748b' }}>
              Tổng cộng: <strong>{reconciliationData?.total ?? reconciliationData?.items.length ?? 0}</strong> bản ghi đối chiếu
            </div>
          </div>

          <div
            style={{
              width: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              borderBottom: '1px solid #e2e8f0',
              scrollbarWidth: 'thin',
              scrollbarColor: '#94a3b8 #f1f5f9',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '950px',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
                tableLayout: 'auto',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 8px', fontWeight: 700, width: '90px', minWidth: '90px', whiteSpace: 'nowrap' }}>Ngày Thu</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, minWidth: '140px', whiteSpace: 'nowrap' }}>Nhân Viên Kinh Doanh</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '70px', minWidth: '70px', whiteSpace: 'nowrap' }}>Số Khoản</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>Tổng Tiền Thu (1)</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>Tiền Đã Nộp (2)</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>KT Đã Khớp (3)</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>
                    Chênh Lệch (1 - 3)
                  </th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>
                    Tình Trạng Đối Chiếu
                  </th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '100px', minWidth: '100px', whiteSpace: 'nowrap' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      Đang tải bảng đối chiếu...
                    </td>
                  </tr>
                ) : !reconciliationData || reconciliationData.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      Không có dữ liệu đối chiếu trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  reconciliationData.items.map((row: DailyReconciliationItem) => {
                    const rowKey = `${row.date}_${row.sales_id}`;

                    return (
                      <React.Fragment key={rowKey}>
                        <tr
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: row.is_balanced ? '#ffffff' : '#fffbeb',
                          }}
                        >
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: '#0f172a', width: '90px', minWidth: '90px', whiteSpace: 'nowrap' }}>
                            {row.date}
                          </td>
                          <td style={{ padding: '10px 8px', fontWeight: 600, color: '#1e293b', minWidth: '140px', whiteSpace: 'nowrap' }}>
                            {row.sales_name}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', width: '70px', minWidth: '70px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                backgroundColor: '#f1f5f9',
                                fontWeight: 600,
                              }}
                            >
                              {row.collections_count}
                            </span>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a', width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>
                            {formatMoney(row.total_collected)}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#0284c7', fontWeight: 600, width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>
                            {formatMoney(row.total_submitted)}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'right', color: '#16a34a', fontWeight: 600, width: '120px', minWidth: '120px', whiteSpace: 'nowrap' }}>
                            {formatMoney(row.total_confirmed)}
                          </td>
                          <td
                            style={{
                              padding: '10px 8px',
                              textAlign: 'right',
                              fontWeight: 700,
                              width: '120px',
                              minWidth: '120px',
                              whiteSpace: 'nowrap',
                              color: (row.total_collected - row.total_confirmed) > 0 ? '#b45309' : '#16a34a',
                            }}
                          >
                            {formatMoney(row.total_collected - row.total_confirmed)}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', width: '130px', minWidth: '130px', whiteSpace: 'nowrap' }}>
                            {row.is_balanced ? (
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                  border: '1px solid #bbf7d0',
                                }}
                              >
                                Cân bằng 100%
                              </span>
                            ) : (
                              <span
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '9999px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  backgroundColor: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                Còn lệch / Chờ nộp
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', width: '100px', minWidth: '100px', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBatch(row);
                                setBatchPage(1);
                                setSelectedIds([]);
                              }}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: '1px solid #2563eb',
                                backgroundColor: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '12px',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Xem chi tiết
                            </button>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang 10 dòng/trang cho Bảng tổng hợp đối chiếu (Tiêu chí 3) */}
          {renderPaginationBar(
            reconPage,
            reconciliationData?.total_pages || 1,
            reconciliationData?.total ?? reconciliationData?.items.length ?? 0,
            10,
            setReconPage,
            'bản ghi đối chiếu'
          )}
        </div>
      )}

      {/* KHỐI 2: DANH SÁCH CÁC KHOẢN THU TIỀN TUYẾN & DUYỆT NỘP */}
      {!selectedBatch && activeTab === 'all_collections' && (
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
          marginBottom: '32px',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
              Danh Sách Các Khoản Thu Tiền Tuyến
            </span>
            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#2563eb' }}>
                  Đã chọn: {selectedIds.length} khoản
                </span>
                {canCollect && (
                  <button
                    type="button"
                    onClick={handleBulkRemit}
                    disabled={actionLoading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Nộp tiền về Cty ({selectedIds.length})
                  </button>
                )}
                {canConfirm && (
                  <button
                    type="button"
                    onClick={handleBulkConfirm}
                    disabled={actionLoading}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Duyệt nhận tiền ({selectedIds.length})
                  </button>
                )}
              </div>
            )}
          </div>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Tổng cộng: <strong>{listData?.total || 0}</strong> khoản thu
          </span>
        </div>

          <div
            ref={collectionsTableRef}
            onMouseDown={handleTableMouseDown}
            onMouseLeave={handleTableMouseLeave}
            onMouseUp={handleTableMouseUp}
            onMouseMove={handleTableMouseMove}
            style={{
              width: '100%',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              borderBottom: '1px solid #e2e8f0',
              cursor: isDragScrolling ? 'grabbing' : 'auto',
              userSelect: isDragScrolling ? 'none' : 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: '#94a3b8 #f1f5f9',
            }}
          >
            <table
              style={{
                width: '100%',
                minWidth: '950px',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
                tableLayout: 'auto',
              }}
            >
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: '#334155', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 6px', width: '36px', minWidth: '36px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        Boolean(listData?.items.length) &&
                        listData?.items.every((it) => selectedIds.includes(it.id))
                      }
                      onChange={(e) => {
                        if (e.target.checked && listData?.items) {
                          setSelectedIds(listData.items.map((it) => it.id));
                        } else {
                          setSelectedIds([]);
                        }
                      }}
                    />
                  </th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, width: '135px', minWidth: '135px', whiteSpace: 'nowrap' }}>Mã Khoản Thu</th>
                  <th style={{ padding: '10px 6px', fontWeight: 700, width: '85px', minWidth: '85px', whiteSpace: 'nowrap' }}>Ngày Thu</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, minWidth: '140px' }}>Cửa Hàng / Đại Lý</th>
                  <th style={{ padding: '10px 6px', fontWeight: 700, width: '110px', minWidth: '110px', whiteSpace: 'nowrap' }}>NVKD Thu</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'right', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>Số Tiền</th>
                  <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'center', width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>
                    Biên Lai
                  </th>
                  <th style={{ padding: '10px 6px', fontWeight: 700, textAlign: 'center', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>Trạng Thái</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700, textAlign: 'center', width: '105px', minWidth: '105px', whiteSpace: 'nowrap' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#64748b' }}>
                      Đang tải danh sách khoản thu...
                    </td>
                  </tr>
                ) : !listData || listData.items.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      Không tìm thấy khoản thu nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  listData.items.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isOwnCollection = currentUser?.id === item.sales_id;
                    const canUserConfirmThis = canConfirm && (!isOwnCollection || isAdmin);

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                        }}
                      >
                        <td style={{ padding: '10px 6px', textAlign: 'center', width: '36px', minWidth: '36px' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds((prev) => [...prev, item.id]);
                              } else {
                                setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                              }
                            }}
                          />
                        </td>
                        <td style={{ padding: '10px 8px', width: '135px', minWidth: '135px', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              fontWeight: 700,
                              color: '#1e3a8a',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontSize: '12.5px',
                              textAlign: 'left',
                            }}
                            title="Bấm để xem chi tiết khoản thu"
                          >
                            {item.code}
                          </button>
                          {item.order_code && (
                            <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
                              Đơn: {item.order_code}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 6px', color: '#475569', width: '85px', minWidth: '85px', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                          {item.collection_date ? item.collection_date.split('T')[0] : ''}
                        </td>
                        <td style={{ padding: '10px 8px', minWidth: '140px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '12.5px' }}>{item.dealer_name}</div>
                          {item.route_name && (
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{item.route_name}</div>
                          )}
                        </td>
                        <td style={{ padding: '10px 6px', color: '#334155', width: '110px', minWidth: '110px', whiteSpace: 'nowrap', fontSize: '12.5px' }}>
                          {item.sales_name}
                          {isOwnCollection && (
                            <span
                              style={{
                                marginLeft: '4px',
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: '#e2e8f0',
                                color: '#475569',
                              }}
                            >
                              Tôi
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>
                          {formatMoney(item.amount)}
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 400 }}>
                            {item.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', width: '75px', minWidth: '75px', whiteSpace: 'nowrap' }}>
                          {item.receipt_image_url ? (
                            <div
                              onClick={() =>
                                setLightboxImage({
                                  url: item.receipt_image_url,
                                  title: `Biên lai ${item.code} - ${item.dealer_name}`,
                                })
                              }
                              style={{
                                cursor: 'pointer',
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                            >
                              <img
                                src={item.receipt_image_url}
                                alt="Biên lai"
                                style={{
                                  width: '36px',
                                  height: '36px',
                                  borderRadius: '6px',
                                  objectFit: 'cover',
                                  border: '1px solid #cbd5e1',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                                }}
                              />
                              <span style={{ fontSize: '10.5px', color: '#2563eb', textDecoration: 'underline' }}>
                                Xem ảnh
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: '#ef4444', fontSize: '11.5px' }}>Thiếu ảnh</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 6px', textAlign: 'center', width: '115px', minWidth: '115px', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(item.status)}
                          {item.rejection_reason && (
                            <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>
                              Lý do: {item.rejection_reason}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', width: '105px', minWidth: '105px', position: 'relative' }}>
                          <div className="payment-action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionId((prev) => (prev === item.id ? null : item.id));
                              }}
                              style={{
                                padding: '4px 10px',
                                backgroundColor: openActionId === item.id ? '#f1f5f9' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#1e293b',
                                cursor: 'pointer',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>Thao tác</span>
                              <svg
                                width="11"
                                height="11"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#64748b"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  transform: openActionId === item.id ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.15s ease',
                                }}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>

                            {openActionId === item.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 'calc(100% + 4px)',
                                  zIndex: 100,
                                  backgroundColor: '#ffffff',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                                  minWidth: '155px',
                                  padding: '5px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left',
                                }}
                              >
                                {/* 1. Chi tiết */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenDetail(item);
                                    setOpenActionId(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    borderRadius: '5px',
                                    fontSize: '12.5px',
                                    color: '#334155',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    whiteSpace: 'nowrap',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>Xem chi tiết</span>
                                </button>

                                {/* 2. Nộp Cty */}
                                {(item.status === 'PENDING_REMITTANCE' || item.status === 'REJECTED') && canCollect && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setRemitModalItem(item);
                                      setRemitNote('');
                                      setOpenActionId(null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '7px 10px',
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      borderRadius: '5px',
                                      fontSize: '12.5px',
                                      color: '#0284c7',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#eff6ff')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="9 18 15 12 9 6" />
                                    </svg>
                                    <span>Nộp tiền về Cty</span>
                                  </button>
                                )}

                                {/* 3. Duyệt & Báo lệch */}
                                {canUserConfirmThis && item.status === 'SUBMITTED' && (
                                  <>
                                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '3px 0' }} />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setConfirmModalItem(item);
                                        setConfirmNote('');
                                        setOpenActionId(null);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderRadius: '5px',
                                        fontSize: '12.5px',
                                        color: '#16a34a',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        whiteSpace: 'nowrap',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                      </svg>
                                      <span>Duyệt nhận tiền</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setRejectModalItem(item);
                                        setRejectReason('');
                                        setOpenActionId(null);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '7px 10px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        borderRadius: '5px',
                                        fontSize: '12.5px',
                                        color: '#dc2626',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        whiteSpace: 'nowrap',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                    >
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                      </svg>
                                      <span>Từ chối / Báo lệch</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Segregation of duties warning if sales tries to confirm own remittance */}
                            {!isAdmin && isAccountant && isOwnCollection && item.status === 'SUBMITTED' && (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  color: '#64748b',
                                  fontStyle: 'italic',
                                  display: 'block',
                                  marginTop: '2px',
                                }}
                                title="Theo quy tắc phân nhiệm (Segregation of Duties), bạn không thể tự duyệt khoản thu do chính mình tạo ra."
                              >
                                Cần KT khác duyệt
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang 10 dòng/trang cho Danh sách các khoản thu tuyến */}
          {renderPaginationBar(
            collectionsPage,
            listData?.total_pages || 1,
            listData?.total || 0,
            10,
            setCollectionsPage,
            'khoản thu'
          )}
        </div>
      )}

      {/* MODAL 1: GHI NHẬN KHOẢN THU TẠI CỬA HÀNG KÈM ẢNH BIÊN LAI (TIÊU CHÍ 1) */}
      <RouteCollectionModal
        isOpen={isCreateModalOpen}
        token={token}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchCollections();
          fetchReconciliation();
        }}
      />

      {/* MODAL 2: NỘP TIỀN VỀ CÔNG TY (TIÊU CHÍ 2) */}
      {remitModalItem && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Nộp Tiền Về Công Ty
              </h3>
              <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Xác nhận chuyển giao khoản thu <strong>{remitModalItem.code}</strong> cho Kế toán / Thủ quỹ
              </p>

              <div
                style={{
                  backgroundColor: '#f8fafc',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div>
                  Đại lý nộp: <strong>{remitModalItem.dealer_name}</strong>
                </div>
                <div style={{ marginTop: '4px' }}>
                  Số tiền nộp: <strong style={{ color: '#2563eb' }}>{formatMoney(remitModalItem.amount)}</strong>
                </div>
              </div>

              <form onSubmit={handleRemitSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Ghi chú nộp tiền (Mã chuyển khoản / Giấy bàn giao)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Đã nộp tiền mặt cho chị Hương thủ quỹ lúc 17h..."
                    value={remitNote}
                    onChange={(e) => setRemitNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRemitModalItem(null)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#0284c7',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {actionLoading ? 'Đang gửi...' : 'Xác nhận Nộp tiền'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 3: KẾ TOÁN XÁC NHẬN NHẬN TIỀN (TIÊU CHÍ 2) */}
      {confirmModalItem && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                Kế Toán Xác Nhận Nhận Tiền
              </h3>
              <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Xác nhận đã kiểm đếm đủ tiền và khớp vào sổ quỹ cho khoản thu <strong>{confirmModalItem.code}</strong>
              </p>

              <div
                style={{
                  backgroundColor: '#f0fdf4',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  marginBottom: '16px',
                  fontSize: '13px',
                }}
              >
                <div>
                  NVKD nộp: <strong>{confirmModalItem.sales_name}</strong>
                </div>
                <div style={{ marginTop: '4px' }}>
                  Đại lý nộp: <strong>{confirmModalItem.dealer_name}</strong>
                </div>
                <div style={{ marginTop: '4px' }}>
                  Số tiền khớp: <strong style={{ color: '#16a34a', fontSize: '16px' }}>{formatMoney(confirmModalItem.amount)}</strong>
                </div>
              </div>

              <form onSubmit={handleConfirmSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Ghi chú kế toán (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Đã kiểm đếm khớp tiền mặt phiếu thu số PT-001..."
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setConfirmModalItem(null)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {actionLoading ? 'Đang duyệt...' : 'Xác nhận Đã nhận tiền'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 4: KẾ TOÁN TỪ CHỐI / BÁO LỆCH KHOẢN THU (TIÊU CHÍ 2) */}
      {rejectModalItem && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                border: '1px solid #fecaca',
                padding: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#b91c1c' }}>
                Từ Chối / Báo Lệch Khoản Thu
              </h3>
              <p style={{ margin: '4px 0 16px 0', fontSize: '13px', color: '#64748b' }}>
                Khoản thu <strong>{rejectModalItem.code}</strong> sẽ được trả lại cho NVKD{' '}
                <strong>{rejectModalItem.sales_name}</strong> để đối chiếu lại.
              </p>

              <form onSubmit={handleRejectSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#1e293b',
                      marginBottom: '6px',
                    }}
                  >
                    Lý do từ chối / Báo lệch <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="VD: Thiếu 200,000 đ so với biên lai cửa hàng; Ảnh biên lai bị mờ không thấy chữ ký..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setRejectModalItem(null)}
                    disabled={actionLoading}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !rejectReason.trim()}
                    style={{
                      padding: '8px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: actionLoading || !rejectReason.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {actionLoading ? 'Đang gửi...' : 'Xác nhận Từ chối'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 5: XEM CHI TIẾT TOÀN DIỆN KHOẢN THU (POPUP CHI TIẾT) */}
      {selectedDetailItem && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                    Chi Tiết Khoản Thu Tuyến: {selectedDetailItem.code}
                  </h3>
                  {renderStatusBadge(selectedDetailItem.status)}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDetailItem(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  Đóng
                </button>
              </div>

              {/* Scrollable Content */}
              <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Box Số tiền to rõ */}
                <div
                  style={{
                    backgroundColor: '#f0fdf4',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#15803d', textTransform: 'uppercase' }}>
                      Số tiền thu
                    </div>
                    <div style={{ fontSize: '26px', fontWeight: 800, color: '#15803d', marginTop: '2px' }}>
                      {formatMoney(selectedDetailItem.amount)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#166534', fontStyle: 'italic', marginTop: '4px' }}>
                      Bằng chữ: <strong>{convertNumberToVietnameseWords(selectedDetailItem.amount)}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #bbf7d0',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#15803d',
                      }}
                    >
                      Hình thức: {selectedDetailItem.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}
                    </span>
                  </div>
                </div>

                {/* Grid thông tin chung */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    backgroundColor: '#f8fafc',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                  }}
                >
                  <div>
                    <span style={{ color: '#64748b' }}>Cửa hàng / Đại lý: </span>
                    <strong style={{ color: '#0f172a' }}>{selectedDetailItem.dealer_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Ngày thu: </span>
                    <strong style={{ color: '#0f172a' }}>{selectedDetailItem.collection_date}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Nhân viên thu tiền: </span>
                    <strong style={{ color: '#0f172a' }}>{selectedDetailItem.sales_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Tuyến / Khu vực: </span>
                    <strong style={{ color: '#0f172a' }}>{selectedDetailItem.route_name || 'Không xác định'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Đơn hàng liên quan: </span>
                    <strong style={{ color: '#0f172a' }}>{selectedDetailItem.order_code || 'Không gắn đơn'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Thời gian ghi nhận: </span>
                    <span style={{ color: '#0f172a' }}>
                      {selectedDetailItem.created_at ? new Date(selectedDetailItem.created_at).toLocaleString('vi-VN') : '—'}
                    </span>
                  </div>
                  {selectedDetailItem.note && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#64748b' }}>Ghi chú khi thu: </span>
                      <span style={{ color: '#1e293b' }}>{selectedDetailItem.note}</span>
                    </div>
                  )}
                </div>

                {/* Ảnh chứng từ / biên lai thu tiền */}
                <div
                  style={{
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '14px 16px',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                    Ảnh Chụp Biên Lai / Phiếu Thu Cửa Hàng
                  </div>
                  {selectedDetailItem.receipt_image_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <img
                        src={selectedDetailItem.receipt_image_url}
                        alt="Biên lai"
                        style={{
                          maxHeight: '140px',
                          maxWidth: '220px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          objectFit: 'contain',
                          cursor: 'pointer',
                        }}
                        onClick={() =>
                          setLightboxImage({
                            url: selectedDetailItem.receipt_image_url,
                            title: `Biên lai ${selectedDetailItem.code} - ${selectedDetailItem.dealer_name}`,
                          })
                        }
                      />
                      <div>
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxImage({
                              url: selectedDetailItem.receipt_image_url,
                              title: `Biên lai ${selectedDetailItem.code} - ${selectedDetailItem.dealer_name}`,
                            })
                          }
                          style={{
                            padding: '6px 14px',
                            backgroundColor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Xem ảnh phóng to
                        </button>
                        <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                          Nhấp vào ảnh để kiểm tra chữ ký và con dấu cửa hàng.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: '#ef4444', fontSize: '13px' }}>
                      Chưa có ảnh biên lai đính kèm.
                    </div>
                  )}
                </div>

                {/* Lịch sử xử lý & Đối chiếu (Audit Trail) */}
                <div
                  style={{
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '14px 16px',
                    backgroundColor: '#f8fafc',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '10px' }}>
                    Nhật Ký Quy Trình Xử Lý & Đối Chiếu Quỹ
                  </div>

                  {/* Bước 1: Ghi nhận */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ minWidth: '130px', color: '#64748b' }}>1. Ghi nhận tại tuyến:</div>
                    <div style={{ flex: 1, color: '#0f172a' }}>
                      Đã ghi nhận bởi <strong>{selectedDetailItem.sales_name}</strong> lúc{' '}
                      {selectedDetailItem.created_at ? new Date(selectedDetailItem.created_at).toLocaleString('vi-VN') : '—'}
                    </div>
                  </div>

                  {/* Bước 2: Nộp về công ty */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ minWidth: '130px', color: '#64748b' }}>2. Nộp về công ty:</div>
                    <div style={{ flex: 1 }}>
                      {selectedDetailItem.remitted_at ? (
                        <span style={{ color: '#0284c7' }}>
                          Đã nộp lúc {new Date(selectedDetailItem.remitted_at).toLocaleString('vi-VN')}
                          {selectedDetailItem.remittance_note && ` (Ghi chú: "${selectedDetailItem.remittance_note}")`}
                        </span>
                      ) : (
                        <span style={{ color: '#b45309', fontWeight: 600 }}>Chưa nộp tiền về công ty</span>
                      )}
                    </div>
                  </div>

                  {/* Bước 3: Kế toán đối chiếu & khớp quỹ */}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <div style={{ minWidth: '130px', color: '#64748b' }}>3. Khớp quỹ kế toán:</div>
                    <div style={{ flex: 1 }}>
                      {selectedDetailItem.status === 'CONFIRMED' ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>
                          Đã khớp quỹ bởi {selectedDetailItem.confirmed_by_name || 'Kế toán'} lúc{' '}
                          {selectedDetailItem.confirmed_at ? new Date(selectedDetailItem.confirmed_at).toLocaleString('vi-VN') : '—'}
                          {selectedDetailItem.confirmation_note && ` (Ghi chú: "${selectedDetailItem.confirmation_note}")`}
                        </span>
                      ) : selectedDetailItem.status === 'REJECTED' ? (
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                          Bị từ chối bởi {selectedDetailItem.confirmed_by_name || 'Kế toán'} lúc{' '}
                          {selectedDetailItem.confirmed_at ? new Date(selectedDetailItem.confirmed_at).toLocaleString('vi-VN') : '—'}:{' '}
                          "{selectedDetailItem.rejection_reason}"
                        </span>
                      ) : (
                        <span style={{ color: '#64748b' }}>Chờ Kế toán kiểm đếm và khớp quỹ</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid #e2e8f0',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Quick action buttons if applicable */}
                  {(selectedDetailItem.status === 'PENDING_REMITTANCE' || selectedDetailItem.status === 'REJECTED') && canCollect && (
                    <button
                      type="button"
                      onClick={() => {
                        const it = selectedDetailItem;
                        setSelectedDetailItem(null);
                        setRemitModalItem(it);
                        setRemitNote('');
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        backgroundColor: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Nộp tiền về Cty
                    </button>
                  )}

                  {canConfirm && selectedDetailItem.status === 'SUBMITTED' && (currentUser?.id !== selectedDetailItem.sales_id || isAdmin) && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const it = selectedDetailItem;
                          setSelectedDetailItem(null);
                          setConfirmModalItem(it);
                          setConfirmNote('');
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Xác nhận nhận tiền
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const it = selectedDetailItem;
                          setSelectedDetailItem(null);
                          setRejectModalItem(it);
                          setRejectReason('');
                        }}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          backgroundColor: '#ef4444',
                          color: '#ffffff',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Báo lệch / Từ chối
                      </button>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDetailItem(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* LIGHTBOX MODAL: XEM ẢNH BIÊN LAI RÕ NÉT (TIÊU CHÍ 1 & 2) */}
      {lightboxImage && (
        <ModalPortal>
          <div
            onClick={() => setLightboxImage(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '24px',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                maxWidth: '90vw',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
            >
              <div
                style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                }}
              >
                <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
                  {lightboxImage.title}
                </span>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px 8px',
                  }}
                >
                  Đóng
                </button>
              </div>
              <div
                style={{
                  padding: '20px',
                  overflow: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: '#0f172a',
                }}
              >
                <img
                  src={lightboxImage.url}
                  alt={lightboxImage.title}
                  style={{
                    maxHeight: '75vh',
                    maxWidth: '100%',
                    borderRadius: '8px',
                    objectFit: 'contain',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                  }}
                />
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};
