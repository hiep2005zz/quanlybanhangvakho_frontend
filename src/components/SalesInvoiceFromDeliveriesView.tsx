import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  User,
  DeliveryDispatchItem,
  SalesInvoicePreviewData,
  SalesInvoiceDetail,
  InvoiceAdjustmentItem,
  getDeliveryDispatchesForInvoicingApi,
  previewSalesInvoiceApi,
  issueSalesInvoiceApi,
  getSalesInvoiceDetailApi,
  downloadSalesInvoicePdfApi,
  logSalesInvoicePrintApi,
  createInvoiceAdjustmentApi,
  getInvoiceAdjustmentsHistoryApi,
} from '../services/api';
import { ModalPortal } from './ModalPortal';
import { InvoiceAdjustmentDetailModal } from './InvoiceAdjustmentDetailModal';
import './warehouse-management.css';

export interface FilterComboboxOptionItem {
  value: string;
  label?: string;
  subLabel?: string;
  badge?: string;
}

export type FilterComboboxOption = string | FilterComboboxOptionItem;

interface FilterComboboxProps {
  value: string;
  onChange: (val: string) => void;
  options: FilterComboboxOption[];
  placeholder?: string;
  onEnter?: () => void;
  unitLabel?: string;
  stepLimit?: number;
}

/**
 * Ô tìm kiếm kết hợp dropdown danh sách lựa chọn theo lượt (chuẩn 5 đơn/lượt):
 * Độ rộng vừa khít 100% ô nhập, chiều cao giới hạn cuộn gọn gàng,
 * hỗ trợ gõ lọc tức thì, nút xóa nhanh ✕, hiển thị thẻ chi tiết và tự động tải thêm 5 đơn/lượt khi cuộn.
 */
