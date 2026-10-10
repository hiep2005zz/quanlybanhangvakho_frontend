import { useState, useEffect } from 'react';
import { OrderItem } from '../services/api';
import './orders-view.css';

interface OrderCancelConfirmModalProps {
  order: OrderItem;
  isSubmitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export default function OrderCancelConfirmModal({
  order,
  isSubmitting,
  onCancel,
  onConfirm,
}: OrderCancelConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSubmitting, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reason.trim();
    if (!clean) {
      setError('Vui lòng nhập lý do hủy đơn hàng (* bắt buộc).');
      return;
    }
    setError(null);
    onConfirm(clean);
  };

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
        style={{ maxWidth: '500px' }}
      >
        <h2 id="order-cancel-title" style={{ marginTop: 0 }}>Xác nhận hủy đơn hàng</h2>
        <p id="order-cancel-description">
          Bạn có chắc chắn muốn hủy đơn <strong>{order.order_code}</strong> ({order.dealer_name}) không?
        </p>

        <div className="orders-confirm-note" style={{ marginBottom: '14px' }}>
          Đơn hàng sẽ chuyển sang trạng thái &ldquo;Đã hủy&rdquo; và tự động nhả số lượng hàng giữ chỗ về tồn kho khả dụng.
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ textAlign: 'left', marginBottom: '16px' }}>
            <label
              htmlFor="cancel-reason-input"
              style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
            >
              Lý do hủy đơn hàng <span style={{ color: '#dc2626' }}>* (Bắt buộc)</span>
            </label>
            <textarea
              id="cancel-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Nhập lý do hủy đơn hàng..."
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: error ? '1px solid #dc2626' : '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <div style={{ color: '#dc2626', fontSize: '12px', marginTop: '4px' }}>
                {error}
              </div>
            )}
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
              type="submit"
              className="orders-confirm-delete"
              disabled={isSubmitting || !reason.trim()}
              style={{
                opacity: isSubmitting || !reason.trim() ? 0.6 : 1,
                cursor: isSubmitting || !reason.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'Đang hủy...' : 'Xác nhận hủy'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
