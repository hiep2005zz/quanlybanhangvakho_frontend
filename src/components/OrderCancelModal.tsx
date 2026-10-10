import React, { useState, useEffect } from 'react';

export interface OrderCancelModalProps {
  orderCode: string;
  dealerName?: string;
  totalAmount?: number;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const OrderCancelModal: React.FC<OrderCancelModalProps> = ({
  orderCode,
  dealerName,
  totalAmount,
  isOpen,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanReason = reason.trim();
    if (!cleanReason) {
      setError('Vui lòng nhập lý do hủy đơn hàng (* bắt buộc).');
      return;
    }
    if (cleanReason.length < 3) {
      setError('Lý do hủy đơn hàng phải có ít nhất 3 ký tự.');
      return;
    }
    setError(null);
    onConfirm(cleanReason);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-modal-title"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          padding: '28px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #f1f5f9',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header (KHÔNG DÙNG ICON THEO YÊU CẦU) */}
        <div style={{ marginBottom: '18px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: '#dc2626',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: '4px',
            }}
          >
            THAO TÁC HỦY ĐƠN HÀNG
          </span>
          <h3
            id="cancel-modal-title"
            style={{
              margin: 0,
              fontSize: '19px',
              fontWeight: 800,
              color: '#0f172a',
            }}
          >
            Xác nhận hủy đơn hàng {orderCode}
          </h3>
        </div>

        {/* Thông tin vắn tắt đơn hàng */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#334155',
            lineHeight: '1.6',
          }}
        >
          {dealerName && (
            <div>
              <span style={{ color: '#64748b' }}>Khách hàng / Đại lý: </span>
              <strong>{dealerName}</strong>
            </div>
          )}
          {typeof totalAmount === 'number' && (
            <div>
              <span style={{ color: '#64748b' }}>Tổng giá trị đơn: </span>
              <strong>{totalAmount.toLocaleString('vi-VN')} đ</strong>
            </div>
          )}
          <div style={{ marginTop: '4px', color: '#047857', fontWeight: 600 }}>
            Hệ thống sẽ tự động hoàn trả số lượng hàng giữ chỗ về tồn khả dụng.
          </div>
        </div>

        {/* Cảnh báo */}
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '18px',
            color: '#991b1b',
            fontSize: '12.5px',
            lineHeight: '1.45',
          }}
        >
          <strong>Lưu ý: </strong>
          Đơn đã hủy sẽ không thể tiếp tục quy trình xuất kho. Nếu đơn hàng đã xuất kho thì bắt buộc phải chuyển sang quy trình trả hàng thay vì hủy.
        </div>

        <form onSubmit={handleSubmit}>
          {/* Nhập lý do hủy bắt buộc */}
          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="cancel-reason-input"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 700,
                color: '#0f172a',
                marginBottom: '6px',
              }}
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
              placeholder="Ví dụ: Đại lý đổi lịch lấy hàng, nhập nhầm số lượng, trùng đơn..."
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: error ? '1.5px solid #dc2626' : '1.5px solid #cbd5e1',
                fontSize: '13.5px',
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
            />
            {error && (
              <div
                style={{
                  fontSize: '12px',
                  color: '#dc2626',
                  marginTop: '4px',
                  fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Action buttons (KHÔNG DÙNG ICON) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '8px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Giữ lại đơn
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              style={{
                padding: '9px 20px',
                background: isSubmitting || !reason.trim() ? '#fca5a5' : '#dc2626',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                color: '#ffffff',
                cursor: isSubmitting || !reason.trim() ? 'not-allowed' : 'pointer',
                boxShadow: isSubmitting || !reason.trim() ? 'none' : '0 2px 4px rgba(220, 38, 38, 0.25)',
              }}
            >
              {isSubmitting ? 'Đang xử lý hủy...' : 'Xác nhận hủy đơn'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderCancelModal;
