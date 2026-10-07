import React, { useState } from 'react';
import { OrderResponseData, approveOrderApi } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface ApproveOrderModalProps {
  isOpen: boolean;
  order: OrderResponseData | null;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ApproveOrderModal: React.FC<ApproveOrderModalProps> = ({
  isOpen,
  order,
  token,
  onClose,
  onSuccess,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const updated = await approveOrderApi(token, order.order_code);
      emitStatusToast({
        title: 'Phê duyệt đơn hàng thành công',
        message: `Đơn hàng ${updated.order_code} đã được duyệt và chuyển sang trạng thái Đã xác nhận để xuất kho.`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi phê duyệt đơn hàng.');
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
          backdropFilter: 'blur(4px)',
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
            borderRadius: '16px',
            padding: '24px 28px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
          }}
        >
        <div style={{ marginBottom: '16px' }}>
          <h3
            style={{
              fontSize: '18px',
              fontWeight: '800',
              color: '#0f172a',
              margin: '0 0 6px 0',
              letterSpacing: '-0.02em',
            }}
          >
            Phê duyệt đơn hàng {order.order_code}
          </h3>
          <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: '1.5' }}>
            Bạn có chắc chắn muốn phê duyệt đơn hàng này không? Sau khi duyệt, đơn hàng sẽ chuyển sang trạng thái <strong>Đã xác nhận</strong> và đủ điều kiện để xuất kho.
          </p>
        </div>

        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '18px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#64748b' }}>Khách hàng:</span>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>{order.dealer_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#64748b' }}>Người lên đơn:</span>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>
              {order.created_by || order.assigned_sale_name || '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ color: '#64748b' }}>Tổng giá trị:</span>
            <span style={{ fontWeight: '800', color: '#2563eb' }}>{order.total_amount.toLocaleString('vi-VN')} đồng</span>
          </div>
          {order.approval_reason && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' }}>
              <span style={{ color: '#b45309', fontWeight: '600' }}>Cảnh báo: </span>
              <span style={{ color: '#b45309' }}>{order.approval_reason}</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '16px',
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            id="btn-cancel-approve-order"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
            }}
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            id="btn-confirm-approve-order"
            onClick={handleConfirm}
            disabled={isSubmitting}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              background: isSubmitting ? '#9ca3af' : '#16a34a',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: isSubmitting ? 'none' : '0 2px 4px rgba(22, 163, 74, 0.25)',
            }}
          >
            {isSubmitting ? 'Đang xử lý...' : 'Xác nhận duyệt'}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default ApproveOrderModal;
