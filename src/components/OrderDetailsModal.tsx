import { useEffect, useState } from 'react';
import {
  getOrderDetailApi,
  OrderDetail,
  getOrderPickingLocationsApi,
  OrderPickingSummary,
  OrderPickingItem,
  ProductPickingLocationItem,
} from '../services/api';
import OrderPrintModal from './OrderPrintModal';
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
  const [pickingSummary, setPickingSummary] = useState<OrderPickingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getOrderDetailApi(token, orderCode),
      getOrderPickingLocationsApi(token, orderCode).catch(() => null),
    ])
      .then(([details, picking]) => {
        if (isMounted) {
          setOrder(details);
          if (picking) setPickingSummary(picking);
        }
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
        style={{ maxWidth: '950px', width: '95%' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-detail-title"
      >
        <header className="orders-detail-heading">
          <div>
            <p className="orders-page-eyebrow">CHI TIẾT ĐƠN HÀNG & SOẠN HÀNG THEO VỊ TRÍ KHO</p>
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
              onClick={() => setIsPrintOpen(true)}
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

        {isLoading && <div className="orders-state" role="status">Đang tải chi tiết đơn hàng và vị trí kho...</div>}
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

            {/* Thông tin kho xuất hàng phục vụ */}
            {pickingSummary && (
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21V9l9-7 9 7v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', textTransform: 'uppercase' }}>
                      Kho xuất hàng mặc định (Đại lý {order.dealer_name})
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0c4a6e' }}>
                      {pickingSummary.warehouse_name} ({pickingSummary.warehouse_code})
                    </div>
                  </div>
                </div>
                {pickingSummary.warehouse_address && (
                  <div style={{ fontSize: '12.5px', color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px' }}>
                    Địa chỉ: {pickingSummary.warehouse_address}
                  </div>
                )}
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
                    <th className="orders-detail-number">SL đặt</th>
                    <th>Vị trí kệ lưu kho & Tồn khả dụng</th>
                    <th className="orders-detail-number">Đơn giá</th>
                    <th className="orders-detail-number">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, index) => {
                    const pickingItem = pickingSummary?.items.find((p: OrderPickingItem) => p.product_id === item.product_id);
                    const totalAvailable = (pickingItem?.locations || []).reduce(
                      (acc: number, l: ProductPickingLocationItem) => acc + (l.available_quantity || 0),
                      0
                    );
                    const isSufficient = totalAvailable >= item.quantity;

                    return (
                      <tr key={`${item.product_id}-${index}`}>
                        <td>
                          <strong>{item.product_code ? `${item.product_code} — ` : ''}{item.product_name}</strong>
                        </td>
                        <td>{item.unit || item.unit_name || '—'}</td>
                        <td className="orders-detail-number" style={{ fontWeight: '700', color: '#0f172a' }}>
                          {item.quantity}
                        </td>
                        <td>
                          {pickingItem && pickingItem.locations.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {pickingItem.locations.map((loc: ProductPickingLocationItem) => (
                                <div
                                  key={loc.location_id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    padding: '2px 8px',
                                    fontSize: '12px',
                                  }}
                                >
                                  <span style={{ fontWeight: '700', color: '#1e293b' }}>
                                    {loc.location_code}
                                  </span>
                                  <span style={{ color: '#64748b', fontSize: '11px' }}>
                                    (Khu {loc.zone} - Kệ {loc.aisle}/{loc.rack})
                                  </span>
                                  <span
                                    style={{
                                      marginLeft: 'auto',
                                      color: loc.available_quantity >= item.quantity ? '#16a34a' : '#d97706',
                                      fontWeight: '600',
                                    }}
                                  >
                                    SL: {loc.available_quantity} {item.unit || 'Cái'}
                                  </span>
                                </div>
                              ))}
                              <div style={{ fontSize: '11px', color: isSufficient ? '#16a34a' : '#dc2626', fontWeight: '600', marginTop: '2px' }}>
                                {isSufficient
                                  ? `✓ Đủ hàng tại kho (${totalAvailable} ${item.unit || 'Cái'} khả dụng)`
                                  : `⚠ Thiếu hàng (Chỉ có ${totalAvailable}/${item.quantity} ${item.unit || 'Cái'})`}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: '#b45309', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <span>Chưa phân bổ vị trí kệ</span>
                            </div>
                          )}
                        </td>
                        <td className="orders-detail-number">{formatCurrency(item.price)}</td>
                        <td className="orders-detail-number">{formatCurrency(item.price * item.quantity)}</td>
                      </tr>
                    );
                  })}
                  {order.items.length === 0 && (
                    <tr><td colSpan={6} className="orders-detail-empty">Đơn hàng không có dữ liệu sản phẩm chi tiết.</td></tr>
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
