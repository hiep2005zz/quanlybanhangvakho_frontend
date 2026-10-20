import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { User } from '../services/api';
import type {
  DealerDebtSummary,
  InvoiceAllocationOption,
  FifoPreviewItem,
  PaymentReceipt,
} from '../types/debtPayment';
import {
  getAllDealersDebtSummaryApi,
  getDealerDebtSummaryApi,
  getDealerInvoicesForAllocationApi,
  createPaymentReceiptApi,
  getPaymentReceiptsApi,
  getPaymentReceiptDetailApi,
  createPaymentAdjustmentApi,
} from '../services/debtPaymentApi';
import { convertNumberToVietnameseWords } from '../utils/numberToWords';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';
import './debt-payment.css';

interface DebtPaymentReconciliationViewProps {
  currentUser: User;
  token: string;
  initialDealerId?: number | null;
  onBackToHome?: () => void;
}

const formatVND = (val?: number | null): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(val || 0);

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
};

const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime())
    ? dateStr
    : `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`;
};

export const DebtPaymentReconciliationView: React.FC<DebtPaymentReconciliationViewProps> = ({
  currentUser,
  token,
  initialDealerId,
}) => {
  // Navigation tabs: Ghi nhận & Đối trừ vs Lịch sử phiếu thu & Điều chỉnh
  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');

  // Dealers list
  const [dealers, setDealers] = useState<DealerDebtSummary[]>([]);
  const [selectedDealerId, setSelectedDealerId] = useState<number | null>(initialDealerId || null);
  const [dealerSearchQuery, setDealerSearchQuery] = useState<string>('');
  const [loadingDealers, setLoadingDealers] = useState<boolean>(true);

  // Dealer custom dropdown state (theo phong cách Ảnh 1)
  const [isDealerDropdownOpen, setIsDealerDropdownOpen] = useState<boolean>(false);
  const dealerDropdownRef = useRef<HTMLDivElement>(null);
  const dealerSearchInputRef = useRef<HTMLInputElement>(null);

  // Selected dealer summary & invoices
  const [dealerSummary, setDealerSummary] = useState<DealerDebtSummary | null>(null);
  const [invoices, setInvoices] = useState<InvoiceAllocationOption[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState<boolean>(false);

  // Payment form state
  const [amountStr, setAmountStr] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('Chuyển khoản');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [collectorName, setCollectorName] = useState<string>(
    currentUser.full_name || currentUser.username || 'Kế toán công nợ'
  );
  const [note, setNote] = useState<string>('');

  // Allocation mode: AUTO_FIFO or MANUAL
  const [allocationMode, setAllocationMode] = useState<'AUTO_FIFO' | 'MANUAL'>('AUTO_FIFO');
  const [manualAllocations, setManualAllocations] = useState<Record<number, number>>({});
  const [fifoPreview, setFifoPreview] = useState<FifoPreviewItem[]>([]);

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Receipts history state
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState<boolean>(false);

  // Danh sách ID hoá đơn vừa được thanh toán thành công để highlight chuyển trạng thái
  const [recentlyPaidInvoiceIds, setRecentlyPaidInvoiceIds] = useState<number[]>([]);

  // Adjustment Modal state (Tiêu chí 5)
  const [adjustingReceipt, setAdjustingReceipt] = useState<PaymentReceipt | null>(null);
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [adjustmentAmounts, setAdjustmentAmounts] = useState<Record<number, string>>({});
  const [adjustingSubmitting, setAdjustingSubmitting] = useState<boolean>(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);

  // Detail Modal state for viewed receipt (Hoá đơn đã trừ)
  const [viewingReceiptDetail, setViewingReceiptDetail] = useState<PaymentReceipt | null>(null);

  // Load all dealers initially
  const loadDealers = useCallback(async () => {
    setLoadingDealers(true);
    try {
      const data = await getAllDealersDebtSummaryApi(token);
      setDealers(data);
      if (!selectedDealerId && data.length > 0) {
        const withDebt = data.find((d) => d.total_remaining_debt > 0) || data[0];
        setSelectedDealerId(withDebt.dealer_id);
      }
    } catch (err: any) {
      console.error('Lỗi tải danh sách đại lý:', err);
      setErrorMessage(err.message || 'Không thể tải danh sách đại lý.');
    } finally {
      setLoadingDealers(false);
    }
  }, [token, selectedDealerId]);

  useEffect(() => {
    loadDealers();
  }, [loadDealers]);

  // Load selected dealer debt summary and invoices
  const loadDealerDetails = useCallback(
    async (dealerId: number, silent: boolean = false) => {
      if (!silent) setLoadingInvoices(true);
      try {
        const [summary, invs] = await Promise.all([
          getDealerDebtSummaryApi(token, dealerId),
          getDealerInvoicesForAllocationApi(token, dealerId),
        ]);
        setDealerSummary(summary);
        setInvoices(invs);
      } catch (err: any) {
        console.error('Lỗi tải thông tin công nợ đại lý:', err);
        setErrorMessage(err.message || 'Không thể tải chi tiết công nợ của đại lý.');
      } finally {
        if (!silent) setLoadingInvoices(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (selectedDealerId) {
      loadDealerDetails(selectedDealerId);
      setManualAllocations({});
    } else {
      setDealerSummary(null);
      setInvoices([]);
    }
  }, [selectedDealerId, loadDealerDetails]);

  const selectedDealer = useMemo(() => {
    return dealers.find((d) => d.dealer_id === selectedDealerId) || null;
  }, [dealers, selectedDealerId]);

  // Đóng dropdown khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dealerDropdownRef.current && !dealerDropdownRef.current.contains(event.target as Node)) {
        setIsDealerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Đóng dropdown khi nhấn Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDealerDropdownOpen) {
        setIsDealerDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDealerDropdownOpen]);

  // Tự động focus vào ô tìm kiếm khi mở dropdown
  useEffect(() => {
    if (isDealerDropdownOpen && dealerSearchInputRef.current) {
      setTimeout(() => {
        dealerSearchInputRef.current?.focus();
      }, 50);
    }
  }, [isDealerDropdownOpen]);

  // Xóa từ khóa tìm kiếm khi đóng dropdown
  useEffect(() => {
    if (!isDealerDropdownOpen) {
      setDealerSearchQuery('');
    }
  }, [isDealerDropdownOpen]);

  // Load receipts history
  const loadReceipts = useCallback(async () => {
    setLoadingReceipts(true);
    try {
      const data = await getPaymentReceiptsApi(token);
      setReceipts(data);
    } catch (err: any) {
      console.error('Lỗi tải lịch sử phiếu thu:', err);
    } finally {
      setLoadingReceipts(false);
    }
  }, [token]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadReceipts();
    }
  }, [activeTab, loadReceipts]);

  // Parse amount and validation
  const numAmount = parseFloat(amountStr) || 0;
  const totalRemainingDebt = dealerSummary?.total_remaining_debt || 0;

  // Validation: Không cho thu vượt tổng công nợ còn lại
  const isOverRemainingDebt = numAmount > totalRemainingDebt + 0.001;
  const isInvalidAmount = amountStr === '' || numAmount <= 0 || isOverRemainingDebt;

  // Running total of manual allocations
  const totalManualAllocated = useMemo(() => {
    return Object.values(manualAllocations).reduce((acc, v) => acc + (v || 0), 0);
  }, [manualAllocations]);

  const isManualAllocationMatched =
    allocationMode === 'MANUAL' &&
    numAmount > 0 &&
    Math.abs(totalManualAllocated - numAmount) < 0.01;

  // Live FIFO calculation preview on client when typing amount in AUTO_FIFO mode
  useEffect(() => {
    if (allocationMode === 'AUTO_FIFO' && numAmount > 0 && !isOverRemainingDebt) {
      let remainingToAlloc = numAmount;
      const preview: FifoPreviewItem[] = [];

      for (const inv of invoices) {
        if (inv.remaining_debt <= 0) continue;
        if (remainingToAlloc <= 0) break;

        const alloc = Math.min(remainingToAlloc, inv.remaining_debt);
        const remAfter = Math.max(0, inv.remaining_debt - alloc);
        const newStatus = remAfter === 0 ? 'PAID' : 'PARTIALLY_PAID';
        const newStatusLabel = remAfter === 0 ? 'Đã thanh toán' : 'Thanh toán một phần';

        preview.push({
          invoice_id: inv.id,
          invoice_code: inv.invoice_code,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          total_amount: inv.total_amount,
          paid_before: inv.paid_amount,
          remaining_before: inv.remaining_debt,
          allocated_amount: alloc,
          remaining_after: remAfter,
          new_status: newStatus,
          new_status_label: newStatusLabel,
        });

        remainingToAlloc -= alloc;
      }
      setFifoPreview(preview);
    } else {
      setFifoPreview([]);
    }
  }, [allocationMode, numAmount, invoices, isOverRemainingDebt]);

  // Handle manual allocation input change
  const handleManualAllocationChange = (invoiceId: number, val: number, maxRem: number) => {
    const clamped = Math.max(0, Math.min(val, maxRem));
    setManualAllocations((prev) => {
      const copy = { ...prev };
      if (clamped <= 0) {
        delete copy[invoiceId];
      } else {
        copy[invoiceId] = clamped;
      }
      return copy;
    });
  };

  // Toggle invoice checkbox in manual mode
  const handleToggleInvoiceManual = (inv: InvoiceAllocationOption) => {
    setManualAllocations((prev) => {
      const copy = { ...prev };
      if (copy[inv.id]) {
        delete copy[inv.id];
      } else {
        const curAllocated = Object.values(copy).reduce((a, b) => a + b, 0);
        const needed = Math.max(0, numAmount - curAllocated);
        copy[inv.id] = Math.min(inv.remaining_debt, needed > 0 ? needed : inv.remaining_debt);
      }
      return copy;
    });
  };

  // Handle submit payment receipt: Lưu đầy đủ vào lịch sử phiếu thu
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedDealerId) {
      setErrorMessage('Vui lòng chọn đại lý thanh toán.');
      return;
    }

    if (numAmount <= 0) {
      setErrorMessage('Số tiền thu phải lớn hơn 0.');
      return;
    }

    if (isOverRemainingDebt) {
      setErrorMessage('Số tiền thu không được vượt quá tổng công nợ còn lại của đại lý.');
      return;
    }

    if (allocationMode === 'MANUAL' && !isManualAllocationMatched) {
      setErrorMessage(
        `Tổng số tiền phân bổ (${formatVND(totalManualAllocated)}) phải bằng đúng số tiền thu (${formatVND(numAmount)}).`
      );
      return;
    }

    setSubmitting(true);
    try {
      const allocationsPayload =
        allocationMode === 'MANUAL'
          ? Object.entries(manualAllocations).map(([invId, amt]) => ({
            invoice_id: Number(invId),
            allocated_amount: amt,
          }))
          : undefined;

      const receipt = await createPaymentReceiptApi(token, {
        dealer_id: selectedDealerId,
        amount: numAmount,
        payment_method: paymentMethod,
        payment_date: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        collector_name: collectorName.trim() || undefined,
        note: note.trim() || undefined,
        allocation_mode: allocationMode,
        allocations: allocationsPayload,
        save_history: true,
      });

      // Lưu danh sách ID hoá đơn vừa thanh toán để highlight hiệu ứng chuyển trạng thái
      const paidIds = (receipt.allocations || []).map((a) => a.invoice_id);
      setRecentlyPaidInvoiceIds(paidIds);
      setTimeout(() => {
        setRecentlyPaidInvoiceIds([]);
      }, 12000);

      // Phát thông báo nổi ở góc phải dưới màn hình (Toast) - tự ẩn sau 4 giây (từ 3-5s)
      emitStatusToast({
        title: 'Thanh toán & Đối trừ thành công',
        message: `Đã ghi nhận thanh toán thành công! Mã phiếu thu: ${receipt.receipt_code} (${formatVND(receipt.amount)}). Phiếu thu đã được lưu vào lịch sử và đối trừ vào các hoá đơn tương ứng.`,
        type: 'success',
        actionType: 'create',
        durationMs: 4000,
      });

      // Re-fetch dealer details (silent để không chớp/mất bảng hoá đơn), reload dealers list, reload receipts
      await loadDealerDetails(selectedDealerId, true);
      loadDealers();
      loadReceipts();

      // Reset form fields
      setAmountStr('');
      setNote('');
      setManualAllocations({});
    } catch (err: any) {
      console.error('Lỗi khi ghi nhận thanh toán:', err);
      setErrorMessage(err.message || 'Lỗi khi ghi nhận thanh toán.');
      emitStatusToast({
        title: 'Lỗi ghi nhận thanh toán',
        message: err.message || 'Không thể thực hiện ghi nhận thanh toán và đối trừ.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Mở Modal xem chi tiết phiếu thu & nạp lại thông tin mới nhất từ máy chủ
  const handleOpenReceiptDetail = async (r: PaymentReceipt) => {
    setViewingReceiptDetail(r);
    try {
      const fresh = await getPaymentReceiptDetailApi(token, r.id);
      if (fresh) {
        setViewingReceiptDetail(fresh);
      }
    } catch (e) {
      console.warn('Lỗi tải chi tiết phiếu thu từ server:', e);
    }
  };

  // Mở Modal Lập Bút Toán Điều Chỉnh Phiếu Thu (Điền sẵn mặc định toàn bộ số tiền đã đối trừ)
  const openAdjustmentModal = (r: PaymentReceipt) => {
    setAdjustingReceipt(r);
    setAdjustmentReason('');
    setAdjustmentError(null);
    const initialAmounts: Record<number, string> = {};
    r.allocations.forEach((a) => {
      const curAllocated = a.current_allocated_amount !== undefined ? a.current_allocated_amount : a.allocated_amount;
      initialAmounts[a.id] = String(curAllocated);
    });
    setAdjustmentAmounts(initialAmounts);
  };

  // Kiểm tra tính hợp lệ của Form điều chỉnh
  const isAdjustmentFormValid = useMemo(() => {
    if (!adjustingReceipt) return false;
    if (!adjustmentReason.trim()) return false;
    if (adjustingReceipt.allocations.length === 0) return true;

    let anyReduction = false;
    for (const a of adjustingReceipt.allocations) {
      const curAllocated = a.current_allocated_amount !== undefined ? a.current_allocated_amount : a.allocated_amount;
      const strVal = adjustmentAmounts[a.id] ?? String(curAllocated);
      const newTarget = parseFloat(strVal);
      if (isNaN(newTarget) || newTarget < 0 || newTarget > curAllocated) {
        return false;
      }
      if (curAllocated - newTarget > 0.001) {
        anyReduction = true;
      }
    }
    return anyReduction;
  }, [adjustingReceipt, adjustmentReason, adjustmentAmounts]);

  // Handle confirm adjustment voucher (Tiêu chí 5)
  const handleConfirmAdjustment = async () => {
    if (!adjustingReceipt) return;
    setAdjustmentError(null);

    if (!adjustmentReason.trim()) {
      setAdjustmentError('Lý do điều chỉnh là bắt buộc. Vui lòng nhập lý do giải trình.');
      return;
    }

    // Tính toán số tiền giảm (reduction) = số tiền đang đối trừ - số tiền đối trừ mới
    const invoiceAdjustments: { invoice_id: number; amount: number }[] = [];
    let totalAdjustAmount = 0;

    for (const a of adjustingReceipt.allocations) {
      const curAllocated = a.current_allocated_amount !== undefined ? a.current_allocated_amount : a.allocated_amount;
      const strVal = adjustmentAmounts[a.id] ?? String(curAllocated);
      const newTarget = parseFloat(strVal);

      if (isNaN(newTarget) || newTarget < 0) {
        setAdjustmentError(`Số tiền đối trừ mới trên hoá đơn ${a.invoice_code || '#' + a.invoice_id} không hợp lệ.`);
        return;
      }
      if (newTarget > curAllocated) {
        setAdjustmentError(
          `Số tiền đối trừ mới trên hoá đơn ${a.invoice_code || '#' + a.invoice_id} (${newTarget.toLocaleString('vi-VN')} đ) không được lớn hơn số tiền đang đối trừ hiện tại (${curAllocated.toLocaleString('vi-VN')} đ).`
        );
        return;
      }

      const reduceAmount = Math.max(0, curAllocated - newTarget);
      if (reduceAmount > 0) {
        invoiceAdjustments.push({
          invoice_id: a.invoice_id,
          amount: reduceAmount,
        });
        totalAdjustAmount += reduceAmount;
      }
    }

    if (totalAdjustAmount <= 0) {
      setAdjustmentError('Vui lòng giảm số tiền đối trừ ít nhất 1 đ để lập bút toán điều chỉnh.');
      return;
    }

    setAdjustingSubmitting(true);
    try {
      const adj = await createPaymentAdjustmentApi(token, adjustingReceipt.id, {
        reason: adjustmentReason.trim(),
        adjustment_amount: totalAdjustAmount,
        invoice_id: adjustingReceipt.allocations.length === 1 ? adjustingReceipt.allocations[0].invoice_id : undefined,
        invoice_adjustments: invoiceAdjustments,
      });

      setAdjustingReceipt(null);
      setAdjustmentReason('');
      setAdjustmentAmounts({});

      // Phát thông báo nổi góc phải dưới màn hình (Toast) - tự ẩn sau 4 giây (từ 3-5s)
      emitStatusToast({
        title: 'Lập điều chỉnh thành công',
        message: `Đã lập bút toán điều chỉnh ${adj.adjustment_code} thành công! Số tiền ${formatVND(adj.adjustment_amount)} đã được hoàn lại và khôi phục vào các hoá đơn tương ứng.`,
        type: 'info',
        actionType: 'update',
        durationMs: 4000,
      });

      // Refresh data
      await loadReceipts();
      if (selectedDealerId) {
        await loadDealerDetails(selectedDealerId, true);
      }
      loadDealers();
    } catch (err: any) {
      setAdjustmentError(err.message || 'Lỗi khi lập bút toán điều chỉnh.');
    } finally {
      setAdjustingSubmitting(false);
    }
  };

  // Filtered dealers list for select
  const filteredDealers = useMemo(() => {
    if (!dealerSearchQuery.trim()) return dealers;
    const q = dealerSearchQuery.toLowerCase();
    return dealers.filter(
      (d) =>
        d.dealer_name.toLowerCase().includes(q) ||
        d.dealer_code.toLowerCase().includes(q) ||
        (d.phone && d.phone.includes(q))
    );
  }, [dealers, dealerSearchQuery]);

  // FIFO map for preview rendering on table rows
  const fifoMap = useMemo(() => {
    const map = new Map<number, FifoPreviewItem>();
    fifoPreview.forEach((p) => map.set(p.invoice_id, p));
    return map;
  }, [fifoPreview]);

  return (
    <div className="debt-payment-container">
      {/* HEADER SECTION - Đã khôi phục 2 tab, không dùng icon và không có nút về trang chủ */}
      <div className="debt-payment-header">
        <div>
          <h1 className="debt-payment-title">Ghi Nhận Thanh Toán &amp; Đối Trừ Công Nợ</h1>
          <p className="debt-payment-subtitle">
            Phân hệ Kế toán công nợ: Theo dõi hoá đơn công nợ, đối trừ thanh toán theo FIFO hoặc chọn lọc từng hoá đơn.
          </p>
        </div>

        <div className="debt-nav-tabs">
          <button
            type="button"
            className={`debt-nav-tab ${activeTab === 'record' ? 'active' : ''}`}
            onClick={() => setActiveTab('record')}
          >
            Ghi nhận &amp; Đối trừ
          </button>
          <button
            type="button"
            className={`debt-nav-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Lịch sử phiếu thu &amp; Điều chỉnh
          </button>
        </div>
      </div>

      {/* ERROR NOTIFICATIONS */}

      {errorMessage && (
        <div className="debt-alert-danger">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#b91c1c',
              fontWeight: '600',
              fontSize: '12px',
            }}
          >
            Đóng
          </button>
        </div>
      )}

      {activeTab === 'record' ? (
        <>
          {/* DEALER SELECTOR & SUMMARY CARDS */}
          <div className="debt-panel" style={{ padding: '12px 16px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 380px', maxWidth: '520px' }}>
                <label
                  htmlFor="dealer-dropdown-trigger"
                  style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', whiteSpace: 'nowrap' }}
                >
                  Đại lý / Khách hàng:
                </label>

                {/* DROPDOWN CHỌN ĐẠI LÝ CHUẨN GIAO DIỆN ẢNH 1 */}
                <div ref={dealerDropdownRef} style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                  {/* Nút bấm hiển thị đại lý đã chọn */}
                  <button
                    id="dealer-dropdown-trigger"
                    type="button"
                    disabled={loadingDealers}
                    onClick={() => setIsDealerDropdownOpen((prev) => !prev)}
                    style={{
                      width: '100%',
                      minHeight: '38px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: isDealerDropdownOpen ? '1.5px solid #059669' : '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      boxShadow: isDealerDropdownOpen
                        ? '0 0 0 3px rgba(16, 185, 129, 0.15)'
                        : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: loadingDealers ? 'not-allowed' : 'pointer',
                      outline: 'none',
                      transition: 'all 0.15s ease',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, paddingRight: '6px' }}>
                      {selectedDealer ? (
                        <>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#0f172a',
                              background: '#f1f5f9',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #e2e8f0',
                              flexShrink: 0,
                            }}
                          >
                            [{selectedDealer.dealer_code}]
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {selectedDealer.dealer_name}
                          </span>
                          {selectedDealer.total_remaining_debt > 0 ? (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#b91c1c',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                padding: '1.5px 7px',
                                borderRadius: '10px',
                                marginLeft: 'auto',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              Nợ: {formatVND(selectedDealer.total_remaining_debt)}
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 500,
                                color: '#64748b',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '1.5px 7px',
                                borderRadius: '10px',
                                marginLeft: 'auto',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              Nợ: 0 đ
                            </span>
                          )}
                        </>
                      ) : (
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                          {loadingDealers ? 'Đang tải danh sách đại lý...' : 'Chọn đại lý / khách hàng...'}
                        </span>
                      )}
                    </span>

                    {/* Chevron Icon đổi chiều khi mở */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        color: isDealerDropdownOpen ? '#059669' : '#94a3b8',
                        transform: isDealerDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease, color 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Menu Dropdown đổ xuống có thanh tìm kiếm & danh sách đại lý giống Ảnh 1 */}
                  {isDealerDropdownOpen && (
                    <div
                      onWheel={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        width: '100%',
                        minWidth: '380px',
                        maxWidth: '520px',
                        zIndex: 9999,
                        background: '#ffffff',
                        borderRadius: '12px',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                        border: '1px solid #cbd5e1',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Hộp tìm kiếm đại lý phía trên (giống Ảnh 1) */}
                      <div
                        style={{
                          padding: '8px 10px',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          flexShrink: 0,
                          position: 'relative',
                        }}
                      >
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{
                              position: 'absolute',
                              left: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: '#94a3b8',
                              pointerEvents: 'none',
                            }}
                          >
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>

                          <input
                            ref={dealerSearchInputRef}
                            type="text"
                            value={dealerSearchQuery}
                            onChange={(e) => setDealerSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm theo mã đại lý, tên hoặc số điện thoại..."
                            style={{
                              width: '100%',
                              padding: '6px 28px 6px 32px',
                              borderRadius: '8px',
                              fontSize: '12.5px',
                              background: '#ffffff',
                              border: '1.5px solid #10b981',
                              color: '#0f172a',
                              outline: 'none',
                              boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.15)',
                              fontWeight: 500,
                            }}
                          />

                          {dealerSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setDealerSearchQuery('')}
                              style={{
                                position: 'absolute',
                                right: '6px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                padding: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Xóa tìm kiếm"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Danh sách đại lý cuộn (giống Ảnh 1) */}
                      <div
                        style={{
                          overflowY: 'auto',
                          maxHeight: '230px',
                          overscrollBehavior: 'contain',
                        }}
                      >
                        {loadingDealers ? (
                          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                              <circle cx="12" cy="12" r="10" stroke="#cbd5e1" strokeWidth="3" />
                              <path d="M4 12a8 8 0 018-8" stroke="#059669" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                            <span>Đang tải danh sách đại lý...</span>
                          </div>
                        ) : filteredDealers.length === 0 ? (
                          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: '#64748b' }}>
                            {dealerSearchQuery
                              ? `Không tìm thấy đại lý nào phù hợp với từ khoá "${dealerSearchQuery}".`
                              : 'Không tìm thấy đại lý nào trong hệ thống.'}
                          </div>
                        ) : (
                          filteredDealers.map((d) => {
                            const isSelected = selectedDealerId === d.dealer_id;
                            return (
                              <div
                                key={d.dealer_id}
                                onClick={() => {
                                  setSelectedDealerId(d.dealer_id);
                                  setIsDealerDropdownOpen(false);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.15s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '12px',
                                  minHeight: '46px',
                                  borderBottom: '1px solid #f1f5f9',
                                  background: isSelected ? 'rgba(236, 253, 245, 0.7)' : '#ffffff',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(236, 253, 245, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span
                                      style={{
                                        fontFamily: 'monospace',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        background: '#f1f5f9',
                                        padding: '1.5px 5px',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {d.dealer_code}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '13px',
                                        fontWeight: isSelected ? 700 : 600,
                                        color: isSelected ? '#065f46' : '#0f172a',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {d.dealer_name}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      fontSize: '11.5px',
                                      color: '#64748b',
                                      marginTop: '3px',
                                      flexWrap: 'wrap',
                                    }}
                                  >
                                    <span>
                                      Công nợ: <strong style={{ color: d.total_remaining_debt > 0 ? '#dc2626' : '#059669' }}>{formatVND(d.total_remaining_debt)}</strong>
                                    </span>
                                    <span>•</span>
                                    <span>
                                      {d.open_invoices_count > 0 ? (
                                        <strong style={{ color: '#475569' }}>{d.open_invoices_count} HĐ nợ</strong>
                                      ) : (
                                        '0 HĐ nợ'
                                      )}
                                    </span>
                                    {d.phone && (
                                      <>
                                        <span>•</span>
                                        <span>SĐT: <strong style={{ color: '#334155' }}>{d.phone}</strong></span>
                                      </>
                                    )}
                                    {d.is_overdue && (
                                      <>
                                        <span>•</span>
                                        <span style={{ color: '#dc2626', fontWeight: 600 }}>Quá hạn</span>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {isSelected && (
                                  <div style={{ flexShrink: 0, color: '#059669' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {!loadingDealers && filteredDealers.length > 0 && (
                          <div
                            style={{
                              padding: '6px 12px',
                              textAlign: 'center',
                              fontSize: '11px',
                              color: '#94a3b8',
                              background: '#f8fafc',
                              borderTop: '1px solid #f1f5f9',
                            }}
                          >
                            Đã hiển thị toàn bộ {filteredDealers.length} / {dealers.length} đại lý
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {dealerSummary && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#475569' }}>
                  <span>
                    <strong>Mã số:</strong> {dealerSummary.dealer_code}
                  </span>
                  <span>
                    <strong>Hạn mức cấp:</strong> {formatVND(dealerSummary.credit_limit)}
                  </span>
                  {dealerSummary.phone && (
                    <span>
                      <strong>SĐT:</strong> {dealerSummary.phone}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3 SUMMARY CARDS - Không icon */}
          <div className="debt-summary-grid">
            <div className="debt-summary-card card-indigo">
              <div className="debt-card-header">
                <span className="debt-card-title">Tổng phát sinh phải thu</span>
              </div>
              <div className="debt-card-value">{formatVND(dealerSummary?.total_receivable)}</div>
              <div className="debt-card-sub">Tổng giá trị tất cả hoá đơn đã phát hành</div>
            </div>

            <div className="debt-summary-card card-emerald">
              <div className="debt-card-header">
                <span className="debt-card-title">Tổng tiền đã thu</span>
              </div>
              <div className="debt-card-value">{formatVND(dealerSummary?.total_paid)}</div>
              <div className="debt-card-sub">Đã thanh toán thực tế vào tài khoản / quỹ</div>
            </div>

            <div className="debt-summary-card card-rose">
              <div className="debt-card-header">
                <span className="debt-card-title">Tổng công nợ còn lại</span>
              </div>
              <div className="debt-card-value" style={{ color: '#e11d48' }}>
                {formatVND(dealerSummary?.total_remaining_debt)}
              </div>
              <div className="debt-card-sub">
                {dealerSummary?.open_invoices_count || 0} hoá đơn chưa thanh toán hết{' '}
                {dealerSummary?.overdue_invoices_count ? `(${dealerSummary.overdue_invoices_count} quá hạn)` : ''}
              </div>
            </div>
          </div>

          {/* FORM GHI NHẬN THANH TOÁN */}
          <form onSubmit={handleSubmitPayment} noValidate>
            <div className="debt-panel">
              <div className="debt-panel-header">
                <div className="debt-panel-title">
                  <span>1. Thông tin khoản thanh toán / Phiếu thu</span>
                </div>
                {numAmount > 0 && (
                  <span style={{ fontSize: '13px', fontStyle: 'italic', color: '#475569' }}>
                    {convertNumberToVietnameseWords(numAmount)}
                  </span>
                )}
              </div>

              {/* Alert lỗi vượt hạn mức - Không dùng icon */}
              {isOverRemainingDebt && (
                <div className="debt-alert-danger">
                  <div>
                    <strong>Cảnh báo:</strong> Số tiền thu ({formatVND(numAmount)}) không được vượt quá tổng công
                    nợ còn lại của đại lý ({formatVND(totalRemainingDebt)}).
                  </div>
                </div>
              )}

              <div className="form-grid">
                {/* 1. Số tiền thu */}
                <div className="form-field">
                  <label htmlFor="amount-input">
                    Số tiền thu (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="amount-input"
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Nhập số tiền thu nợ..."
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className={isOverRemainingDebt ? 'has-error' : ''}
                    required
                  />
                  {numAmount > 0 && !isOverRemainingDebt && (
                    <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>
                      Bằng số: {formatVND(numAmount)}
                    </span>
                  )}
                </div>

                {/* 2. Hình thức thu */}
                <div className="form-field">
                  <label htmlFor="payment-method-select">
                    Hình thức thu <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    id="payment-method-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    required
                  >
                    <option value="Chuyển khoản">Chuyển khoản (Ngân hàng)</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                    <option value="Khác">Khác (Ví điện tử / Bù trừ)</option>
                  </select>
                </div>

                {/* 3. Ngày thu */}
                <div className="form-field">
                  <label htmlFor="payment-date-input">
                    Ngày thu tiền <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="payment-date-input"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>

                {/* 4. Người thu */}
                <div className="form-field">
                  <label htmlFor="collector-name-input">
                    Người thu tiền <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    id="collector-name-input"
                    type="text"
                    value={collectorName}
                    onChange={(e) => setCollectorName(e.target.value)}
                    placeholder="Tên kế toán / nhân viên thu tiền..."
                    required
                  />
                </div>
              </div>

              {/* 5. Ghi chú */}
              <div className="form-field" style={{ marginBottom: '20px' }}>
                <label htmlFor="note-input">Ghi chú phiếu thu</label>
                <textarea
                  id="note-input"
                  rows={2}
                  placeholder="Ghi chú thêm về giao dịch (VD: UNC 123456 qua Vietcombank...)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              {/* CHỌN CHẾ ĐỘ ĐỐI TRỪ */}
              <div className="allocation-mode-box">
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b' }}>
                  2. Chế độ đối trừ vào hoá đơn:
                </span>
                <div className="allocation-options">
                  <div
                    className={`allocation-radio-card ${allocationMode === 'AUTO_FIFO' ? 'selected' : ''}`}
                    onClick={() => setAllocationMode('AUTO_FIFO')}
                  >
                    <input
                      type="radio"
                      id="mode-fifo"
                      name="allocation_mode"
                      checked={allocationMode === 'AUTO_FIFO'}
                      onChange={() => setAllocationMode('AUTO_FIFO')}
                    />
                    <div>
                      <label htmlFor="mode-fifo" style={{ fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        Tự động theo hoá đơn cũ nhất trước
                      </label>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                        Hệ thống tự động trừ lần lượt vào các hoá đơn có ngày phát hành cũ nhất trước cho đến khi hết số tiền thu.
                      </p>
                    </div>
                  </div>

                  <div
                    className={`allocation-radio-card ${allocationMode === 'MANUAL' ? 'selected' : ''}`}
                    onClick={() => setAllocationMode('MANUAL')}
                  >
                    <input
                      type="radio"
                      id="mode-manual"
                      name="allocation_mode"
                      checked={allocationMode === 'MANUAL'}
                      onChange={() => setAllocationMode('MANUAL')}
                    />
                    <div>
                      <label htmlFor="mode-manual" style={{ fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}>
                        Chọn đối trừ vào hoá đơn cụ thể
                      </label>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                        Kế toán tích chọn hoá đơn cụ thể và nhập số tiền muốn trừ cho từng hoá đơn.
                      </p>
                    </div>
                  </div>
                </div>

                {allocationMode === 'MANUAL' && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: '6px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: isManualAllocationMatched ? '#ecfdf5' : '#fffbeb',
                      border: `1px solid ${isManualAllocationMatched ? '#a7f3d0' : '#fde68a'}`,
                      fontSize: '13px',
                    }}
                  >
                    <span>
                      Tiền thu: <strong>{formatVND(numAmount)}</strong> | Đã phân bổ: <strong>{formatVND(totalManualAllocated)}</strong>{' '}
                      | Chênh lệch:{' '}
                      <strong style={{ color: isManualAllocationMatched ? '#059669' : '#dc2626' }}>
                        {formatVND(numAmount - totalManualAllocated)}
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setManualAllocations({})}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Xoá chọn tất cả
                    </button>
                  </div>
                )}
              </div>

              {/* BẢNG DANH SÁCH HOÁ ĐƠN ĐỐI TRỪ */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a' }}>
                    Danh sách hoá đơn của đại lý ({invoices.length} hoá đơn)
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    * Sắp xếp theo ngày phát hành cũ nhất xếp trước
                  </span>
                </div>

                {loadingInvoices ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Đang tải danh sách hoá đơn...</div>
                ) : invoices.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
                    Đại lý này hiện không có hoá đơn nào trong hệ thống.
                  </div>
                ) : (
                  <div className="debt-table-wrapper">
                    <table className="debt-table">
                      <thead>
                        <tr>
                          {allocationMode === 'MANUAL' && <th style={{ width: '40px', textAlign: 'center' }}>Chọn</th>}
                          <th>Số hoá đơn</th>
                          <th>Ngày phát hành</th>
                          <th>Hạn thanh toán</th>
                          <th style={{ textAlign: 'right' }}>Tổng tiền HĐ</th>
                          <th style={{ textAlign: 'right' }}>Đã thu</th>
                          <th style={{ textAlign: 'right' }}>Còn nợ</th>
                          <th style={{ textAlign: 'center' }}>Trạng thái</th>
                          <th style={{ textAlign: 'right' }}>Trừ đợt này</th>
                          <th style={{ textAlign: 'right' }}>Còn nợ sau trừ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv) => {
                          const fifoItem = fifoMap.get(inv.id);
                          const manualAllocVal = manualAllocations[inv.id] || 0;
                          const isAllocated = allocationMode === 'AUTO_FIFO' ? Boolean(fifoItem) : manualAllocVal > 0;
                          const isRecentlyPaid = recentlyPaidInvoiceIds.includes(inv.id);

                          const allocatedAmt =
                            allocationMode === 'AUTO_FIFO'
                              ? fifoItem?.allocated_amount || 0
                              : manualAllocVal;

                          const remAfter = Math.max(0, inv.remaining_debt - allocatedAmt);
                          const newStatusLabel =
                            allocatedAmt > 0
                              ? remAfter === 0
                                ? 'Đã thanh toán'
                                : 'Thanh toán một phần'
                              : inv.status_label;

                          return (
                            <tr
                              key={inv.id}
                              className={`${isAllocated ? 'row-allocated' : ''} ${isRecentlyPaid ? 'row-recently-paid' : ''}`}
                            >
                              {allocationMode === 'MANUAL' && (
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(manualAllocations[inv.id])}
                                    disabled={inv.remaining_debt <= 0}
                                    onChange={() => handleToggleInvoiceManual(inv)}
                                  />
                                </td>
                              )}
                              <td>
                                <strong style={{ color: '#0f172a' }}>{inv.invoice_code}</strong>
                                {inv.order_code && (
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>Đơn: {inv.order_code}</div>
                                )}
                              </td>
                              <td>{formatDate(inv.issue_date)}</td>
                              <td>
                                <span style={{ color: inv.is_overdue ? '#e11d48' : 'inherit' }}>
                                  {formatDate(inv.due_date)}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatVND(inv.total_amount)}</td>
                              <td style={{ textAlign: 'right', color: '#059669' }}>{formatVND(inv.paid_amount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: '700', color: inv.remaining_debt > 0 ? '#e11d48' : '#64748b' }}>
                                {formatVND(inv.remaining_debt)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span
                                  className={`badge ${inv.status === 'PAID'
                                    ? 'badge-paid'
                                    : inv.status === 'PARTIALLY_PAID' || inv.status === 'PARTIAL'
                                      ? 'badge-partial'
                                      : inv.status === 'OVERDUE'
                                        ? 'badge-overdue'
                                        : 'badge-unpaid'
                                    }`}
                                >
                                  {inv.status_label}
                                </span>
                              </td>

                              {/* Cột Trừ đợt này */}
                              <td style={{ textAlign: 'right' }}>
                                {allocationMode === 'AUTO_FIFO' ? (
                                  <strong style={{ color: allocatedAmt > 0 ? '#059669' : '#94a3b8' }}>
                                    {allocatedAmt > 0 ? formatVND(allocatedAmt) : '—'}
                                  </strong>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0"
                                      max={inv.remaining_debt}
                                      value={manualAllocations[inv.id] !== undefined ? manualAllocations[inv.id] : ''}
                                      placeholder="0"
                                      disabled={inv.remaining_debt <= 0}
                                      onChange={(e) =>
                                        handleManualAllocationChange(inv.id, parseFloat(e.target.value) || 0, inv.remaining_debt)
                                      }
                                      style={{
                                        width: '110px',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '13px',
                                        textAlign: 'right',
                                        fontWeight: '600',
                                        color: '#0f172a',
                                      }}
                                    />
                                    {inv.remaining_debt > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleManualAllocationChange(inv.id, inv.remaining_debt, inv.remaining_debt)}
                                        className="btn-outline"
                                        style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                                        title="Điền toàn bộ số còn nợ của hoá đơn này"
                                      >
                                        Tối đa
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Cột Còn nợ sau trừ */}
                              <td style={{ textAlign: 'right' }}>
                                {allocatedAmt > 0 ? (
                                  <div>
                                    <strong style={{ color: remAfter === 0 ? '#059669' : '#b45309' }}>
                                      {formatVND(remAfter)}
                                    </strong>
                                    <div style={{ fontSize: '11px', color: '#059669' }}>({newStatusLabel})</div>
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8' }}>{formatVND(inv.remaining_debt)}</span>
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

              {/* NÚT XÁC NHẬN GHI NHẬN THANH TOÁN - Không dùng icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
                <span
                  style={{
                    fontSize: '13px',
                    color: isOverRemainingDebt ? '#dc2626' : '#64748b',
                    fontWeight: isOverRemainingDebt ? '600' : 'normal',
                  }}
                >
                  {isOverRemainingDebt
                    ? 'Số tiền thu vượt quá tổng công nợ còn lại'
                    : numAmount <= 0
                      ? ''
                      : allocationMode === 'MANUAL' && !isManualAllocationMatched
                        ? 'Tổng tiền phân bổ chưa khớp số tiền thu'
                        : `Sẵn sàng đối trừ ${formatVND(numAmount)}`}
                </span>

                <button
                  type="submit"
                  disabled={isInvalidAmount || isOverRemainingDebt || submitting || (allocationMode === 'MANUAL' && !isManualAllocationMatched)}
                  className={`btn-primary ${isOverRemainingDebt ? 'btn-danger-locked' : ''}`}
                  style={
                    isOverRemainingDebt
                      ? {
                        backgroundColor: '#ef4444',
                        borderColor: '#dc2626',
                        color: '#ffffff',
                        cursor: 'not-allowed',
                        opacity: 0.95,
                      }
                      : undefined
                  }
                  title={isOverRemainingDebt ? 'Số tiền thu vượt quá tổng công nợ còn lại' : undefined}
                >
                  {submitting ? 'Đang xử lý đối trừ...' : `Xác nhận thu tiền (${formatVND(numAmount)})`}
                </button>
              </div>
            </div>
          </form>
        </>
      ) : (
        /* TAB 2: LỊCH SỬ PHIẾU THU & BÚT TOÁN ĐIỀU CHỈNH (TIÊU CHÍ 5) */
        <div className="debt-panel">
          <div className="debt-panel-header">
            <div>
              <div className="debt-panel-title">Lịch sử các khoản thanh toán / Phiếu thu đã ghi nhận</div>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Theo quy chuẩn Kế toán (Tiêu chí 5): Các phiếu thu đã ghi nhận tuyệt đối không bị xoá khỏi hệ thống. Khi cần điều chỉnh sai sót, Kế toán thực hiện &quot;Lập bút toán điều chỉnh&quot;.
              </p>
            </div>
            <button type="button" onClick={loadReceipts} className="btn-outline">
              Làm mới dữ liệu
            </button>
          </div>

          {loadingReceipts ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang tải lịch sử phiếu thu...</div>
          ) : receipts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
              Chưa có khoản thanh toán nào được ghi nhận trong lịch sử.
            </div>
          ) : (
            <div className="debt-table-wrapper">
              <table className="debt-table">
                <thead>
                  <tr>
                    <th>Mã phiếu thu</th>
                    <th>Đại lý</th>
                    <th style={{ textAlign: 'right' }}>Số tiền thu</th>
                    <th>Hình thức</th>
                    <th>Ngày thu</th>
                    <th>Người thu</th>
                    <th>Phương thức đối trừ</th>
                    <th>Hoá đơn đã trừ</th>
                    <th style={{ textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ textAlign: 'center' }}>Thao tác kế toán</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ color: '#0f172a' }}>{r.receipt_code}</strong>
                        {r.note && <div style={{ fontSize: '11.5px', color: '#64748b' }}>{r.note}</div>}
                      </td>
                      <td>
                        <strong>{r.dealer_name}</strong>
                        {r.dealer_code && <div style={{ fontSize: '11px', color: '#64748b' }}>{r.dealer_code}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.status === 'ADJUSTED' ? (
                          <div>
                            <div style={{ fontWeight: '700', color: '#059669', fontSize: '14.5px' }}>
                              {formatVND(
                                (r.allocations || []).reduce(
                                  (sum, a) => sum + (a.current_allocated_amount !== undefined ? a.current_allocated_amount : a.allocated_amount),
                                  0
                                )
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              Gốc: <span style={{ textDecoration: 'line-through' }}>{formatVND(r.amount)}</span>
                            </div>
                            {(r.adjustments || []).length > 0 && (
                              <div style={{ fontSize: '11px', color: '#d97706', fontWeight: '500' }}>
                                (-{formatVND((r.adjustments || []).reduce((s, adj) => s + (adj.adjustment_amount || 0), 0))})
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontWeight: '700', color: '#059669', fontSize: '14.5px' }}>
                            {formatVND(r.amount)}
                          </span>
                        )}
                      </td>
                      <td>{r.payment_method}</td>
                      <td>{formatDate(r.payment_date)}</td>
                      <td>{r.collector_name}</td>
                      <td>
                        <span style={{ fontSize: '12.5px', color: '#334155' }}>
                          {r.allocation_mode === 'AUTO_FIFO' ? 'FIFO (Tự động)' : 'Thủ công'}
                        </span>
                      </td>
                      <td>
                        {r.allocations && r.allocations.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReceiptDetail(r)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#dbeafe';
                              e.currentTarget.style.borderColor = '#93c5fd';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#eff6ff';
                              e.currentTarget.style.borderColor = '#bfdbfe';
                            }}
                            title="Bấm để xem chi tiết danh sách hoá đơn đối trừ"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                            <span>{r.allocations.length} HĐ</span>
                            <span style={{ fontSize: '11px', color: '#2563eb', textDecoration: 'underline' }}>
                              Chi tiết
                            </span>
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                            Chưa đối trừ
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${r.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-adjusted'}`}>
                          {r.status === 'CONFIRMED' ? 'Đã ghi nhận' : 'Đã điều chỉnh'}
                        </span>
                      </td>

                      {/* CỘT THAO TÁC: CẤM XOÁ TUYỆT ĐỐI, CHỈ CÓ NÚT LẬP BÚT TOÁN ĐIỀU CHỈNH */}
                      <td style={{ textAlign: 'center' }}>
                        {r.status === 'CONFIRMED' ? (
                          <button
                            type="button"
                            onClick={() => openAdjustmentModal(r)}
                            className="btn-warning"
                          >
                            Lập bút toán điều chỉnh
                          </button>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                            Đã lập điều chỉnh
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL LẬP BÚT TOÁN ĐIỀU CHỈNH (TIÊU CHÍ 5) */}
      {adjustingReceipt && (
        <ModalPortal>
          <div className="debt-modal-backdrop">
            <div className="debt-modal-panel">
              <div className="debt-modal-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                    Lập Bút Toán Điều Chỉnh Phiếu Thu
                  </h3>
                  <span style={{ fontSize: '13px', color: '#64748b' }}>
                    Mã phiếu thu gốc: <strong>{adjustingReceipt.receipt_code}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustingReceipt(null)}
                  style={{ background: 'none', border: 'none', fontSize: '13px', cursor: 'pointer', color: '#64748b', fontWeight: '600' }}
                >
                  Đóng
                </button>
              </div>

              <div className="debt-modal-body">
                {adjustmentError && <div className="debt-alert-danger">{adjustmentError}</div>}

                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '18px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13.5px' }}>
                    <div>
                      Đại lý: <strong>{adjustingReceipt.dealer_name}</strong>
                    </div>
                    <div>
                      Số tiền đã thu: <strong style={{ color: '#059669' }}>{formatVND(adjustingReceipt.amount)}</strong>
                    </div>
                    <div>
                      Ngày thu: <strong>{formatDate(adjustingReceipt.payment_date)}</strong>
                    </div>
                    <div>
                      Người thu: <strong>{adjustingReceipt.collector_name}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px', color: '#0f172a' }}>
                      Các hoá đơn đã được đối trừ:
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {adjustingReceipt.allocations.map((a) => {
                        const curAllocated = a.current_allocated_amount !== undefined ? a.current_allocated_amount : a.allocated_amount;
                        const enteredStr = adjustmentAmounts[a.id] ?? String(curAllocated);
                        const enteredNum = parseFloat(enteredStr);
                        const isInvalid = isNaN(enteredNum) || enteredNum < 0 || enteredNum > curAllocated;
                        const isOver = !isNaN(enteredNum) && enteredNum > curAllocated;
                        const isUnder = !isNaN(enteredNum) && enteredNum < 0;
                        const reductionAmount = !isNaN(enteredNum) ? Math.max(0, curAllocated - enteredNum) : 0;

                        return (
                          <div
                            key={a.id}
                            style={{
                              background: '#ffffff',
                              border: isInvalid ? '1px solid #f87171' : '1px solid #cbd5e1',
                              borderRadius: '8px',
                              padding: '12px 14px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ fontWeight: '600', color: '#1e293b' }}>
                                Hoá đơn: <strong style={{ color: '#0f172a' }}>{a.invoice_code || `HĐ #${a.invoice_id}`}</strong>
                              </span>
                              <span style={{ fontSize: '12.5px', color: '#475569' }}>
                                Đang đối trừ hiện tại: <strong style={{ color: '#059669' }}>{formatVND(curAllocated)}</strong>
                              </span>
                            </div>

                            <div className="form-field" style={{ marginBottom: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <label
                                  htmlFor={`adjust-amount-${a.id}`}
                                  style={{ fontWeight: '600', fontSize: '12.5px', color: '#334155' }}
                                >
                                  Số tiền đối trừ mới (sau điều chỉnh) <span style={{ color: '#ef4444' }}>*</span>
                                </label>
                                <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  (Từ 0 đ đến tối đa {formatVND(curAllocated)})
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  id={`adjust-amount-${a.id}`}
                                  type="number"
                                  min="0"
                                  max={curAllocated}
                                  step="any"
                                  placeholder="Nhập số tiền đối trừ mới (VD: 480000)..."
                                  value={adjustmentAmounts[a.id] ?? String(curAllocated)}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setAdjustmentAmounts((prev) => ({ ...prev, [a.id]: val }));
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '7px 10px',
                                    borderRadius: '6px',
                                    border: isInvalid ? '1px solid #ef4444' : '1px solid #cbd5e1',
                                    fontSize: '13.5px',
                                    fontWeight: '600',
                                    outline: 'none',
                                  }}
                                  required
                                />
                                <button
                                  type="button"
                                  onClick={() => setAdjustmentAmounts((prev) => ({ ...prev, [a.id]: '0' }))}
                                  className="btn-outline"
                                  style={{ padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap', color: '#dc2626', borderColor: '#fca5a5' }}
                                  title="Huỷ đối trừ hoàn toàn hoá đơn này (đưa số tiền đối trừ về 0 đ)"
                                >
                                  Huỷ về 0 đ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setAdjustmentAmounts((prev) => ({ ...prev, [a.id]: String(curAllocated) }))}
                                  className="btn-outline"
                                  style={{ padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap' }}
                                  title="Giữ nguyên số tiền đối trừ hiện tại"
                                >
                                  Giữ nguyên
                                </button>
                              </div>
                            </div>

                            {/* CẢNH BÁO HOẶC DÒNG XEM TRƯỚC */}
                            {isOver ? (
                              <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                                Số tiền đối trừ mới không được vượt quá số tiền đang đối trừ hiện tại ({formatVND(curAllocated)}).
                              </div>
                            ) : isUnder ? (
                              <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                                Số tiền đối trừ mới không được nhỏ hơn 0 đ.
                              </div>
                            ) : (
                              <div
                                style={{
                                  marginTop: '6px',
                                  padding: '7px 10px',
                                  background: reductionAmount > 0 ? '#fffbeb' : '#f8fafc',
                                  border: reductionAmount > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  color: reductionAmount > 0 ? '#92400e' : '#64748b',
                                  lineHeight: '1.4',
                                }}
                              >
                                {reductionAmount > 0 ? (
                                  <>
                                    <span>
                                      Số tiền điều chỉnh giảm (hoàn lại vào nợ):{' '}
                                      <strong style={{ color: '#d97706' }}>-{formatVND(reductionAmount)}</strong>
                                    </span>
                                    {' • '}
                                    <span>
                                      Sau điều chỉnh còn đối trừ:{' '}
                                      <strong style={{ color: '#059669' }}>{formatVND(enteredNum)}</strong>
                                    </span>
                                  </>
                                ) : (
                                  <span>Không có điều chỉnh giảm trên hoá đơn này (giữ nguyên {formatVND(curAllocated)}).</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="adjust-reason">
                    Lý do điều chỉnh <span style={{ color: '#ef4444' }}>* (Bắt buộc)</span>
                  </label>
                  <textarea
                    id="adjust-reason"
                    rows={3}
                    placeholder="Nhập lý do điều chỉnh cụ thể (VD: Khách chuyển nhầm chi nhánh, tính sai chiết khấu, huỷ giao dịch...)"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    * Nghiệp vụ kế toán: Bút toán điều chỉnh sẽ hoàn lại tiền và phục hồi số dư nợ đúng của các hoá đơn.
                  </span>
                </div>
              </div>

              <div className="debt-modal-footer">
                <button
                  type="button"
                  onClick={() => setAdjustingReceipt(null)}
                  disabled={adjustingSubmitting}
                  className="btn-outline"
                >
                  Huỷ bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdjustment}
                  disabled={adjustingSubmitting || !isAdjustmentFormValid}
                  className="btn-primary"
                  style={{ background: '#d97706' }}
                >
                  {adjustingSubmitting ? 'Đang thực hiện...' : 'Xác nhận lập bút toán điều chỉnh'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL CHI TIẾT HOÁ ĐƠN ĐÃ ĐỐI TRỪ */}
      {viewingReceiptDetail && (() => {
        const isAdjusted =
          viewingReceiptDetail.status === 'ADJUSTED' ||
          Boolean(viewingReceiptDetail.adjustments && viewingReceiptDetail.adjustments.length > 0);

        const totalOrigAllocated = (viewingReceiptDetail.allocations || []).reduce(
          (sum, a) => sum + (a.allocated_amount || 0),
          0
        );

        const totalCurAllocated = (viewingReceiptDetail.allocations || []).reduce(
          (sum, a) =>
            sum +
            (a.current_allocated_amount !== undefined ? a.current_allocated_amount : a.allocated_amount || 0),
          0
        );

        const totalAdjustedAmount =
          (viewingReceiptDetail.adjustments || []).reduce(
            (sum, adj) => sum + (adj.adjustment_amount || 0),
            0
          ) || Math.max(0, totalOrigAllocated - totalCurAllocated);

        return (
          <ModalPortal>
            <div className="debt-modal-backdrop" onClick={() => setViewingReceiptDetail(null)}>
              <div
                className="debt-modal-panel"
                style={{ maxWidth: '720px', width: '95%' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="debt-modal-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                      Chi Tiết Hoá Đơn Đã Đối Trừ
                    </h3>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                      Phiếu thu: <strong style={{ color: '#0f172a' }}>{viewingReceiptDetail.receipt_code}</strong> • Đại lý: <strong style={{ color: '#0f172a' }}>{viewingReceiptDetail.dealer_name}</strong> {viewingReceiptDetail.dealer_code && `(${viewingReceiptDetail.dealer_code})`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingReceiptDetail(null)}
                    style={{
                      background: '#f1f5f9',
                      border: 'none',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      fontSize: '16px',
                      cursor: 'pointer',
                      color: '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Đóng"
                  >
                    ✕
                  </button>
                </div>

                <div className="debt-modal-body" style={{ padding: '16px 20px', maxHeight: '75vh', overflowY: 'auto' }}>
                  {/* Thông tin tóm tắt phiếu thu */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '12px',
                      padding: '12px 14px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      marginBottom: '16px',
                      fontSize: '12.5px',
                    }}
                  >
                    <div>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '2px' }}>
                        {isAdjusted ? 'Số tiền đối trừ hiện tại:' : 'Số tiền thu:'}
                      </div>
                      <strong style={{ color: '#059669', fontSize: '15px' }}>
                        {formatVND(totalCurAllocated)}
                      </strong>
                      {isAdjusted && (
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          Gốc ban đầu: <span style={{ textDecoration: 'line-through' }}>{formatVND(viewingReceiptDetail.amount)}</span>
                        </div>
                      )}
                    </div>

                    {isAdjusted && (
                      <div>
                        <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '2px' }}>Đã điều chỉnh giảm:</div>
                        <strong style={{ color: '#d97706', fontSize: '14px' }}>
                          -{formatVND(totalAdjustedAmount)}
                        </strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          (Đã hoàn nợ vào HĐ)
                        </div>
                      </div>
                    )}

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '2px' }}>Trạng thái:</div>
                      <span className={`badge ${viewingReceiptDetail.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-adjusted'}`}>
                        {viewingReceiptDetail.status === 'CONFIRMED' ? 'Đã ghi nhận' : 'Đã điều chỉnh'}
                      </span>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '2px' }}>Hình thức:</div>
                      <strong style={{ color: '#1e293b' }}>{viewingReceiptDetail.payment_method}</strong>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '2px' }}>Phương thức:</div>
                      <strong style={{ color: '#1e293b' }}>
                        {viewingReceiptDetail.allocation_mode === 'AUTO_FIFO' ? 'FIFO (Tự động)' : 'Thủ công'}
                      </strong>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '2px' }}>Ngày thu:</div>
                      <strong style={{ color: '#1e293b' }}>{formatDate(viewingReceiptDetail.payment_date)}</strong>
                    </div>

                    <div>
                      <div style={{ color: '#64748b', fontSize: '11.5px', marginBottom: '2px' }}>Người thu:</div>
                      <strong style={{ color: '#1e293b' }}>{viewingReceiptDetail.collector_name}</strong>
                    </div>
                  </div>

                  {viewingReceiptDetail.note && (
                    <div
                      style={{
                        padding: '8px 12px',
                        background: '#fffbeb',
                        border: '1px solid #fef3c7',
                        borderRadius: '6px',
                        fontSize: '12px',
                        color: '#92400e',
                        marginBottom: '16px',
                      }}
                    >
                      <strong>Ghi chú:</strong> {viewingReceiptDetail.note}
                    </div>
                  )}

                  {/* Bảng danh sách hoá đơn */}
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                      Danh sách hoá đơn đã được bù trừ ({viewingReceiptDetail.allocations?.length || 0} hoá đơn):
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                            <th style={{ padding: '8px 12px', width: '40px', textAlign: 'center' }}>STT</th>
                            <th style={{ padding: '8px 12px' }}>Mã số hoá đơn</th>
                            {isAdjusted ? (
                              <>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đối trừ ban đầu</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Điều chỉnh giảm</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đối trừ hiện tại</th>
                              </>
                            ) : (
                              <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số tiền đối trừ</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {viewingReceiptDetail.allocations && viewingReceiptDetail.allocations.length > 0 ? (
                            viewingReceiptDetail.allocations.map((a, idx) => {
                              const origAmt = a.allocated_amount || 0;
                              const curAmt =
                                a.current_allocated_amount !== undefined
                                  ? a.current_allocated_amount
                                  : origAmt;
                              const reducedAmt = Math.max(0, origAmt - curAmt);

                              return (
                                <tr key={a.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '9px 12px', textAlign: 'center', color: '#64748b' }}>
                                    {idx + 1}
                                  </td>
                                  <td style={{ padding: '9px 12px' }}>
                                    <strong style={{ color: '#0f172a' }}>
                                      {a.invoice_code || `HĐ #${a.invoice_id}`}
                                    </strong>
                                  </td>
                                  {isAdjusted ? (
                                    <>
                                      <td style={{ padding: '9px 12px', textAlign: 'right', color: '#64748b', fontSize: '12.5px' }}>
                                        {formatVND(origAmt)}
                                      </td>
                                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '600', color: reducedAmt > 0 ? '#d97706' : '#94a3b8', fontSize: '12.5px' }}>
                                        {reducedAmt > 0 ? `-${formatVND(reducedAmt)}` : '—'}
                                      </td>
                                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700', color: '#059669', fontSize: '13px' }}>
                                        {formatVND(curAmt)}
                                      </td>
                                    </>
                                  ) : (
                                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700', color: '#059669', fontSize: '13px' }}>
                                      {formatVND(curAmt)}
                                    </td>
                                  )}
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={isAdjusted ? 5 : 3} style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>
                                Không có hoá đơn nào được ghi nhận.
                              </td>
                            </tr>
                          )}
                        </tbody>
                        {viewingReceiptDetail.allocations && viewingReceiptDetail.allocations.length > 0 && (
                          <tfoot>
                            <tr style={{ background: '#f8fafc', fontWeight: '700', borderTop: '1px solid #cbd5e1' }}>
                              <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                                Tổng số tiền:
                              </td>
                              {isAdjusted ? (
                                <>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#64748b', fontSize: '13px' }}>
                                    {formatVND(totalOrigAllocated)}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', color: totalAdjustedAmount > 0 ? '#d97706' : '#94a3b8', fontSize: '13px' }}>
                                    {totalAdjustedAmount > 0 ? `-${formatVND(totalAdjustedAmount)}` : '—'}
                                  </td>
                                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontSize: '14px' }}>
                                    {formatVND(totalCurAllocated)}
                                  </td>
                                </>
                              ) : (
                                <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontSize: '14px' }}>
                                  {formatVND(totalCurAllocated)}
                                </td>
                              )}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* Danh sách chứng từ bút toán điều chỉnh đã lập (Tiêu chí 5) */}
                  {viewingReceiptDetail.adjustments && viewingReceiptDetail.adjustments.length > 0 && (
                    <div style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span>Lịch sử bút toán điều chỉnh ({viewingReceiptDetail.adjustments.length} chứng từ)</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {viewingReceiptDetail.adjustments.map((adj) => (
                          <div
                            key={adj.id}
                            style={{
                              background: '#fffbeb',
                              border: '1px solid #fef3c7',
                              borderRadius: '6px',
                              padding: '10px 12px',
                              fontSize: '12px',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                              <span>
                                Mã bút toán: <strong style={{ color: '#b45309' }}>{adj.adjustment_code}</strong>
                              </span>
                              <span style={{ color: '#64748b' }}>
                                {formatDateTime(adj.created_at)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ color: '#475569' }}>
                                Người lập: <strong>{adj.adjusted_by_name || 'Kế toán'}</strong>
                              </span>
                              <span style={{ color: '#dc2626', fontWeight: '700', fontSize: '13px' }}>
                                Giảm đối trừ: -{formatVND(adj.adjustment_amount)}
                              </span>
                            </div>
                            <div style={{ color: '#78350f', background: '#fef3c7', padding: '6px 8px', borderRadius: '4px', marginTop: '4px', fontStyle: 'italic' }}>
                              <strong>Lý do điều chỉnh:</strong> {adj.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className="debt-modal-footer"
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '12px 20px',
                    borderTop: '1px solid #e2e8f0',
                    background: '#f8fafc',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setViewingReceiptDetail(null)}
                    className="btn-outline"
                    style={{ padding: '7px 18px', fontSize: '13px' }}
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        );
      })()}
    </div>
  );
};

export default DebtPaymentReconciliationView;
