import React, { useEffect, useState, useCallback } from 'react';
import {
  ProductItem,
  User,
  createOrderApi,
  getDealersApi,
  resolvePriceApi,
  DealerItem,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

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
  { id: 1, code: 'DL001', name: 'Đại Lý Phân Phối Miền Bắc - Sao Mai', customer_group: 'dai_ly_cap_1' },
  { id: 2, code: 'DL002', name: 'Đại Lý Thời Trang Tân Bình', customer_group: 'dai_ly_cap_2' },
  { id: 3, code: 'DL003', name: 'Đại Lý Tổng Hợp Hải Phòng', customer_group: 'dai_ly_cap_1' },
  { id: 4, code: 'DL004', name: 'Công Ty TNHH Bán Lẻ An Phát', customer_group: 'dai_ly_cap_2' },
  { id: 5, code: 'DL005', name: 'Khách Mua Lẻ Trực Tiếp', customer_group: 'khach_le' },
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

  const [dealers, setDealers] = useState<DealerItem[]>(FALLBACK_DEALERS);
  const [selectedDealerId, setSelectedDealerId] = useState<number>(initialDealerId);
  const [selectedProductId, setSelectedProductId] = useState<number>(
    products.length > 0 ? products[0].id : 1
  );

  const [floorPrice, setFloorPrice] = useState<number | null>(null);
  const [isResolvingPrice, setIsResolvingPrice] = useState(false);
  const [priceResolveNote, setPriceResolveNote] = useState<string | null>(null);

  const selectedDealer = dealers.find((d) => d.id === selectedDealerId) || dealers[0];
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

  // 1. Tải danh sách đại lý từ backend
  useEffect(() => {
    getDealersApi(token)
      .then((data) => {
        if (data && data.length > 0) {
          setDealers(data);
          if (!data.some((d) => d.id === selectedDealerId)) {
            setSelectedDealerId(data[0].id);
          }
        }
      })
      .catch(() => {
        // Fallback danh sách đại lý mặc định
      });
  }, [token]);

  // Nhận diện nhãn và màu sắc nhóm khách hàng
  const getCustomerGroupDisplay = (group?: string) => {
    const g = group || 'dai_ly_cap_1';
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
    return {
      label: 'Khách lẻ',
      badgeBg: '#ffedd5',
      badgeColor: '#c2410c',
      borderColor: '#fed7aa',
    };
  };

  const groupInfo = getCustomerGroupDisplay(selectedDealer?.customer_group);

  // 2. Tra cứu giá tự động qua API /price-books/resolve-price khi đổi khách hàng hoặc sản phẩm
  const handleResolvePrice = useCallback(
    async (dealerId: number, productId: number) => {
      if (!dealerId || !productId) return;
      setIsResolvingPrice(true);
      setPriceResolveNote(null);
      try {
        const res = await resolvePriceApi(token, dealerId, productId);
        setSellPrice(res.sale_price);
        setFloorPrice(res.floor_price);
        const pbIdentifier = res.price_book_name || res.price_book_code || 'Bảng giá quy định';
        setPriceResolveNote(
          `Áp dụng bảng giá: ${pbIdentifier} - Giá sàn quy định: ${res.floor_price.toLocaleString('vi-VN')} đồng`
        );
      } catch (err: any) {
        // Trường hợp sản phẩm chưa có trong bảng giá nhóm này, dùng giá niêm yết
        const currentProd = products.find((p) => p.id === productId);
        const fallbackPrice = currentProd?.sell_price || 0;
        setSellPrice(fallbackPrice);
        setFloorPrice(null);
        setPriceResolveNote(
          `Chưa có bảng giá áp dụng cho nhóm khách hàng này - Áp dụng giá niêm yết: ${fallbackPrice.toLocaleString('vi-VN')} đồng`
        );
      } finally {
        setIsResolvingPrice(false);
      }
    },
    [token, products, groupInfo.label]
  );

  // Khi thay đổi sản phẩm hoặc khách hàng: gọi tra cứu giá tự động
  useEffect(() => {
    if (selectedDealerId && selectedProductId) {
      handleResolvePrice(selectedDealerId, selectedProductId);
    }
  }, [selectedDealerId, selectedProductId, handleResolvePrice]);

  // Khi đổi sản phẩm, reset đơn vị về đơn vị cơ sở của sản phẩm đó
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

    setIsSubmitting(true);
    try {
      const res = await createOrderApi(token, {
        dealer_id: selectedDealerId,
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

      if (res.status === 'PENDING_APPROVAL' || res.requires_approval) {
        emitStatusToast({
          title: 'Đơn hàng chuyển sang Chờ quản lý duyệt',
          message: `Đơn ${res.order_code} đã được tạo thành công và chuyển sang trạng thái Chờ quản lý duyệt do đơn giá bán (${sellPrice.toLocaleString('vi-VN')} đồng) thấp hơn giá sàn quy định (${floorPrice?.toLocaleString('vi-VN')} đồng).`,
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
        }}
      >
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              Tạo Đơn Hàng Mới
            </h3>
            <p style={{ fontSize: '12.5px', color: '#64748b', margin: '4px 0 0 0' }}>
              Tự động áp giá theo nhóm khách hàng và kiểm soát giá sàn
            </p>
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
          <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
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
              value={selectedDealerId}
              onChange={(e) => setSelectedDealerId(parseInt(e.target.value, 10))}
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
              {dealers.map((d) => {
                const dGroup = getCustomerGroupDisplay(d.customer_group);
                return (
                  <option key={d.id} value={d.id}>
                    {d.code} - {d.name} ({dGroup.label})
                  </option>
                );
              })}
            </select>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11.5px', color: '#64748b' }}>
              <span>Địa chỉ: {selectedDealer?.address || 'Toàn quốc'}</span>
              {currentUser && (
                <span>Người lên đơn: <strong style={{ color: '#2563eb' }}>{currentUser.full_name || currentUser.username}</strong></span>
              )}
            </div>
          </div>

          {/* 2. CHỌN SẢN PHẨM */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Sản phẩm <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              id="select-product-item"
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
                color: '#0f172a',
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name} (Tồn kho: {p.stock} {p.base_unit || 'Cái'} - Giá niêm yết: {p.sell_price.toLocaleString('vi-VN')} đồng)
                </option>
              ))}
            </select>
          </div>

          {/* Dòng thông báo văn bản thuần túy áp dụng bảng giá */}
          <div
            id="banner-price-book-note"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              fontSize: '12.5px',
              fontWeight: '600',
              marginBottom: '14px',
              lineHeight: '1.5',
            }}
          >
            {isResolvingPrice
              ? 'Đang tự động tra cứu bảng giá theo nhóm khách hàng...'
              : (priceResolveNote || 'Chưa có bảng giá áp dụng cho nhóm khách hàng này')}
          </div>

          {/* Đơn vị tính & Số lượng */}
          <div style={{ marginBottom: '14px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
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
                    {u.unit_name} {u.is_base ? '(Đơn vị cơ sở)' : `(= ${u.conversion_rate} ${baseUnit})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
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
                  fontWeight: '700',
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          {/* Thông tin quy đổi số lượng kho */}
          <div
            style={{
              padding: '10px 14px',
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
              <div style={{ fontSize: '12px', color: '#475569', fontWeight: '700' }}>
                Quy đổi số lượng trừ vào kho cơ sở:
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                1 {currentUnit.unit_name} = {currentUnit.conversion_rate} {baseUnit}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '16px', fontWeight: '800', color: '#2563eb' }}>
                {baseQuantity.toLocaleString()}
              </span>{' '}
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>
                {baseUnit}
              </span>
            </div>
          </div>

          {/* Đơn giá thực tế & Tổng thành tiền */}
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
                style={{
                  padding: '9px 12px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  fontSize: '14px',
                  fontWeight: '800',
                  color: '#0f172a',
                  textAlign: 'right',
                }}
              >
                {totalAmount.toLocaleString('vi-VN')} đồng
              </div>
            </div>
          </div>

          {/* Thông báo chữ màu đỏ khi đơn giá bán < floor_price (Yêu cầu đề bài) */}
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
              Đơn giá bán thấp hơn giá sàn quy định. Đơn hàng sẽ được gửi cho Quản lý phê duyệt.
            </div>
          )}

          {/* Ghi chú */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Ghi chú đơn hàng / Lý do điều chỉnh giá
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isBelowFloorPrice ? 'Nhập lý do bán dưới giá sàn...' : 'Ví dụ: Giao hàng giờ hành chính, đóng gói tiêu chuẩn...'}
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

          {/* Nút hành động */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
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
              id="btn-submit-create-order"
              disabled={isSubmitting}
              style={{
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                background: isBelowFloorPrice ? '#d97706' : '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
            >
              {isSubmitting ? 'Đang xử lý...' : 'Tạo Đơn Hàng'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default OrderCreateModal;
