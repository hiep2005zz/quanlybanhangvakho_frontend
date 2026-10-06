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

export interface SelectedOrderItem {
  productId: number;
  productCode: string;
  productName: string;
  stock: number;
  baseUnit: string;
  unitName: string;
  conversionRate: number;
  availableUnits: Array<{ unit_name: string; conversion_rate: number; is_base: boolean }>;
  quantity: number | string;
  sellPrice: number;
  floorPrice: number | null;
  priceNote?: string;
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

  // Danh sách nhiều sản phẩm trong đơn hàng
  const [orderItems, setOrderItems] = useState<SelectedOrderItem[]>([]);

  // Điểm giao hàng
  const [points, setPoints] = useState<DeliveryPoint[]>([]);
  const [deliveryPointId, setDeliveryPointId] = useState<number | null>(null);

  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedDealer = dealers.find((d) => d.id === dealerId) || dealers[0];

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
  const loadPoints = useCallback(async () => {
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
  }, [dealerId, token]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

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

  // Khi thay đổi đại lý -> tự động cập nhật lại bảng giá cho các sản phẩm đã có trong đơn
  useEffect(() => {
    if (!dealerId || orderItems.length === 0) return;

    const refreshPrices = async () => {
      const updated = await Promise.all(
        orderItems.map(async (item) => {
          try {
            const res = await resolvePriceApi(token, dealerId, item.productId);
            return {
              ...item,
              sellPrice: res.sale_price,
              floorPrice: res.floor_price,
              priceNote: res.price_book_name || res.price_book_code,
            };
          } catch {
            return item;
          }
        })
      );
      setOrderItems(updated);
    };

    refreshPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealerId]);

  // Thêm sản phẩm từ Dropdown
  const handleSelectProduct = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    const pId = parseInt(val, 10);
    const prod = products.find((p) => p.id === pId);
    if (!prod) return;

    // Reset Dropdown ngay lập tức để người dùng có thể tiếp tục chọn sản phẩm khác
    e.target.value = '';

    // Kiểm tra xem sản phẩm đã có trong danh sách hay chưa
    const existingIndex = orderItems.findIndex((item) => item.productId === pId);
    if (existingIndex >= 0) {
      // Nếu đã có -> tăng số lượng thêm 1
      setOrderItems((prev) =>
        prev.map((item, idx) => {
          if (idx !== existingIndex) return item;
          const currentQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
          return {
            ...item,
            quantity: currentQty + 1,
          };
        })
      );
      return;
    }

    // Nếu chưa có -> tạo mới dòng sản phẩm
    const baseUnit = prod.base_unit || 'Cái';
    const units = [
      { unit_name: baseUnit, conversion_rate: 1.0, is_base: true },
      ...(prod.units || []).map((u) => ({
        unit_name: u.unit_name,
        conversion_rate: u.conversion_rate,
        is_base: false,
      })),
    ];

    let itemSellPrice = prod.sell_price || 0;
    let itemFloorPrice: number | null = prod.sell_price || 0;
    let itemNote: string | undefined = undefined;

    if (dealerId) {
      try {
        const res = await resolvePriceApi(token, dealerId, prod.id);
        itemSellPrice = res.sale_price;
        itemFloorPrice = res.floor_price;
        itemNote = res.price_book_name || res.price_book_code;
      } catch {
        itemSellPrice = prod.sell_price || 0;
        itemFloorPrice = prod.sell_price || 0;
      }
    }

    const newItem: SelectedOrderItem = {
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      stock: prod.stock,
      baseUnit,
      unitName: baseUnit,
      conversionRate: 1.0,
      availableUnits: units,
      quantity: 1,
      sellPrice: itemSellPrice,
      floorPrice: itemFloorPrice,
      priceNote: itemNote,
    };

    setOrderItems((prev) => [...prev, newItem]);
  };

