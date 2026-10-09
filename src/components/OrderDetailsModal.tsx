import { useEffect, useState } from 'react';
import { getOrderDetailApi, OrderDetail } from '../services/api';
import OrderPrintModal from './OrderPrintModal';
import './orders-view.css';

interface OrderDetailsModalProps {
  token: string;
  orderCode: string;
  onClose: () => void;
  onOpenPrint?: (orderCode: string, orderData?: OrderDetail | null) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);

const formatDate = (value?: string | null) => {
  if (!value) return 'Chưa có thông tin';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
};

export default function OrderDetailsModal({ token, orderCode, onClose, onOpenPrint }: OrderDetailsModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getOrderDetailApi(token, orderCode)
      .then((details) => {
        if (isMounted) setOrder(details);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải chi tiết đơn hàng.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [orderCode, token]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="orders-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section
        className="orders-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
      >
        <header className="orders-detail-heading">
          <div>
            <p className="orders-page-eyebrow">CHI TIẾT ĐƠN HÀNG</p>
            <h2 id="order-detail-title">{orderCode}</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="orders-detail-button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                padding: '8px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
              onClick={() => {
                if (onOpenPrint) {
                  onOpenPrint(orderCode, order);
                } else {
                  setIsPrintOpen(true);
                }
              }}
              title="In phiếu hoặc xuất file PDF đơn hàng cho đại lý xem và ký xác nhận"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
              In / Xuất PDF
            </button>
            <button type="button" className="orders-back-button" onClick={onClose}>Đóng</button>
          </div>
        </header>

        {isLoading && <div className="orders-state" role="status">Đang tải chi tiết đơn hàng...</div>}
        {error && <div className="orders-state orders-error" role="alert">{error}</div>}
        {order && (
          <div className="orders-detail-content">
            {Boolean(
              order.dealer_status &&
              (order.dealer_status.toLowerCase().includes('khóa') ||
               order.dealer_status.toLowerCase().includes('lock') ||
               order.dealer_status.toLowerCase().includes('ngừng'))
            ) && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #ef4444',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  color: '#991b1b',
                  fontSize: '13.5px',
                  lineHeight: '1.5',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  boxShadow: '0 2px 4px rgba(239, 68, 68, 0.08)',
                }}
              >
                <div>
                  <strong style={{ display: 'block', marginBottom: '2px', color: '#b91c1c' }}>
                    CẢNH BÁO CÔNG NỢ: Đại lý &apos;{order.dealer_name}&apos; hiện đang bị KHÓA giao dịch
                    {order.dealer_lock_reason ? ` (Lý do: ${order.dealer_lock_reason})` : ''}.
                  </strong>
                  <span>Đơn dở dang này vẫn được phép xử lý nhưng vui lòng kiểm tra kỹ công nợ trước khi xuất hàng!</span>
                </div>
              </div>
            )}
            <dl className="orders-detail-summary">
              <div><dt>Đại lý</dt><dd>{order.dealer_name}</dd></div>
              <div><dt>Người tạo</dt><dd>{order.created_by}</dd></div>
              <div><dt>Ngày tạo</dt><dd>{formatDate(order.created_at)}</dd></div>
              <div><dt>Trạng thái</dt><dd>{order.status}</dd></div>
              <div><dt>Điểm giao hàng</dt><dd>{order.delivery_point || 'Chưa có thông tin'}</dd></div>
              <div><dt>Ngày giao mong muốn</dt><dd>{formatDate(order.desired_delivery_date)}</dd></div>
              {order.note && <div className="orders-detail-note"><dt>Ghi chú</dt><dd>{order.note}</dd></div>}
            </dl>

            <div className="orders-detail-table-wrap">
              <table className="orders-table orders-detail-table">
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>Đơn vị</th>
                    <th className="orders-detail-number">Số lượng</th>
                    <th className="orders-detail-number">Đơn giá</th>
                    <th className="orders-detail-number">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => (
                    <tr key={`${item.product_id}-${index}`}>
                      <td>{item.product_code ? `${item.product_code} — ` : ''}{item.product_name}</td>
                      <td>{item.unit || item.unit_name || '—'}</td>
                      <td className="orders-detail-number">{item.quantity}</td>
                      <td className="orders-detail-number">{formatCurrency(item.price)}</td>
                      <td className="orders-detail-number">{formatCurrency(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                  {order.items.length === 0 && (
                    <tr><td colSpan={5} className="orders-detail-empty">Đơn hàng không có dữ liệu sản phẩm chi tiết.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="orders-detail-totals">
              <div><span>Tổng tiền hàng</span><strong>{formatCurrency(order.subtotal_amount)}</strong></div>
              <div><span>Chiết khấu ({order.discount_percent}%)</span><strong>− {formatCurrency(order.discount_amount)}</strong></div>
              <div className="orders-detail-grand-total"><span>Tổng thanh toán</span><strong>{formatCurrency(order.total_amount)}</strong></div>
            </div>
          </div>
        )}
      </section>

      {isPrintOpen && (
        <OrderPrintModal
          token={token}
          orderCode={orderCode}
          initialOrder={order}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </div>
  );
}
