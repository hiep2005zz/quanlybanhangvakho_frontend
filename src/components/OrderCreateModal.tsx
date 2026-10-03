import React, { useEffect, useState } from 'react';
import {
  ProductItem,
  createOrderApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface OrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  products: ProductItem[];
  onSuccess: () => void;
}

export const OrderCreateModal: React.FC<OrderCreateModalProps> = ({
  isOpen,
  onClose,
  token,
  products,
  onSuccess,
}) => {
  if (!isOpen) return null;

  // Đại lý mẫu (id 1)
  const [dealerId] = useState(1);
  const [selectedProductId, setSelectedProductId] = useState<number>(
    products.length > 0 ? products[0].id : 0
  );

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const baseUnit = selectedProduct?.base_unit || 'Cái';
  const availableUnits = [
    { unit_name: baseUnit, conversion_rate: 1.0, is_base: true },
    ...(selectedProduct?.units || []).map((u) => ({
      unit_name: u.unit_name,
      conversion_rate: u.conversion_rate,
      is_base: false,
    })),
  ];

  const [selectedUnitName, setSelectedUnitName] = useState<string>(baseUnit);
  const [orderQuantity, setOrderQuantity] = useState<number | string>(1);
  const [sellPrice, setSellPrice] = useState<number>(selectedProduct?.sell_price || 0);
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Khi đổi sản phẩm, reset đơn vị về đơn vị cơ sở của sản phẩm đó
  useEffect(() => {
    if (selectedProduct) {
      setSelectedUnitName(selectedProduct.base_unit || 'Cái');
      setSellPrice(selectedProduct.sell_price || 0);
    }
  }, [selectedProductId, selectedProduct]);

  const currentUnit =
    availableUnits.find((u) => u.unit_name === selectedUnitName) || availableUnits[0];
  const numQty = typeof orderQuantity === 'string' ? parseFloat(orderQuantity) || 0 : orderQuantity;
  const baseQuantity = Math.round(numQty * (currentUnit?.conversion_rate || 1.0));
  const totalAmount = numQty * sellPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numQty <= 0) {
      setErrorMsg('Số lượng đặt hàng phải lớn hơn 0.');
      return;
    }
    if (!selectedProduct) {
      setErrorMsg('Vui lòng chọn sản phẩm.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrderApi(token, {
        dealer_id: dealerId,
        items: [
          {
            product_id: selectedProduct.id,
            quantity: Math.round(numQty),
            price: sellPrice,
            unit_name: currentUnit.unit_name,
            conversion_rate: currentUnit.conversion_rate,
          },
        ],
        note: note.trim() || undefined,
      });

      emitStatusToast({
        title: 'Tạo đơn hàng thành công',
        message: `Đơn ${res.order_code} đã tạo thành công với ${numQty} ${currentUnit.unit_name} (= ${baseQuantity} ${baseUnit}). Tồn kho đã được trừ ${baseQuantity} ${baseUnit}.`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px',
        animation: 'fadeInCard 0.15s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Tạo Đơn Hàng Mới (Bán Hàng / Xuất Đơn)
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Khách hàng: <strong style={{ color: '#2563eb' }}>Đại Lý Phân Phối Miền Bắc - Sao Mai</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '20px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Chọn sản phẩm */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Sản phẩm <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(parseInt(e.target.value, 10))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                background: '#ffffff',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name} (Tồn: {p.stock} {p.base_unit || 'Cái'})
                </option>
              ))}
            </select>
          </div>

          {/* Đơn vị tính & Số lượng */}
          <div style={{ marginBottom: '14px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Đơn vị tính chọn <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={selectedUnitName}
                onChange={(e) => setSelectedUnitName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  background: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {availableUnits.map((u) => (
                  <option key={u.unit_name} value={u.unit_name}>
                    {u.unit_name} {u.is_base ? '(ĐV cơ sở)' : `(= ${u.conversion_rate} ${baseUnit})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Số lượng đặt ({selectedUnitName}) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                step="any"
                min="1"
                required
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  textAlign: 'right',
                  boxSizing: 'border-box',
                  fontWeight: '600',
                }}
              />
            </div>
          </div>

          {/* Banner tính base_quantity và trừ kho */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>
                QUY ĐỔI SỐ LƯỢNG TRỪ VÀO SỔ KHO:
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                1 {currentUnit.unit_name} = {currentUnit.conversion_rate} {baseUnit}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '17px', fontWeight: '800', color: '#2563eb' }}>
                {baseQuantity.toLocaleString()}
              </span>{' '}
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#475569' }}>
                {baseUnit}
              </span>
            </div>
          </div>

          {/* Đơn giá & Tổng tiền */}
          <div style={{ marginBottom: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Đơn giá ({selectedUnitName})
              </label>
              <input
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  textAlign: 'right',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Tổng thành tiền
              </label>
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#0f172a',
                  textAlign: 'right',
                }}
              >
                {totalAmount.toLocaleString('vi-VN')} đ
              </div>
            </div>
          </div>

          {/* Ghi chú */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Ghi chú đơn hàng
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="VD: Giao trước 17h, đóng gói thùng xốp..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)',
              }}
            >
              {isSubmitting ? 'Đang tạo đơn...' : 'Tạo đơn & Trừ kho'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