  // Cập nhật số lượng của dòng sản phẩm
  const handleQuantityChange = (index: number, val: string) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: val } : item))
    );
  };

  // Cập nhật đơn giá bán của dòng sản phẩm
  const handlePriceChange = (index: number, val: number) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, sellPrice: val } : item))
    );
  };

  // Cập nhật đơn vị tính của dòng sản phẩm
  const handleUnitChange = (index: number, unitName: string) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const targetUnit = item.availableUnits.find((u) => u.unit_name === unitName);
        return {
          ...item,
          unitName,
          conversionRate: targetUnit?.conversion_rate || 1.0,
        };
      })
    );
  };

  // Xóa sản phẩm khỏi danh sách
  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Tính toán tổng tiền và tổng số lượng
  const subtotalAmount = orderItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    return sum + qty * item.sellPrice;
  }, 0);

  const totalQuantity = orderItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    return sum + qty;
  }, 0);

  const parsedDiscount = Number(discountPercent);
  const safeDiscount = Number.isFinite(parsedDiscount) ? Math.min(100, Math.max(0, parsedDiscount)) : 0;
  const discountAmount = Math.round((subtotalAmount * safeDiscount) / 100);
  const totalAmount = subtotalAmount - discountAmount;

  // Kiểm tra xem có sản phẩm nào bán dưới giá sàn quy định hay không
  const isAnyBelowFloorPrice = orderItems.some(
    (item) => item.floorPrice !== null && item.sellPrice < item.floorPrice
  );
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDealer) {
      setErrorMsg('Vui lòng chọn khách hàng / đại lý.');
      return;
    }

    if (orderItems.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất một sản phẩm vào đơn hàng.');
      return;
    }

    for (const item of orderItems) {
      const q = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
      if (q <= 0) {
        setErrorMsg(`Số lượng của sản phẩm "${item.productName}" phải lớn hơn 0.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await createOrderApi(token, {
        dealer_id: dealerId,
        items: orderItems.map((item) => {
          const q = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
          return {
            product_id: item.productId,
            quantity: Math.round(q),
            price: item.sellPrice,
            unit_name: item.unitName,
            conversion_rate: item.conversionRate,
          };
        }),
        discount_percent: safeDiscount,
        note: note.trim() || undefined,
        delivery_point_id: deliveryPointId,
      });

      if (res.status === 'PENDING_APPROVAL' || (res as any).requires_approval) {
        emitStatusToast({
          title: 'Đơn hàng chuyển sang Chờ quản lý duyệt',
          message: `Đơn ${res.order_code} đã được tạo thành công với ${orderItems.length} sản phẩm và chuyển sang trạng thái Chờ quản lý duyệt do có đơn giá bán thấp hơn giá niêm yết / giá sàn quy định.`,
        });
      } else {
        emitStatusToast({
          title: 'Tạo đơn hàng thành công',
          message: `Đơn ${res.order_code} đã được tạo thành công với ${orderItems.length} sản phẩm (${totalQuantity} đơn vị). Tổng giá trị: ${totalAmount.toLocaleString('vi-VN')} đồng.`,
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
          maxWidth: '820px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          maxHeight: '94vh',
          overflowY: 'auto',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Header Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
              Tạo Đơn Hàng Mới
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '6px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0 }}>
                Hỗ trợ thêm nhiều sản phẩm vào đơn hàng · Tự động áp giá theo nhóm khách hàng và kiểm soát giá sàn
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
              marginBottom: '18px',
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

          {/* 2. CHỌN SẢN PHẨM (DROPDOWN TỰ ĐỘNG RESET SAU KHI CHỌN ĐỂ THÊM TIẾP) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Chọn sản phẩm để thêm vào đơn <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              id="select-order-product"
              defaultValue=""
              onChange={handleSelectProduct}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1.5px solid #3b82f6',
                fontSize: '13.5px',
                outline: 'none',
                background: '#f0f9ff',
                color: '#0f172a',
                boxSizing: 'border-box',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              <option value="">-- Bấm vào đây để chọn và thêm sản phẩm vào danh sách --</option>
              {products.map((p) => {
                const isAdded = orderItems.some((item) => item.productId === p.id);
                return (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name} (Tồn: {p.stock} {p.base_unit || 'Cái'}){isAdded ? ' [Đã có trong đơn]' : ''}
                  </option>
                );
              })}
            </select>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 2px' }}>
              💡 Chọn một sản phẩm sẽ tự động thêm vào danh sách bên dưới. Bạn có thể chọn nhiều sản phẩm liên tiếp.
            </p>
          </div>

          {/* 3. DANH SÁCH CÁC SẢN PHẨM ĐÃ CHỌN */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                Danh Sách Sản Phẩm Đặt Hàng ({orderItems.length})
              </span>
              {orderItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOrderItems([])}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  Xóa tất cả
                </button>
              )}
            </div>

            {orderItems.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '28px 16px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1.5px dashed #cbd5e1',
                  color: '#64748b',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>📦</div>
                Chưa có sản phẩm nào trong đơn hàng.
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Vui lòng chọn sản phẩm ở ô Dropdown phía trên để thêm vào danh sách.
                </div>
              </div>
            ) : (
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#ffffff',
                }}
              >
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr
                        style={{
                          background: '#f8fafc',
                          color: '#475569',
                          borderBottom: '1px solid #e2e8f0',
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700' }}>Tên Sản Phẩm</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', width: '100px' }}>ĐVT</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700', width: '90px' }}>Số Lượng</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', width: '140px' }}>Đơn Giá Thực Tế</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', width: '130px' }}>Thành Tiền</th>
                        <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '700', width: '45px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderItems.map((item, idx) => {
                        const itemQty =
                          typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
                        const itemTotal = itemQty * item.sellPrice;
                        const isBelowFloor = item.floorPrice !== null && item.sellPrice < item.floorPrice;

                        return (
                          <tr
                            key={item.productId}
                            style={{
                              borderBottom: idx === orderItems.length - 1 ? 'none' : '1px solid #f1f5f9',
                              background: isBelowFloor ? '#fef2f2' : idx % 2 === 0 ? '#ffffff' : '#fafafa',
                            }}
                          >
                            {/* Tên sản phẩm */}
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.productName}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Mã: <span style={{ fontFamily: 'monospace' }}>{item.productCode}</span> · Tồn: {item.stock} {item.baseUnit}
                              </div>
                              {item.priceNote && (
                                <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '2px' }}>
                                  🏷️ {item.priceNote}
                                </div>
                              )}
                            </td>

                            {/* Đơn vị tính */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              {item.availableUnits.length > 1 ? (
                                <select
                                  value={item.unitName}
                                  onChange={(e) => handleUnitChange(idx, e.target.value)}
                                  style={{
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12px',
                                    background: '#fff',
                                    outline: 'none',
                                    cursor: 'pointer',
                                  }}
                                >
                                  {item.availableUnits.map((u) => (
                                    <option key={u.unit_name} value={u.unit_name}>
                                      {u.unit_name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    fontSize: '12px',
                                    fontWeight: '500',
                                  }}
                                >
                                  {item.unitName}
                                </span>
                              )}
                            </td>

                            {/* Số lượng */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                style={{
                                  width: '70px',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  textAlign: 'center',
                                  outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                              />
                            </td>

                            {/* Đơn giá bán thực tế */}
                            <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                              <input
                                type="number"
                                min="0"
                                value={item.sellPrice}
                                onChange={(e) => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                                style={{
                                  width: '105px',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: isBelowFloor ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                  fontSize: '13px',
                                  fontWeight: '700',
                                  textAlign: 'right',
                                  outline: 'none',
                                  color: isBelowFloor ? '#b91c1c' : '#0f172a',
                                  background: isBelowFloor ? '#fff' : '#fff',
                                  boxSizing: 'border-box',
                                }}
                              />
                              {item.floorPrice !== null && (
                                <div
                                  style={{
                                    fontSize: '10.5px',
                                    color: isBelowFloor ? '#dc2626' : '#64748b',
                                    fontWeight: isBelowFloor ? '700' : '400',
                                    marginTop: '2px',
                                  }}
                                >
                                  Sàn: {item.floorPrice.toLocaleString('vi-VN')} đ
                                </div>
                              )}
                            </td>

                            {/* Thành tiền (Số lượng x Đơn giá) */}
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                              {itemTotal.toLocaleString('vi-VN')} đ
                            </td>

                            {/* Nút xóa sản phẩm */}
                            <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background 0.15s ease',
                                }}
                                title="Xóa sản phẩm khỏi đơn"
                              >
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17" />
                                  <line x1="14" y1="11" x2="14" y2="17" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* 4. TỔNG THÀNH TIỀN TOÀN ĐƠN HÀNG */}
          <div
            id="text-order-total-amount"
            style={{
              marginBottom: '16px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>
                Tổng cộng ({orderItems.length} sản phẩm · {totalQuantity} đơn vị):
              </span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
              {subtotalAmount.toLocaleString('vi-VN')} đồng
            </div>
          </div>

          {/* CHIẾT KHẤU ĐƠN HÀNG */}
          <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Chiết khấu (%)
                </label>
                <input
                  id="input-order-discount-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    textAlign: 'right',
                    boxSizing: 'border-box',
                    fontWeight: '700',
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Tiền chiết khấu
                </label>
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    color: '#15803d',
                    textAlign: 'right',
                  }}
                >
                  − {discountAmount.toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>

            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Tổng thanh toán thực tế:</span>
              <strong id="text-order-total-amount" style={{ fontSize: '16px', color: '#059669', fontWeight: '800' }}>
                {totalAmount.toLocaleString('vi-VN')} đồng
              </strong>
            </div>
          </div>

          {/* Thông báo nếu có sản phẩm bán dưới giá sàn quy định */}
          {isAnyBelowFloorPrice && (
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
              ⚠️ Đơn hàng có sản phẩm có đơn giá bán thấp hơn giá niêm yết / giá sàn quy định. Đơn hàng sẽ được chuyển sang trạng thái Chờ quản lý phê duyệt.
            </div>
          )}

          {/* 5. ĐIỂM GIAO HÀNG */}
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

          {/* 6. GHI CHÚ */}
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

          {/* 7. ACTIONS */}
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
              disabled={isSubmitting || orderItems.length === 0}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: orderItems.length === 0 ? '#94a3b8' : isAnyBelowFloorPrice ? '#ea580c' : '#2563eb',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#fff',
                cursor: isSubmitting || orderItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow:
                  orderItems.length === 0
                    ? 'none'
                    : isAnyBelowFloorPrice
                    ? '0 4px 6px -1px rgba(234, 88, 12, 0.3)'
                    : '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
              }}
            >
              {isSubmitting
                ? 'Đang lưu đơn hàng...'
                : isAnyBelowFloorPrice
                ? 'Gửi duyệt (Dưới giá niêm yết / sàn)'
                : `Tạo đơn hàng (${orderItems.length} sản phẩm)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderCreateModal;
