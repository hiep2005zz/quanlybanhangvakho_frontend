import { useEffect, useState } from 'react';
import { getOrderDetailApi, OrderDetail } from '../services/api';
import './orders-view.css';

interface OrderDetailsModalProps {
  token: string;
  orderCode: string;
  onClose: () => void;
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

export default function OrderDetailsModal({ token, orderCode, onClose }: OrderDetailsModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
          <button type="button" className="orders-back-button" onClick={onClose}>Đóng</button>
        </header>

        {isLoading && <div className="orders-state" role="status">Đang tải chi tiết đơn hàng...</div>}
        {error && <div className="orders-state orders-error" role="alert">{error}</div>}
        {order && (
          <div className="orders-detail-content">
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
    </div>
  );
}
