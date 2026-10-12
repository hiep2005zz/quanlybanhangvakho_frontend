import React from 'react';
import { WarehouseThresholdItem } from '../services/api';
import { ModalPortal } from './ModalPortal';

interface LowStockAlertModalProps {
  isOpen: boolean;
  items: WarehouseThresholdItem[];
  onClose: () => void;
  onOpenThresholdConfig?: () => void;
  onOpenGoodsReceipt?: () => void;
}

export const LowStockAlertModal: React.FC<LowStockAlertModalProps> = ({
  isOpen,
  items,
  onClose,
  onOpenThresholdConfig,
  onOpenGoodsReceipt,
}) => {
  if (!isOpen) return null;

  const lowItems = items.filter((it) => it.is_low_stock);
  const uniqueProductsCount = new Set(lowItems.map((it) => it.product_id)).size;

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99992,
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '920px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '1px solid #fee2e2',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#fff1f2',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#991b1b' }}>
                  Cảnh Báo Tồn Kho Dưới Định Mức Tối Thiểu
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#b91c1c' }}>
                  Có <strong>{uniqueProductsCount}</strong> mặt hàng {lowItems.length > uniqueProductsCount ? `(tổng ${lowItems.length} cảnh báo tại các chi nhánh kho)` : ''} đang dưới ngưỡng an toàn cần đặt hàng NCC ngay trước khi đứt hàng
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#fee2e2',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                fontSize: '18px',
                fontWeight: '600',
                color: '#991b1b',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>

          {/* Body table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {lowItems.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#15803d' }}>
                🎉 Tất cả các mặt hàng hiện đều đang ở mức tồn kho an toàn!
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #fed7aa', color: '#9a3412', fontSize: '12px', background: '#fffbeb' }}>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>Kho</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>Mã SKU</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700' }}>Tên Sản Phẩm</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Tồn Thực Tế</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Định Mức Tối Thiểu</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', textAlign: 'right' }}>Thiếu Hụt Cần Nhập</th>
                    <th style={{ padding: '10px 14px', fontWeight: '700', textAlign: 'center', whiteSpace: 'nowrap' }}>Mức Độ Khẩn</th>
                  </tr>
                </thead>
                <tbody>
                  {lowItems.map((it) => {
                    const isSevere = it.actual_stock <= 0;
                    return (
                      <tr
                        key={`${it.warehouse_id}_${it.product_id}`}
                        style={{
                          borderBottom: '1px solid #fef2f2',
                          background: isSevere ? '#fef2f2' : '#ffffff',
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#475569' }}>
                          <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {it.warehouse_name}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: '700', color: '#b91c1c' }}>
                          {it.product_code}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b' }}>
                          {it.product_name}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: isSevere ? '#dc2626' : '#ea580c' }}>
                          {it.actual_stock.toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{it.base_unit}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#334155' }}>
                          {it.min_stock.toLocaleString()} {it.base_unit}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                          +{Math.max(1, it.shortage_quantity).toLocaleString()} {it.base_unit}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {isSevere ? (
                            <span
                              style={{
                                background: '#b91c1c',
                                color: '#ffffff',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: '750',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                              }}
                            >
                              ĐÃ HẾT HÀNG (0)
                            </span>
                          ) : (
                            <span
                              style={{
                                background: '#ffedd5',
                                color: '#c2410c',
                                border: '1px solid #fed7aa',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                                display: 'inline-block',
                              }}
                            >
                              SẮP ĐỨT HÀNG
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer actions */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {onOpenGoodsReceipt && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGoodsReceipt();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#0fad89',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(15, 173, 137, 0.25)',
                  }}
                >
                  Lập Phiếu Nhập Kho (Đặt Hàng NCC)
                </button>
              )}
              {onOpenThresholdConfig && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenThresholdConfig();
                  }}
                  style={{
                    padding: '8px 16px',
                    background: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Cấu Hình Định Mức Tồn
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                background: '#475569',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
