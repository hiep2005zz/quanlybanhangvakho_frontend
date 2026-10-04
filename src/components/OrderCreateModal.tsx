import React, { useEffect, useState } from 'react';
import {
  ProductItem,
  User,
  createOrderApi,
  getAvatarUrl,
  listDealersApi,
  listDeliveryPointsApi,
  DealerOption,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import DeliveryPointManager from './DeliveryPointManager';
import type { DeliveryPoint } from '../types/deliveryPoint';

interface OrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  products: ProductItem[];
  currentUser?: User;
  onSuccess: () => void;
}

export const OrderCreateModal: React.FC<OrderCreateModalProps> = ({
  isOpen,
  onClose,
  token,
  products,
  currentUser,
  onSuccess,
}) => {
  if (!isOpen) return null;

  // Danh sách Đại lý / Khách hàng
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [dealerId, setDealerId] = useState<number>(1);
  const [loadingDealers, setLoadingDealers] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<number>(
    products.length > 0 ? products[0].id : 0
  );
  // ----- Điểm giao hàng (3b) -----
  const [points, setPoints] = useState<DeliveryPoint[]>([]);
  const [deliveryPointId, setDeliveryPointId] = useState<number | null>(null);
  const [showManager, setShowManager] = useState(false);

  // Tải danh sách đại lý khi mở modal
  useEffect(() => {
    if (isOpen && token) {
      setLoadingDealers(true);
      listDealersApi(token)
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setDealers(data);
            setDealerId(data[0].id);
          } else {
            const fallback: DealerOption[] = [
              { id: 1, name: 'Đại Lý Phân Phối Miền Bắc - Sao Mai', code: 'DL001' },
              { id: 2, name: 'Đại Lý Thời Trang Tân Bình', code: 'DL002' },
              { id: 3, name: 'Đại Lý Tổng Hợp Hải Phòng', code: 'DL003' },
            ];
            setDealers(fallback);
            setDealerId(1);
          }
        })
        .catch(() => {
          const fallback: DealerOption[] = [
            { id: 1, name: 'Đại Lý Phân Phối Miền Bắc - Sao Mai', code: 'DL001' },
            { id: 2, name: 'Đại Lý Thời Trang Tân Bình', code: 'DL002' },
            { id: 3, name: 'Đại Lý Tổng Hợp Hải Phòng', code: 'DL003' },
          ];
          setDealers(fallback);
          setDealerId(1);
        })
        .finally(() => {
          setLoadingDealers(false);
        });
    }
  }, [isOpen, token]);

  // ----- Tải điểm giao theo Đại lý được chọn (3c) -----
  const loadPoints = async () => {
    if (!dealerId) { setPoints([]); setDeliveryPointId(null); return; }
    try {
      const list = await listDeliveryPointsApi(token, dealerId);
      setPoints(list);
      setDeliveryPointId((cur) =>
        list.some((p) => p.id === cur) ? cur : (list.find((p) => p.is_default)?.id ?? (list[0]?.id ?? null))
      );
    } catch {
      setPoints([]);
      setDeliveryPointId(null);
    }
  };

  useEffect(() => {
    setShowManager(false);
    loadPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId]);

  const currentDealer = dealers.find((d) => d.id === dealerId);

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
        delivery_point_id: deliveryPointId,
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
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Tạo Đơn Hàng Mới (Bán Hàng / Xuất Đơn)
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Khách hàng: <strong style={{ color: '#2563eb' }}>{currentDealer ? currentDealer.name : 'Đang tải...'}</strong>
              </p>
              {currentUser && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  color: '#334155',
                }}>
                  <div style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: currentUser.avatar_url ? '#f1f5f9' : '#2563eb',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '700',
                    overflow: 'hidden',
                  }}>
                    {currentUser.avatar_url ? (
                      <img src={getAvatarUrl(currentUser.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      (currentUser.full_name || currentUser.username).charAt(0).toUpperCase()
                    )}
                  </div>
                  <span>Người tạo: <strong>{currentUser.full_name || currentUser.username}</strong></span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              background: '#1e293b',
              border: '1px solid #334155',
              fontSize: '16px',
              lineHeight: 1,
              color: '#cbd5e1',
              cursor: 'pointer',
              flex: '0 0 auto',
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
          {/* Chọn Đại lý / Khách hàng */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              <span>Đại lý / Khách hàng <span style={{ color: '#dc2626' }}>*</span></span>
              {currentDealer?.phone && (
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748b' }}>
                  SĐT: {currentDealer.phone}
                </span>
              )}
            </label>
            <select
              value={dealerId}
              onChange={(e) => setDealerId(parseInt(e.target.value, 10))}
              disabled={loadingDealers || dealers.length === 0}
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
                fontWeight: '600',
                color: '#0f172a',
              }}
            >
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.code ? `[${d.code}] ` : ''}{d.name} {d.address ? `— ${d.address}` : ''}
                </option>
              ))}
            </select>
          </div>

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
          <div style={{ marginBottom: '14px', display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>


            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                Tổng thành tiền
              </label>
              <div
                style={{
                  height: 46,
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  padding: '0 14px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontWeight: '700',
                  color: '#0f172a',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginRight: 'auto' }}>
                  {sellPrice.toLocaleString('vi-VN')} đ × {numQty}
                </span>
                <span>{totalAmount.toLocaleString('vi-VN')} đ</span>
              </div>
            </div>
          </div>

          {/* Điểm giao hàng */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Điểm giao hàng
            </label>
            <select
              value={deliveryPointId ?? ''}
              onChange={(e) => setDeliveryPointId(e.target.value ? Number(e.target.value) : null)}
              disabled={points.length === 0}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fff',
              }}
            >
              {points.length === 0 && <option value="">Đại lý chưa có điểm giao</option>}
              {points.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} - {p.address}{p.is_default ? ' (Mặc định)' : ''}
                </option>
              ))}
            </select>
            {(() => {
              const selected = points.find((pt) => pt.id === deliveryPointId);
              if (!selected) return null;
              return (
                <div
                  style={{
                    marginTop: 8,
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid rgba(99, 102, 241, 0.45)',
                    background: 'rgba(99, 102, 241, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <b style={{ fontSize: 14 }}>{selected.label}</b>
                    {selected.is_default && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: 'rgba(99, 102, 241, 0.2)',
                          color: '#a5b4fc',
                        }}
                      >
                        Mặc định
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#cbd5e1' }}>Địa chỉ: {selected.address}</div>
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>
                    Người nhận: {selected.receiver_name} - {selected.receiver_phone}
                  </div>
                  {selected.route_note && (
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: '#64748b' }}>
                      Ghi chú đường đi: {selected.route_note}
                    </div>
                  )}
                </div>
              );
            })()}
            <button
              type="button"
              onClick={() => setShowManager((v) => !v)}
              disabled={!dealerId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid rgba(99, 102, 241, 0.45)',
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#a5b4fc',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.22)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.45)';
              }}
            >

              {showManager ? '✕ Đóng quản lý điểm giao' : '＋ Quản lý điểm giao'}
            </button>
            {showManager && dealerId && (
              <div style={{ marginTop: '8px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px' }}>
                <DeliveryPointManager
                  token={token}
                  dealerId={dealerId}
                  onChanged={loadPoints}
                  onCreated={() => setShowManager(false)}
                />
              </div>
            )}
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
