import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  getDebtReconciliationsApi,
  previewDebtReconciliationApi,
  createDebtReconciliationApi,
  sendDebtReconciliationApi,
  resolveDebtReconciliationApi,
  deleteDebtReconciliationApi,
  getDealersApi,
  DealerItem,
  DebtReconciliationItemResponse,
  DebtReconciliationKpiSummary,
  DebtReconciliationPreviewResult,
  User,
} from '../services/api';
import { DebtReconciliationPrintModal } from './DebtReconciliationPrintModal';
import { emitStatusToast } from './StatusToast';
import { DealerSelectDropdown } from './DealerSelectDropdown';

interface DebtReconciliationViewProps {
  token: string;
  currentUser?: User;
  initialDealerId?: number;
  onBackToHome?: () => void;
}

export const DebtReconciliationView: React.FC<DebtReconciliationViewProps> = ({
  token,
  currentUser: _currentUser,
  initialDealerId,
  onBackToHome: _onBackToHome,
}) => {
  // State danh sách
  const [items, setItems] = useState<DebtReconciliationItemResponse[]>([]);
  const [kpiSummary, setKpiSummary] = useState<DebtReconciliationKpiSummary>({
    total_count: 0,
    pending_count: 0,
    confirmed_count: 0,
    disputed_count: 0,
    draft_count: 0,
  });
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const pageSize = 15;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Bộ lọc
  const [search, setSearch] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('selected_debt_dealer_code') || '';
      if (saved) {
        sessionStorage.removeItem('selected_debt_dealer_code');
      }
      return saved;
    } catch {
      return '';
    }
  });
  const [selectedDealerId, setSelectedDealerId] = useState<number | 'all'>(initialDealerId || 'all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [dealers, setDealers] = useState<DealerItem[]>([]);

  // Modal In A4 / PDF
  const [printRec, setPrintRec] = useState<DebtReconciliationItemResponse | null>(null);

  // Modal Lập biên bản mới
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newDealerId, setNewDealerId] = useState<number | ''>(initialDealerId || '');
  const [newFromDate, setNewFromDate] = useState<string>('');
  const [newToDate, setNewToDate] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');
  const [previewResult, setPreviewResult] = useState<DebtReconciliationPreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Modal Xử lý khiếu nại (Dispute)
  const [resolvingRec, setResolvingRec] = useState<DebtReconciliationItemResponse | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  // Modal Xác nhận xóa biên bản (Thay thế window.confirm của trình duyệt)
  const [deletingRec, setDeletingRec] = useState<{ id: number; code: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Modal Xác nhận gửi biên bản sang đại lý (Thay thế window.confirm của trình duyệt)
  const [sendingRec, setSendingRec] = useState<{ id: number; code: string } | null>(null);
  const [isSending, setIsSending] = useState<boolean>(false);

  // Tự động set mặc định từ ngày 1 đến ngày cuối tháng trước hoặc tháng hiện tại
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth(); // 0-based
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    const fmt = (d: Date) => d.toISOString().split('T')[0];
    setNewFromDate(fmt(firstDay));
    setNewToDate(fmt(lastDay));
  }, []);

  // Tải danh sách đại lý cho dropdown
  useEffect(() => {
    async function fetchDealers() {
      try {
        const res = await getDealersApi(token);
        setDealers(Array.isArray(res) ? res : []);
      } catch (err: any) {
        console.error('Lỗi tải danh mục đại lý:', err);
      }
    }
    fetchDealers();
  }, [token]);

  // Tải danh sách biên bản
  const loadReconciliations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await getDebtReconciliationsApi(token, {
        dealer_id: selectedDealerId,
        status: selectedStatus,
        search: search.trim() || undefined,
        page,
        page_size: pageSize,
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
      setKpiSummary(res.kpi_summary || {
        total_count: 0,
        pending_count: 0,
        confirmed_count: 0,
        disputed_count: 0,
        draft_count: 0,
      });
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi tải danh sách biên bản đối chiếu.');
    } finally {
      setIsLoading(false);
    }
  }, [token, selectedDealerId, selectedStatus, search, page]);

  // Reset trang về 1 khi thay đổi bộ lọc tìm kiếm
  useEffect(() => {
    setPage(1);
  }, [selectedDealerId, selectedStatus, search]);

  useEffect(() => {
    loadReconciliations();
  }, [loadReconciliations]);

  // Hiển thị thông báo thành công tạm thời
  const showToast = (msg: string) => {
    emitStatusToast({
      title: 'Thành công',
      message: msg,
      type: 'success',
    });
  };

  // Xem trước số liệu khi tạo mới
  const handleCalculatePreview = async () => {
    if (!newDealerId) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Vui lòng chọn đại lý cần đối chiếu.',
        type: 'warning',
      });
      return;
    }
    if (!newFromDate || !newToDate) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Vui lòng nhập đầy đủ từ ngày và đến ngày.',
        type: 'warning',
      });
      return;
    }
    if (newFromDate > newToDate) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Từ ngày không được lớn hơn Đến ngày.',
        type: 'warning',
      });
      return;
    }

    setIsPreviewLoading(true);
    try {
      const res = await previewDebtReconciliationApi(token, {
        dealer_id: Number(newDealerId),
        from_date: newFromDate,
        to_date: newToDate,
      });
      setPreviewResult(res);
      emitStatusToast({
        title: 'Tổng hợp hoàn tất',
        message: `Đã tính toán số liệu đối chiếu kỳ ${res.period_label}`,
        type: 'info',
      });
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Lỗi tính toán xem trước số liệu đối chiếu.',
        type: 'error',
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const notifyReconciliationChanged = () => {
    try {
      localStorage.setItem('debt_reconciliation_last_updated', Date.now().toString());
      window.dispatchEvent(new CustomEvent('debt-reconciliation-updated'));
    } catch (_) {}
  };

  // Tạo biên bản chính thức
  const handleCreateReconciliation = async (sendImmediately: boolean) => {
    if (!newDealerId || !newFromDate || !newToDate) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Vui lòng nhập đầy đủ thông tin kỳ đối chiếu và đại lý.',
        type: 'warning',
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await createDebtReconciliationApi(token, {
        dealer_id: Number(newDealerId),
        from_date: newFromDate,
        to_date: newToDate,
        note: newNote,
        send_immediately: sendImmediately,
      });
      showToast(sendImmediately ? `Đã tạo và gửi biên bản ${res.code} sang Cổng đại lý thành công!` : `Đã lưu bản nháp biên bản ${res.code}!`);
      setIsCreateModalOpen(false);
      setPreviewResult(null);
      notifyReconciliationChanged();
      loadReconciliations();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Lỗi tạo biên bản đối chiếu.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Xác nhận gửi biên bản sang đại lý
  const handleConfirmSend = async () => {
    if (!sendingRec) return;
    setIsSending(true);
    try {
      await sendDebtReconciliationApi(token, sendingRec.id);
      showToast(`Đã gửi biên bản ${sendingRec.code} sang Cổng đại lý thành công!`);
      setSendingRec(null);
      notifyReconciliationChanged();
      loadReconciliations();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Lỗi gửi biên bản đối chiếu.',
        type: 'error',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Xác nhận xóa biên bản
  const handleConfirmDelete = async () => {
    if (!deletingRec) return;
    setIsDeleting(true);
    try {
      await deleteDebtReconciliationApi(token, deletingRec.id);
      showToast(`Đã xóa biên bản ${deletingRec.code} thành công.`);
      setDeletingRec(null);
      notifyReconciliationChanged();
      loadReconciliations();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Lỗi xóa biên bản.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Xử lý khiếu nại của đại lý
  const handleResolveDispute = async () => {
    if (!resolvingRec) return;
    if (!resolutionNote.trim()) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Vui lòng nhập ghi chú giải quyết chênh lệch.',
        type: 'warning',
      });
      return;
    }
    try {
      await resolveDebtReconciliationApi(token, resolvingRec.id, {
        resolution_note: resolutionNote.trim(),
      });
      showToast('Đã cập nhật ghi chú giải quyết khiếu nại thành công!');
      setResolvingRec(null);
      setResolutionNote('');
      notifyReconciliationChanged();
      loadReconciliations();
    } catch (err: any) {
      emitStatusToast({
        title: 'Lỗi',
        message: err.message || 'Lỗi giải quyết khiếu nại.',
        type: 'error',
      });
    }
  };

  const formatVND = (val?: number) => {
    return (val || 0).toLocaleString('vi-VN') + ' đ';
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'CONFIRMED':
        return (
          <span style={{ padding: '3px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#15803d', whiteSpace: 'nowrap', display: 'inline-block' }}>
            Đã đối chiếu khớp
          </span>
        );
      case 'SENT':
        return (
          <span style={{ padding: '3px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#b45309', whiteSpace: 'nowrap', display: 'inline-block' }}>
            Chờ đại lý xác nhận
          </span>
        );
      case 'DISPUTED':
        return (
          <span style={{ padding: '3px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fee2e2', color: '#b91c1c', whiteSpace: 'nowrap', display: 'inline-block' }}>
            Báo lệch / Khiếu nại
          </span>
        );
      case 'DRAFT':
        return (
          <span style={{ padding: '3px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', backgroundColor: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap', display: 'inline-block' }}>
            Bản nháp
          </span>
        );
      default:
        return <span style={{ padding: '3px 6px', borderRadius: '10px', fontSize: '11px', backgroundColor: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap', display: 'inline-block' }}>{st}</span>;
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  return (
    <div
      style={{
        padding: '12px 16px',
        backgroundColor: '#f8fafc',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Header Điều hướng & Tiêu đề */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Đối Chiếu Công Nợ Đại Lý
            </h1>
          </div>
        </div>

        <button
          onClick={() => {
            setIsCreateModalOpen(true);
            setPreviewResult(null);
          }}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '7px',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 5px -1px rgba(16, 185, 129, 0.25)',
          }}
        >
          Lập biên bản đối chiếu mới
        </button>
      </div>


      {/* Thông báo lỗi */}
      {errorMessage && (
        <div style={{ padding: '8px 14px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', color: '#991b1b', marginBottom: '8px', fontSize: '13px', fontWeight: '600', flexShrink: 0 }}>
          {errorMessage}
        </div>
      )}

      {/* 4 Thẻ KPI Tóm tắt tiến độ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '10px', flexShrink: 0 }}>
        <div style={{ backgroundColor: '#ffffff', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#64748b', fontSize: '12px', fontWeight: '600' }}>Tổng số biên bản</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
            {kpiSummary.total_count}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#b45309', fontSize: '12px', fontWeight: '600' }}>Đang chờ đại lý xác nhận</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706', marginTop: '2px' }}>
            {kpiSummary.pending_count}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#15803d', fontSize: '12px', fontWeight: '600' }}>Đã đối chiếu khớp (Thành công)</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a', marginTop: '2px' }}>
            {kpiSummary.confirmed_count}
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', padding: '10px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
          <div style={{ color: '#b91c1c', fontSize: '12px', fontWeight: '600' }}>Báo lệch / Khiếu nại</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
            {kpiSummary.disputed_count}
          </div>
        </div>
      </div>

      {/* Bảng danh sách Biên bản đối chiếu (Gộp thanh tìm kiếm & lọc vào chung bảng) */}
      <div
        style={{
          flex: 1,
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Thanh lọc & Tìm kiếm (Gộp vào đầu bảng) */}
        <div
          style={{
            backgroundColor: '#ffffff',
            padding: '8px 14px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Tìm theo mã biên bản, tên hoặc mã đại lý..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 px-3 text-xs rounded-md border border-slate-300 bg-white text-slate-800 shadow-2xs placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all box-border"
            />
          </div>

          <div style={{ width: '220px' }}>
            <DealerSelectDropdown
              dealers={dealers}
              selectedId={selectedDealerId}
              onSelectId={(id) => setSelectedDealerId(id)}
              allowAll={true}
              allLabel="-- Tất cả đại lý --"
              compact={true}
            />
          </div>

          <div style={{ width: '170px' }} className="relative flex items-center">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full h-8 pl-2.5 pr-7 text-xs rounded-md border border-slate-300 bg-white text-slate-800 shadow-2xs cursor-pointer appearance-none focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 font-medium transition-all"
            >
              <option value="all">-- Tất cả trạng thái --</option>
              <option value="SENT">Chờ đại lý xác nhận</option>
              <option value="CONFIRMED">Đã đối chiếu khớp</option>
              <option value="DISPUTED">Báo lệch / Khiếu nại</option>
              <option value="DRAFT">Bản nháp</option>
            </select>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          <button
            onClick={() => {
              setPage(1);
              loadReconciliations();
            }}
            className="h-8 px-3.5 text-xs font-semibold rounded-md border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 shadow-2xs cursor-pointer transition-all flex items-center justify-center shrink-0"
          >
            Làm mới
          </button>
        </div>

        <div
          ref={(el) => {
            if (el && el.scrollLeft !== 0) el.scrollLeft = 0;
          }}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', width: '100%' }}
        >
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700', fontSize: '12px' }}>
                <th style={{ padding: '10px 8px', width: '15%', whiteSpace: 'nowrap' }}>Mã biên bản</th>
                <th style={{ padding: '10px 8px', width: '20%' }}>Đại lý</th>
                <th style={{ padding: '10px 6px', width: '10%', whiteSpace: 'nowrap' }}>Kỳ đối chiếu</th>
                <th style={{ padding: '10px 6px', width: '8%', textAlign: 'right', whiteSpace: 'nowrap' }}>Dư đầu kỳ</th>
                <th style={{ padding: '10px 6px', width: '10%', textAlign: 'right', whiteSpace: 'nowrap' }}>Tăng trong kỳ</th>
                <th style={{ padding: '10px 6px', width: '8%', textAlign: 'right', whiteSpace: 'nowrap' }}>Giảm trong kỳ</th>
                <th style={{ padding: '10px 6px', width: '10%', textAlign: 'right', whiteSpace: 'nowrap' }}>Dư nợ cuối kỳ</th>
                <th style={{ padding: '10px 4px', width: '10%', textAlign: 'center', whiteSpace: 'nowrap' }}>Trạng thái</th>
                <th style={{ padding: '10px 6px', width: '9%', textAlign: 'center', whiteSpace: 'nowrap' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Đang tải dữ liệu biên bản đối chiếu...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                      Chưa có biên bản đối chiếu nào
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      Bấm nút <strong>"Lập biên bản đối chiếu mới"</strong> để bắt đầu chốt công nợ với đại lý.
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((r) => (
                  <tr
                    key={r.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: r.status === 'DISPUTED' ? '#fff7ed' : '#ffffff',
                    }}
                  >
                    <td style={{ padding: '9px 8px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {r.code}
                    </td>
                    <td style={{ padding: '9px 8px', overflow: 'hidden' }}>
                      <div
                        style={{
                          fontWeight: '600',
                          color: '#1e293b',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={r.dealer_name}
                      >
                        {r.dealer_name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>Mã: {r.dealer_code}</div>
                    </td>
                    <td style={{ padding: '9px 6px', color: '#334155', fontSize: '11px', lineHeight: 1.25 }}>
                      <div>{r.from_date ? new Date(r.from_date).toLocaleDateString('vi-VN') : ''}</div>
                      <div style={{ color: '#64748b' }}>đến {r.to_date ? new Date(r.to_date).toLocaleDateString('vi-VN') : ''}</div>
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', color: '#475569', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                      {formatVND(r.opening_balance)}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', color: '#b91c1c', fontWeight: '600', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                      +{formatVND(r.total_increase)}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', color: '#15803d', fontWeight: '600', whiteSpace: 'nowrap', fontSize: '11.5px' }}>
                      -{formatVND(r.total_decrease)}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'right', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap', fontSize: '12px' }}>
                      {formatVND(r.closing_balance)}
                    </td>
                    <td style={{ padding: '9px 4px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {getStatusBadge(r.status)}
                      {r.status === 'DISPUTED' && r.dealer_reported_balance !== null && (
                        <div style={{ fontSize: '10.5px', color: '#c2410c', marginTop: '2px' }}>
                          Đại lý báo: {formatVND(r.dealer_reported_balance)}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                        {/* Nút Xem / In PDF */}
                        <button
                          onClick={() => setPrintRec(r)}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: '#ffffff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '11.5px',
                            fontWeight: '600',
                          }}
                          title="Xem & In biên bản A4"
                        >
                          In
                        </button>

                        {/* Nút Gửi cho đại lý nếu là bản nháp */}
                        {r.status === 'DRAFT' && (
                          <button
                            onClick={() => setSendingRec({ id: r.id, code: r.code })}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: '#f59e0b',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              fontWeight: '600',
                            }}
                            title="Gửi sang Cổng đại lý"
                          >
                            Gửi
                          </button>
                        )}

                        {/* Nút Xử lý nếu đại lý khiếu nại báo lệch */}
                        {r.status === 'DISPUTED' && (
                          <button
                            onClick={() => {
                              setResolvingRec(r);
                              setResolutionNote(r.resolution_note || '');
                            }}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: '#dc2626',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              fontWeight: '600',
                            }}
                            title="Xử lý khiếu nại"
                          >
                            Xử lý
                          </button>
                        )}

                        {/* Nút Xóa nếu chưa xác nhận */}
                        {r.status !== 'CONFIRMED' && (
                          <button
                            onClick={() => setDeletingRec({ id: r.id, code: r.code })}
                            style={{
                              padding: '3px 7px',
                              backgroundColor: '#ffffff',
                              color: '#ef4444',
                              border: '1px solid #fecaca',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '11.5px',
                              fontWeight: '600',
                            }}
                            title="Xóa biên bản"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Chân bảng: Phân trang (Pagination) theo phong cách Hình 3 */}
        <div
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
            flexShrink: 0,
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
                    onClick={() => setPage(p)}
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

      {/* Modal Lập biên bản đối chiếu mới */}
      {isCreateModalOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '16px 24px', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '17px', fontWeight: '700' }}>Lập Biên Bản Đối Chiếu Công Nợ Mới</div>
              <button onClick={() => setIsCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
              {/* Form chọn đại lý & thời gian */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Đại lý cần đối chiếu <span style={{ color: '#ef4444' }}>*</span></label>
                <DealerSelectDropdown
                  dealers={dealers}
                  selectedId={newDealerId}
                  onSelect={(d) => setNewDealerId(d.id)}
                />
              </div>

              {/* Hàng chọn thời gian: Từ ngày và Đến ngày trên cùng một hàng */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Từ ngày <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    value={newFromDate}
                    onChange={(e) => setNewFromDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Đến ngày <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="date"
                    value={newToDate}
                    onChange={(e) => setNewToDate(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Nút Tính toán số liệu */}
              <div style={{ marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={handleCalculatePreview}
                  disabled={isPreviewLoading}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {isPreviewLoading ? 'Đang tổng hợp số liệu...' : 'Tính toán số liệu đối chiếu'}
                </button>
              </div>

              {/* Kết quả tính toán xem trước */}
              {previewResult && (
                <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a', marginBottom: '12px' }}>
                    Kết quả tổng hợp kỳ: {previewResult.period_label}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>Dư nợ đầu kỳ</div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold' }}>{formatVND(previewResult.opening_balance)}</div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <div style={{ fontSize: '11.5px', color: '#b91c1c' }}>Phát sinh TĂNG (Mua hàng)</div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#b91c1c' }}>+{formatVND(previewResult.total_increase)}</div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <div style={{ fontSize: '11.5px', color: '#15803d' }}>Phát sinh GIẢM (Đã trả)</div>
                      <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#15803d' }}>-{formatVND(previewResult.total_decrease)}</div>
                    </div>
                    <div style={{ backgroundColor: '#ffffff', padding: '10px 12px', borderRadius: '6px', border: '1px solid #0f172a' }}>
                      <div style={{ fontSize: '11.5px', color: '#0f172a', fontWeight: '600' }}>DƯ NỢ CUỐI KỲ</div>
                      <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>{formatVND(previewResult.closing_balance)}</div>
                    </div>
                  </div>

                  {/* Bảng kê thu gọn */}
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                    Số lượng chứng từ phát sinh trong kỳ: <strong>{previewResult.items.length}</strong>
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Ghi chú gửi kèm biên bản</label>
                <textarea
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Ví dụ: Kính đề nghị Quý đại lý kiểm tra và xác nhận trước ngày 05 tháng sau..."
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ padding: '14px 24px', backgroundColor: '#f1f5f9', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                style={{ padding: '8px 16px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => handleCreateReconciliation(true)}
                disabled={isSubmitting || !previewResult}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: previewResult ? 'pointer' : 'not-allowed',
                }}
              >
                {isSubmitting ? 'Đang tạo...' : 'Lưu & Gửi Đại lý ngay'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Xử lý khiếu nại báo lệch */}
      {resolvingRec && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '600px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: '17px', color: '#b91c1c' }}>
              Xử lý phản hồi lệch công nợ ({resolvingRec.code})
            </h3>
            <div style={{ backgroundColor: '#fff7ed', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fed7aa', marginBottom: '16px', fontSize: '13.5px' }}>
              <div>• Đại lý: <strong>{resolvingRec.dealer_name}</strong></div>
              <div>• Số dư hệ thống: <strong>{formatVND(resolvingRec.closing_balance)}</strong></div>
              <div>• Số dư đại lý ghi nhận: <strong style={{ color: '#c2410c' }}>{formatVND(resolvingRec.dealer_reported_balance || 0)}</strong></div>
              <div style={{ marginTop: '6px' }}>• Lý do lệch theo đại lý: <em>"{resolvingRec.dealer_dispute_reason}"</em></div>
              <div style={{ fontSize: '12px', color: '#78716c', marginTop: '4px' }}>Thời gian gửi phản hồi: {resolvingRec.disputed_at}</div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                Ghi chú giải quyết của kế toán <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                rows={3}
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                placeholder="Nhập giải trình sau khi liên hệ đại lý (ví dụ: Đã đối chiếu sao kê và cập nhật phiếu thu bù vào tháng sau...)"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13.5px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setResolvingRec(null)} style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer' }}>
                Hủy
              </button>
              <button onClick={handleResolveDispute} style={{ padding: '8px 18px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}>
                Lưu giải quyết khiếu nại
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Xác nhận xóa biên bản (Thay thế window.confirm của trình duyệt) */}
      {deletingRec && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !isDeleting && setDeletingRec(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#b91c1c' }}>
                Xác nhận xóa biên bản
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Hành động này sẽ xóa dữ liệu và không thể hoàn tác
              </p>
            </div>

            <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn xóa biên bản đối chiếu{' '}
              <strong style={{ color: '#0f172a' }}>{deletingRec.code}</strong> khỏi hệ thống?
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setDeletingRec(null)}
                disabled={isDeleting}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  padding: '8px 18px',
                  backgroundColor: isDeleting ? '#f87171' : '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Xác nhận gửi biên bản sang Đại lý */}
      {sendingRec && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(5px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => !isSending && setSendingRec(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '440px',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                Gửi biên bản cho Đại lý
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Biên bản {sendingRec.code} sẽ chuyển sang trạng thái chờ Đại lý xác nhận
              </p>
            </div>

            <div style={{ fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn gửi biên bản đối chiếu này sang Cổng đại lý để hai bên cùng chốt số dư nợ?
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setSendingRec(null)}
                disabled={isSending}
                style={{
                  padding: '8px 18px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSend}
                disabled={isSending}
                style={{
                  padding: '8px 18px',
                  backgroundColor: isSending ? '#fbbf24' : '#f59e0b',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: isSending ? 'not-allowed' : 'pointer',
                }}
              >
                {isSending ? 'Đang gửi...' : 'Gửi biên bản'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal In A4 */}
      <DebtReconciliationPrintModal
        isOpen={!!printRec}
        onClose={() => setPrintRec(null)}
        reconciliation={printRec}
      />
    </div>
  );
};
