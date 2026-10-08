import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ProductItem,
  User,
  createOrderApi,
  getDealersApi,
  resolvePriceApi,
  DealerItem,
  getAvatarUrl,
  listDeliveryPointsApi,
  getDiscountPoliciesApi,
  DiscountPolicy,
  getDealerStockSummaryApi,
  DealerStockSummaryResponse,
} from '../services/api';
import { evaluateBestDiscountPolicy, parseStoredPolicies } from '../utils/discountEngine';
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

  // Chiết khấu sản lượng
  const [policies, setPolicies] = useState<DiscountPolicy[]>([]);
  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [isManualDiscount, setIsManualDiscount] = useState<boolean>(false);

  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AC 1 & 2: Quản lý tồn kho khả dụng theo kho phục vụ của đại lý
  const [stockSummary, setStockSummary] = useState<DealerStockSummaryResponse | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  const isCustomer = currentUser?.role === 'customer' || Boolean(currentUser?.roles && currentUser.roles.includes('customer'));
  const selectedDealer = dealers.find((d) => d.id === dealerId) || dealers[0];
  const isLockedDealer = Boolean(
    selectedDealer?.status &&
    (selectedDealer.status.toLowerCase().includes('khóa') ||
     selectedDealer.status.toLowerCase().includes('lock'))
  );

  useEffect(() => {
    if (isOpen && token) {
      const local = parseStoredPolicies();
      if (local.length > 0) {
        setPolicies(local);
      }
      getDiscountPoliciesApi(token, { is_active: true })
        .then((res) => {
          if (res.items && res.items.length > 0) {
            const merged = [...res.items];
            local.forEach((lp) => {
              if (!merged.some((p) => p.code === lp.code)) merged.push(lp);
            });
            setPolicies(merged);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, token]);

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

  // AC 1: Tải tồn kho khả dụng của kho phục vụ cho đại lý được chọn
  useEffect(() => {
    if (!dealerId || !token) {
      setStockSummary(null);
      return;
    }
    let isCancelled = false;
    setIsLoadingStock(true);
    getDealerStockSummaryApi(token, dealerId)
      .then((data) => {
        if (!isCancelled) {
          setStockSummary(data);
        }
      })
      .catch((err) => {
        console.warn('Could not load dealer stock summary in modal:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingStock(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [dealerId, token]);

  const stockMap = React.useMemo(() => {
    const map = new Map<number, { actual_stock: number; reserved_stock: number; available_stock: number }>();
    if (!stockSummary?.items) return map;
    for (const item of stockSummary.items) {
      map.set(item.product_id, item);
    }
    return map;
  }, [stockSummary]);

  const hasStockErrors = React.useMemo(() => {
    if (!dealerId) return false;
    return orderItems.some((item) => {
      const stockItem = stockMap.get(item.productId);
      if (!stockItem) return false;
      const q = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
      const rate = item.conversionRate || 1;
      const maxOrderable = Math.max(0, Math.floor(stockItem.available_stock / rate));
      return q > maxOrderable;
    });
  }, [dealerId, orderItems, stockMap]);

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
  const handleQuantityChange = (index: number, val: string | number) => {
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

  // Tính toán tổng tiền hàng và tổng số lượng
  const subtotalAmount = orderItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    return sum + qty * item.sellPrice;
  }, 0);

  const totalQuantity = orderItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    return sum + qty;
  }, 0);

  // Kiểm tra xem có sản phẩm nào bán dưới giá sàn quy định hay không
  const isAnyBelowFloorPrice = orderItems.some(
    (item) => item.floorPrice !== null && item.sellPrice < item.floorPrice
  );

  // Đánh giá chính sách chiết khấu theo Best Price Rule cho toàn đơn hàng
  const discountEvaluation = React.useMemo(() => {
    const itemsForEvaluation = orderItems.map((item) => {
      const q = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
      return {
        productId: item.productId,
        quantity: Math.round(q),
        price: item.sellPrice,
        name: item.productName,
        code: item.productCode,
      };
    });

    return evaluateBestDiscountPolicy(
      policies,
      itemsForEvaluation,
      selectedDealer
        ? {
            id: selectedDealer.id,
            customer_group: selectedDealer.customer_group || '',
            name: selectedDealer.name,
          }
        : null,
      Math.round(totalQuantity),
      subtotalAmount
    );
  }, [policies, orderItems, selectedDealer, totalQuantity, subtotalAmount]);

  // Tự động điền giá trị % vào ô "Chiết khấu (%)" khi số lượng thỏa mãn các bậc
  useEffect(() => {
    if (!isManualDiscount) {
      if (discountEvaluation.isQualified) {
        setDiscountPercent(String(discountEvaluation.discountPercent));
      } else {
        setDiscountPercent('0');
      }
    }
  }, [discountEvaluation, isManualDiscount]);

  const parsedDiscount = Number(discountPercent);
  const safeDiscount = Number.isFinite(parsedDiscount) ? Math.min(100, Math.max(0, parsedDiscount)) : 0;
  const discountAmount = Math.round((subtotalAmount * safeDiscount) / 100);
  const totalAmount = subtotalAmount - discountAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDealer) {
      setErrorMsg('Vui lòng chọn khách hàng / đại lý.');
      return;
    }

    const isLockedDealer = Boolean(
      selectedDealer?.status &&
      (selectedDealer.status.toLowerCase().includes('khóa') ||
       selectedDealer.status.toLowerCase().includes('lock'))
    );
    if (isLockedDealer) {
      setErrorMsg(`Đại lý "${selectedDealer?.name}" hiện đang bị KHÓA giao dịch. Không thể tạo đơn hàng mới.`);
      emitStatusToast({
        title: 'Đại lý bị khóa giao dịch',
        message: `Đại lý "${selectedDealer?.name}" hiện đang bị KHÓA giao dịch. Vui lòng liên hệ quản trị viên.`,
        type: 'error',
      });
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
      // AC 3: Kiểm tra vượt tồn khả dụng tại kho phục vụ
      const stockItem = stockMap.get(item.productId);
      if (stockItem) {
        const rate = item.conversionRate || 1;
        const maxOrderable = Math.max(0, Math.floor(stockItem.available_stock / rate));
        if (q > maxOrderable) {
          const warehouseName = stockSummary?.warehouse_name || 'kho';
          const errMsg = `Sản phẩm "${item.productName}" vượt quá tồn khả dụng tại ${warehouseName}. Số lượng tối đa có thể đặt: ${maxOrderable} ${item.unitName}.`;
          setErrorMsg(errMsg);
          emitStatusToast({
            title: 'Vượt tồn khả dụng',
            message: errMsg,
            type: 'error',
          });
          return;
        }
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

  return createPortal(
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
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          maxWidth: '840px',
          width: '100%',
          maxHeight: 'calc(100vh - 32px)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal (Cố định ở trên) */}
        <div
          style={{
            padding: '20px 24px 16px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexShrink: 0,
            background: '#ffffff',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
              Tạo Đơn Hàng Mới
            </h3>
            {currentUser && (
              <div style={{ marginTop: '6px' }}>
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
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '22px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              borderRadius: '6px',
              flexShrink: 0,
            }}
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Form Body: Container flex column để phần giữa cuộn, Footer cố định */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Vùng nội dung cuộn mượt mà */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '13px',
                }}
              >
                {errorMsg}
              </div>
            )}
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
              disabled={loadingDealers || dealers.length === 0 || isCustomer || dealers.length === 1}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                outline: 'none',
                background: isCustomer || dealers.length === 1 ? '#f1f5f9' : '#ffffff',
                boxSizing: 'border-box',
                fontWeight: '500',
              }}
            >
              {dealers.map((d) => {
                const dGroup = getCustomerGroupDisplay(d.customer_group);
                const isLocked = Boolean(
                  d.status &&
                  (d.status.toLowerCase().includes('khóa') ||
                   d.status.toLowerCase().includes('lock'))
                );
                return (
                  <option key={d.id} value={d.id} disabled={isLocked}>
                    {d.code ? `[${d.code}] ` : ''}{d.name} ({dGroup.label}){isLocked ? ' [Đã khóa]' : ''}
                  </option>
                );
              })}
            </select>

            {/* AC 1: Hiển thị kho phục vụ riêng cho đại lý */}
            {stockSummary && (
              <div
                style={{
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  color: '#0369a1',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  padding: '6px 10px',
                  borderRadius: '6px',
                }}
              >
                <span>🏬 Kho phục vụ: <strong>{stockSummary.warehouse_name}</strong> ({stockSummary.warehouse_id})</span>
                {isLoadingStock && <span style={{ color: '#0284c7' }}>(Đang cập nhật tồn...)</span>}
              </div>
            )}

            {isLockedDealer && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  fontSize: '12.5px',
                  color: '#991b1b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span>
                  <strong>Đại lý bị khóa giao dịch:</strong> Đại lý này hiện đang ở trạng thái <strong>Đã khóa</strong>. Hệ thống chặn tạo đơn hàng mới.
                </span>
              </div>
            )}

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
                        const stockItem = stockMap.get(item.productId);
                        const rate = item.conversionRate || 1;
                        const maxOrderable = stockItem ? Math.max(0, Math.floor(stockItem.available_stock / rate)) : undefined;
                        const actualInUnit = stockItem ? Math.floor(stockItem.actual_stock / rate) : undefined;
                        const reservedInUnit = stockItem ? Math.floor(stockItem.reserved_stock / rate) : undefined;
                        const isExceeded = stockItem !== undefined && maxOrderable !== undefined && itemQty > maxOrderable;

                        return (
                          <tr
                            key={item.productId}
                            style={{
                              borderBottom: idx === orderItems.length - 1 ? 'none' : '1px solid #f1f5f9',
                              background: isExceeded ? '#fff1f2' : isBelowFloor ? '#fef2f2' : idx % 2 === 0 ? '#ffffff' : '#fafafa',
                            }}
                          >
                            {/* Tên sản phẩm */}
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.productName}</div>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Mã: <span style={{ fontFamily: 'monospace' }}>{item.productCode}</span>
                              </div>

                              {/* AC 1 & 2: Hiển thị tồn khả dụng theo kho phục vụ riêng cho đại lý */}
                              {stockItem && (
                                <div style={{ fontSize: '11px', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '5px', alignItems: 'center' }}>
                                  <span
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: '600',
                                      fontSize: '11px',
                                      background: isExceeded ? '#fee2e2' : maxOrderable === 0 ? '#f1f5f9' : '#dcfce7',
                                      color: isExceeded ? '#dc2626' : maxOrderable === 0 ? '#64748b' : '#15803d',
                                      border: `1px solid ${isExceeded ? '#fca5a5' : maxOrderable === 0 ? '#cbd5e1' : '#86efac'}`,
                                    }}
                                    title={`Tồn thực tế: ${actualInUnit} ${item.unitName} - Đang giữ chỗ: ${reservedInUnit} ${item.unitName}`}
                                  >
                                    Tồn khả dụng: {maxOrderable} {item.unitName}
                                  </span>
                                  <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                                    (Thực tế: {actualInUnit} | Giữ chỗ: {reservedInUnit})
                                  </span>
                                </div>
                              )}

                              {/* AC 3: Cảnh báo vượt tồn khả dụng và nút gợi ý đặt tối đa */}
                              {isExceeded && maxOrderable !== undefined && (
                                <div style={{ marginTop: '4px', fontSize: '11px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span>⚠️ Vượt tồn kho ({maxOrderable} {item.unitName})</span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityChange(idx, maxOrderable)}
                                    style={{
                                      background: '#fee2e2',
                                      border: '1px solid #f87171',
                                      color: '#b91c1c',
                                      borderRadius: '4px',
                                      padding: '1px 6px',
                                      fontSize: '10.5px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                    }}
                                    title="Điều chỉnh số lượng về tồn khả dụng tối đa"
                                  >
                                    Đặt tối đa ({maxOrderable})
                                  </button>
                                </div>
                              )}

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
                                  border: isExceeded ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                  background: isExceeded ? '#fef2f2' : '#ffffff',
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

          {/* 4. TỔNG TIỀN VÀ CHIẾT KHẤU SẢN LƯỢNG */}
          <div
            style={{
              marginBottom: '12px',
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
                Tổng tiền hàng ({orderItems.length} sản phẩm · {totalQuantity} đơn vị):
              </span>
            </div>
            <div
              id="text-order-subtotal-amount"
              style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}
            >
              {subtotalAmount.toLocaleString('vi-VN')} đ
            </div>
          </div>

          {/* CHIẾT KHẤU SẢN LƯỢNG */}
          <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                    Chiết khấu (%)
                  </label>
                  {isManualDiscount && discountEvaluation.isQualified && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualDiscount(false);
                        setDiscountPercent(String(discountEvaluation.discountPercent));
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '11.5px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      ↺ Theo chính sách ({discountEvaluation.discountPercent}%)
                    </button>
                  )}
                </div>
                <input
                  id="input-order-discount-percent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={discountPercent}
                  onChange={(e) => {
                    setIsManualDiscount(true);
                    setDiscountPercent(e.target.value);
                  }}
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

            {discountEvaluation.isQualified && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '8px',
                  padding: '6px 10px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '6px',
                  color: '#15803d',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{discountEvaluation.label}</span>
              </div>
            )}

            {isManualDiscount && safeDiscount > discountEvaluation.discountPercent && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '6px',
                  color: '#b45309',
                  fontSize: '11.5px',
                }}
              >
                ⚠️ Chiết khấu bạn nhập ({safeDiscount}%) cao hơn mức chính sách ({discountEvaluation.discountPercent}%). Đơn hàng sẽ cần Quản lý duyệt.
              </div>
            )}

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

          </div>

          {/* 7. ACTIONS (Cố định ở chân modal, LUÔN HIỂN THỊ) */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: '#f8fafc',
              flexShrink: 0,
              boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
            }}
          >
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
              disabled={isSubmitting || orderItems.length === 0 || isLockedDealer || hasStockErrors}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: orderItems.length === 0 || isLockedDealer || hasStockErrors ? '#94a3b8' : isAnyBelowFloorPrice ? '#ea580c' : '#0fad89',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#fff',
                cursor: isSubmitting || orderItems.length === 0 || isLockedDealer || hasStockErrors ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                boxShadow:
                  orderItems.length === 0 || isLockedDealer || hasStockErrors
                    ? 'none'
                    : isAnyBelowFloorPrice
                    ? '0 4px 6px -1px rgba(234, 88, 12, 0.3)'
                    : '0 4px 6px -1px rgba(15, 173, 137, 0.3)',
              }}
              title={
                isLockedDealer
                  ? `Đại lý "${selectedDealer?.name}" hiện đang bị khóa giao dịch, không thể tạo đơn hàng`
                  : hasStockErrors
                  ? 'Có sản phẩm vượt quá tồn khả dụng kho phục vụ. Vui lòng điều chỉnh số lượng trước khi đặt hàng'
                  : undefined
              }
            >
              {isSubmitting
                ? 'Đang lưu đơn hàng...'
                : isLockedDealer
                ? 'Đại lý bị khóa (Không thể tạo đơn)'
                : hasStockErrors
                ? 'Vượt tồn khả dụng (Không thể tạo đơn)'
                : isAnyBelowFloorPrice
                ? 'Gửi duyệt (Dưới giá niêm yết / sàn)'
                : `Tạo đơn hàng (${orderItems.length} sản phẩm)`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default OrderCreateModal;
