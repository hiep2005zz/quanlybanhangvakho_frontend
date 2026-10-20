// frontend/src/components/CreateDebtAdjustmentModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';
import {
  getPendingReturnsApi,
  getDebtAdjustmentPreviewApi,
  createDebtAdjustmentApi,
} from '../services/debtAdjustmentApi';
import type {
  PendingReturnOrder,
  DebtAdjustmentPreview,
  DebtAdjustment,
} from '../types/debtAdjustment';
import './debt-adjustment.css';

interface CreateDebtAdjustmentModalProps {
  token: string;
  onClose: () => void;
  onSuccess: (adjustment: DebtAdjustment) => void;
}

const formatCurrency = (val?: number | null) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('vi-VN');
};

export const CreateDebtAdjustmentModal: React.FC<CreateDebtAdjustmentModalProps> = ({
  token,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Pending returns
  const [pendingReturns, setPendingReturns] = useState<PendingReturnOrder[]>([]);
  const [loadingReturns, setLoadingReturns] = useState<boolean>(true);
  const [selectedReturn, setSelectedReturn] = useState<PendingReturnOrder | null>(null);

  // Step 2 & 3: Preview data
  const [preview, setPreview] = useState<DebtAdjustmentPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Form Inputs
  const [reason, setReason] = useState<string>('Hàng trả lại theo thỏa thuận, giảm trừ công nợ');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Load pending returns on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingReturns(true);
    getPendingReturnsApi(token)
      .then((data: PendingReturnOrder[]) => {
        if (isMounted) {
          setPendingReturns(data);
          setLoadingReturns(false);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setLoadingReturns(false);
          emitStatusToast({
            type: 'error',
            title: 'Lỗi tải phiếu trả hàng',
            message: err.message || 'Không thể tải danh sách phiếu trả hàng chờ lập giảm nợ.',
          });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle select a return order and load preview
  const handleSelectReturn = useCallback(
    async (item: PendingReturnOrder) => {
      setSelectedReturn(item);
      setLoadingPreview(true);
      setPreviewError(null);
      try {
        const previewData = await getDebtAdjustmentPreviewApi(token, item.id);
        setPreview(previewData);
        setStep(2);
      } catch (err: any) {
        setPreviewError(err.message || 'Lỗi khi tải thông tin đối soát đơn giá gốc.');
        emitStatusToast({
          type: 'error',
          title: 'Lỗi tải đối soát',
          message: err.message || 'Lỗi khi lấy dữ liệu đơn giá từ hóa đơn gốc.',
        });
      } finally {
        setLoadingPreview(false);
      }
    },
    [token]
  );

  // Dynamic totals for Step 2 & 3
  const subtotal = preview?.subtotal_amount || 0;
  const taxAmount = preview?.tax_amount || 0;
  const totalAdjustedAmount = preview?.total_adjusted_amount || (subtotal + taxAmount);

  // Invoice remaining debt after adjustment
  const invoiceDebtBefore = preview?.invoice_remaining_debt || 0;
  const invoiceDebtAfter = preview?.estimated_remaining_debt ?? Math.max(0, invoiceDebtBefore - totalAdjustedAmount);

  // Dealer current debt after adjustment
  const dealerDebtBefore = preview?.current_debt || 0;
  const dealerDebtAfter = preview?.estimated_dealer_debt ?? Math.max(0, dealerDebtBefore - totalAdjustedAmount);

  // Credit limit available after adjustment
  const creditLimit = preview?.credit_limit || 0;
  const remainingCreditBefore = preview?.remaining_credit || 0;
  const remainingCreditAfter = preview?.estimated_remaining_credit ?? Math.min(
    creditLimit,
    Math.max(0, creditLimit - dealerDebtAfter)
  );

  // Submit Debt Adjustment
  const handleSubmit = async () => {
    if (!selectedReturn) {
      emitStatusToast({
        type: 'warning',
        title: 'Thiếu thông tin',
        message: 'Vui lòng chọn phiếu trả hàng.',
      });
      return;
    }

    if (!reason.trim()) {
      emitStatusToast({
        type: 'warning',
        title: 'Thiếu lý do điều chỉnh',
        message: 'Vui lòng nhập lý do điều chỉnh giảm nợ.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const created = await createDebtAdjustmentApi(token, {
        return_order_id: selectedReturn.id,
        reason: reason.trim(),
        note: note.trim() || undefined,
      });

      emitStatusToast({
        type: 'success',
        title: 'Lập chứng từ thành công',
        message: `Chứng từ ${created.adjustment_code} đã được ghi sổ và đối trừ công nợ.`,
      });

      onSuccess(created);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Không thể lập chứng từ',
        message: err.message || 'Đã xảy ra lỗi khi ghi sổ chứng từ điều chỉnh.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div className="debt-modal-overlay">
        <div className="debt-modal-card">
          {/* Header */}
          <div className="debt-modal-header">
            <div>
              <h2>Lập Chứng Từ Điều Chỉnh Giảm Công Nợ</h2>
              <p>Khấu trừ công nợ khi trả lại hàng theo Hóa đơn gốc &amp; Đơn giá đã xuất bán</p>
            </div>
            <button
              type="button"
              className="debt-modal-close-btn"
              onClick={onClose}
              disabled={submitting}
              title="Đóng modal"
            >
              &times;
            </button>
          </div>

          {/* Steps Indicator */}
          <div style={{ padding: '1rem 1.5rem 0 1.5rem', backgroundColor: '#f8fafc' }}>
            <div className="debt-steps-bar">
              <div className={`debt-step-item ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
                <div className="debt-step-circle">1</div>
                <div className="debt-step-label">Chọn Phiếu trả hàng</div>
              </div>
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: step > 1 ? '#10b981' : '#e2e8f0',
                  margin: '0 0.5rem',
                  marginBottom: '1rem',
                }}
              />
              <div className={`debt-step-item ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
                <div className="debt-step-circle">2</div>
                <div className="debt-step-label">Đối soát Đơn giá gốc</div>
              </div>
              <div
                style={{
                  flex: 1,
                  height: '2px',
                  backgroundColor: step > 2 ? '#10b981' : '#e2e8f0',
                  margin: '0 0.5rem',
                  marginBottom: '1rem',
                }}
              />
              <div className={`debt-step-item ${step === 3 ? 'active' : ''}`}>
                <div className="debt-step-circle">3</div>
                <div className="debt-step-label">Xem trước &amp; Ghi sổ</div>
              </div>
            </div>
          </div>

          {/* Modal Body */}
          <div className="debt-modal-body">
            {/* STEP 1: CHỌN PHIẾU TRẢ HÀNG */}
            {step === 1 && (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                    Danh sách Phiếu trả hàng đã hoàn kho chờ lập chứng từ giảm nợ
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                    Chỉ hiển thị các phiếu trả hàng có trạng thái HOÀN KHO / XÁC NHẬN chưa từng lập chứng từ giảm trừ công nợ.
                  </p>
                </div>

                {loadingReturns ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                    <p>Đang tìm kiếm phiếu trả hàng chờ xử lý...</p>
                  </div>
                ) : pendingReturns.length === 0 ? (
                  <div
                    style={{
                      padding: '2.5rem',
                      textAlign: 'center',
                      backgroundColor: '#f8fafc',
                      borderRadius: '0.5rem',
                      border: '1px dashed #cbd5e1',
                    }}
                  >
                    <p style={{ fontWeight: 600, color: '#475569', margin: 0 }}>
                      Không có phiếu trả hàng nào đang chờ lập giảm nợ
                    </p>
                    <p style={{ fontSize: '0.8125rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                      Tất cả các phiếu trả hàng đã được ghi nhận hoặc chưa có đơn hàng nào phát sinh hoàn kho.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                    <table className="debt-adj-table">
                      <thead>
                        <tr>
                          <th>Mã Phiếu Trả</th>
                          <th>Hóa Đơn Gốc</th>
                          <th>Đại Lý</th>
                          <th>Ngày Trả Hàng</th>
                          <th>Số Mặt Hàng</th>
                          <th style={{ textAlign: 'right' }}>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingReturns.map((item) => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600, color: '#0f766e' }}>{item.return_code}</td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>
                                {item.original_invoice_code}
                              </span>
                            </td>
                            <td>{item.dealer_name}</td>
                            <td>{formatDate(item.confirmed_at || item.created_at)}</td>
                            <td>
                              <span
                                style={{
                                  padding: '0.2rem 0.5rem',
                                  borderRadius: '9999px',
                                  backgroundColor: '#ccfbf1',
                                  color: '#0f766e',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                }}
                              >
                                {item.total_items_count || item.items?.length || 0} sản phẩm
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="debt-adj-btn-primary"
                                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}
                                onClick={() => handleSelectReturn(item)}
                                disabled={loadingPreview}
                              >
                                {loadingPreview && selectedReturn?.id === item.id ? 'Đang tải...' : 'Chọn phiếu này'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: ĐỐI SOÁT ĐƠN GIÁ GỐC */}
            {step === 2 && preview && (
              <div>
                {previewError && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', borderRadius: '0.375rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {previewError}
                  </div>
                )}

                {/* Header overview cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  {/* Dealer Info */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Thông Tin Đại Lý
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                      {preview.dealer_name}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '0.25rem' }}>
                      Mã: {preview.dealer_code || preview.dealer_id} | Dư nợ hiện tại:{' '}
                      <strong style={{ color: '#b91c1c' }}>{formatCurrency(preview.current_debt)}</strong>
                    </div>
                  </div>

                  {/* Original Invoice Info */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                      Hóa Đơn Bán Hàng Gốc
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginTop: '0.25rem' }}>
                      {preview.original_invoice_code}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#475569', marginTop: '0.25rem' }}>
                      Tổng tiền HĐ: {formatCurrency(preview.invoice_total_amount)} | Còn nợ HĐ:{' '}
                      <strong style={{ color: '#b91c1c' }}>{formatCurrency(preview.invoice_remaining_debt)}</strong>
                    </div>
                  </div>
                </div>

                {/* Return Items Table (Read-only) */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                      Bảng Chi Tiết Mặt Hàng Trả Lại &amp; Đơn Giá Bán Gốc
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                      ✓ Đã bảo đảm đơn giá thời điểm bán
                    </span>
                  </div>

                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '0.5rem' }}>
                    <table className="debt-adj-table">
                      <thead>
                        <tr>
                          <th>STT</th>
                          <th>Mã SP</th>
                          <th>Tên Sản Phẩm</th>
                          <th>ĐVT</th>
                          <th style={{ textAlign: 'right' }}>SL Trả</th>
                          <th style={{ textAlign: 'right' }}>Đơn Giá Gốc</th>
                          <th style={{ textAlign: 'right' }}>Thành Tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.items.map((item, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.product_code}</td>
                            <td>{item.product_name}</td>
                            <td>{item.unit_name || 'Cái'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{item.return_quantity}</td>
                            <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                              {formatCurrency(item.original_unit_price)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                              {formatCurrency(item.line_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Subtotals & Total */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <div style={{ width: '320px', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#64748b' }}>Tiền hàng trả theo giá gốc:</span>
                      <strong style={{ color: '#0f172a' }}>{formatCurrency(subtotal)}</strong>
                    </div>
                    {taxAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#64748b' }}>Thuế VAT hoàn:</span>
                        <strong style={{ color: '#0f172a' }}>{formatCurrency(taxAmount)}</strong>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '1rem',
                        fontWeight: 700,
                        color: '#0f766e',
                        borderTop: '1px dashed #cbd5e1',
                        paddingTop: '0.5rem',
                        marginTop: '0.5rem',
                      }}
                    >
                      <span>Tổng giảm trừ dự kiến:</span>
                      <span>{formatCurrency(totalAdjustedAmount)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: XEM TRƯỚC SỐ DƯ & GHI SỔ */}
            {step === 3 && preview && (
              <div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
                    Đối chiếu &amp; Xem trước tác động đối trừ công nợ
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8125rem', color: '#64748b' }}>
                    Hệ thống sẽ đồng thời trừ số nợ trên hóa đơn gốc, giảm nợ tổng đại lý và giải phóng hạn mức tín dụng ngay lập tức.
                  </p>
                </div>

                {/* 3 Impact comparison boxes */}
                <div className="debt-comparison-grid">
                  {/* Card 1: Hóa đơn gốc */}
                  <div className="debt-comparison-box">
                    <h4>1. Hóa Đơn Gốc: {preview.original_invoice_code}</h4>
                    <div className="debt-comp-row">
                      <span style={{ color: '#64748b' }}>Dư nợ hiện tại:</span>
                      <span>{formatCurrency(invoiceDebtBefore)}</span>
                    </div>
                    <div className="debt-comp-row">
                      <span style={{ color: '#64748b' }}>Khấu trừ giảm:</span>
                      <span style={{ color: '#059669', fontWeight: 600 }}>-{formatCurrency(totalAdjustedAmount)}</span>
                    </div>
                    <div className="debt-comp-row highlight">
                      <span>Dư nợ còn lại:</span>
                      <span style={{ color: invoiceDebtAfter === 0 ? '#059669' : '#b91c1c' }}>
                        {formatCurrency(invoiceDebtAfter)}
                      </span>
                    </div>
                    {invoiceDebtAfter === 0 && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#059669', backgroundColor: '#d1fae5', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', textAlign: 'center' }}>
                        ✓ Hóa đơn sẽ tự động chuyển sang ĐÃ THANH TOÁN
                      </div>
                    )}
                  </div>

                  {/* Card 2: Công nợ đại lý */}
                  <div className="debt-comparison-box">
                    <h4>2. Công Nợ Đại Lý: {preview.dealer_name}</h4>
                    <div className="debt-comp-row">
                      <span style={{ color: '#64748b' }}>Nợ lũy kế hiện tại:</span>
                      <span>{formatCurrency(dealerDebtBefore)}</span>
                    </div>
                    <div className="debt-comp-row">
                      <span style={{ color: '#64748b' }}>Giảm trừ công nợ:</span>
                      <span style={{ color: '#059669', fontWeight: 600 }}>-{formatCurrency(totalAdjustedAmount)}</span>
                    </div>
                    <div className="debt-comp-row highlight">
                      <span>Nợ lũy kế mới:</span>
                      <span style={{ color: '#0f766e' }}>{formatCurrency(dealerDebtAfter)}</span>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                      Ghi Sổ chi tiết công nợ Mẫu S31-DN: Cột Phát sinh Có
                    </div>
                  </div>

                  {/* Card 3: Hạn mức khả dụng */}
                  <div className="debt-comparison-box">
                    <h4>3. Hạn Mức Tín Dụng Khả Dụng</h4>
                    <div className="debt-comp-row">
                      <span style={{ color: '#64748b' }}>Hạn mức tín dụng:</span>
                      <span>{formatCurrency(creditLimit)}</span>
                    </div>
                    <div className="debt-comp-row">
                      <span style={{ color: '#64748b' }}>Khả dụng trước:</span>
                      <span>{formatCurrency(remainingCreditBefore)}</span>
                    </div>
                    <div className="debt-comp-row highlight">
                      <span>Khả dụng sau:</span>
                      <span style={{ color: '#059669' }}>{formatCurrency(remainingCreditAfter)}</span>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>
                      ↑ Tăng khả dụng: +{formatCurrency(Math.min(dealerDebtBefore, totalAdjustedAmount))}
                    </div>
                  </div>
                </div>

                {/* Form fields: Reason & Note */}
                <div style={{ marginTop: '1.25rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Lý do điều chỉnh giảm nợ <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Ví dụ: Hàng lỗi quy cách kỹ thuật, đại lý trả lại theo biên bản kiểm kê..."
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>
                      Ghi chú bổ sung
                    </label>
                    <textarea
                      rows={2}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Thông tin thêm cho kế toán trưởng hoặc đại lý..."
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="debt-modal-footer">
            {step === 1 && (
              <button
                type="button"
                className="debt-adj-btn-secondary"
                onClick={onClose}
              >
                Hủy bỏ
              </button>
            )}

            {step === 2 && (
              <>
                <button
                  type="button"
                  className="debt-adj-btn-secondary"
                  onClick={() => setStep(1)}
                >
                  ← Quay lại chọn phiếu
                </button>
                <button
                  type="button"
                  className="debt-adj-btn-primary"
                  onClick={() => setStep(3)}
                >
                  Tiếp tục xem trước đối chiếu →
                </button>
              </>
            )}

            {step === 3 && (
              <>
                <button
                  type="button"
                  className="debt-adj-btn-secondary"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                >
                  ← Kiểm tra lại đối soát
                </button>
                <button
                  type="button"
                  className="debt-adj-btn-primary"
                  style={{ backgroundColor: '#059669' }}
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? 'Đang ghi sổ ACID...' : '✓ Xác nhận & Ghi sổ chứng từ'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
