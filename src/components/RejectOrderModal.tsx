import React, { useState, useEffect } from 'react';
import { OrderResponseData, rejectOrderApi } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface RejectOrderModalProps {
  isOpen: boolean;
  order: OrderResponseData | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RejectOrderModal: React.FC<RejectOrderModalProps> = ({
  isOpen,
  order,
  token,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const trimmedReason = reason.trim();
  const isValidLength = trimmedReason.length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLength) {
      setErrorMsg('Vui lòng nhập lý do từ chối cụ thể (tối thiểu 5 ký tự).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updated = await rejectOrderApi(token, order.order_code, trimmedReason);
      emitStatusToast({
        title: 'Từ chối đơn hàng thành công',
        message: `Đơn hàng ${updated.order_code} đã bị từ chối phê duyệt.`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi từ chối đơn hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) {
            onClose();
          }
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '20px 24px',
            maxWidth: '480px',
            width: '100%',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ marginBottom: '14px' }}>
            <h3
              style={{
                fontSize: '16.5px',
                fontWeight: '700',
                color: '#0f172a',
                margin: '0 0 4px 0',
              }}
            >
              Từ chối duyệt đơn hàng {order.order_code}
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
              Khách hàng: <strong>{order.dealer_name}</strong> &bull; Tổng tiền:{' '}
              <strong style={{ color: '#0284c7' }}>{order.total_amount.toLocaleString('vi-VN')} đ</strong>
            </p>
          </div>

          {order.approval_reason && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                padding: '8px 12px',
                marginBottom: '12px',
                fontSize: '12px',
                color: '#b45309',
                lineHeight: '1.4',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '2px' }}>Lý do cảnh báo vi phạm:</strong>
              {order.approval_reason}
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '12.5px',
                fontWeight: '600',
                marginBottom: '12px',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="input-reject-order-reason"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                <span>Ý kiến / Lý do từ chối (bắt buộc):</span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: '500',
                    color: isValidLength ? '#16a34a' : '#ef4444',
                  }}
                >
                  {trimmedReason.length}/5 ký tự tối thiểu
                </span>
              </label>
              <textarea
                id="input-reject-order-reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Nhập chi tiết lý do từ chối (tối thiểu 5 ký tự)..."
                rows={3}
                required
                autoFocus
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                id="btn-cancel-reject-order"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                id="btn-confirm-reject-order"
                disabled={isSubmitting || !isValidLength}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isSubmitting || !isValidLength ? '#94a3b8' : '#dc2626',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: isSubmitting || !isValidLength ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RejectOrderModal;
