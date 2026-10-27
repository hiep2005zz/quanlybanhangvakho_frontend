import React, { useState } from 'react';
import { ReturnOrderData, confirmReturnReceiptApi, cancelReturnOrderApi } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface ReturnOrderDetailModalProps {
  isOpen: boolean;
  order: ReturnOrderData | null;
  token: string;
  canConfirmWarehouse: boolean; // Quản lý kho, thủ kho, admin
  canCancel: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReturnOrderDetailModal: React.FC<ReturnOrderDetailModalProps> = ({
  isOpen,
  order,
  token,
  canConfirmWarehouse,
  canCancel,
  onClose,
  onSuccess,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmPrompt, setShowConfirmPrompt] = useState(false);
  const [confirmNote, setConfirmNote] = useState('');

  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !order) return null;

  const handleConfirmReceipt = async () => {
    setIsConfirming(true);
    setActionError(null);
    try {
      const res = await confirmReturnReceiptApi(token, order.id, confirmNote.trim());
      emitStatusToast({
        title: 'Nhập kho thành công',
        message: `Phiếu trả hàng ${res.code} đã hoàn tất và tồn kho đã được cộng vào kho tương ứng.`,
      });
      setShowConfirmPrompt(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Lỗi khi xác nhận nhận hàng và cập nhật tồn kho.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      setActionError('Vui lòng nhập lý do hủy phiếu trả.');
      return;
    }
    setIsCancelling(true);
    setActionError(null);
    try {
      const res = await cancelReturnOrderApi(token, order.id, cancelReason.trim());
      emitStatusToast({
        title: 'Đã hủy phiếu trả hàng',
        message: `Phiếu trả hàng ${res.code} đã được chuyển sang trạng thái Đã hủy.`,
      });
      setShowCancelPrompt(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      setActionError(err.message || 'Lỗi khi hủy phiếu trả hàng.');
    } finally {
      setIsCancelling(false);
    }
  };

  const renderStatusBadge = (st: string) => {
    switch (st) {
      case 'PENDING_WAREHOUSE':
        return (
          <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', fontWeight: '700', fontSize: '12px', whiteSpace: 'nowrap' }}>
            Chờ kho xác nhận
          </span>
        );
      case 'COMPLETED':
        return (
          <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#dcfce7', color: '#166534', fontWeight: '700', fontSize: '12px', whiteSpace: 'nowrap' }}>
            Đã nhập kho
          </span>
        );
      case 'CANCELLED':
        return (
          <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontWeight: '700', fontSize: '12px', whiteSpace: 'nowrap' }}>
            Đã hủy
          </span>
        );
      default:
        return <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', fontSize: '12px' }}>{st}</span>;
    }
  };

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isConfirming && !isCancelling) onClose();
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '920px',
            width: '100%',
            maxHeight: 'calc(100vh - 40px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Phiếu Trả Hàng: {order.code}
                </h3>
                {renderStatusBadge(order.status)}
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Đơn hàng gốc: <strong style={{ color: '#0F8A5F' }}>{order.order_code}</strong> &bull; Đại lý: <strong>{order.dealer_name}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isConfirming || isCancelling}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {actionError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: '600',
                }}
              >
                {actionError}
              </div>
            )}

            {/* Thông tin chung */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '14px 16px',
                fontSize: '13px',
              }}
            >
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Người lập phiếu:</span>
                <strong style={{ color: '#0f172a' }}>{order.created_by}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Thời gian lập:</span>
                <strong style={{ color: '#0f172a' }}>{order.created_at}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Xác nhận kho:</span>
                <strong style={{ color: order.confirmed_by ? '#166534' : '#64748b' }}>
                  {order.confirmed_by ? `${order.confirmed_by} (${order.confirmed_at})` : 'Chưa nhận hàng'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: '11.5px' }}>Tổng hoàn tiền:</span>
                <strong style={{ color: '#ea580c', fontSize: '15px' }}>
                  {order.total_refund_amount.toLocaleString('vi-VN')} đ
                </strong>
              </div>
              {order.cancelled_by && (
                <div style={{ gridColumn: '1 / -1', background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca', color: '#991b1b' }}>
                  Hủy bởi: <strong>{order.cancelled_by}</strong> lúc {order.cancelled_at} &bull; Lý do: <em>{order.cancel_reason}</em>
                </div>
              )}
              {order.note && (
                <div style={{ gridColumn: '1 / -1', color: '#475569' }}>
                  Ghi chú: <em>{order.note}</em>
                </div>
              )}
            </div>

            {/* Prompt Xác nhận nhận hàng */}
            {showConfirmPrompt && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#166534' }}>
                    Xác nhận nhận hàng & Nhập kho
                  </h4>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '12.5px', color: '#14532d', lineHeight: '1.5' }}>
                  Hệ thống sẽ chuyển trạng thái phiếu sang <strong>Đã nhập kho</strong>, đồng thời cộng tồn kho vật lý vào đúng kho và đúng mã lô.
                </p>
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#166534', marginBottom: '4px' }}>
                    Ghi chú kiểm đếm của thủ kho (tùy chọn):
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Đã kiểm tra bao bì, hàng nguyên vẹn..."
                    value={confirmNote}
                    onChange={(e) => setConfirmNote(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #86efac',
                      fontSize: '13px',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPrompt(false)}
                    disabled={isConfirming}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReceipt}
                    disabled={isConfirming}
                    style={{
                      padding: '7px 18px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#16a34a',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: isConfirming ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isConfirming ? 'Đang cập nhật tồn kho...' : 'Xác nhận nhập kho ngay'}
                  </button>
                </div>
              </div>
            )}

            {/* Prompt Hủy phiếu */}
            {showCancelPrompt && (
              <div
                style={{
                  background: '#fef2f2',
                  border: '1.5px solid #fca5a5',
                  borderRadius: '12px',
                  padding: '16px',
                }}
              >
                <h4 style={{ margin: '0 0 8px 0', fontSize: '14.5px', fontWeight: '700', color: '#991b1b' }}>
                  Hủy Phiếu Trả Hàng
                </h4>
                <div style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#991b1b', marginBottom: '4px' }}>
                    Lý do hủy (bắt buộc):
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập lý do hủy phiếu..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #fca5a5',
                      fontSize: '13px',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setShowCancelPrompt(false)}
                    disabled={isCancelling}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelOrder}
                    disabled={isCancelling || !cancelReason.trim()}
                    style={{
                      padding: '7px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#dc2626',
                      color: '#ffffff',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: isCancelling || !cancelReason.trim() ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy phiếu'}
                  </button>
                </div>
              </div>
            )}

            {/* Bảng sản phẩm trả */}
            <div>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                Danh Sách Sản Phẩm Nhập Trả ({order.items.length} mặt hàng - Tổng số lượng: {order.total_quantity})
              </h4>
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflowX: 'auto',
                  background: '#ffffff',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center' }}>#</th>
                      <th style={{ padding: '10px 12px' }}>Tên sản phẩm</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>SL Trả</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Đơn giá</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thành tiền hoàn</th>
                      <th style={{ padding: '10px 12px' }}>Lý do trả</th>
                      <th style={{ padding: '10px 12px' }}>Mã Lô</th>
                      <th style={{ padding: '10px 12px' }}>Kho nhập lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.product_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Mã: {item.product_code || '—'} &bull; ĐVT: {item.unit_name}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>
                          {item.return_quantity}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#334155' }}>
                          {item.unit_price.toLocaleString('vi-VN')} đ
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#ea580c' }}>
                          {item.refund_amount.toLocaleString('vi-VN')} đ
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ color: '#334155' }}>{item.return_reason}</span>
                          {item.is_damaged && (
                            <span style={{ display: 'block', fontSize: '10.5px', color: '#b45309', fontWeight: '700' }}>
                              [Hàng lỗi/hỏng]
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {item.batch_number ? (
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#fef3c7', color: '#92400e', fontSize: '11.5px', fontWeight: '700' }}>
                              {item.batch_number}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              background: item.is_damaged ? '#fee2e2' : '#f0fdf4',
                              color: item.is_damaged ? '#b91c1c' : '#166534',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.target_warehouse_name || (item.is_damaged ? 'Kho lỗi' : 'Kho gốc')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <div>
              {order.status === 'PENDING_WAREHOUSE' && canCancel && !showCancelPrompt && !showConfirmPrompt && (
                <button
                  type="button"
                  onClick={() => setShowCancelPrompt(true)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid #fecaca',
                    background: '#ffffff',
                    color: '#dc2626',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Hủy phiếu trả này
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>

              {/* Nút Duyệt kho / Xác nhận nhận hàng (Quy tắc 4) */}
              {order.status === 'PENDING_WAREHOUSE' && canConfirmWarehouse && !showConfirmPrompt && (
                <button
                  type="button"
                  onClick={() => setShowConfirmPrompt(true)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#16a34a',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                  }}
                >
                  Xác nhận nhận hàng & Nhập kho
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ReturnOrderDetailModal;
