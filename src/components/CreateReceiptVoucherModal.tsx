import React, { useState } from 'react';
import { DealerSearchItem, ReceiptVoucherData, createReceiptVoucherApi } from '../services/dealerSearchApi';
import { User, formatErrorMessage } from '../services/api';
import { convertNumberToVietnameseWords } from '../utils/numberToWords';
import { ModalPortal } from './ModalPortal';

interface CreateReceiptVoucherModalProps {
  isOpen: boolean;
  dealer: DealerSearchItem;
  orderCode?: string;
  defaultAmount?: number;
  currentUser?: User | null;
  token?: string;
  onClose: () => void;
  onSuccess: (voucher: ReceiptVoucherData) => void;
}

export const CreateReceiptVoucherModal: React.FC<CreateReceiptVoucherModalProps> = ({
  isOpen,
  dealer,
  orderCode,
  defaultAmount,
  currentUser,
  token,
  onClose,
  onSuccess,
}) => {
  const [amountStr, setAmountStr] = useState<string>(
    defaultAmount && defaultAmount > 0 ? String(defaultAmount) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<string>('Tiền mặt');
  const [payerName, setPayerName] = useState<string>(dealer.name ? `Đại diện ${dealer.name}` : '');
  const [reason, setReason] = useState<string>(
    orderCode ? `Thu tiền thanh toán đơn hàng ${orderCode}` : `Thu tiền công nợ đại lý ${dealer.code}`
  );
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const numAmount = parseFloat(amountStr) || 0;
  const isInvalidAmount = amountStr === '' || isNaN(numAmount) || numAmount <= 0;
  const words = numAmount > 0 ? convertNumberToVietnameseWords(numAmount) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isInvalidAmount) {
      setErrorMsg('Số tiền thu phải lớn hơn 0 (tối thiểu 1 đ).');
      return;
    }
    if (!payerName.trim()) {
      setErrorMsg('Vui lòng nhập tên người nộp tiền.');
      return;
    }

    setSubmitting(true);
    try {
      const voucher = await createReceiptVoucherApi(
        dealer.id,
        {
          amount: numAmount,
          payment_method: paymentMethod,
          reason: reason.trim() || undefined,
          order_code: orderCode || undefined,
          payer_name: payerName.trim() || undefined,
          note: note.trim() || undefined,
        },
        token
      );
      onSuccess(voucher);
    } catch (err: any) {
      setErrorMsg(formatErrorMessage(err?.message || err, 'Lỗi lập phiếu thu.'));
    } finally {
      setSubmitting(false);
    }
  };

  const collectorName = currentUser?.full_name || currentUser?.username || 'Kế toán công nợ';

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          padding: '16px',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            maxWidth: '540px',
            width: '100%',
            maxHeight: 'min(92vh, 650px)',
            display: 'flex',
            flexDirection: 'column',
            padding: '18px 22px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.25)',
            color: '#0f172a',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              paddingBottom: '10px',
              borderBottom: '1px solid #e2e8f0',
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: '800', margin: '0 0 3px 0', color: '#0f172a' }}>
                Lập Phiếu Thu Tiền Đại Lý
              </h2>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                Đại lý: <strong style={{ color: '#0f172a' }}>{dealer.name}</strong> ({dealer.code})
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '7px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '12.5px',
                marginBottom: '10px',
                flexShrink: 0,
              }}
            >
              {errorMsg}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                paddingRight: '4px',
                marginBottom: '12px',
              }}
            >
              {/* Số tiền thu - Đặt lên trên đầu form và căn lề trái */}
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '700',
                    color: '#334155',
                    marginBottom: '4px',
                  }}
                >
                  Số tiền thu (VNĐ) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  autoFocus
                  required
                  value={amountStr}
                  onChange={(e) => {
                    setAmountStr(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Nhập số tiền..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '7px',
                    border: isInvalidAmount && amountStr !== '' ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    background: isInvalidAmount && amountStr !== '' ? '#fef2f2' : '#ffffff',
                    fontSize: '15px',
                    fontWeight: '800',
                    color: isInvalidAmount && amountStr !== '' ? '#b91c1c' : '#1e40af',
                    outline: 'none',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                  }}
                />
                {numAmount > 0 && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: '12px',
                      color: '#15803d',
                      fontStyle: 'italic',
                      fontWeight: '600',
                    }}
                  >
                    Bằng chữ: {words}
                  </div>
                )}
                {isInvalidAmount && amountStr !== '' && (
                  <div style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626', fontWeight: '500' }}>
                    Số tiền thu phải lớn hơn 0
                  </div>
                )}
              </div>

              {/* Thông tin đại lý */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  marginBottom: '12px',
                  fontSize: '12.5px',
                  lineHeight: '1.5',
                  color: '#475569',
                }}
              >
                <div>
                  <strong>Địa chỉ:</strong> {dealer.address || '—'}
                </div>
                <div>
                  <strong>Điện thoại:</strong> {dealer.phone || '—'} {dealer.tax_code ? ` | MST: ${dealer.tax_code}` : ''}
                </div>
                <div>
                  <strong>Người thu (Kế toán):</strong> {collectorName}
                </div>
              </div>

              {/* Hình thức thanh toán */}
              <div style={{ marginBottom: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    Hình thức thanh toán <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff',
                      outline: 'none',
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="Tiền mặt">Tiền mặt</option>
                    <option value="Chuyển khoản ngân hàng">Chuyển khoản ngân hàng</option>
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      color: '#334155',
                      marginBottom: '4px',
                    }}
                  >
                    Người nộp tiền <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Tên người nộp tiền..."
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Lý do thu */}
              <div style={{ marginBottom: '12px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#334155',
                    marginBottom: '4px',
                  }}
                >
                  Lý do thu tiền <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: Thu tiền thanh toán công nợ..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Ghi chú */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    color: '#334155',
                    marginBottom: '4px',
                  }}
                >
                  Ghi chú chứng từ
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi chú thêm về khoản thu (nếu có)..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '7px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Footer buttons */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                paddingTop: '10px',
                borderTop: '1px solid #f1f5f9',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '7px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={submitting || isInvalidAmount}
                style={{
                  padding: '8px 20px',
                  borderRadius: '7px',
                  border: 'none',
                  background: submitting || isInvalidAmount ? '#cbd5e1' : '#2563eb',
                  color: submitting || isInvalidAmount ? '#64748b' : '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: submitting || isInvalidAmount ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {submitting ? 'Đang ghi nhận...' : 'Ghi nhận & In phiếu thu'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CreateReceiptVoucherModal;
