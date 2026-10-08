import React, { useState } from 'react';
import { ProductItem } from '../services/api';
import { updateProductPriceApi } from '../services/productApi';
import { ModalPortal } from './ModalPortal';

interface PriceUpdateModalProps {
  product: ProductItem | null;
  isOpen: boolean;
  onClose: () => void;
  token: string;
  isCostVisible?: boolean;
  onSuccess: (updatedProduct: ProductItem) => void;
}

export const PriceUpdateModal: React.FC<PriceUpdateModalProps> = ({
  product,
  isOpen,
  onClose,
  token,
  isCostVisible = false,
  onSuccess,
}) => {
  const [sellPriceInput, setSellPriceInput] = useState<string>(() =>
    product ? String(product.sell_price) : ''
  );
  const [costPriceInput, setCostPriceInput] = useState<string>(() =>
    product && product.cost_price !== undefined && product.cost_price !== null
      ? String(product.cost_price)
      : ''
  );
  const [reasonInput, setReasonInput] = useState<string>(
    'Điều chỉnh giá theo chính sách bán hàng cho đại lý'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (product) {
      setSellPriceInput(String(product.sell_price));
      setCostPriceInput(
        product.cost_price !== undefined && product.cost_price !== null
          ? String(product.cost_price)
          : ''
      );
      setReasonInput('Điều chỉnh giá theo chính sách bán hàng cho đại lý');
      setError(null);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const currentSellPrice = product.sell_price;
  const newSellPrice = parseFloat(sellPriceInput) || 0;
  const sellDelta = newSellPrice - currentSellPrice;
  const sellPercent = currentSellPrice > 0
    ? Math.round((sellDelta / currentSellPrice) * 1000) / 10
    : 0;

  const currentCostPrice = product.cost_price || 0;
  const newCostPrice = costPriceInput.trim() ? parseFloat(costPriceInput) || 0 : undefined;
  const costDelta = newCostPrice !== undefined ? newCostPrice - currentCostPrice : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newSellPrice < 0) {
      setError('Giá bán niêm yết không được là số âm');
      return;
    }
    if (!reasonInput.trim()) {
      setError('Vui lòng nhập lý do điều chỉnh giá để lưu vết lịch sử');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload: { sell_price: number; cost_price?: number; reason: string } = {
        sell_price: newSellPrice,
        reason: reasonInput.trim(),
      };
      if (isCostVisible && newCostPrice !== undefined) {
        payload.cost_price = newCostPrice;
      }

      const res = await updateProductPriceApi(token, product.id, payload);
      setLoading(false);
      onSuccess(res.product);
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Lỗi cập nhật giá sản phẩm');
    }
  };

  return (
    <ModalPortal>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: 'calc(100vh - 32px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflowY: 'auto',
          border: '1px solid #e2e8f0',
        }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#fef3c7',
                color: '#b45309',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
              }}>
                {product.code}
              </span>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                Cập nhật giá sản phẩm
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              {product.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div style={{
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          {/* Giá bán niêm yết */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Giá bán niêm yết mới (VNĐ) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="number"
                min="0"
                step="1000"
                value={sellPriceInput}
                onChange={(e) => setSellPriceInput(e.target.value)}
                placeholder="Nhập giá bán mới"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  fontWeight: '600',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* So sánh giá bán */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px',
              marginTop: '6px',
              fontSize: '12.5px',
            }}>
              <div>
                <span style={{ color: '#64748b' }}>Giá hiện tại: </span>
                <span style={{ fontWeight: '600', color: '#334155' }}>
                  {currentSellPrice.toLocaleString('vi-VN')} đ
                </span>
                <span style={{ margin: '0 6px', color: '#94a3b8' }}>➔</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>
                  {newSellPrice.toLocaleString('vi-VN')} đ
                </span>
              </div>
              {sellDelta !== 0 && (
                <span style={{
                  fontWeight: '700',
                  color: sellDelta > 0 ? '#15803d' : '#dc2626',
                  background: sellDelta > 0 ? '#dcfce7' : '#fee2e2',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                }}>
                  {sellDelta > 0 ? `+${sellDelta.toLocaleString('vi-VN')} đ` : `${sellDelta.toLocaleString('vi-VN')} đ`} ({sellPercent > 0 ? `+${sellPercent}%` : `${sellPercent}%`})
                </span>
              )}
            </div>
          </div>

          {/* Giá vốn (nếu có quyền xem giá vốn) */}
          {isCostVisible && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Giá vốn nhập kho (VNĐ)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={costPriceInput}
                onChange={(e) => setCostPriceInput(e.target.value)}
                placeholder="Nhập giá vốn mới (không bắt buộc)"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
              {costDelta !== null && costDelta !== 0 && (
                <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: '#64748b' }}>
                  Chênh lệch giá vốn: <strong style={{ color: costDelta > 0 ? '#b45309' : '#15803d' }}>
                    {costDelta > 0 ? `+${costDelta.toLocaleString('vi-VN')} đ` : `${costDelta.toLocaleString('vi-VN')} đ`}
                  </strong>
                </p>
              )}
            </div>
          )}

          {/* Lý do điều chỉnh (Bắt buộc để giải thích với đại lý) */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Lý do điều chỉnh giá <span style={{ color: '#ef4444' }}>*</span>
              <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 'normal', marginLeft: '6px' }}>
                (Để giải thích với đại lý khi tra cứu lịch sử)
              </span>
            </label>
            <textarea
              rows={3}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder="Ví dụ: Áp dụng bảng giá mới quý 4; Chiết khấu đại lý tháng 10..."
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: loading ? '#a7f3d0' : '#0fad89',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              {loading ? 'Đang lưu...' : 'Xác nhận cập nhật giá'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
