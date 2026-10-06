import React, { useEffect, useState, useCallback } from 'react';
import {
  ProductItem,
  User,
  createOrderApi,
  getDealersApi,
  resolvePriceApi,
  DealerItem,
  getAvatarUrl,
  listDeliveryPointsApi,
} from '../services/api';
import { searchDealers } from '../services/dealerSearchApi';
import { emitStatusToast } from './StatusToast';
import type { DeliveryPoint } from '../types/deliveryPoint';

interface OrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  products: ProductItem[];
  currentUser?: User;
  onSuccess: () => void;
  initialDealerId?: number;
}

const FALLBACK_DEALERS: DealerItem[] = [
  { id: 1, code: 'DL001', name: 'Đại Lý Phân Phối Miền Bắc - Sao Mai', customer_group: 'Đại lý cấp 1' },
  { id: 2, code: 'DL002', name: 'Đại Lý Thời Trang Tân Bình', customer_group: 'Đại lý cấp 2' },
  { id: 3, code: 'DL003', name: 'Đại Lý Tổng Hợp Hải Phòng', customer_group: 'Khách sỉ' },
  { id: 4, code: 'DL004', name: 'Công Ty TNHH Bán Lẻ An Phát', customer_group: 'Khách lẻ' },
];

export const OrderCreateModal: React.FC<OrderCreateModalProps> = ({
  isOpen,
  onClose,
  token,
  products,
  currentUser,
  onSuccess,
  initialDealerId = 1,
}) => {
  if (!isOpen) return null;

  // Danh sách đại lý / khách hàng
  const [dealers, setDealers] = useState<any[]>(FALLBACK_DEALERS);
  const [dealerId, setDealerId] = useState<number>(initialDealerId);
  const [loadingDealers, setLoadingDealers] = useState(false);

  // Sản phẩm được chọn
  const [selectedProductId, setSelectedProductId] = useState<number>(
    products.length > 0 ? products[0].id : 1
  );

  // Điểm giao hàng
  const [points, setPoints] = useState<DeliveryPoint[]>([]);
  const [deliveryPointId, setDeliveryPointId] = useState<number | null>(null);

  // Giá bán & Giá sàn
  const [floorPrice, setFloorPrice] = useState<number | null>(null);
  const [isResolvingPrice, setIsResolvingPrice] = useState(false);
  const [priceResolveNote, setPriceResolveNote] = useState<string | null>(null);

  const selectedDealer = dealers.find((d) => d.id === dealerId) || dealers[0];
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

  // Tải danh sách đại lý khi mở modal
  useEffect(() => {
    if (isOpen && token) {
      setLoadingDealers(true);
      searchDealers(token)
        .then((res) => {
          const items = res.items || [];
          if (items.length > 0) {
            setDealers(items);
            setDealerId((prev) => (items.some((d) => d.id === prev) ? prev : items[0].id));
          } else {
            // fallback to getDealersApi
            getDealersApi(token)
              .then((dList) => {
                if (dList && dList.length > 0) {
                  setDealers(dList);
                  setDealerId((prev) => (dList.some((d) => d.id === prev) ? prev : dList[0].id));
                }
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          getDealersApi(token)
            .then((dList) => {
              if (dList && dList.length > 0) {
                setDealers(dList);
                setDealerId((prev) => (dList.some((d) => d.id === prev) ? prev : dList[0].id));
              }
            })
            .catch(() => {});
        })
        .finally(() => {
          setLoadingDealers(false);
        });
    }
  }, [isOpen, token]);

  // Tải điểm giao hàng theo Đại lý được chọn
  const loadPoints = async () => {
    if (!dealerId) {
      setPoints([]);
      setDeliveryPointId(null);
      return;
    }
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
    loadPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId]);

  const isDebtWarning =
    selectedDealer?.debt_status &&
    (selectedDealer.debt_status.includes('Vượt') || selectedDealer.debt_status.includes('Quá hạn'));

  // Nhận diện nhãn và màu sắc nhóm khách hàng
  const getCustomerGroupDisplay = (group?: string) => {
    const g = group || 'Đại lý cấp 1';
    if (g === 'dai_ly_cap_1' || g === 'Dai_ly_cap_1' || g === 'CAP_1' || g === 'Đại lý cấp 1') {
      return {
        label: 'Đại lý cấp 1',
        badgeBg: '#dbeafe',
        badgeColor: '#1d4ed8',
        borderColor: '#bfdbfe',
      };
    }
    if (g === 'dai_ly_cap_2' || g === 'Dai_ly_cap_2' || g === 'CAP_2' || g === 'Đại lý cấp 2') {
      return {
        label: 'Đại lý cấp 2',
        badgeBg: '#f3e8ff',
        badgeColor: '#7e22ce',
        borderColor: '#e9d5ff',
      };
    }
    if (g === 'khach_si' || g === 'Khach_si' || g === 'Khách sỉ') {
      return {
        label: 'Khách sỉ',
        badgeBg: '#e0f2fe',
        badgeColor: '#0369a1',
        borderColor: '#bae6fd',
      };
    }
    return {
      label: 'Khách lẻ',
      badgeBg: '#ffedd5',
      badgeColor: '#c2410c',
      borderColor: '#fed7aa',
    };
  };

  const groupInfo = getCustomerGroupDisplay(selectedDealer?.customer_group);

  // Tra cứu giá tự động qua API /price-books/resolve-price khi đổi khách hàng hoặc sản phẩm
  const handleResolvePrice = useCallback(
    async (dId: number, pId: number) => {
      if (!dId || !pId) return;
      setIsResolvingPrice(true);
      setPriceResolveNote(null);
      try {
        const res = await resolvePriceApi(token, dId, pId);
        setSellPrice(res.sale_price);
        setFloorPrice(res.floor_price);
        const pbIdentifier = res.price_book_name || res.price_book_code || 'Bảng giá quy định';
        setPriceResolveNote(
          `Áp dụng bảng giá: ${pbIdentifier} - Giá sàn quy định: ${res.floor_price.toLocaleString('vi-VN')} đồng`
        );
      } catch (err: any) {
        const currentProd = products.find((p) => p.id === pId);
        const fallbackPrice = currentProd?.sell_price || 0;
        setSellPrice(fallbackPrice);
        setFloorPrice(fallbackPrice);
        if (groupInfo.label === 'Khách sỉ') {
          setPriceResolveNote(`Chưa có bảng giá áp dụng cho Khách sỉ - Áp dụng giá niêm yết: ${fallbackPrice.toLocaleString('vi-VN')} đồng`);
        } else {
          setPriceResolveNote(
            `Chưa có bảng giá áp dụng cho nhóm khách hàng này - Áp dụng giá niêm yết: ${fallbackPrice.toLocaleString('vi-VN')} đồng`
          );
        }
      } finally {
        setIsResolvingPrice(false);
      }
    },
    [token, products, groupInfo.label]
  );

  useEffect(() => {
    if (dealerId && selectedProductId) {
      handleResolvePrice(dealerId, selectedProductId);
    }
  }, [dealerId, selectedProductId, handleResolvePrice]);

  useEffect(() => {
    if (selectedProduct) {
      setSelectedUnitName(selectedProduct.base_unit || 'Cái');
    }
  }, [selectedProductId, selectedProduct]);

  const currentUnit =
    availableUnits.find((u) => u.unit_name === selectedUnitName) || availableUnits[0];
  const numQty = typeof orderQuantity === 'string' ? parseFloat(orderQuantity) || 0 : orderQuantity;
  const baseQuantity = Math.round(numQty * (currentUnit?.conversion_rate || 1.0));
  const totalAmount = numQty * sellPrice;

  // Kiểm tra điều kiện bán dưới giá sàn
  const isBelowFloorPrice = floorPrice !== null && sellPrice < floorPrice;

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
    if (!selectedDealer) {
      setErrorMsg('Vui lòng chọn khách hàng / đại lý.');
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

      if (res.status === 'PENDING_APPROVAL' || (res as any).requires_approval) {
        emitStatusToast({
          title: 'Đơn hàng chuyển sang Chờ quản lý duyệt',
          message: `Đơn ${res.order_code} đã được tạo thành công và chuyển sang trạng thái Chờ quản lý duyệt do đơn giá bán (${sellPrice.toLocaleString('vi-VN')} đồng) thấp hơn giá niêm yết / giá sàn quy định (${floorPrice?.toLocaleString('vi-VN')} đồng).`,
        });
      } else {
        emitStatusToast({
          title: 'Tạo đơn hàng thành công',
          message: `Đơn ${res.order_code} đã được tạo thành công với trạng thái Đã xác nhận. Số lượng: ${numQty} ${currentUnit.unit_name} (tương đương ${baseQuantity} ${baseUnit}).`,
        });
      }

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
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '24px 28px',
          maxWidth: '620px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              Tạo Đơn Hàng Mới
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                Tự động áp giá theo nhóm khách hàng và kiểm soát giá sàn
              </p>
              {currentUser && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    color: '#334155',
                  }}
                >
                  <div
                    style={{
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
                    }}
                  >
                    {currentUser.avatar_url ? (
                      <img
                        src={getAvatarUrl(currentUser.avatar_url)}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      (currentUser.full_name || currentUser.username).charAt(0).toUpperCase()
                    )}
                  </div>
                  <span>
                    Người tạo: <strong>{currentUser.full_name || currentUser.username}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#475569',
              cursor: 'pointer',
              padding: '5px 12px',
              fontWeight: '600',
            }}
          >
            Đóng
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
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* 1. KHÁCH HÀNG & NHÓM KHÁCH HÀNG */}
          <div
            style={{
              marginBottom: '16px',
              background: '#f8fafc',
              padding: '14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                Khách Hàng / Đại Lý <span style={{ color: '#dc2626' }}>*</span>
              </label>

              {/* Tag nhóm khách hàng */}
              <span
                id="badge-customer-group"
                style={{
                  background: groupInfo.badgeBg,
                  color: groupInfo.badgeColor,
                  border: `1px solid ${groupInfo.borderColor}`,
                  borderRadius: '999px',
                  padding: '3px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  letterSpacing: '0.02em',
                }}
              >
                Nhóm: {groupInfo.label}
              </span>
            </div>

            <select
              id="select-dealer-customer"
              value={dealerId}
              onChange={(e) => setDealerId(parseInt(e.target.value, 10))}
              disabled={loadingDealers || dealers.length === 0}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                background: '#ffffff',
                boxSizing: 'border-box',
                fontWeight: '500',
              }}
            >
              {dealers.map((d) => {
                const dGroup = getCustomerGroupDisplay(d.customer_group);
                return (
                  <option key={d.id} value={d.id}>
                    {d.code ? `[${d.code}] ` : ''}{d.name} ({dGroup.label})
                  </option>
                );
              })}
            </select>

            {isDebtWarning && (
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12.5px',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>
                  <strong>Cảnh báo:</strong> Khách hàng đang có trạng thái: <strong>{selectedDealer?.debt_status}</strong>. Đơn hàng có thể bị chặn khi lưu.
                </span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '6px',
                fontSize: '11.5px',
                color: '#64748b',
              }}
            >
              <span>Địa chỉ: {selectedDealer?.address || 'Toàn quốc'}</span>
              {selectedDealer?.phone && <span>SĐT: {selectedDealer.phone}</span>}
            </div>
          </div>

          {/* 2. CHỌN SẢN PHẨM */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Chọn sản phẩm <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              id="select-order-product"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(parseInt(e.target.value, 10))}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                background: '#fff',
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

          {/* 3. ĐƠN VỊ TÍNH & SỐ LƯỢNG */}
          <div style={{ marginBottom: '14px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Đơn vị tính xuất
              </label>
              <select
                id="select-order-unit"
                value={selectedUnitName}
                onChange={(e) => setSelectedUnitName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  background: '#fff',
                  boxSizing: 'border-box',
                }}
              >
                {availableUnits.map((u) => (
                  <option key={u.unit_name} value={u.unit_name}>
                    {u.unit_name} {u.is_base ? '(ĐVT Cơ sở)' : `(1 ${u.unit_name} = ${u.conversion_rate} ${baseUnit})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Số lượng đặt <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="input-order-quantity"
                type="number"
                min="1"
                step="1"
                value={orderQuantity}
                onChange={(e) => setOrderQuantity(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  textAlign: 'right',
                  fontWeight: '600',
                }}
              />
            </div>
          </div>

          {/* Bảng quy đổi quy cách */}
          {!currentUnit?.is_base && (
            <div
              style={{
                marginBottom: '14px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                fontSize: '12.5px',
                color: '#1e40af',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Quy đổi tồn kho:</span>
              <strong>
                {numQty} {currentUnit?.unit_name} = {baseQuantity} {baseUnit}
              </strong>
            </div>
          )}

          {/* 4. GỢI Ý & ÁP DỤNG BẢNG GIÁ THEO NHÓM KHÁCH HÀNG */}
          <div
            id="panel-price-book-resolve"
            style={{
              marginBottom: '14px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px dashed #94a3b8',
              fontSize: '12.5px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: '700', color: '#334155' }}>
                Tra Cứu Bảng Giá: {isResolvingPrice ? 'Đang kiểm tra...' : groupInfo.label}
              </span>
              {floorPrice !== null && (
                <span
                  id="label-floor-price"
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: '700',
                    fontSize: '11.5px',
                  }}
                >
                  Giá sàn kiểm soát: {floorPrice.toLocaleString('vi-VN')} đ
                </span>
              )}
            </div>

            {priceResolveNote && (
              <div style={{ color: '#475569', fontStyle: 'italic', marginTop: '2px', lineHeight: '1.4' }}>
                {priceResolveNote}
              </div>
            )}
          </div>

          {/* 5. ĐƠN GIÁ BÁN THỰC TẾ & TỔNG THÀNH TIỀN */}
          <div style={{ marginBottom: '14px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Đơn giá bán thực tế ({selectedUnitName}) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                id="input-order-unit-price"
                type="number"
                min="0"
                value={sellPrice}
                onChange={(e) => setSellPrice(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: isBelowFloorPrice ? '2px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  textAlign: 'right',
                  boxSizing: 'border-box',
                  fontWeight: '700',
                  color: isBelowFloorPrice ? '#b91c1c' : '#0f172a',
                  background: isBelowFloorPrice ? '#fef2f2' : '#ffffff',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Tổng thành tiền
              </label>
              <div
                id="text-order-total-amount"
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontWeight: '800',
                  color: '#0f172a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8' }}>
                  {sellPrice.toLocaleString('vi-VN')} đ × {numQty}
                </span>
                <span>{totalAmount.toLocaleString('vi-VN')} đồng</span>
              </div>
            </div>
          </div>

          {/* Thông báo chữ màu đỏ khi đơn giá bán < floor_price */}
          {isBelowFloorPrice && (
            <div
              id="warning-floor-price-inline"
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1.5px solid #f87171',
                color: '#dc2626',
                fontSize: '13px',
                fontWeight: '700',
                marginBottom: '16px',
                lineHeight: '1.4',
              }}
            >
              Đơn giá bán thấp hơn giá niêm yết / giá sàn quy định. Đơn hàng sẽ được gửi cho Quản lý phê duyệt.
            </div>
          )}

          {/* 6. ĐIỂM GIAO HÀNG */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
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
                  {p.label} - {p.address}
                  {p.is_default ? ' (Mặc định)' : ''}
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
                    padding: 12,
                    borderRadius: 10,
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 13, color: '#1e293b' }}>{selected.label}</strong>
                    {selected.is_default && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: '#e0e7ff',
                          color: '#4338ca',
                        }}
                      >
                        Mặc định
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#475569' }}>Địa chỉ: {selected.address}</div>
                  <div style={{ fontSize: 12.5, color: '#64748b' }}>
                    Người nhận: {selected.receiver_name || 'Chưa cập nhật'} - {selected.receiver_phone || 'Chưa cập nhật'}
                  </div>
                  {selected.route_note && (
                    <div style={{ fontSize: 12, fontStyle: 'italic', color: '#94a3b8' }}>
                      Ghi chú đường đi: {selected.route_note}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 7. GHI CHÚ */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Ghi chú đơn hàng / Lý do điều chỉnh giá
            </label>
            <input
              id="input-order-note"
              type="text"
              placeholder="Nhập ghi chú hoặc lý do nếu bán dưới giá sàn..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
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

          {/* 8. ACTIONS */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              id="btn-submit-order"
              type="submit"
              disabled={isSubmitting}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: isBelowFloorPrice ? '#ea580c' : '#2563eb',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#fff',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow: isBelowFloorPrice
                  ? '0 4px 6px -1px rgba(234, 88, 12, 0.3)'
                  : '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
              }}
            >
              {isSubmitting
                ? 'Đang lưu đơn hàng...'
                : isBelowFloorPrice
                ? 'Gửi duyệt (Dưới giá niêm yết / sàn)'
                : 'Tạo đơn hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderCreateModal;
