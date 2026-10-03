import { useEffect } from 'react';
import { OrderItem } from '../services/api';
import './orders-view.css';

interface OrderCancelConfirmModalProps {
  order: OrderItem;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function OrderCancelConfirmModal({
  order,
  isSubmitting,
  onCancel,
  onConfirm,
}: OrderCancelConfirmModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onCancel]);

  return (
    <div
      className="orders-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onCancel();
      }}
    >
      <section
        className="orders-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="order-cancel-title"
        aria-describedby="order-cancel-description"
      >
        <div className="orders-confirm-icon" aria-hidden="true">!</div>
        <h2 id="order-cancel-title">Xác nhận hủy đơn hàng</h2>
        <p id="order-cancel-description">
          Bạn có chắc chắn muốn hủy đơn <strong>{order.order_code}</strong> không?
        </p>
        <div className="orders-confirm-note">
          Đơn hàng sẽ chuyển sang trạng thái “Đã hủy” và vẫn được lưu trong lịch sử hệ thống.
        </div>
        <div className="orders-confirm-actions">
          <button
            type="button"
            className="orders-back-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Giữ lại đơn
          </button>
          <button
            type="button"
            className="orders-confirm-delete"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Đang hủy...' : 'Xác nhận hủy'}
          </button>
        </div>
      </section>
    </div>
  );
}
