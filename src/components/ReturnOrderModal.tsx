import React, { useState, useEffect } from 'react';
import { OrderResponseData, returnOrderApi } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface ReturnOrderModalProps {
  isOpen: boolean;
  order: OrderResponseData | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnOrderModal: React.FC<ReturnOrderModalProps> = ({
  isOpen,
  order,
  token,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const trimmedReason = reason.trim();
  const isValidLength = trimmedReason.length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidLength) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: 'Vui lòng nhập ý kiến chỉ đạo sửa (tối thiểu 5 ký tự).',
        type: 'warning',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const updated = await returnOrderApi(token, order.order_code, trimmedReason);
      emitStatusToast({
        title: 'Trả lại đơn hàng thành công',
        message: `Đơn hàng ${updated.order_code} đã được chuyển về trạng thái Yêu cầu sửa.`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: err.message || 'Lỗi khi trả lại đơn hàng.',
        type: 'error',
      });
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
              Trả lại đơn hàng {order.order_code} để sửa
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
              Khách hàng: <strong>{order.dealer_name}</strong> &bull; Người tạo:{' '}
              <strong>{order.created_by || order.assigned_sale_name || '—'}</strong>
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

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="input-return-order-reason"
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
                <span>Ý kiến chỉ đạo sửa (bắt buộc):</span>
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
                id="input-return-order-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Nhập nội dung chỉ đạo chỉnh sửa chi tiết (tối thiểu 5 ký tự)..."
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
                id="btn-cancel-return-order"
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
                id="btn-confirm-return-order"
                disabled={isSubmitting || !isValidLength}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  background: isSubmitting || !isValidLength ? '#94a3b8' : '#ea580c',
                  color: '#ffffff',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: isSubmitting || !isValidLength ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                {isSubmitting ? 'Đang xử lý...' : 'Xác nhận trả lại sửa'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ReturnOrderModal;