export const FilterCombobox: React.FC<FilterComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Chọn hoặc nhập...',
  onEnter,
  unitLabel = 'đơn',
  stepLimit = 5,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(stepLimit);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return options;
    const term = value.toLowerCase().trim();
    return options.filter((opt) => {
      if (typeof opt === 'string') {
        return opt.toLowerCase().includes(term);
      }
      return (
        opt.value.toLowerCase().includes(term) ||
        (opt.label && opt.label.toLowerCase().includes(term)) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(term))
      );
    });
  }, [options, value]);

  const displayed = useMemo(() => {
    return filtered.slice(0, displayLimit);
  }, [filtered, displayLimit]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onFocus={() => {
            setDisplayLimit(stepLimit);
            setIsOpen(true);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setDisplayLimit(stepLimit);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsOpen(false);
              if (onEnter) onEnter();
            } else if (e.key === 'Escape') {
              setIsOpen(false);
            }
          }}
          className={`w-full h-8 pl-2 ${value ? 'pr-7' : 'pr-5'} text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors placeholder:text-slate-400 text-slate-800`}
        />
        <div className="absolute right-1 flex items-center gap-0.5 text-slate-400">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setDisplayLimit(stepLimit);
                setIsOpen(false);
              }}
              className="w-4 h-4 flex items-center justify-center text-[11px] text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer"
              title="Xóa lựa chọn"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!isOpen) setDisplayLimit(stepLimit);
              setIsOpen(!isOpen);
            }}
            className="w-4 h-4 flex items-center justify-center text-[9px] text-slate-500 hover:text-slate-800 bg-transparent border-0 cursor-pointer"
            title="Xem danh sách chọn"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Dropdown danh sách lựa chọn: 5 đơn/lượt, có thể cuộn hoặc bấm tải thêm */}
      {isOpen && (
        <div className="absolute top-[calc(100%+3px)] left-0 w-full min-w-[260px] bg-white border border-slate-200 rounded-md shadow-xl z-50 overflow-hidden text-left animate-in fade-in duration-150">
          {/* Danh sách cuộn mượt mà có cơ chế tải thêm stepLimit (5 đơn) */}
          <div
            className="max-h-56 overflow-y-auto divide-y divide-slate-100"
            onScroll={(e) => {
              const target = e.currentTarget;
              if (target.scrollHeight - target.scrollTop <= target.clientHeight + 25) {
                if (displayLimit < filtered.length) {
                  setDisplayLimit((prev) => Math.min(prev + stepLimit, filtered.length));
                }
              }
            }}
          >
            {displayed.length === 0 ? (
              <div className="px-3 py-3 text-[11.5px] text-slate-400 text-center">
                Không có {unitLabel} nào phù hợp với &quot;{value}&quot;
              </div>
            ) : (
              displayed.map((opt, idx) => {
                const optVal = typeof opt === 'string' ? opt : opt.value;
                const optLabel = typeof opt === 'string' ? opt : opt.label || opt.value;
                const optSub = typeof opt === 'string' ? null : opt.subLabel;
                const optBadge = typeof opt === 'string' ? null : opt.badge;
                const isSelected = optVal === value;

                return (
                  <div
                    key={`${optVal}-${idx}`}
                    onClick={() => {
                      onChange(optVal);
                      setIsOpen(false);
                      if (onEnter) onEnter();
                    }}
                    className={`px-2.5 py-1.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 text-emerald-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-bold text-xs text-slate-800 truncate">
                        {optLabel}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {optBadge && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            {optBadge}
                          </span>
                        )}
                        {isSelected && (
                          <span className="text-emerald-600 font-bold text-xs ml-1">✓</span>
                        )}
                      </div>
                    </div>
                    {optSub && (
                      <div className="text-[10.5px] text-slate-500 truncate mt-0.5">
                        {optSub}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Nút bấm tải thêm 5 đơn tiếp theo nếu còn */}
          {displayLimit < filtered.length && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDisplayLimit((prev) => Math.min(prev + stepLimit, filtered.length));
              }}
              className="w-full py-1.5 px-2 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold text-center cursor-pointer transition-colors border-t border-emerald-100 select-none block"
            >
              Tải thêm {Math.min(stepLimit, filtered.length - displayLimit)} {unitLabel} tiếp theo... (còn {filtered.length - displayLimit})
            </button>
          )}
        </div>
      )}
    </div>
  );
};

interface SalesInvoiceFromDeliveriesViewProps {
  currentUser: User;
  token: string;
  onBackToWorkflow?: () => void;
}

export const SalesInvoiceFromDeliveriesView: React.FC<SalesInvoiceFromDeliveriesViewProps> = ({
  currentUser,
  token,
}) => {
  // 1. Tab & Bộ lọc
  const [activeTab, setActiveTab] = useState<'PENDING' | 'INVOICED' | 'ADJUSTMENTS' | 'ALL'>('PENDING');
  const [dispatchCodeFilter, setDispatchCodeFilter] = useState('');
  const [orderCodeFilter, setOrderCodeFilter] = useState('');
  const [dealerNameFilter, setDealerNameFilter] = useState('');
  const [warehouseIdFilter, setWarehouseIdFilter] = useState('');
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('');
  const [adjustmentTypeFilter, setAdjustmentTypeFilter] = useState('');
  const [fromDateFilter, setFromDateFilter] = useState('');
  const [toDateFilter, setToDateFilter] = useState('');
  const [quickSearchText, setQuickSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // 2. Dữ liệu bảng & Thống kê
  const [isLoading, setIsLoading] = useState(false);
  const [dispatches, setDispatches] = useState<DeliveryDispatchItem[]>([]);
  const [adjustmentsList, setAdjustmentsList] = useState<InvoiceAdjustmentItem[]>([]);
  const [selectedAdjustmentDetail, setSelectedAdjustmentDetail] = useState<InvoiceAdjustmentItem | null>(null);
  const [quickStats, setQuickStats] = useState({
    total_pending_invoices: 0,
    total_issued_invoices: 0,
    total_adjustments: 0,
    total_pending_amount: 0,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // 3. Selection
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Format currency
  const formatVND = useCallback((amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  }, []);

  const handleResetFilters = () => {
    setQuickSearchText('');
    setDispatchCodeFilter('');
    setOrderCodeFilter('');
    setDealerNameFilter('');
    setWarehouseIdFilter('');
    setDeliveryStatusFilter('');
    setAdjustmentTypeFilter('');
    setFromDateFilter('');
    setToDateFilter('');
    setCurrentPage(1);
  };

  // 4. Modals
  const [previewData, setPreviewData] = useState<SalesInvoicePreviewData | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [invoiceNote, setInvoiceNote] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false);

  // Detail & Print Modal
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<SalesInvoiceDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isPdfDownloading, setIsPdfDownloading] = useState(false);

  // Adjustment (Chứng từ điều chỉnh hóa đơn)
  const [adjustmentType, setAdjustmentType] = useState<'INCREASE' | 'DECREASE' | 'INFO'>('INCREASE');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentSubtotal, setAdjustmentSubtotal] = useState('0');
  const [adjustmentVat, setAdjustmentVat] = useState('0');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  // Success Notification Dialog
  const [successResult, setSuccessResult] = useState<{
    invoiceId: number;
    invoiceCode: string;
    dealerName: string;
    totalAmount: number;
    dispatchesCount: number;
  } | null>(null);

  // Dispatch Detail Drawer & Sub-pages
  const [viewingDispatch, setViewingDispatch] = useState<DeliveryDispatchItem | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'dispatch_detail' | 'adjustment'>('list');

  // State menu 3 chấm thao tác từng dòng
  const [activeDropdownRowId, setActiveDropdownRowId] = useState<number | string | null>(null);
  const [dropdownOpenUpwardMap, setDropdownOpenUpwardMap] = useState<Record<string | number, boolean>>({});

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.wh-action-dropdown-container')) {
        setActiveDropdownRowId(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Toast / Thông báo
  const [toastMessage, setToMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToMessage({ type, text });
    setTimeout(() => {
      setToMessage((cur) => (cur?.text === text ? null : cur));
    }, 4500);
  }, []);

  // Tải dữ liệu phiếu giao hàng hoặc lịch sử chứng từ điều chỉnh từ API
  const fetchDispatches = useCallback(async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'ADJUSTMENTS') {
        const res = await getInvoiceAdjustmentsHistoryApi(token, {
          search: (quickSearchText || dispatchCodeFilter || orderCodeFilter || dealerNameFilter).trim() || undefined,
          adjustment_type: adjustmentTypeFilter || undefined,
          from_date: fromDateFilter || undefined,
          to_date: toDateFilter || undefined,
          page: currentPage,
          page_size: pageSize,
        });

        setAdjustmentsList(res.data || []);
        if (res.quick_stats) {
          setQuickStats((prev) => ({
            ...prev,
            total_adjustments: res.quick_stats.total_adjustments,
          }));
        }
        setTotalPages(res.pagination?.total_pages || 1);
        setTotalRecords(res.pagination?.total_records || 0);
        return;
      }

      const res = await getDeliveryDispatchesForInvoicingApi(token, {
        search: quickSearchText.trim() || undefined,
        dispatch_code: dispatchCodeFilter.trim() || undefined,
        order_code: orderCodeFilter.trim() || undefined,
        dealer_name: dealerNameFilter.trim() || undefined,
        warehouse_id: warehouseIdFilter || undefined,
        from_date: fromDateFilter || undefined,
        to_date: toDateFilter || undefined,
        delivery_status: deliveryStatusFilter || undefined,
        invoice_status: activeTab,
        page: currentPage,
        page_size: pageSize,
      });

      setDispatches(res.data || []);
      setQuickStats({
        total_pending_invoices: res.quick_stats?.total_pending_invoices || 0,
        total_issued_invoices: res.quick_stats?.total_issued_invoices || 0,
        total_adjustments: res.quick_stats?.total_adjustments || 0,
        total_pending_amount: res.quick_stats?.total_pending_amount || 0,
      });
      setTotalPages(res.pagination?.total_pages || 1);
      setTotalRecords(res.pagination?.total_records || 0);
    } catch (err: any) {
      showToast(err.message || 'Không thể tải dữ liệu từ hệ thống', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [
    token,
    quickSearchText,
    dispatchCodeFilter,
    orderCodeFilter,
    dealerNameFilter,
    warehouseIdFilter,
    adjustmentTypeFilter,
    fromDateFilter,
    toDateFilter,
    deliveryStatusFilter,
    activeTab,
    currentPage,
    pageSize,
    showToast,
  ]);

  useEffect(() => {
    fetchDispatches();
  }, [fetchDispatches]);

  // Danh sách phiếu hợp lệ trên trang hiện tại
  const eligibleDispatchesOnPage = useMemo(() => {
    return dispatches.filter((d) => d.is_eligible);
  }, [dispatches]);

  // Kiểm tra Master Checkbox
  const isAllEligibleSelected = useMemo(() => {
    if (eligibleDispatchesOnPage.length === 0) return false;
    return eligibleDispatchesOnPage.every((d) => selectedIds.includes(d.dispatch_id));
  }, [eligibleDispatchesOnPage, selectedIds]);

  const handleToggleSelectAll = () => {
    if (isAllEligibleSelected) {
      // Bỏ chọn tất cả dòng trên trang
      const idsToRemove = new Set(eligibleDispatchesOnPage.map((d) => d.dispatch_id));
      setSelectedIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
    } else {
      // Chọn tất cả dòng đủ điều kiện trên trang
      const newIds = new Set(selectedIds);
      eligibleDispatchesOnPage.forEach((d) => newIds.add(d.dispatch_id));
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelectOne = (dispatchId: number) => {
    setSelectedIds((prev) =>
      prev.includes(dispatchId) ? prev.filter((id) => id !== dispatchId) : [...prev, dispatchId]
    );
  };

  // Tính tổng giá trị các phiếu được chọn
  const selectedSummary = useMemo(() => {
    const selectedDispatches = dispatches.filter((d) => selectedIds.includes(d.dispatch_id));
    const totalAmount = selectedDispatches.reduce((acc, cur) => acc + (cur.total_amount || 0), 0);
    const totalQty = selectedDispatches.reduce((acc, cur) => acc + (cur.total_delivered_quantity || 0), 0);
    const dealerSet = new Set(selectedDispatches.map((d) => d.dealer_name));
    return {
      count: selectedIds.length,
      totalAmount,
      totalQty,
      dealersCount: dealerSet.size,
      dealersNames: Array.from(dealerSet).join(', '),
    };
  }, [dispatches, selectedIds]);

  // Xử lý mở Modal Xem trước hóa đơn gộp
  const handleOpenPreview = async () => {
    if (selectedIds.length === 0) {
      showToast('Vui lòng tích chọn ít nhất một phiếu giao hàng ở bảng bên dưới để xuất hóa đơn.', 'warning');
      return;
    }

    // Kiểm tra nhanh khác đại lý ở Frontend
    if (selectedSummary.dealersCount > 1) {
      showToast(
        `Không thể gộp các phiếu giao hàng thuộc các đại lý khác nhau (${selectedSummary.dealersNames}) vào cùng một hóa đơn. Vui lòng chỉ chọn các phiếu của cùng một đại lý!`,
        'error'
      );
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await previewSalesInvoiceApi(token, selectedIds);
      setPreviewData(res.preview);
      setInvoiceNote('');
    } catch (err: any) {
      setPreviewError(err.message || 'Không thể xem trước hóa đơn.');
      showToast(err.message || 'Lỗi khi xem trước hóa đơn', 'error');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Xử lý xuất hóa đơn trực tiếp 1-click cho từng phiếu trên dòng bảng
  const handleSingleDispatchIssue = async (dispatch: DeliveryDispatchItem) => {
    setSelectedIds([dispatch.dispatch_id]);
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await previewSalesInvoiceApi(token, [dispatch.dispatch_id]);
      setPreviewData(res.preview);
      setInvoiceNote('');
    } catch (err: any) {
      setPreviewError(err.message || 'Không thể xem trước hóa đơn.');
      showToast(err.message || 'Lỗi khi xem trước hóa đơn', 'error');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Xử lý Phát hành hóa đơn (Giao dịch nguyên tử)
  const handleIssueInvoice = async () => {
    if (!previewData || selectedIds.length === 0) return;

    setIsIssuing(true);
    try {
      const res = await issueSalesInvoiceApi(token, {
        dispatch_ids: selectedIds,
        template_code: previewData.template_code || '1/001',
        invoice_series: previewData.invoice_series || 'C26TAA',
        note: invoiceNote.trim() || undefined,
      });

      setPreviewData(null);
      setIssueConfirmOpen(false);
      setSelectedIds([]);

      // Hiển thị dialog thành công
      setSuccessResult({
        invoiceId: res.data.invoice_id,
        invoiceCode: res.data.invoice_code,
        dealerName: res.data.dealer_name,
        totalAmount: res.data.total_amount,
        dispatchesCount: res.data.dispatches_count,
      });

      showToast(`Phát hành thành công hóa đơn bán hàng ${res.data.invoice_code}!`, 'success');
      fetchDispatches();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi phát hành hóa đơn bán hàng.', 'error');
    } finally {
      setIsIssuing(false);
    }
  };

  // Xử lý xem chi tiết hóa đơn đã phát hành
  const handleOpenInvoiceDetail = async (invoiceId: number) => {
    setIsDetailLoading(true);
    setDetailModalOpen(true);
    try {
      const res = await getSalesInvoiceDetailApi(token, invoiceId);
      setSelectedInvoiceDetail(res.data);
    } catch (err: any) {
      showToast(err.message || 'Không thể tải chi tiết hóa đơn.', 'error');
      setDetailModalOpen(false);
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Tải PDF hóa đơn
  const handleDownloadPdf = async (invoiceId: number, invoiceCode: string) => {
    if (isPdfDownloading) return;
    setIsPdfDownloading(true);
    try {
      showToast(`Đang khởi tạo tệp PDF ${invoiceCode}...`, 'warning');
      await downloadSalesInvoicePdfApi(token, invoiceId, invoiceCode);
      showToast(`Tải thành công hóa đơn ${invoiceCode}.pdf!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi tải tệp PDF hóa đơn.', 'error');
    } finally {
      setIsPdfDownloading(false);
    }
  };

  // In hóa đơn trực tiếp
  const handlePrintInvoice = (invoiceId: number) => {
    logSalesInvoicePrintApi(token, invoiceId);
    window.print();
  };

  // Lập chứng từ điều chỉnh hóa đơn
  const handleCreateAdjustment = async () => {
    if (!selectedInvoiceDetail) return;
    if (!adjustmentReason.trim()) {
      showToast('Vui lòng nhập lý do lập chứng từ điều chỉnh hóa đơn.', 'warning');
      return;
    }
    const diffSub = parseFloat(adjustmentSubtotal) || 0;
    const diffV = parseFloat(adjustmentVat) || 0;
    const diffTot = diffSub + diffV;

    setIsSubmittingAdjustment(true);
    try {
      const res = await createInvoiceAdjustmentApi(token, selectedInvoiceDetail.id, {
        adjustment_type: adjustmentType,
        reason: adjustmentReason.trim(),
        difference_subtotal: diffSub,
        difference_vat: diffV,
        difference_total: diffTot,
      });
      showToast(`Đã lập chứng từ điều chỉnh ${res.data?.adjustment_code || ''} thành công!`, 'success');
      setAdjustmentReason('');
      setAdjustmentSubtotal('0');
      setAdjustmentVat('0');
      // Tải lại chi tiết hóa đơn để cập nhật danh sách điều chỉnh
      const refreshRes = await getSalesInvoiceDetailApi(token, selectedInvoiceDetail.id);
      setSelectedInvoiceDetail(refreshRes.data);
      if (viewingDispatch) {
        setViewMode('dispatch_detail');
      } else {
        setViewMode('list');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lập chứng từ điều chỉnh', 'error');
    } finally {
      setIsSubmittingAdjustment(false);
    }
  };

  const renderPaginationBar = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (page: number) => void
  ) => {
    if (totalItems <= 0) return null;

    let pageList: (number | string)[] = [];
    if (totalPages <= 5) {
      pageList = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      if (currentPage <= 3) {
        pageList = [1, 2, 3, '...', totalPages];
      } else if (currentPage >= totalPages - 2) {
        pageList = [1, '...', totalPages - 2, totalPages - 1, totalPages];
      } else {
        pageList = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
      }
    }

    return (
      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Tổng số: <strong style={{ color: '#0f172a' }}>{totalItems}</strong> {activeTab === 'ADJUSTMENTS' ? 'chứng từ' : 'phiếu giao hàng'} | Trang <strong style={{ color: '#0f172a' }}>{currentPage}</strong> / {totalPages}
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            height: '30px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          {currentPage > 1 && (
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              style={{
                width: '30px',
                height: '100%',
                border: 'none',
                borderRight: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
              title="Trang trước"
            >
              ‹
            </button>
          )}

          {pageList.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 8px',
                    height: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '12px',
                    borderRight: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    userSelect: 'none',
                  }}
                >
                  ...
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                style={{
                  minWidth: '30px',
                  padding: '0 6px',
                  height: '100%',
                  border: 'none',
                  borderRight: idx === pageList.length - 1 && currentPage === totalPages ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isActive ? '#059669' : '#ffffff',
                  color: isActive ? '#ffffff' : '#374151',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {pageNum}
              </button>
            );
          })}

          {currentPage < totalPages && (
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              style={{
                width: '30px',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
              title="Trang tiếp"
            >
              ›
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="sales-invoice-view min-h-full bg-slate-50 flex flex-col p-3 sm:p-4 md:p-5 text-slate-800">
      {/* Toast Host: Đặt ở góc dưới bên phải màn hình không bị thanh menu che khuất */}
      {toastMessage && (
        <div
          onClick={() => setToMessage(null)}
          className={`fixed bottom-6 right-6 z-[9999] px-4 py-3 rounded-xl shadow-2xl text-xs sm:text-sm font-medium transition-all cursor-pointer border animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-md ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-300'
              : 'bg-amber-50 text-amber-900 border-amber-300'
          }`}
          title="Bấm để đóng thông báo"
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* =========================================================================
          TRANG CON 1: CHI TIẾT PHIẾU GIAO HÀNG (FULL-PAGE VIEW)
          ========================================================================= */}
      {viewMode === 'dispatch_detail' && viewingDispatch ? (
        <div className="w-full animate-in fade-in duration-150">
          {/* TẤT CẢ TRONG 1 KHUNG DUY NHẤT, NGĂN CÁCH BỞI ĐƯỜNG KẺ MỜ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-200">
            {/* 1. Header Bar điều hướng & Thao tác */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('list');
                    setViewingDispatch(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 cursor-pointer"
                >
                  Quay lại danh sách
                </button>
                <div className="h-5 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <span className="text-xs font-semibold text-emerald-600 block">
                    Chi tiết phiếu giao hàng
                  </span>
                  <h2 className="text-base sm:text-lg font-bold font-mono text-slate-900 m-0">
                    {viewingDispatch.dispatch_code}
                  </h2>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex items-center gap-2">
                {viewingDispatch.invoice_status === 'INVOICED' && viewingDispatch.invoice_info?.invoice_id && (
                  <button
                    type="button"
                    id="btn-dispatch-open-adjustment-top"
                    onClick={async () => {
                      const invId = viewingDispatch.invoice_info!.invoice_id;
                      try {
                        const res = await getSalesInvoiceDetailApi(token, invId);
                        setSelectedInvoiceDetail(res.data);
                        setAdjustmentType('INCREASE');
                        setAdjustmentReason('');
                        setAdjustmentSubtotal('0');
                        setAdjustmentVat('0');
                        setViewMode('adjustment');
                      } catch (err: any) {
                        showToast(err.message || 'Lỗi khi mở chứng từ điều chỉnh', 'error');
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-sm cursor-pointer border-0 transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    <span>Lập chứng từ điều chỉnh</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. Thông tin phiếu giao: 2 Cột */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Cột 1: Đơn hàng & Vận chuyển */}
              <div className="p-4 sm:p-5 space-y-2.5 text-xs">
                <h3 className="text-xs font-bold text-slate-700 pb-2 border-b border-slate-100 flex items-center gap-2 m-0">
                  <span>📦</span> Thông tin đơn hàng & vận chuyển
                </h3>
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-slate-500">Mã đơn hàng:</span>
                  <strong className="font-mono text-slate-800 text-sm">{viewingDispatch.order_code}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-slate-500">Đại lý nhận hàng:</span>
                  <strong className="text-slate-900 text-right">{viewingDispatch.dealer_name}</strong>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-slate-500">Kho xuất hàng:</span>
                  <span className="text-slate-700 font-medium">{viewingDispatch.warehouse_name}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Ngày giao hàng:</span>
                  <span className="text-slate-700 font-medium">{viewingDispatch.delivery_date}</span>
                </div>
              </div>

              {/* Cột 2: Trạng thái & Hóa đơn */}
              <div className="p-4 sm:p-5 space-y-2.5 text-xs">
                <h3 className="text-xs font-bold text-slate-700 pb-2 border-b border-slate-100 flex items-center gap-2 m-0">
                  Trạng thái & hóa đơn bán hàng
                </h3>
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-slate-500">Trạng thái giao:</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {viewingDispatch.delivery_status}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-50">
                  <span className="text-slate-500">Trạng thái hóa đơn:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    viewingDispatch.invoice_status === 'INVOICED'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {viewingDispatch.invoice_status === 'INVOICED' ? 'Đã xuất hóa đơn' : 'Chờ xuất hóa đơn'}
                  </span>
                </div>
                {viewingDispatch.invoice_info?.invoice_code && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-50">
                    <span className="text-slate-500">Mã hóa đơn:</span>
                    <button
                      type="button"
                      onClick={() => viewingDispatch.invoice_info?.invoice_id && handleOpenInvoiceDetail(viewingDispatch.invoice_info.invoice_id)}
                      className="inline-flex items-center gap-1 font-mono font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 transition-colors"
                      title="Bấm để xem chi tiết hóa đơn bán hàng"
                    >
                      <span>{viewingDispatch.invoice_info.invoice_code}</span>
                    </button>
                  </div>
                )}
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500">Tổng giá trị phiếu:</span>
                  <strong className="text-emerald-700 font-bold text-sm font-mono">
                    {formatVND(viewingDispatch.total_amount)}
                  </strong>
                </div>
              </div>
            </div>

            {/* 3. Bảng danh sách mặt hàng thực giao trong phiếu */}
            <div>
              <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
                <h3 className="text-xs font-bold text-slate-700 m-0">
                  Mặt hàng thực giao trong phiếu ({viewingDispatch.items?.length || 0} sản phẩm)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100/70 text-slate-600 font-semibold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 text-center w-12">STT</th>
                      <th className="py-2.5 px-4">Tên sản phẩm</th>
                      <th className="py-2.5 px-4 text-center w-20">ĐVT</th>
                      <th className="py-2.5 px-4 text-right w-24">SL Thực</th>
                      <th className="py-2.5 px-4 text-right w-32">Đơn giá</th>
                      <th className="py-2.5 px-4 text-right w-36">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingDispatch.items && viewingDispatch.items.length > 0 ? (
                      viewingDispatch.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-4 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {it.product_name}
                          </td>
                          <td className="py-2.5 px-4 text-center text-slate-500">
                            {it.unit_name}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-emerald-700 font-mono">
                            {it.delivered_quantity}
                          </td>
                          <td className="py-2.5 px-4 text-right text-slate-700 font-mono">
                            {formatVND(it.unit_price)}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                            {formatVND(it.total_amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 text-xs">
                          Không có mặt hàng nào trong phiếu giao
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tổng tiền dự kiến */}
              <div className="p-4 sm:p-5 bg-emerald-50/50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950">
                  Tổng tiền dự kiến phiếu giao:
                </span>
                <strong className="text-base sm:text-lg font-bold text-emerald-800 font-mono">
                  {formatVND(viewingDispatch.total_amount)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === 'adjustment' && selectedInvoiceDetail ? (
        /* =========================================================================
           TRANG CON 2: LẬP CHỨNG TỪ ĐIỀU CHỈNH HÓA ĐƠN (FULL-PAGE VIEW)
           ========================================================================= */
        <div className="w-full animate-in fade-in duration-150">
          {/* TẤT CẢ TRONG 1 KHUNG DUY NHẤT, NGĂN CÁCH BỞI ĐƯỜNG KẺ MỜ */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-200">
            {/* 1. Header Bar điều hướng & Tiêu đề */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 bg-white">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (viewingDispatch) {
                      setViewMode('dispatch_detail');
                    } else {
                      setViewMode('list');
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300 cursor-pointer"
                >
                  {viewingDispatch ? 'Quay lại chi tiết phiếu' : 'Quay lại danh sách'}
                </button>
                <div className="h-5 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <span className="text-xs font-semibold text-amber-600 block">
                    Kế toán bán hàng & công nợ
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 m-0">
                    Lập Chứng Từ Điều Chỉnh Hóa Đơn
                  </h2>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[11px] text-slate-500 block">Hóa đơn gốc:</span>
                <strong className="font-mono text-emerald-700 text-xs">{selectedInvoiceDetail.invoice_code}</strong>
              </div>
            </div>

            {/* 2. Banner cảnh báo quy chuẩn kế toán */}
            <div className="p-4 bg-amber-50/70 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
              <span className="text-base">⚠️</span>
              <div>
                <strong>Quy chuẩn kế toán bất biến:</strong> Hóa đơn đã phát hành chính thức không được sửa hay xóa trực tiếp.
                Mọi thay đổi về giá trị, tiền thuế hoặc thông tin bắt buộc phải lập chứng từ điều chỉnh để lưu vết kiểm toán và bảo vệ tính toàn vẹn hệ thống.
              </div>
            </div>

            {/* 3. Thông tin hóa đơn gốc cần điều chỉnh */}
            <div className="p-4 sm:p-5 text-xs space-y-2">
              <h3 className="text-xs font-bold text-slate-700 pb-1 m-0">
                Thông tin hóa đơn gốc cần điều chỉnh
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Đại lý:</span>
                  <strong className="text-slate-900 block mt-0.5 truncate">{selectedInvoiceDetail.dealer.name}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Ngày lập hóa đơn:</span>
                  <strong className="text-slate-800 block mt-0.5">{selectedInvoiceDetail.issue_date || '—'}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-500 block text-[11px]">Tổng tiền hóa đơn gốc:</span>
                  <strong className="text-emerald-700 block mt-0.5 font-mono">{formatVND(selectedInvoiceDetail.summary?.total_amount || 0)}</strong>
                </div>
              </div>
            </div>

            {/* 4. Nội dung điều chỉnh */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <h3 className="text-xs font-bold text-slate-700 pb-1 m-0">
                Nội dung điều chỉnh
              </h3>

              {/* Chọn loại điều chỉnh */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Loại chứng từ điều chỉnh: <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('INCREASE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      adjustmentType === 'INCREASE'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-500 ring-2 ring-emerald-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>Điều chỉnh tăng</span>
                    <span className="text-[10.5px] font-normal text-slate-500">Tăng tiền hàng hoặc tiền thuế</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('DECREASE')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      adjustmentType === 'DECREASE'
                        ? 'bg-rose-50 text-rose-800 border-rose-500 ring-2 ring-rose-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>Điều chỉnh giảm</span>
                    <span className="text-[10.5px] font-normal text-slate-500">Giảm tiền hàng hoặc tiền thuế</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentType('INFO')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                      adjustmentType === 'INFO'
                        ? 'bg-blue-50 text-blue-800 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>Điều chỉnh thông tin</span>
                    <span className="text-[10.5px] font-normal text-slate-500">Không thay đổi giá trị tiền</span>
                  </button>
                </div>
              </div>

              {/* Lý do điều chỉnh */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Lý do điều chỉnh: <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="VD: Điều chỉnh giá bán theo phụ lục thỏa thuận, sai sót số lượng giao nhận thực tế..."
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white"
                />
              </div>

              {/* Nhập số tiền chênh lệch (nếu không phải chỉ điều chỉnh thông tin) */}
              {adjustmentType !== 'INFO' && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Chênh lệch tiền hàng (chưa thuế):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={adjustmentSubtotal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAdjustmentSubtotal(val);
                            const sub = parseFloat(val) || 0;
                            setAdjustmentVat(String(Math.round(sub * 0.1)));
                          }}
                          placeholder="0"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                        />
                        <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-medium">VNĐ</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Chênh lệch thuế GTGT (10%):
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={adjustmentVat}
                          onChange={(e) => setAdjustmentVat(e.target.value)}
                          placeholder="0"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                        />
                        <span className="absolute right-3 top-2 text-[11px] text-slate-400 font-medium">VNĐ</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center text-xs gap-2">
                    <span className="font-bold text-slate-700">Tổng chênh lệch thanh toán thực tế:</span>
                    <strong className={`text-base font-bold font-mono ${
                      adjustmentType === 'INCREASE' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {adjustmentType === 'INCREASE' ? '+' : '-'} {formatVND((parseFloat(adjustmentSubtotal) || 0) + (parseFloat(adjustmentVat) || 0))}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Thanh nút bấm hành động */}
            <div className="p-4 sm:p-5 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  if (viewingDispatch) {
                    setViewMode('dispatch_detail');
                  } else {
                    setViewMode('list');
                  }
                }}
                disabled={isSubmittingAdjustment}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer border border-slate-300 bg-white transition-colors"
              >
                Hủy thao tác
              </button>

              <button
                type="button"
                id="btn-submit-adjustment"
                onClick={handleCreateAdjustment}
                disabled={isSubmittingAdjustment}
                className="px-6 py-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-lg shadow-md cursor-pointer border-0 flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmittingAdjustment ? 'Đang lưu chứng từ...' : 'Xác nhận lập chứng từ'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* =========================================================================
              MÀN HÌNH CHÍNH: DANH SÁCH XUẤT HÓA ĐƠN BÁN HÀNG
              ========================================================================= */}
          {/* 1. Tiêu đề trang ra ngoài trên cùng */}
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 leading-tight m-0">
              Xuất Hóa Đơn Bán Hàng
            </h1>
          </div>

          {/* 2. 4 Ô màu thống kê tách ra bên dưới tiêu đề như minh họa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full mb-3">
            {/* Card 1: Chờ xuất HĐ */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '10px',
                padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#b45309' }}>
                Chờ xuất hóa đơn
              </div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#92400e', marginTop: '6px', lineHeight: 1.2 }}>
                {quickStats.total_pending_invoices.toLocaleString()}{' '}
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#b45309' }}>phiếu</span>
              </div>
              <div style={{ fontSize: '11px', color: '#78350f', marginTop: '4px' }}>
                Phiếu giao đủ điều kiện xuất hóa đơn
              </div>
            </div>

            {/* Card 2: Đã xuất HĐ */}
            <div
              style={{
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderLeft: '4px solid #10b981',
                borderRadius: '10px',
                padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#047857' }}>
                Đã xuất hóa đơn
              </div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#065f46', marginTop: '6px', lineHeight: 1.2 }}>
                {quickStats.total_issued_invoices.toLocaleString()}{' '}
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#047857' }}>phiếu</span>
              </div>
              <div style={{ fontSize: '11px', color: '#064e3b', marginTop: '4px' }}>
                Đã phát hành hóa đơn tài chính
              </div>
            </div>

            {/* Card 3: Chứng từ điều chỉnh */}
            <div
              style={{
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
                borderLeft: '4px solid #6366f1',
                borderRadius: '10px',
                padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#4338ca' }}>
                Chứng từ điều chỉnh
              </div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#3730a3', marginTop: '6px', lineHeight: 1.2 }}>
                {(quickStats.total_adjustments || 0).toLocaleString()}{' '}
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#4338ca' }}>chứng từ</span>
              </div>
              <div style={{ fontSize: '11px', color: '#312e81', marginTop: '4px' }}>
                Lịch sử điều chỉnh sai sót hóa đơn
              </div>
            </div>

            {/* Card 4: Tổng tiền dự kiến */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderLeft: '4px solid #3b82f6',
                borderRadius: '10px',
                padding: '12px 16px',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0369a1' }}>
                Tổng tiền dự kiến
              </div>
              <div
                style={{ fontSize: '20px', fontWeight: '800', color: '#1e40af', marginTop: '6px', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={formatVND(quickStats.total_pending_amount)}
              >
                {formatVND(quickStats.total_pending_amount)}
              </div>
              <div style={{ fontSize: '11px', color: '#1e3a8a', marginTop: '4px' }}>
                Doanh số tất cả phiếu chờ xuất
              </div>
            </div>
          </div>

          {/* 3. KHUNG GỘP BỘ LỌC TÌM KIẾM VÀ BẢNG DỮ LIỆU LÀM 1 */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 flex flex-col" style={{ overflow: 'visible' }}>
            {/* 3 nút chuyển trạng thái đặt bên trên thanh tìm kiếm */}
            <div className="p-3 pb-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('PENDING');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'PENDING'
                    ? 'bg-emerald-600 text-white shadow-xs border border-emerald-600'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                Chờ xuất hóa đơn ({quickStats.total_pending_invoices})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('INVOICED');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'INVOICED'
                    ? 'bg-emerald-600 text-white shadow-xs border border-emerald-600'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                Đã xuất hóa đơn ({quickStats.total_issued_invoices})
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ADJUSTMENTS');
                  setCurrentPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'ADJUSTMENTS'
                    ? 'bg-emerald-600 text-white shadow-xs border border-emerald-600'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-300'
                }`}
              >
                Lịch sử chứng từ điều chỉnh ({quickStats.total_adjustments || 0})
              </button>
            </div>

            {/* Phần bộ lọc & tìm kiếm */}
            <div className="p-3 space-y-2.5">
              {/* Thanh tìm kiếm nhanh phong cách Chọn sản phẩm theo kệ (chuẩn 5 đơn/lượt) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="mb-1.5">
                  <span className="text-xs font-bold text-slate-800">
                    Tìm kiếm đơn hàng & phiếu giao
                  </span>
                </div>

                <div className="relative w-full">
                  <input
                    type="text"
                    placeholder="Tìm nhanh theo mã phiếu giao, mã đơn hàng, tên đại lý (VD: GH-001, DH-002, Minh Khang...)..."
                    value={quickSearchText}
                    onChange={(e) => {
                      setQuickSearchText(e.target.value);
                      setCurrentPage(1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setCurrentPage(1);
                        fetchDispatches();
                      }
                    }}
                    className="w-full h-8 px-2.5 pr-7 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-slate-800 placeholder:text-slate-400"
                  />
                  {quickSearchText && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSearchText('');
                        setCurrentPage(1);
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[11px] text-slate-400 hover:text-slate-600 bg-transparent border-0 cursor-pointer"
                      title="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Bộ lọc lưới 4 cột gọn gàng vừa vặn */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end pt-2 border-t border-slate-100">
                {/* Cột 1: Trạng thái giao hoặc Loại điều chỉnh */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {activeTab === 'ADJUSTMENTS' ? 'Loại điều chỉnh' : 'Trạng thái giao'}
                  </label>
                  {activeTab === 'ADJUSTMENTS' ? (
                    <select
                      value={adjustmentTypeFilter}
                      onChange={(e) => setAdjustmentTypeFilter(e.target.value)}
                      className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer transition-colors text-slate-800"
                    >
                      <option value="">Tất cả loại điều chỉnh</option>
                      <option value="INCREASE">Điều chỉnh tăng (+)</option>
                      <option value="DECREASE">Điều chỉnh giảm (-)</option>
                      <option value="INFO">Điều chỉnh thông tin</option>
                    </select>
                  ) : (
                    <select
                      value={deliveryStatusFilter}
                      onChange={(e) => setDeliveryStatusFilter(e.target.value)}
                      className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer transition-colors text-slate-800"
                    >
                      <option value="">Tất cả trạng thái</option>
                      <option value="DELIVERED">Đã giao thành công</option>
                      <option value="PENDING">Đang chờ giao</option>
                      <option value="FAILED">Giao thất bại</option>
                    </select>
                  )}
                </div>

                {/* Cột 2: Từ ngày */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={fromDateFilter}
                    onChange={(e) => setFromDateFilter(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-slate-700"
                  />
                </div>

                {/* Cột 3: Đến ngày */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={toDateFilter}
                    onChange={(e) => setToDateFilter(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors text-slate-700"
                  />
                </div>

                {/* Cột 4: Nút Lọc và Đặt lại */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 invisible select-none">
                    Thao tác
                  </label>
                  <div className="flex items-center gap-1.5 h-8">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPage(1);
                        fetchDispatches();
                      }}
                      className="flex-1 h-8 bg-slate-800 text-white rounded-md text-xs font-semibold hover:bg-slate-900 transition-colors cursor-pointer border-0"
                    >
                      Lọc
                    </button>
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="flex-1 h-8 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer border border-slate-300"
                    >
                      Đặt lại
                    </button>
                  </div>
                </div>
              </div>

              {/* Thanh ngang gộp đặt bên trong ô tìm kiếm với màu nền sáng trang nhã, chiều cao h-7 */}
              {activeTab === 'ADJUSTMENTS' ? (
                <div className="bg-amber-50/80 border border-amber-200/90 rounded py-1 px-2 flex flex-wrap items-center justify-between gap-1.5 text-amber-900 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold uppercase tracking-wider text-[11px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">
                      Sổ Lưu Vết Kế Toán
                    </span>
                    <span className="text-slate-700 font-medium">
                      Ghi nhận đầy đủ lịch sử tất cả các lần điều chỉnh giá trị, tiền thuế hoặc thông tin hóa đơn bán hàng theo nguyên tắc bất biến.
                    </span>
                  </div>
                  <div className="font-bold text-amber-900">
                    Tổng số: {totalRecords} chứng từ
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/90 border border-slate-200/90 rounded py-1 px-2 flex flex-wrap items-center justify-between gap-1.5 text-slate-800">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        id="master-checkbox"
                        checked={isAllEligibleSelected}
                        onChange={handleToggleSelectAll}
                        disabled={eligibleDispatchesOnPage.length === 0}
                        className="w-3.5 h-3.5 text-emerald-600 rounded cursor-pointer"
                      />
                      <span className="text-[11px] font-semibold text-slate-700">
                        Chọn tất cả ({eligibleDispatchesOnPage.length} phiếu đủ điều kiện)
                      </span>
                    </label>

                    <div className="h-3 w-px bg-slate-300 hidden sm:block" />

                    <div className="text-[11px] text-slate-600">
                      Đã chọn: <strong className="text-emerald-700 font-bold text-[11px]">{selectedSummary.count}</strong> phiếu
                      {selectedSummary.count > 0 && (
                        <>
                          {' '}
                          | Tổng tiền:{' '}
                          <strong className="text-slate-900 font-bold text-[11px]">{formatVND(selectedSummary.totalAmount)}</strong>
                          {selectedSummary.dealersCount > 1 && (
                            <span className="ml-1.5 px-1 py-0.2 bg-red-100 text-red-700 text-[10px] rounded border border-red-300 font-semibold">
                              Chọn nhiều đại lý khác nhau
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {selectedSummary.count > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-800 transition-colors cursor-pointer border-0 bg-transparent"
                      >
                        Bỏ chọn
                      </button>
                    )}

                    <button
                      type="button"
                      id="btn-consolidate-issue-invoice"
                      onClick={handleOpenPreview}
                      disabled={isPreviewLoading}
                      title={selectedSummary.count === 0 ? "Vui lòng tích chọn phiếu giao hàng bên dưới" : "Bấm để xem trước và xuất hóa đơn"}
                      className={`px-3 h-7 rounded text-[11px] font-bold transition-all cursor-pointer border-0 ${
                        selectedSummary.count > 0 && !isPreviewLoading
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      }`}
                    >
                      {isPreviewLoading ? 'Đang kiểm tra...' : `Gộp & Xuất Hóa Đơn (${selectedSummary.count})`}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bảng danh sách phiếu giao hàng */}
            <div className="overflow-x-auto w-full border-t border-slate-200" style={{ minHeight: '260px', overflowY: 'visible' }}>
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 shadow-xs">
              <tr className="bg-slate-100/95 text-slate-700 font-semibold uppercase text-[11px] border-b border-slate-200 tracking-wider">
                {activeTab === 'ADJUSTMENTS' ? (
                  <>
                    <th className="px-3 py-2.5 whitespace-nowrap">Mã điều chỉnh</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Hóa đơn gốc</th>
                    <th className="px-3 py-2.5">Đại lý / Khách hàng</th>
                    <th className="px-2.5 py-2.5 text-center whitespace-nowrap">Phân loại</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Người lập & Ngày lập</th>
                    <th className="px-3 py-2.5 text-center whitespace-nowrap">Thao tác</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-2.5 w-10 text-center whitespace-nowrap">
                      <span className="sr-only">Chọn</span>
                    </th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Mã phiếu / Đơn</th>
                    <th className="px-3 py-2.5">Đại lý / Kho xuất</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Ngày giao</th>
                    <th className="px-3 py-2.5 whitespace-nowrap text-center">Trạng thái giao</th>
                    <th className="px-3 py-2.5 whitespace-nowrap text-left">Sản phẩm thực giao (SL)</th>
                    <th className="px-3 py-2.5 whitespace-nowrap text-right">Tổng tiền dự kiến</th>
                    <th className="px-3 py-2.5 whitespace-nowrap text-center">Thao tác</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeTab === 'ADJUSTMENTS' ? (
                isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 whitespace-nowrap text-[11px]">
                      <div>Đang tải lịch sử chứng từ điều chỉnh từ hệ thống...</div>
                    </td>
                  </tr>
                ) : adjustmentsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 whitespace-nowrap text-[11px]">
                      <div className="font-semibold text-slate-700">Chưa có chứng từ điều chỉnh nào</div>
                      <p className="text-[10.5px] text-slate-400 mt-1">
                        Khi hóa đơn đã phát hành có sai sót và được lập chứng từ điều chỉnh, lịch sử sẽ tự động lưu vết tại đây.
                      </p>
                    </td>
                  </tr>
                ) : (
                  adjustmentsList.map((adj) => {
                    return (
                    <tr key={adj.id} className="hover:bg-amber-50/30 transition-colors" style={{ position: 'relative', zIndex: activeDropdownRowId === adj.id ? 50 : 1 }}>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-amber-800 text-xs bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          {adj.adjustment_code}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenInvoiceDetail(adj.invoice_id)}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer bg-transparent border-0 p-0 text-xs flex items-center gap-1"
                          title="Bấm để mở xem hóa đơn gốc"
                        >
                          <span>{adj.invoice_code}</span>
                        </button>
                      </td>
                      <td className="px-3 py-2.5 min-w-[180px]">
                        <div className="font-semibold text-slate-900 text-xs">
                          {adj.dealer_name || 'Khách hàng mua lẻ'}
                        </div>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                          adj.adjustment_type === 'INCREASE'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : adj.adjustment_type === 'DECREASE'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-blue-50 text-blue-800 border-blue-200'
                        }`}>
                          {adj.adjustment_type === 'INCREASE' ? 'Tăng tiền/thuế' : adj.adjustment_type === 'DECREASE' ? 'Giảm tiền/thuế' : 'Thông tin'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 text-xs">
                        <div className="font-medium">{adj.created_at || '—'}</div>
                        <div className="text-[10.5px] text-slate-400">{adj.created_by || '—'}</div>
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap" style={{ position: 'relative', zIndex: activeDropdownRowId === adj.id ? 60 : 1 }}>
                        <div className="wh-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            className={`wh-action-dots-btn ${activeDropdownRowId === adj.id ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const shouldOpenUp = spaceBelow < 190;
                              setDropdownOpenUpwardMap((prev) => ({ ...prev, [adj.id]: shouldOpenUp }));
                              setActiveDropdownRowId((prev) => (prev === adj.id ? null : adj.id));
                            }}
                            title="Tùy chọn thao tác"
                          >
                            <span className="wh-action-dots-icon">
                              <span />
                              <span />
                              <span />
                            </span>
                          </button>

                          {activeDropdownRowId === adj.id && (
                            <div className={`wh-dropdown-menu ${dropdownOpenUpwardMap[adj.id] ? 'open-up' : 'open-down'}`} style={{ minWidth: '145px' }}>
                              <button
                                type="button"
                                className="wh-dropdown-item wh-dropdown-item-primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownRowId(null);
                                  setSelectedAdjustmentDetail(adj);
                                }}
                              >
                                <span>Chi tiết</span>
                              </button>
                              {adj.invoice_id && (
                                <button
                                  type="button"
                                  className="wh-dropdown-item"
                                  style={{ color: '#0284c7', fontWeight: 600 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownRowId(null);
                                    handleOpenInvoiceDetail(adj.invoice_id);
                                  }}
                                >
                                  <span>Xem hóa đơn gốc</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })
                )
              ) : isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 whitespace-nowrap text-[11px]">
                    <div>Đang tải danh sách phiếu giao hàng từ hệ thống...</div>
                  </td>
                </tr>
              ) : dispatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 whitespace-nowrap text-[11px]">
                    <div className="font-semibold text-slate-700">Không tìm thấy phiếu giao hàng nào</div>
                    <p className="text-[10.5px] text-slate-400 mt-1">Hãy thử thay đổi điều kiện lọc hoặc từ khóa tìm kiếm.</p>
                  </td>
                </tr>
              ) : (
                dispatches.map((d) => {
                  const isChecked = selectedIds.includes(d.dispatch_id);
                  const canCheck = d.is_eligible;

                  return (
                    <tr
                      key={d.dispatch_id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isChecked ? 'bg-emerald-50/40' : ''
                      }`}
                      style={{ position: 'relative', zIndex: activeDropdownRowId === d.dispatch_id ? 50 : 1 }}
                    >
                      <td className="px-1.5 py-2 text-center whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!canCheck}
                          onChange={() => handleToggleSelectOne(d.dispatch_id)}
                          title={!canCheck ? (d.invoice_status === 'INVOICED' ? 'Phiếu này đã được xuất hóa đơn' : 'Phiếu chưa giao thành công') : 'Chọn phiếu này để xuất hóa đơn'}
                          className={`w-3.5 h-3.5 rounded cursor-pointer ${
                            !canCheck ? 'opacity-30 cursor-not-allowed' : 'text-emerald-600'
                          }`}
                        />
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 font-mono text-[11px]">
                          {d.dispatch_code}
                        </div>
                        <div className="font-mono text-slate-400 text-[10px]">
                          {d.order_code}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 min-w-[200px]" title={`${d.dealer_name} | ${d.warehouse_name}`}>
                        <div className="font-semibold text-slate-850 text-xs">
                          {d.dealer_name}
                          {d.dealer_phone && <span className="text-[11px] text-slate-500 ml-1 font-normal">({d.dealer_phone})</span>}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {d.warehouse_name}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 text-xs whitespace-nowrap">
                        {d.delivery_date}
                      </td>
                      <td className="px-2 py-2 text-center whitespace-nowrap">
                        {d.delivery_status === 'DELIVERED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Đã giao
                          </span>
                        ) : d.delivery_status === 'FAILED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200">
                            Thất bại
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            Chờ giao
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-left min-w-[220px]">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold text-slate-900 text-[11.5px]">
                            {d.total_delivered_quantity.toLocaleString()} SP
                          </span>
                          <span className="text-slate-500 text-[10px] font-medium">
                            ({d.items_count} mặt hàng)
                          </span>
                        </div>
                        {d.items && d.items.length > 0 ? (
                          <div className="max-h-20 overflow-y-auto space-y-0.5 pr-1 text-[10.5px]">
                            {d.items.map((prod, pIdx) => (
                              <div
                                key={pIdx}
                                className="text-slate-700 truncate"
                                title={`${prod.product_name} (${prod.product_code}) - SL: ${prod.delivered_quantity} ${prod.unit_name || ''}`}
                              >
                                • <span className="font-medium text-slate-800">{prod.product_name}</span>{' '}
                                <span className="text-slate-500">x{prod.delivered_quantity} {prod.unit_name || ''}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400">
                            {d.items_count} mặt hàng
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-2 text-right font-bold text-slate-900 text-[11px] whitespace-nowrap">
                        {formatVND(d.total_amount)}
                      </td>
                      <td className="px-2.5 py-2 text-center whitespace-nowrap" style={{ position: 'relative', zIndex: activeDropdownRowId === d.dispatch_id ? 60 : 1 }}>
                        <div className="wh-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            className={`wh-action-dots-btn ${activeDropdownRowId === d.dispatch_id ? 'active' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const shouldOpenUp = spaceBelow < 190;
                              setDropdownOpenUpwardMap((prev) => ({ ...prev, [d.dispatch_id]: shouldOpenUp }));
                              setActiveDropdownRowId((prev) => (prev === d.dispatch_id ? null : d.dispatch_id));
                            }}
                            title="Tùy chọn thao tác"
                          >
                            <span className="wh-action-dots-icon">
                              <span />
                              <span />
                              <span />
                            </span>
                          </button>

                          {activeDropdownRowId === d.dispatch_id && (() => {
                            const openUpward = !!dropdownOpenUpwardMap[d.dispatch_id];
                            return (
                              <div className={`wh-dropdown-menu ${openUpward ? 'open-up' : 'open-down'}`} style={{ minWidth: '145px' }}>
                                <button
                                  type="button"
                                  className="wh-dropdown-item wh-dropdown-item-primary"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdownRowId(null);
                                    setViewingDispatch(d);
                                    setViewMode('dispatch_detail');
                                  }}
                                >
                                  <span>Chi tiết</span>
                                </button>
                                {d.invoice_status === 'INVOICED' && d.invoice_info?.invoice_id && (
                                  <button
                                    type="button"
                                    className="wh-dropdown-item"
                                    style={{ color: '#0284c7', fontWeight: 600 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownRowId(null);
                                      handleOpenInvoiceDetail(d.invoice_info!.invoice_id);
                                    }}
                                  >
                                    <span>Xem hóa đơn ({d.invoice_info?.invoice_code || 'HĐ'})</span>
                                  </button>
                                )}
                                {d.invoice_status !== 'INVOICED' && d.is_eligible && (
                                  <button
                                    type="button"
                                    className="wh-dropdown-item"
                                    style={{ color: '#16a34a', fontWeight: 600 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownRowId(null);
                                      handleSingleDispatchIssue(d);
                                    }}
                                  >
                                    <span>Xuất hóa đơn</span>
                                  </button>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {renderPaginationBar(currentPage, totalPages, totalRecords, setCurrentPage)}
      </div>
    </>
  )}

      {/* =========================================================================
          6. MODAL XEM TRƯỚC HÓA ĐƠN GỘP (PREVIEW MODAL)
         ========================================================================= */}
      {previewData && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-white inline-block mb-1">
                  Xem Trước Hóa Đơn Trước Khi Phát Hành
                </span>
                <h2 className="text-lg sm:text-xl font-bold">HÓA ĐƠN BÁN HÀNG BÁN BUÔN</h2>
                <p className="text-xs text-emerald-100">
                  Mẫu số: {previewData.template_code} | Ký hiệu: {previewData.invoice_series} | Cấp số chính thức khi bấm phát hành
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border-0 cursor-pointer"
              >
                Đóng
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
              {previewError && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-200 text-xs font-semibold">
                  {previewError}
                </div>
              )}

              {/* Thông tin 2 bên */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Đơn vị bán hàng</div>
                  <div className="font-bold text-slate-900 text-sm">CÔNG TY CỔ PHẦN PHÂN PHỐI & BÁN HÀNG TOÀN QUỐC</div>
                  <div>Mã số thuế: <span className="font-mono font-semibold">0101234567</span></div>
                  <div>Địa chỉ: Tầng 8, Tòa nhà Discovery Complex, 302 Cầu Giấy, Hà Nội</div>
                  <div>Người lập: <strong className="text-slate-800">{previewData.issued_by}</strong></div>
                </div>

                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Đại lý / Khách mua hàng</div>
                  <div className="font-bold text-emerald-950 text-sm">{previewData.dealer.name}</div>
                  <div>Mã đại lý: <span className="font-mono font-semibold text-emerald-800">{previewData.dealer.code}</span></div>
                  <div>Mã số thuế: <span className="font-mono">{previewData.dealer.tax_code || '0108899889'}</span></div>
                  <div>Địa chỉ: {previewData.dealer.address || 'Hà Nội, Việt Nam'}</div>
                  <div>Điện thoại: {previewData.dealer.phone || '—'}</div>
                </div>
              </div>

              {/* Danh sách phiếu giao hàng nguồn */}
              <div>
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span>Danh Sách Phiếu Giao Hàng Nguồn Gộp ({previewData.source_dispatches.length} phiếu)</span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="p-2">Mã phiếu giao</th>
                        <th className="p-2">Mã đơn hàng</th>
                        <th className="p-2">Kho xuất</th>
                        <th className="p-2">Ngày giao</th>
                        <th className="p-2 text-right">SL thực giao</th>
                        <th className="p-2 text-right">Tổng tiền phiếu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.source_dispatches.map((sd) => (
                        <tr key={sd.dispatch_id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-semibold text-emerald-700">{sd.dispatch_code}</td>
                          <td className="p-2 font-mono text-slate-600">{sd.order_code}</td>
                          <td className="p-2 text-slate-600">{sd.warehouse_name}</td>
                          <td className="p-2 text-slate-500">{sd.delivery_date}</td>
                          <td className="p-2 text-right font-bold">{sd.delivered_quantity}</td>
                          <td className="p-2 text-right font-bold text-slate-800">{formatVND(sd.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bảng chi tiết mặt hàng tính theo số lượng thực giao */}
              <div>
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Chi Tiết Mặt Hàng Tính Theo Số Lượng Thực Giao</span>
                  <span className="text-emerald-700 font-semibold lowercase">Đã gộp theo mã SP & đơn giá</span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold text-[11px]">
                      <tr>
                        <th className="p-2 w-10 text-center">STT</th>
                        <th className="p-2">Mã SP</th>
                        <th className="p-2">Tên hàng hóa</th>
                        <th className="p-2 text-center">ĐVT</th>
                        <th className="p-2 text-right">SL Thực</th>
                        <th className="p-2 text-right">Đơn giá bán</th>
                        <th className="p-2 text-right">Tiền trước thuế</th>
                        <th className="p-2 text-right">Thuế GTGT</th>
                        <th className="p-2 text-right">Tổng tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewData.items.map((it) => (
                        <tr key={`${it.product_id}_${it.unit_name}`} className="hover:bg-slate-50">
                          <td className="p-2 text-center text-slate-500">{it.stt}</td>
                          <td className="p-2 font-mono text-slate-600">{it.product_code}</td>
                          <td className="p-2 font-medium text-slate-800">{it.product_name}</td>
                          <td className="p-2 text-center text-slate-600">{it.unit_name}</td>
                          <td className="p-2 text-right font-bold text-emerald-800">{it.delivered_quantity}</td>
                          <td className="p-2 text-right text-slate-700">{formatVND(it.unit_price)}</td>
                          <td className="p-2 text-right font-semibold text-slate-800">{formatVND(it.subtotal)}</td>
                          <td className="p-2 text-right text-slate-600">{formatVND(it.vat_amount)} (10%)</td>
                          <td className="p-2 text-right font-bold text-slate-900">{formatVND(it.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Khối tổng kết thanh toán */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1 max-w-md">
                  <div className="text-[11px] font-semibold text-slate-500">Số tiền viết bằng chữ:</div>
                  <div className="font-semibold text-slate-800 italic">"{previewData.summary.amount_in_words}"</div>
                  <div className="pt-2">
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Ghi chú hóa đơn (tùy chọn):</label>
                    <input
                      type="text"
                      placeholder="Ghi chú điều khoản thanh toán..."
                      value={invoiceNote}
                      onChange={(e) => setInvoiceNote(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="w-full sm:w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Tổng số lượng thực giao:</span>
                    <strong className="text-slate-800 font-bold">{previewData.summary.total_quantity}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Cộng tiền hàng (chưa thuế):</span>
                    <span className="font-semibold">{formatVND(previewData.summary.subtotal_amount)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền thuế GTGT (10%):</span>
                    <span className="font-semibold">{formatVND(previewData.summary.vat_amount)}</span>
                  </div>
                  <div className="h-px bg-slate-200 my-1" />
                  <div className="flex justify-between text-sm font-bold text-emerald-800">
                    <span>TỔNG CỘNG THANH TOÁN:</span>
                    <span>{formatVND(previewData.summary.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
              >
                Quay lại danh sách
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-white cursor-pointer bg-white"
                >
                  Hủy thao tác
                </button>

                <button
                  type="button"
                  id="btn-confirm-issue-invoice"
                  onClick={() => setIssueConfirmOpen(true)}
                  disabled={isIssuing}
                  className="px-6 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md transition-all cursor-pointer border-0 flex items-center gap-2"
                >
                  <span>Phát Hành Hóa Đơn Chính Thức</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}

      {/* Dialog Xác nhận trước khi phát hành */}
      {issueConfirmOpen && previewData && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center animate-in fade-in zoom-in duration-150">
              <h3 className="text-lg font-bold text-slate-900 mb-2">Xác nhận phát hành hóa đơn?</h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Bạn đang phát hành hóa đơn bán hàng cho đại lý{' '}
                <strong className="text-slate-900">{previewData.dealer.name}</strong>, gộp từ{' '}
                <strong className="text-slate-900">{previewData.source_dispatches.length} phiếu giao hàng</strong> với tổng số
                tiền thanh toán là{' '}
                <strong className="text-emerald-700 font-bold">{formatVND(previewData.summary.total_amount)}</strong>.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-left text-[11px] text-amber-900 mb-5">
                <strong>Lưu ý nghiệp vụ kế toán:</strong> Hóa đơn sau khi phát hành thành công sẽ có tính{' '}
                <strong>bất biến</strong>. Số hóa đơn sẽ được cấp tuần tự và các phiếu giao hàng nguồn sẽ không thể tái sử dụng cho hóa đơn khác.
              </div>

              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setIssueConfirmOpen(false)}
                  disabled={isIssuing}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 border border-slate-300 hover:bg-slate-50 cursor-pointer bg-white"
                >
                  Xem lại
                </button>
                <button
                  type="button"
                  id="btn-submit-issue-transaction"
                  onClick={handleIssueInvoice}
                  disabled={isIssuing}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer border-0 flex items-center gap-2"
                >
                  {isIssuing ? 'Đang phát hành...' : 'Đồng ý phát hành'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Dialog Phát hành thành công kèm In / Tải PDF */}
      {successResult && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-center animate-in fade-in zoom-in duration-150">
              <h3 className="text-xl font-bold text-slate-900 mb-1">Phát Hành Thành Công!</h3>
              <p className="text-xs text-slate-500 mb-4">Hóa đơn bán hàng đã được lưu và cấp số chính thức</p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2 mb-5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Mã hóa đơn:</span>
                  <strong className="font-mono text-emerald-700 text-sm">{successResult.invoiceCode}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Đại lý:</span>
                  <strong className="text-slate-800">{successResult.dealerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Số phiếu giao gộp:</span>
                  <span className="font-semibold">{successResult.dispatchesCount} phiếu</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-sm">
                  <span className="text-slate-700 font-bold">Tổng thanh toán:</span>
                  <strong className="text-emerald-700 font-bold">{formatVND(successResult.totalAmount)}</strong>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(successResult.invoiceId, successResult.invoiceCode)}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border-0"
                  >
                    <span>Xuất hóa đơn PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenInvoiceDetail(successResult.invoiceId)}
                    className="w-full py-2.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center gap-1.5 shadow-sm cursor-pointer border-0"
                  >
                    <span>Xem & In</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSuccessResult(null)}
                  className="w-full py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border-0 bg-transparent"
                >
                  Đóng thông báo
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* =========================================================================
          7. MODAL CHI TIẾT HÓA ĐƠN ĐÃ PHÁT HÀNH (KÈM IN & XUẤT PDF & ĐIỀU CHỈNH)
          ========================================================================= */}
      {detailModalOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            {/* CSS Print Stylesheet để khi in trực tiếp không bao giờ bị trắng trang */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-invoice-content, #printable-invoice-content * {
                  visibility: visible !important;
                }
                #printable-invoice-content {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  padding: 24px !important;
                  background: white !important;
                  color: #0f172a !important;
                  overflow: visible !important;
                  z-index: 999999 !important;
                  font-family: inherit !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print\\:hidden {
                  display: none !important;
                }
                @page {
                  size: A4 portrait;
                  margin: 10mm;
                }
              }
            `}</style>
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in duration-200">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between print:hidden">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded inline-block mb-1">
                    Chứng Từ Hóa Đơn Đã Phát Hành (Bất Biến)
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold font-mono">
                    {selectedInvoiceDetail?.invoice_code || 'Chi Tiết Hóa Đơn'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold border-0 cursor-pointer"
                >
                  Đóng
                </button>
              </div>

              {/* Modal Body (In được trực tiếp) */}
              <div id="printable-invoice-content" className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
                {isDetailLoading ? (
                  <div className="p-12 text-center text-slate-500">
                    <div>Đang tải chi tiết hóa đơn...</div>
                  </div>
                ) : selectedInvoiceDetail ? (
                  <>
                    {/* Header Hóa đơn in */}
                    <div className="border-b border-slate-200 pb-3 flex justify-between items-start">
                      <div>
                        <div className="font-bold text-slate-900 text-sm sm:text-base">CÔNG TY CỔ PHẦN PHÂN PHỐI & BÁN HÀNG TOÀN QUỐC</div>
                        <div className="text-slate-600 text-[11.5px] mt-0.5">Địa chỉ: Tầng 8, Discovery Complex, Cầu Giấy, Hà Nội</div>
                        <div className="text-slate-600 text-[11.5px]">Mã số thuế: <span className="font-semibold text-slate-800">0101234567</span> | Hotline: <span className="font-semibold text-slate-800">1900 6868</span></div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-700">Mẫu số: <span className="font-mono font-bold text-slate-900">{selectedInvoiceDetail.template_code}</span></div>
                        <div className="text-xs text-slate-600">Ký hiệu: <span className="font-mono font-bold text-slate-900">{selectedInvoiceDetail.invoice_series}</span></div>
                        <div className="text-sm font-bold text-emerald-700 font-mono mt-0.5">Số: {selectedInvoiceDetail.invoice_code}</div>
                        <div className="text-[11px] text-slate-500">Ngày lập: {selectedInvoiceDetail.issue_date}</div>
                      </div>
                    </div>

                    {/* Tiêu đề Hóa đơn chính giữa */}
                    <div className="text-center py-1">
                      <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900">
                        HÓA ĐƠN BÁN HÀNG
                      </h1>
                      <p className="text-xs text-slate-500 italic mt-0.5">
                        (Hóa đơn giá trị gia tăng kiêm phiếu giao nhận hàng hóa)
                      </p>
                    </div>

                    {/* Thông tin khách hàng */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 text-xs">
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 uppercase font-semibold">Khách hàng / Đại lý mua hàng:</span>
                        <div className="font-bold text-slate-900 text-sm">{selectedInvoiceDetail.dealer.name}</div>
                        <div className="text-slate-600">Mã đại lý: <span className="font-mono font-bold text-slate-800">{selectedInvoiceDetail.dealer.code}</span></div>
                        <div className="text-slate-600">Mã số thuế: <span className="font-mono font-bold text-slate-800">{selectedInvoiceDetail.dealer.tax_code || '0108899889'}</span></div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 uppercase font-semibold">Thông tin nhận hàng & Thanh toán:</span>
                        <div className="text-slate-700">Địa chỉ: {selectedInvoiceDetail.dealer.address || 'Hà Nội'}</div>
                        <div className="text-slate-700">Điện thoại: {selectedInvoiceDetail.dealer.phone || '—'}</div>
                        <div className="text-slate-700">Hình thức thanh toán: <span className="font-semibold text-slate-800">TM / CK (Tiền mặt / Chuyển khoản)</span></div>
                        <div className="text-slate-700">Đồng tiền thanh toán: <span className="font-semibold text-slate-800">{selectedInvoiceDetail.currency || 'VND'}</span></div>
                      </div>
                    </div>

                    {/* Phiếu nguồn liên kết */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-700">Căn cứ theo phiếu giao hàng:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedInvoiceDetail.source_dispatches.map((sd) => (
                          <span
                            key={sd.dispatch_id}
                            className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded text-slate-800 font-mono text-[11px]"
                          >
                            {sd.dispatch_code} ({sd.order_code}) - {sd.delivered_quantity} sp ({formatVND(sd.total_amount)})
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Bảng hàng hóa */}
                    <div className="border border-slate-300 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-300">
                          <tr>
                            <th className="p-2 text-center w-10 border-r border-slate-300">STT</th>
                            <th className="p-2 text-center w-24 border-r border-slate-300">Mã hàng</th>
                            <th className="p-2 border-r border-slate-300">Tên hàng hóa, quy cách</th>
                            <th className="p-2 text-center w-16 border-r border-slate-300">ĐVT</th>
                            <th className="p-2 text-right w-20 border-r border-slate-300">SL Thực</th>
                            <th className="p-2 text-right w-28 border-r border-slate-300">Đơn giá</th>
                            <th className="p-2 text-right w-32">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {selectedInvoiceDetail.items.map((it) => (
                            <tr key={it.stt} className="hover:bg-slate-50">
                              <td className="p-2 text-center text-slate-500 border-r border-slate-200">{it.stt}</td>
                              <td className="p-2 text-center font-mono text-slate-600 border-r border-slate-200">
                                {it.product_code || `SP${String(it.product_id).padStart(4, '0')}`}
                              </td>
                              <td className="p-2 font-medium text-slate-900 border-r border-slate-200">{it.product_name}</td>
                              <td className="p-2 text-center text-slate-600 border-r border-slate-200">{it.unit_name}</td>
                              <td className="p-2 text-right font-bold text-slate-900 border-r border-slate-200">
                                {it.delivered_quantity ?? (it as any).quantity ?? 0}
                              </td>
                              <td className="p-2 text-right text-slate-700 border-r border-slate-200">{formatVND(it.unit_price)}</td>
                              <td className="p-2 text-right font-bold text-slate-900">{formatVND(it.subtotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tổng kết */}
                    <div className="flex justify-between items-start border-t border-slate-300 pt-3">
                      <div className="text-xs text-slate-700 max-w-sm italic space-y-1">
                        <div>
                          Số tiền bằng chữ: <strong className="text-slate-900 not-italic">"{selectedInvoiceDetail.summary.amount_in_words}"</strong>
                        </div>
                        {selectedInvoiceDetail.note && (
                          <div className="text-slate-500 not-italic">
                            Ghi chú: {selectedInvoiceDetail.note}
                          </div>
                        )}
                      </div>
                      <div className="w-72 space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Cộng tiền hàng:</span>
                          <span className="font-semibold text-slate-800">{formatVND(selectedInvoiceDetail.summary.subtotal_amount)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Tiền thuế GTGT (10%):</span>
                          <span className="font-semibold text-slate-800">{formatVND(selectedInvoiceDetail.summary.vat_amount)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm text-emerald-800 pt-1.5 border-t border-slate-300">
                          <span>TỔNG THANH TOÁN:</span>
                          <span className="text-base font-bold text-emerald-700">{formatVND(selectedInvoiceDetail.summary.total_amount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Danh sách Chứng từ điều chỉnh đã lập (Chỉ hiện trên web, ẩn khi in giấy) */}
                    {selectedInvoiceDetail.adjustments && selectedInvoiceDetail.adjustments.length > 0 && (
                      <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 print:hidden">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                            <span>Chứng từ điều chỉnh đã lập ({selectedInvoiceDetail.adjustments.length})</span>
                          </span>
                          <span className="text-[11px] text-amber-700 italic">Theo quy chuẩn hóa đơn bất biến</span>
                        </div>
                        <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-amber-100/60 text-amber-900 font-semibold text-[11px]">
                              <tr>
                                <th className="p-2">Mã điều chỉnh</th>
                                <th className="p-2">Loại điều chỉnh</th>
                                <th className="p-2">Lý do</th>
                                <th className="p-2 text-right">Tiền chênh lệch</th>
                                <th className="p-2">Ngày lập</th>
                                <th className="p-2">Người lập</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {selectedInvoiceDetail.adjustments.map((adj) => (
                                <tr key={adj.id} className="hover:bg-amber-50/40">
                                  <td className="p-2 font-mono font-bold text-amber-800">{adj.adjustment_code}</td>
                                  <td className="p-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      adj.adjustment_type === 'INCREASE'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : adj.adjustment_type === 'DECREASE'
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {adj.adjustment_type === 'INCREASE' ? 'Tăng tiền/thuế' : adj.adjustment_type === 'DECREASE' ? 'Giảm tiền/thuế' : 'Thông tin'}
                                    </span>
                                  </td>
                                  <td className="p-2 text-slate-700">{adj.reason}</td>
                                  <td className="p-2 text-right font-bold text-slate-900">
                                    {adj.difference_total !== 0 ? formatVND(adj.difference_total) : '—'}
                                  </td>
                                  <td className="p-2 text-slate-500 text-[11px]">{adj.created_at || '—'}</td>
                                  <td className="p-2 text-slate-600">{adj.created_by || '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Ký tên */}
                    <div className="grid grid-cols-3 gap-4 text-center pt-8 pb-4 text-xs">
                      <div>
                        <div className="font-bold text-slate-900">Người mua hàng</div>
                        <div className="text-[10px] text-slate-400 italic">(Ký, ghi rõ họ tên)</div>
                        <div className="h-16 flex items-end justify-center">
                          <span className="text-slate-400 text-[11px]">—</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">Người lập hóa đơn</div>
                        <div className="text-[10px] text-slate-400 italic">(Ký, ghi rõ họ tên)</div>
                        <div className="h-16 flex items-end justify-center">
                          <span className="font-bold text-slate-800 text-[11px]">{selectedInvoiceDetail.issued_by || 'Kế toán bán hàng'}</span>
                        </div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">Thủ trưởng đơn vị</div>
                        <div className="text-[10px] text-slate-400 italic">(Ký, đóng dấu)</div>
                        <div className="h-16 flex items-end justify-center">
                          <span className="text-slate-400 text-[11px]">—</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>

              {/* Modal Footer: Nút In hóa đơn và Xuất hóa đơn PDF */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 print:hidden">
                {selectedInvoiceDetail && (
                  <>
                    <button
                      type="button"
                      id="btn-print-invoice"
                      onClick={() => handlePrintInvoice(selectedInvoiceDetail.id)}
                      className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer border-0 active:scale-95 transition-all"
                    >
                      <span>In hóa đơn</span>
                    </button>
                    <button
                      type="button"
                      id="btn-export-invoice-pdf"
                      disabled={isPdfDownloading}
                      onClick={() => handleDownloadPdf(selectedInvoiceDetail.id, selectedInvoiceDetail.invoice_code)}
                      className={`px-4 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all border-0 ${
                        isPdfDownloading
                          ? 'bg-blue-400 text-white cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-95'
                      }`}
                    >
                      <span>{isPdfDownloading ? 'Đang xuất PDF...' : 'Xuất hóa đơn PDF'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* 8. MODAL CHI TIẾT CHỨNG TỪ ĐIỀU CHỈNH HÓA ĐƠN (KÈM IN & XUẤT PDF) */}
      {selectedAdjustmentDetail && (
        <InvoiceAdjustmentDetailModal
          adjustment={selectedAdjustmentDetail}
          currentUser={currentUser}
          onClose={() => setSelectedAdjustmentDetail(null)}
          onOpenOriginalInvoice={(invoiceId) => {
            setSelectedAdjustmentDetail(null);
            handleOpenInvoiceDetail(invoiceId);
          }}
        />
      )}

    </div>
  );
};

export default SalesInvoiceFromDeliveriesView;
