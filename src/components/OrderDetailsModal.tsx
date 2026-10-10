import { useEffect, useState } from 'react';
import {
  cancelOrderApi,
  getOrderDetailApi,
  getCloneOrderDataApi,
  OrderDetail,
  getOrderPickingLocationsApi,
  OrderPickingSummary,
  OrderPickingItem,
  ProductPickingLocationItem,
  User,
} from '../services/api';
import { OrderLifecycleTimeline } from './OrderLifecycleTimeline';
import { OrderCancelModal } from './OrderCancelModal';
import { getOrderPermissionTier } from '../utils/orderPermissions';
import OrderPrintModal from './OrderPrintModal';
import './orders-view.css';

interface OrderDetailsModalProps {
  token: string;
  orderCode: string;
  onClose: () => void;
  onOpenPrint?: (orderCode: string, orderData?: OrderDetail | null) => void;
  currentUser?: User;
  onOrderCancelled?: () => void;
  onCloneOrder?: (data: any) => void;
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

export default function OrderDetailsModal({
  token,
  orderCode,
  onClose,
  onOpenPrint,
  currentUser,
  onOrderCancelled,
  onCloneOrder,
}: OrderDetailsModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [pickingSummary, setPickingSummary] = useState<OrderPickingSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const permTier = getOrderPermissionTier(currentUser);
  const isFullAccess = permTier === 'FULL_ACCESS';
  const isNoAccess = permTier === 'NO_ACCESS';

  useEffect(() => {
    let isMounted = true;
    if (isNoAccess) {
      setError('Truy cập bị từ chối: Nhân viên mua hàng không có quyền xem đơn hàng bán.');
      setIsLoading(false);
      return;
    }

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
  }, [orderCode, token, isNoAccess]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isCancelModalOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isCancelModalOpen]);

  const handleConfirmCancel = async (reason: string) => {
    if (!order) return;
    setIsSubmittingCancel(true);
    try {
      await cancelOrderApi(token, order.order_code, reason);
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'CANCELLED',
              cancel_reason: reason,
              cancelled_by: currentUser?.username || 'Bạn',
              cancelled_at: new Date().toISOString(),
            }
          : prev
      );
      setActionMessage('Đã hủy đơn hàng thành công và tự động nhả tồn kho giữ chỗ.');
      setIsCancelModalOpen(false);
      if (onOrderCancelled) {
        onOrderCancelled();
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi khi hủy đơn hàng');
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const currentStatus = (order?.status || '').toUpperCase();
  const isExportedOrLater = [
    'EXPORTED',
    'DISPATCHED',
    'SHIPPED',
    'DELIVERED',
    'CLOSED',
    'COMPLETED',
  ].includes(currentStatus);
  const isAlreadyCancelled = ['CANCELLED', 'REJECTED'].includes(currentStatus);

  return (
    <>
      <div
        className="orders-modal-backdrop"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !isCancelModalOpen) onClose();
        }}
      >
        <section
          className="orders-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-title"
          style={{ maxWidth: '950px', width: '95%' }}
        >
          <header className="orders-detail-heading">
            <div>
              <p className="orders-page-eyebrow">CHI TIẾT VÀ VÒNG ĐỜI ĐƠN HÀNG & SOẠN HÀNG THEO VỊ TRÍ KHO</p>
              <h2 id="order-detail-title">{orderCode}</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

              {onCloneOrder && (
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #86efac',
                    fontWeight: 600,
                    fontSize: '13px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={async () => {
                    try {
                      const data = await getCloneOrderDataApi(token, orderCode);
                      onClose();
                      onCloneOrder(data);
                    } catch (e: any) {
                      alert(e.message || 'Lỗi khi sao chép đơn hàng');
                    }
                  }}
                  title="Sao chép đơn hàng này thành đơn mới"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Sao chép đơn này
                </button>
              )}

              {/* Nút Hủy đơn chỉ hiển thị với Nhóm Toàn Quyền (Sales / Sales Manager / Admin) */}
              {isFullAccess && !isAlreadyCancelled && (
                <button
                  type="button"
                  id={`btn-cancel-order-${orderCode}`}
                  onClick={() => setIsCancelModalOpen(true)}
                  disabled={isExportedOrLater}
                  style={{
                    padding: '8px 16px',
                    background: isExportedOrLater ? '#e2e8f0' : '#dc2626',
                    color: isExportedOrLater ? '#94a3b8' : '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: isExportedOrLater ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title={
                    isExportedOrLater
                      ? 'Đơn hàng đã xuất kho, không thể hủy (phải đi đường trả hàng)'
                      : 'Hủy đơn hàng và nhả tồn giữ chỗ'
                  }
                >
                  {isExportedOrLater ? 'Không thể hủy (Đã xuất)' : 'Hủy đơn hàng'}
                </button>
              )}

              <button type="button" className="orders-back-button" onClick={onClose}>
                Đóng
              </button>
            </div>
          </header>

          {actionMessage && (
            <div
              style={{
                background: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 16px',
                marginBottom: '16px',
                fontSize: '13px',
                fontWeight: 600,
              }}
            >
              {actionMessage}
            </div>
          )}

          {isLoading && <div className="orders-state" role="status">Đang tải chi tiết đơn hàng...</div>}
          {error && <div className="orders-state orders-error" role="alert">{error}</div>}

          {order && (
            <div className="orders-detail-content">
              {/* 1. COMPONENT TIMELINE / STEPPER VÒNG ĐỜI ĐƠN HÀNG (7 BƯỚC + NHÁNH HỦY, KHÔNG DÙNG ICON) */}
              <OrderLifecycleTimeline
                status={order.status}
                cancelReason={order.cancel_reason}
                cancelledBy={order.cancelled_by}
                cancelledAt={order.cancelled_at}
                approvalReason={order.approval_reason}
                approvedBy={order.approved_by}
                approvedAt={order.approved_at}
              />

              {/* Thông báo nếu đã xuất kho và không được hủy */}
              {isExportedOrLater && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    color: '#92400e',
                    lineHeight: '1.45',
                  }}
                >
                  <strong>Lưu ý nghiệp vụ: </strong>
                  Đơn hàng đã xuất kho vận chuyển (trạng thái: {order.status}). Hệ thống vô hiệu hóa chức năng Hủy đơn. Trường hợp cần trả hàng hoặc đổi ý, vui lòng thực hiện quy trình trả hàng tại khâu kho vận.
                </div>
              )}

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
                  }}
                >
                  <strong style={{ display: 'block', marginBottom: '2px', color: '#b91c1c' }}>
                    CẢNH BÁO CÔNG NỢ: Đại lý &apos;{order.dealer_name}&apos; hiện đang bị KHÓA giao dịch
                    {order.dealer_lock_reason ? ` (Lý do: ${order.dealer_lock_reason})` : ''}.
                  </strong>
                  <span>Đơn dở dang này vẫn được phép xử lý nhưng vui lòng kiểm tra kỹ công nợ trước khi xuất hàng!</span>
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
      </div>

      {/* Modal xác nhận và nhập lý do hủy đơn hàng */}
      {order && (
        <OrderCancelModal
          orderCode={order.order_code}
          dealerName={order.dealer_name}
          totalAmount={order.total_amount}
          isOpen={isCancelModalOpen}
          isSubmitting={isSubmittingCancel}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={handleConfirmCancel}
        />
      )}

      {isPrintOpen && (
        <OrderPrintModal
          token={token}
          orderCode={orderCode}
          initialOrder={order}
          onClose={() => setIsPrintOpen(false)}
        />
      )}
    </>
  );
}

