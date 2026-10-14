import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ProductItem,
  User,
  createOrderApi,
  getDealersApi,
  resolvePriceApi,
  DealerItem,
  listDeliveryPointsApi,
  getDiscountPoliciesApi,
  DiscountPolicy,
  DealerPurchaseHistory,
  PurchaseHistoryItem,
  getDealerPurchaseHistoryApi,
  getDealerStockSummaryApi,
  DealerStockSummaryResponse,
  DealerCreditInfo,
  getDealerCreditInfoApi,
} from '../services/api';
import { evaluateBestDiscountPolicy, parseStoredPolicies } from '../utils/discountEngine';
import { searchDealers } from '../services/dealerSearchApi';
import { emitStatusToast } from './StatusToast';
import type { DeliveryPoint } from '../types/deliveryPoint';
import { Link, useNavigate } from '../hooks/useLocation';
import { ProductInfiniteSelect } from './ProductInfiniteSelect';

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

export interface CreateOrderPageProps {
  token: string;
  currentUser?: User;
  products: ProductItem[];
  onClose?: () => void;
  onSuccess?: () => void;
  initialDealerId?: number;
  initialOrderItems?: SelectedOrderItem[];
  initialNote?: string;
  initialDeliveryPointId?: number | null;
}

export const normalizeOrderItem = (raw: any, productsList: ProductItem[] = []): SelectedOrderItem => {
  const prodId = Number(raw.productId ?? raw.product_id ?? 0);
  const prod = productsList.find((p) => p.id === prodId);
  const baseUnit = prod?.base_unit || raw.baseUnit || raw.base_unit || raw.unitName || raw.unit_name || raw.unit || 'Cái';
  const unitName = raw.unitName || raw.unit_name || raw.unit || baseUnit;
  const conversionRate = Number(raw.conversionRate ?? raw.conversion_rate ?? 1.0) || 1.0;

  const availableUnits = (raw.availableUnits && Array.isArray(raw.availableUnits) && raw.availableUnits.length > 0)
    ? raw.availableUnits
    : prod
      ? [
          { unit_name: baseUnit, conversion_rate: 1.0, is_base: true },
          ...(prod.units || []).map((u) => ({
            unit_name: u.unit_name,
            conversion_rate: u.conversion_rate,
            is_base: false,
          })),
        ]
      : [{ unit_name: unitName, conversion_rate: conversionRate, is_base: true }];

  const rawPrice = raw.sellPrice ?? raw.unit_price ?? raw.price ?? prod?.sell_price ?? 0;
  const sellPrice = Number(rawPrice) || 0;
  const rawFloor = raw.floorPrice ?? raw.floor_price;
  const floorPrice = (rawFloor !== undefined && rawFloor !== null)
    ? Number(rawFloor)
    : (prod?.sell_price !== undefined && prod?.sell_price !== null ? Number(prod.sell_price) : null);

  return {
    productId: prodId,
    productCode: raw.productCode || raw.product_code || prod?.code || '',
    productName: raw.productName || raw.product_name || prod?.name || '',
    stock: prod?.stock ?? raw.stock ?? 999,
    baseUnit,
    unitName,
    conversionRate,
    availableUnits,
    quantity: raw.quantity ?? 1,
    sellPrice,
    floorPrice,
    priceNote: raw.priceNote || raw.price_note,
  };
};

const FALLBACK_DEALERS: DealerItem[] = [
  { id: 1, code: 'DL001', name: 'Đại Lý Phân Phối Miền Bắc - Sao Mai', customer_group: 'Đại lý cấp 1' },
  { id: 2, code: 'DL002', name: 'Đại Lý Thời Trang Tân Bình', customer_group: 'Đại lý cấp 2' },
  { id: 3, code: 'DL003', name: 'Đại Lý Tổng Hợp Hải Phòng', customer_group: 'Khách sỉ' },
  { id: 4, code: 'DL004', name: 'Công Ty TNHH Bán Lẻ An Phát', customer_group: 'Khách lẻ' },
];

export const CreateOrderPage: React.FC<CreateOrderPageProps> = ({
  token,
  currentUser,
  products,
  onClose,
  onSuccess,
  initialDealerId = 1,
  initialOrderItems,
  initialNote,
  initialDeliveryPointId,
}) => {
  const navigate = useNavigate();

  const handleCancelNavigation = useCallback(() => {
    try {
      sessionStorage.removeItem('clone_order_draft');
    } catch {}
    if (onClose) {
      onClose();
    } else {
      navigate('/orders');
    }
  }, [onClose, navigate]);

  // 1. Danh sách đại lý & Đại lý được chọn
  const [dealers, setDealers] = useState<any[]>(FALLBACK_DEALERS);
  const [dealerId, setDealerId] = useState<number>(initialDealerId);
  const [loadingDealers, setLoadingDealers] = useState(false);

  // Cache các sản phẩm đã tải để luôn tra cứu được thông tin khi thêm từ lịch sử / clone
  const [loadedProductsMap, setLoadedProductsMap] = useState<Map<number, ProductItem>>(() => {
    const map = new Map<number, ProductItem>();
    if (products && Array.isArray(products)) {
      for (const p of products) map.set(p.id, p);
    }
    return map;
  });

  useEffect(() => {
    if (products && products.length > 0) {
      setLoadedProductsMap((prev) => {
        const next = new Map(prev);
        for (const p of products) {
          if (!next.has(p.id)) next.set(p.id, p);
        }
        return next;
      });
    }
  }, [products]);

  // 2. Danh sách sản phẩm trong giỏ hàng đặt hàng
  const [orderItems, setOrderItems] = useState<SelectedOrderItem[]>(() => {
    if (initialOrderItems && Array.isArray(initialOrderItems) && initialOrderItems.length > 0) {
      return initialOrderItems.map((it) => normalizeOrderItem(it, products));
    }
    try {
      const cloneDraft = sessionStorage.getItem('clone_order_draft');
      if (cloneDraft) {
        const parsed = JSON.parse(cloneDraft);
        if (parsed.items && Array.isArray(parsed.items)) {
          return parsed.items.map((it: any) => normalizeOrderItem(it, products));
        }
      }
    } catch {}
    return [];
  });

  // 3. Điểm giao hàng
  const [points, setPoints] = useState<DeliveryPoint[]>([]);
  const [deliveryPointId, setDeliveryPointId] = useState<number | null>(
    () => (initialDeliveryPointId !== undefined ? initialDeliveryPointId : null)
  );

  // 4. Chính sách chiết khấu & Chiết khấu %
  const [policies, setPolicies] = useState<DiscountPolicy[]>([]);
  const [discountPercent, setDiscountPercent] = useState<string>('0');
  const [isManualDiscount, setIsManualDiscount] = useState<boolean>(false);
  const [note, setNote] = useState<string>(() => initialNote || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 5. Lịch sử mua hàng của đại lý & gợi ý mặt hàng
  const [purchaseHistory, setPurchaseHistory] = useState<DealerPurchaseHistory | null>(null);
  const [, setIsLoadingHistory] = useState(false);
  const [historyForbidden, setHistoryForbidden] = useState(false);

  // 6. Quản lý tồn kho khả dụng theo kho phục vụ
  const [stockSummary, setStockSummary] = useState<DealerStockSummaryResponse | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState<boolean>(false);

  // 7. Thông tin công nợ, hạn mức & nợ quá hạn
  const [creditInfo, setCreditInfo] = useState<DealerCreditInfo | null>(null);
  const [isLoadingCredit, setIsLoadingCredit] = useState<boolean>(false);

  // Cập nhật khi có props khởi tạo ban đầu hoặc draft từ sessionStorage
  useEffect(() => {
    try {
      const cloneDraftStr = sessionStorage.getItem('clone_order_draft');
      if (cloneDraftStr) {
        const cloneDraft = JSON.parse(cloneDraftStr);
        if (cloneDraft.dealerId || cloneDraft.dealer_id) {
          setDealerId(cloneDraft.dealerId || cloneDraft.dealer_id);
        }
        if (cloneDraft.items && Array.isArray(cloneDraft.items) && cloneDraft.items.length > 0) {
          setOrderItems(cloneDraft.items.map((it: any) => normalizeOrderItem(it, products)));
        }
        if (cloneDraft.note) setNote(cloneDraft.note);
        if (cloneDraft.deliveryPointId !== undefined) setDeliveryPointId(cloneDraft.deliveryPointId);
        return;
      }

      const draftStr = sessionStorage.getItem('reorder_draft');
      if (draftStr) {
        sessionStorage.removeItem('reorder_draft');
        const draft = JSON.parse(draftStr);
        if (draft.dealerId) setDealerId(draft.dealerId);
        if (draft.items && draft.items.length > 0) {
          setOrderItems(draft.items.map((it: any) => normalizeOrderItem(it, products)));
        }
        if (draft.note) setNote(draft.note);
        if (draft.deliveryPointId !== undefined) setDeliveryPointId(draft.deliveryPointId);
        return;
      }
    } catch {
      // ignore
    }

    if (initialOrderItems && initialOrderItems.length > 0) {
      setOrderItems(initialOrderItems.map((it) => normalizeOrderItem(it, products)));
    }
    if (initialDealerId) {
      setDealerId(initialDealerId);
    }
    if (initialDeliveryPointId !== undefined) {
      setDeliveryPointId(initialDeliveryPointId);
    }
    if (initialNote !== undefined) {
      setNote(initialNote);
    }
  }, [initialOrderItems, initialDealerId, initialDeliveryPointId, initialNote, products]);

  const isCustomer = Boolean(
    currentUser?.role === 'customer' ||
    currentUser?.role === 'agent' ||
    (currentUser?.roles && (currentUser.roles.includes('customer') || currentUser.roles.includes('agent')))
  );

  // RBAC Guard: Chỉ Sales và Admin mới được sửa giá và xem cảnh báo giá sàn
  const canEditPrice = Boolean(
    currentUser &&
    ['admin', 'sales_manager', 'sales'].some((r) =>
      currentUser.role === r || (currentUser.roles && currentUser.roles.includes(r))
    )
  );

  const selectedDealer = dealers.find((d) => d.id === dealerId) || dealers[0];
  const isLockedDealer = Boolean(
    selectedDealer?.status &&
    (selectedDealer.status.toLowerCase().includes('khóa') ||
      selectedDealer.status.toLowerCase().includes('lock'))
  );

  // Helper tìm đại lý tương ứng với tài khoản đại lý đang đăng nhập
  const findCustomerOwnDealer = useCallback((itemsList: any[]) => {
    if (!currentUser || !itemsList || itemsList.length === 0) return null;
    return itemsList.find((d: any) =>
      d.id === currentUser.id ||
      (d.code && currentUser.username && d.code.toLowerCase() === currentUser.username.toLowerCase()) ||
      (d.email && currentUser.email && d.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      (d.phone && currentUser.phone && d.phone === currentUser.phone) ||
      (d.name && currentUser.full_name && d.name.toLowerCase() === currentUser.full_name.toLowerCase())
    ) || itemsList[0];
  }, [currentUser]);

  // Tải chính sách chiết khấu
  useEffect(() => {
    if (token) {
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
        .catch(() => { });
    }
  }, [token]);

  // Tải lịch sử mua hàng và gợi ý mặt hàng theo đại lý
  useEffect(() => {
    if (!token || !dealerId) {
      setPurchaseHistory(null);
      setHistoryForbidden(false);
      setIsLoadingHistory(false);
      return;
    }
    let isMounted = true;
    setIsLoadingHistory(true);
    setHistoryForbidden(false);

    getDealerPurchaseHistoryApi(token, Number(dealerId))
      .then((history) => {
        if (!isMounted) return;
        setPurchaseHistory(history);
        setHistoryForbidden(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setPurchaseHistory(null);
        if (err instanceof Error && (err.message.includes('phân công') || err.message.includes('403'))) {
          setHistoryForbidden(true);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token, dealerId]);

  // Tải danh sách đại lý
  useEffect(() => {
    if (token) {
      setLoadingDealers(true);
      searchDealers(token)
        .then((res) => {
          const items = res.items || [];
          if (items.length > 0) {
            setDealers(items);
            if (isCustomer) {
              const own = findCustomerOwnDealer(items);
              if (own) setDealerId(own.id);
            } else {
              setDealerId((prev) => (items.some((d) => d.id === prev) ? prev : items[0].id));
            }
          } else {
            getDealersApi(token)
              .then((dList) => {
                if (dList && dList.length > 0) {
                  setDealers(dList);
                  if (isCustomer) {
                    const own = findCustomerOwnDealer(dList);
                    if (own) setDealerId(own.id);
                  } else {
                    setDealerId((prev) => (dList.some((d) => d.id === prev) ? prev : dList[0].id));
                  }
                }
              })
              .catch(() => { });
          }
        })
        .catch(() => {
          getDealersApi(token)
            .then((dList) => {
              if (dList && dList.length > 0) {
                setDealers(dList);
                if (isCustomer) {
                  const own = findCustomerOwnDealer(dList);
                  if (own) setDealerId(own.id);
                } else {
                  setDealerId((prev) => (dList.some((d) => d.id === prev) ? prev : dList[0].id));
                }
              }
            })
            .catch(() => { });
        })
        .finally(() => {
          setLoadingDealers(false);
        });
    }
  }, [token, isCustomer, findCustomerOwnDealer]);

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

  // Tải tồn kho khả dụng của kho phục vụ cho đại lý được chọn
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
        console.warn('Could not load dealer stock summary in page:', err);
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

  // Tải thông tin công nợ, hạn mức & nợ quá hạn
  useEffect(() => {
    if (!dealerId || !token) {
      setCreditInfo(null);
      return;
    }
    let isCancelled = false;
    setIsLoadingCredit(true);
    getDealerCreditInfoApi(token, dealerId)
      .then((info) => {
        if (!isCancelled) {
          setCreditInfo(info);
        }
      })
      .catch((err) => {
        console.warn('Could not load dealer credit info in page:', err);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingCredit(false);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [dealerId, token]);

  const stockMap = useMemo(() => {
    const map = new Map<number, { actual_stock: number; reserved_stock: number; available_stock: number }>();
    if (!stockSummary?.items) return map;
    for (const item of stockSummary.items) {
      map.set(item.product_id, item);
    }
    return map;
  }, [stockSummary]);

  const hasStockErrors = useMemo(() => {
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

  // Nhóm khách hàng
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

  // Thêm sản phẩm từ Dropdown phân trang (nhận ProductItem trực tiếp)
  const handleSelectProductItem = async (prod: ProductItem) => {
    if (!prod) return;

    // Lưu vào cache để các phần khác luôn tra cứu được thông tin sản phẩm
    setLoadedProductsMap((prev) => {
      const next = new Map(prev);
      next.set(prod.id, prod);
      return next;
    });

    const existingIndex = orderItems.findIndex((item) => item.productId === prod.id);
    if (existingIndex >= 0) {
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
      emitStatusToast({
        title: 'Đã tăng số lượng',
        message: `Đã tăng thêm 1 cho "${prod.name}".`,
      });
      return;
    }

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
        emitStatusToast({
          title: 'Chặn thêm sản phẩm',
          message: `Sản phẩm [${prod.code}] chưa có bảng giá đang hiệu lực cho nhóm khách hàng này. Vui lòng kiểm tra lại cấu hình giá.`,
          type: 'error',
        });
        return;
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
    emitStatusToast({
      title: 'Đã thêm sản phẩm',
      message: `Đã thêm "${prod.name}" vào đơn hàng.`,
    });
  };

  // Thêm nhanh một mặt hàng từ lịch sử
  const handleAddHistoryItem = async (item: PurchaseHistoryItem) => {
    const prod = products.find((p) => p.id === item.product_id) || loadedProductsMap.get(item.product_id);
    const qtyToAdd = Math.max(1, Math.round(item.last_order_quantity || item.avg_quantity || 1));
    const baseUnit = prod?.base_unit || item.unit || 'Cái';
    const itemUnit = item.unit || baseUnit;

    const existingIndex = orderItems.findIndex((it) => it.productId === item.product_id && it.unitName === itemUnit);
    if (existingIndex >= 0) {
      setOrderItems((prev) =>
        prev.map((it, idx) => {
          if (idx !== existingIndex) return it;
          const currentQty = typeof it.quantity === 'number' ? it.quantity : parseFloat(it.quantity) || 0;
          return {
            ...it,
            quantity: currentQty + qtyToAdd,
          };
        })
      );
      emitStatusToast({
        title: 'Đã cập nhật số lượng',
        message: `Đã tăng thêm ${qtyToAdd} ${itemUnit} cho "${item.product_name}".`,
      });
      return;
    }

    const units = prod
      ? [
        { unit_name: baseUnit, conversion_rate: 1.0, is_base: true },
        ...(prod.units || []).map((u) => ({
          unit_name: u.unit_name,
          conversion_rate: u.conversion_rate,
          is_base: false,
        })),
      ]
      : [{ unit_name: itemUnit, conversion_rate: item.conversion_rate || 1.0, is_base: true }];

    let itemSellPrice = item.price || prod?.sell_price || 0;
    let itemFloorPrice: number | null = prod?.sell_price || item.price || 0;
    let itemNote: string | undefined = undefined;

    if (dealerId) {
      try {
        const res = await resolvePriceApi(token, dealerId, item.product_id);
        itemSellPrice = res.sale_price;
        itemFloorPrice = res.floor_price;
        itemNote = res.price_book_name || res.price_book_code;
      } catch {
        // fallback
      }
    }

    const newItem: SelectedOrderItem = {
      productId: item.product_id,
      productCode: item.product_code,
      productName: item.product_name,
      stock: prod?.stock ?? 999,
      baseUnit,
      unitName: itemUnit,
      conversionRate: item.conversion_rate || 1.0,
      availableUnits: units,
      quantity: qtyToAdd,
      sellPrice: itemSellPrice,
      floorPrice: itemFloorPrice,
      priceNote: itemNote,
    };

    setOrderItems((prev) => [...prev, newItem]);
    emitStatusToast({
      title: 'Đã thêm sản phẩm',
      message: `Đã thêm "${item.product_name}" (${qtyToAdd} ${itemUnit}) vào đơn hàng.`,
    });
  };

  // Thêm nhanh cả nhóm hàng đã mua lần trước
  const handleAddAllPreviousItems = async () => {
    if (!purchaseHistory) return;
    const itemsToAdd = (purchaseHistory.last_order_items && purchaseHistory.last_order_items.length > 0)
      ? purchaseHistory.last_order_items
      : purchaseHistory.items.map((it) => ({
        product_id: it.product_id,
        product_code: it.product_code,
        product_name: it.product_name,
        quantity: it.last_order_quantity || it.avg_quantity || 1,
        price: it.price,
        unit: it.unit,
        conversion_rate: it.conversion_rate || 1,
      }));

    if (itemsToAdd.length === 0) {
      emitStatusToast({
        title: 'Thông báo',
        message: 'Không tìm thấy nhóm hàng từ lần mua trước để thêm.',
      });
      return;
    }

    const updated = [...orderItems];

    for (const item of itemsToAdd) {
      const prod = products.find((p) => p.id === item.product_id) || loadedProductsMap.get(item.product_id);
      const qtyToAdd = Math.max(1, Math.round(item.quantity || 1));
      const baseUnit = prod?.base_unit || item.unit || 'Cái';
      const itemUnit = item.unit || baseUnit;

      const existingIndex = updated.findIndex((it) => it.productId === item.product_id && it.unitName === itemUnit);
      if (existingIndex >= 0) {
        const cur = updated[existingIndex];
        const currentQty = typeof cur.quantity === 'number' ? cur.quantity : parseFloat(cur.quantity) || 0;
        updated[existingIndex] = {
          ...cur,
          quantity: currentQty + qtyToAdd,
        };
      } else {
        const units = prod
          ? [
            { unit_name: baseUnit, conversion_rate: 1.0, is_base: true },
            ...(prod.units || []).map((u) => ({
              unit_name: u.unit_name,
              conversion_rate: u.conversion_rate,
              is_base: false,
            })),
          ]
          : [{ unit_name: itemUnit, conversion_rate: item.conversion_rate || 1.0, is_base: true }];

        let itemSellPrice = item.price || prod?.sell_price || 0;
        let itemFloorPrice: number | null = prod?.sell_price || item.price || 0;
        let itemNote: string | undefined = undefined;

        if (dealerId) {
          try {
            const res = await resolvePriceApi(token, dealerId, item.product_id);
            itemSellPrice = res.sale_price;
            itemFloorPrice = res.floor_price;
            itemNote = res.price_book_name || res.price_book_code;
          } catch {
            // fallback
          }
        }

        updated.push({
          productId: item.product_id,
          productCode: item.product_code,
          productName: item.product_name,
          stock: prod?.stock ?? 999,
          baseUnit,
          unitName: itemUnit,
          conversionRate: item.conversion_rate || 1.0,
          availableUnits: units,
          quantity: qtyToAdd,
          sellPrice: itemSellPrice,
          floorPrice: itemFloorPrice,
          priceNote: itemNote,
        });
      }
    }

    setOrderItems(updated);
    emitStatusToast({
      title: 'Đã thêm nhóm hàng',
      message: `Đã thêm nhanh cả nhóm ${itemsToAdd.length} mặt hàng đã mua lần trước vào đơn mới!`,
    });
  };

  const handleQuantityChange = (index: number, val: string | number) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: val } : item))
    );
  };

  const handleQuantityStep = (index: number, delta: number) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const currentQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
        const newQty = Math.max(1, Math.round((currentQty + delta) * 1000) / 1000);
        return { ...item, quantity: newQty };
      })
    );
  };

  const handlePriceChange = (index: number, val: number) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, sellPrice: val } : item))
    );
  };

  const handleUnitChange = (index: number, unitName: string) => {
    setOrderItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const available = item.availableUnits || [];
        const targetUnit = available.find((u) => u.unit_name === unitName);
        return {
          ...item,
          unitName,
          conversionRate: targetUnit?.conversion_rate || 1.0,
        };
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Tính toán tiền hàng và số lượng
  const subtotalAmount = orderItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    const price = typeof item.sellPrice === 'number' ? item.sellPrice : parseFloat(item.sellPrice as any) || 0;
    return sum + (Number.isFinite(qty * price) ? qty * price : 0);
  }, 0);

  const totalQuantity = orderItems.reduce((sum, item) => {
    const qty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);

  const isAnyBelowFloorPrice = orderItems.some((item) => {
    const floorVal = item.floorPrice !== null && item.floorPrice !== undefined ? Number(item.floorPrice) : null;
    const price = typeof item.sellPrice === 'number' ? item.sellPrice : parseFloat(item.sellPrice as any) || 0;
    return floorVal !== null && price < floorVal;
  });

  const discountEvaluation = useMemo(() => {
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

  // Phân quyền
  const rawRoles = currentUser?.roles && currentUser.roles.length > 0 ? currentUser.roles : (currentUser?.role ? [currentUser.role] : []);
  const isSalesOrAdmin = !currentUser || rawRoles.some((r) => ['sales', 'sales_manager', 'admin'].includes(r));
  const isCustomerRole = Boolean(
    currentUser && (
      currentUser.role === 'customer' ||
      currentUser.role === 'agent' ||
      rawRoles.includes('customer') ||
      rawRoles.includes('agent')
    )
  );
  const isStrictlyBlockedRole = Boolean(
    currentUser &&
    rawRoles.some((r) => ['muahang', 'purchasing', 'kho', 'warehouse', 'warehouse_manager', 'ketoan', 'accountant'].includes(r)) &&
    !isSalesOrAdmin &&
    !isCustomerRole
  );
  const canCreateOrder = (isSalesOrAdmin || isCustomerRole) && !isStrictlyBlockedRole;

  // Kiểm tra công nợ
  const isOverdueBlocked = Boolean(
    creditInfo?.is_overdue ||
    (creditInfo && creditInfo.max_debt_age > (creditInfo.overdue_days_allowed || 30))
  );
  const isOverLimit = Boolean(
    creditInfo &&
    creditInfo.credit_limit > 0 &&
    (creditInfo.current_debt + totalAmount > creditInfo.credit_limit)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedDealer) {
      setErrorMsg('Vui lòng chọn khách hàng / đại lý.');
      return;
    }

    if (isLockedDealer) {
      setErrorMsg(`Đại lý "${selectedDealer?.name}" hiện đang bị KHÓA giao dịch. Không thể tạo đơn hàng mới.`);
      emitStatusToast({
        title: 'Đại lý bị khóa giao dịch',
        message: `Đại lý "${selectedDealer?.name}" hiện đang bị KHÓA giao dịch. Vui lòng liên hệ quản trị viên.`,
        type: 'error',
      });
      return;
    }

    if (!canCreateOrder) {
      setErrorMsg('Bạn không có quyền tạo đơn hàng. Chức năng chỉ dành cho Nhân viên kinh doanh, Quản trị hệ thống và Đại lý.');
      return;
    }

    if (isOverdueBlocked) {
      const overdueDays = creditInfo?.max_debt_age || 0;
      const maxAllowed = creditInfo?.overdue_days_allowed || 30;
      const overdueMsg = `Đại lý "${selectedDealer?.name}" có khoản nợ quá hạn (${overdueDays} ngày, vượt mức cho phép ${maxAllowed} ngày). Hệ thống chặn tạo đơn hàng hoàn toàn!`;
      setErrorMsg(overdueMsg);
      emitStatusToast({
        title: 'Chặn tạo đơn do nợ quá hạn',
        message: overdueMsg,
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
      const stockItem = stockMap.get(item.productId);
      if (stockItem) {
        const rate = item.conversionRate || 1;
        const maxOrderable = Math.max(0, Math.floor(stockItem.available_stock / rate));
        if (q > maxOrderable) {
          const warehouseName = stockSummary?.warehouse_name || 'kho';
          const msg = `Sản phẩm "${item.productName}" vượt quá tồn khả dụng tại ${warehouseName}. Số lượng tối đa có thể đặt: ${maxOrderable} ${item.unitName}.`;
          setErrorMsg(msg);
          emitStatusToast({
            title: 'Vượt tồn khả dụng',
            message: msg,
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
        const reasonText = (res as any).approval_reason
          ? `: ${(res as any).approval_reason}.`
          : ' do có chiết khấu hoặc đơn giá bán vượt mức quy định.';
        emitStatusToast({
          title: 'Đơn hàng chuyển sang Chờ quản lý duyệt',
          message: `Đơn ${res.order_code} đã được tạo thành công và chuyển sang trạng thái Chờ quản lý duyệt${reasonText}`,
        });
      } else {
        emitStatusToast({
          title: 'Tạo đơn hàng thành công',
          message: `Đơn ${res.order_code} đã được tạo thành công với ${orderItems.length} sản phẩm (${totalQuantity} đơn vị). Tổng giá trị: ${totalAmount.toLocaleString('vi-VN')} đồng.`,
        });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/orders');
      }
    } catch (err: any) {
      const msg = err.message || 'Lỗi khi tạo đơn hàng';
      setErrorMsg(msg);
      emitStatusToast({
        title: msg.includes('quá hạn') ? 'Chặn tạo đơn do nợ quá hạn' : (msg.includes('vượt quá tồn') ? 'Vượt tồn khả dụng' : 'Lỗi tạo đơn hàng'),
        message: msg,
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 overflow-y-auto bg-slate-50 flex flex-col min-h-full">
      {/* 1. Header Trang Độc Lập */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-4 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancelNavigation}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
              title="Quay lại danh sách đơn hàng"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              <span>Quay lại</span>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Tạo Đơn Hàng Mới
              </h1>
            </div>
          </div>

          {currentUser && (
            <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full text-xs text-slate-600 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>
                Người tạo: <strong className="text-slate-800">{currentUser.full_name || currentUser.username}</strong> ({currentUser.role})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Form */}
      <form onSubmit={handleSubmit} className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6 pb-28">
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2 shadow-xs">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* BỐ TRÍ 2 CỘT HIỆN ĐẠI (SPLIT-SCREEN WORKSPACE)          */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CỘT TRÁI (LỚN): NHẬP LIỆU & GIỎ HÀNG (7 CỘT LG / 8 CỘT XL) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">

            {/* 1. THÔNG TIN KHÁCH HÀNG & GIAO HÀNG */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                  <span className="w-2 h-5 bg-emerald-500 rounded-full inline-block"></span>
                  <span>Thông tin Khách hàng & Giao hàng</span>
                </div>
                <span
                  id="badge-customer-group"
                  style={{
                    background: groupInfo.badgeBg,
                    color: groupInfo.badgeColor,
                    border: `1px solid ${groupInfo.borderColor}`,
                  }}
                  className="px-3 py-1 rounded-full text-xs font-bold"
                >
                  Nhóm: {groupInfo.label}
                </span>
              </div>

              {/* Chọn đại lý */}
              <div>
                <label htmlFor="select-dealer-customer" className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                  Khách Hàng / Đại Lý <span className="text-red-500">*</span>
                </label>
                <select
                  id="select-dealer-customer"
                  value={dealerId}
                  onChange={(e) => setDealerId(parseInt(e.target.value, 10))}
                  disabled={loadingDealers || dealers.length === 0 || isCustomer || dealers.length === 1}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
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

                {isCustomer && (
                  <div className="mt-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs sm:text-[13px] text-emerald-800 flex items-center gap-2">
                    <span className="font-bold">✓ Cổng Đại lý tự đặt hàng:</span>
                    <span>Đơn hàng được liên kết với <strong>{selectedDealer?.name || currentUser?.full_name}</strong></span>
                  </div>
                )}

                {/* Kho phục vụ riêng */}
                {stockSummary && (
                  <div className="mt-2.5 flex items-center justify-between text-xs text-sky-800 bg-sky-50 border border-sky-200 px-3.5 py-2 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">Kho phục vụ chỉ định:</span>
                      <strong className="text-sky-900">{stockSummary.warehouse_name}</strong>
                      <span className="text-sky-600">({stockSummary.warehouse_id})</span>
                    </div>
                    {isLoadingStock && <span className="text-sky-600 italic">(Đang kiểm tra tồn...)</span>}
                  </div>
                )}

                {isLockedDealer && (
                  <div className="mt-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs sm:text-[13px] text-red-700 flex items-center gap-2 font-semibold">
                    <span>⚠️ Đại lý này hiện đang ở trạng thái <strong>Đã khóa</strong>. Hệ thống chặn tạo đơn hàng mới!</span>
                  </div>
                )}
              </div>

              {/* Grid 2 cột cho Điểm giao hàng & Ghi chú */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 items-stretch">
                {/* Điểm giao hàng */}
                <div className="flex flex-col">
                  <label className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                    Điểm giao hàng
                  </label>
                  <select
                    value={deliveryPointId ?? ''}
                    onChange={(e) => setDeliveryPointId(e.target.value ? Number(e.target.value) : null)}
                    disabled={points.length === 0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all disabled:bg-slate-100"
                  >
                    {points.length === 0 && <option value="">Đại lý chưa có điểm giao hàng cụ thể</option>}
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} - {p.address} {p.is_default ? ' (Mặc định)' : ''}
                      </option>
                    ))}
                  </select>

                  {(() => {
                    const selected = points.find((pt) => pt.id === deliveryPointId);
                    if (!selected) return null;
                    return (
                      <div className="mt-2.5 p-3 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-1 text-xs flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-2 font-bold text-slate-800">
                          <span>{selected.label}</span>
                          {selected.is_default && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10.5px] font-semibold">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600">Địa chỉ: <span className="font-medium">{selected.address}</span></div>
                        <div className="text-slate-500">
                          Người nhận: <span className="font-medium text-slate-700">{selected.receiver_name || '—'}</span> {selected.receiver_phone ? `(${selected.receiver_phone})` : ''}
                        </div>
                        {selected.route_note && (
                          <div className="text-slate-500 italic text-[11px]">Ghi chú tuyến: {selected.route_note}</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Ghi chú */}
                <div className="flex flex-col">
                  <label htmlFor="input-order-note" className="block text-xs sm:text-sm font-bold text-slate-700 mb-1.5">
                    Ghi chú đơn hàng / Lý do điều chỉnh
                  </label>
                  <textarea
                    id="input-order-note"
                    placeholder="Nhập ghi chú vận chuyển, yêu cầu hóa đơn hoặc lý do nếu có điều chỉnh giá..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full flex-1 min-h-[96px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  />
                </div>
              </div>
            </div>

            {/* 2. SẢN PHẨM & GIỎ HÀNG */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                  <span className="w-2 h-5 bg-indigo-500 rounded-full inline-block"></span>
                  <span>Sản Phẩm & Giỏ Hàng Đặt Hàng ({orderItems.length})</span>
                </div>
                {orderItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOrderItems([])}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    Xóa tất cả mặt hàng
                  </button>
                )}
              </div>

              {/* Gợi ý mặt hàng thường lấy từ lịch sử 3 tháng */}
              {selectedDealer && !historyForbidden && purchaseHistory && purchaseHistory.has_history && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <span>Gợi ý mặt hàng thường lấy (3 tháng gần nhất)</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold">
                          {purchaseHistory.total_orders_3_months} đơn
                        </span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Thêm nhanh sản phẩm theo mức tiêu thụ bình quân hoặc lần mua gần nhất
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAllPreviousItems}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
                    >
                      <span>Thêm nhanh toàn bộ đơn trước</span>
                      <span className="px-1.5 py-0.2 bg-blue-800 rounded-full text-[10.5px]">
                        {purchaseHistory.last_order_items?.length || purchaseHistory.items.length} món
                      </span>
                    </button>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                          <th className="p-2.5">Mã SP</th>
                          <th className="p-2.5">Tên sản phẩm</th>
                          <th className="p-2.5 text-center">ĐVT</th>
                          <th className="p-2.5 text-center">SL Bình quân</th>
                          <th className="p-2.5 text-center">SL Lần trước</th>
                          <th className="p-2.5 text-right">Đơn giá</th>
                          <th className="p-2.5 text-center">Hành động</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {purchaseHistory.items.map((item) => (
                          <tr key={item.product_id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-2.5 font-mono font-semibold text-slate-700">{item.product_code}</td>
                            <td className="p-2.5 font-medium text-slate-900">{item.product_name}</td>
                            <td className="p-2.5 text-center text-slate-500">{item.unit}</td>
                            <td className="p-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                                {item.avg_quantity} {item.unit}
                              </span>
                            </td>
                            <td className="p-2.5 text-center text-slate-700 font-semibold">
                              {item.last_order_quantity > 0 ? `${item.last_order_quantity} ${item.unit}` : '—'}
                            </td>
                            <td className="p-2.5 text-right font-semibold text-slate-800">
                              {item.price.toLocaleString('vi-VN')} đ
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleAddHistoryItem(item)}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-md font-bold transition-colors cursor-pointer text-[11px]"
                              >
                                + Thêm
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ô Chọn sản phẩm to và rõ ràng */}
              <div className="space-y-1.5">
                <label htmlFor="select-order-product" className="block text-xs sm:text-sm font-bold text-slate-800">
                  Chọn sản phẩm để thêm vào đơn <span className="text-red-500">*</span>
                </label>
                <ProductInfiniteSelect
                  id="select-order-product"
                  token={token}
                  orderItems={orderItems}
                  onSelectProduct={handleSelectProductItem}
                />
                <p className="text-[11.5px] text-slate-500 italic">
                  * Sau khi chọn, sản phẩm sẽ tự động thêm vào danh sách bên dưới và ô chọn sẽ được làm mới sẵn sàng cho mặt hàng tiếp theo.
                </p>
              </div>

              {/* Bảng Giỏ Hàng Thoáng Đãng */}
              {orderItems.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50/70 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 space-y-2">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-slate-400">
                    <circle cx="8" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                  </svg>
                  <div className="font-semibold text-slate-700 text-sm">Chưa có sản phẩm nào trong đơn hàng</div>
                  <div className="text-xs text-slate-400">Vui lòng sử dụng ô chọn sản phẩm phía trên để đưa hàng vào danh sách.</div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse min-w-[720px]">
                      <thead>
                        <tr className="bg-slate-100/80 text-slate-600 text-xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                          <th className="py-3.5 px-4 font-bold">Sản Phẩm & Kho Phục Vụ</th>
                          <th className="py-3.5 px-3 text-center font-bold w-32">ĐVT</th>
                          <th className="py-3.5 px-3 text-center font-bold w-36">Số Lượng</th>
                          <th className="py-3.5 px-4 text-right font-bold w-40">Đơn Giá Thực Tế</th>
                          <th className="py-3.5 px-4 text-right font-bold w-36">Thành Tiền</th>
                          <th className="py-3.5 px-2 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orderItems.map((item, idx) => {
                          const itemQty = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 0;
                          const itemPrice = typeof item.sellPrice === 'number' ? item.sellPrice : parseFloat(item.sellPrice as any) || 0;
                          const itemTotal = Number.isFinite(itemQty * itemPrice) ? itemQty * itemPrice : 0;
                          const floorVal = item.floorPrice !== null && item.floorPrice !== undefined ? Number(item.floorPrice) : null;
                          const isBelowFloor = canEditPrice && floorVal !== null && itemPrice < floorVal;
                          const stockItem = stockMap.get(item.productId);
                          const rate = item.conversionRate || 1;
                          const maxOrderable = stockItem ? Math.max(0, Math.floor(stockItem.available_stock / rate)) : undefined;
                          const actualInUnit = stockItem ? Math.floor(stockItem.actual_stock / rate) : undefined;
                          const reservedInUnit = stockItem ? Math.floor(stockItem.reserved_stock / rate) : undefined;
                          const isExceeded = stockItem !== undefined && maxOrderable !== undefined && itemQty > maxOrderable;

                          return (
                            <tr
                              key={item.productId || idx}
                              className={`transition-colors ${isExceeded ? 'bg-red-50/60' : isBelowFloor ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'
                                }`}
                            >
                              {/* Cột 1: Thông tin sản phẩm & Kho */}
                              <td className="py-3.5 px-4 align-middle">
                                <div className="font-bold text-slate-900 text-sm leading-snug">
                                  {item.productName || 'Sản phẩm chưa rõ tên'}
                                </div>
                                <div className="text-xs text-slate-500 font-mono mt-0.5">
                                  Mã: {item.productCode || '---'}
                                </div>

                                {/* Tồn kho chi tiết */}
                                {stockItem ? (
                                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span
                                      className={`px-2 py-0.5 rounded-full font-semibold ${isExceeded
                                        ? 'bg-red-100 text-red-700 font-bold border border-red-300'
                                        : (maxOrderable ?? 0) <= 0
                                          ? 'bg-red-50 text-red-600 border border-red-200'
                                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        }`}
                                    >
                                      Khả dụng: <strong>{maxOrderable ?? 0}</strong> {item.unitName || item.baseUnit || 'Cái'}
                                    </span>
                                    <span className="text-slate-400">
                                      (Thực tế: {actualInUnit ?? 0} | Đặt giữ: {reservedInUnit ?? 0})
                                    </span>
                                    {isExceeded && (
                                      <span className="text-red-600 font-bold ml-1">
                                        ⚠️ Vượt tồn khả dụng!
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-[11px] text-slate-400 italic">
                                    Đang kiểm tra tồn khả dụng...
                                  </div>
                                )}
                              </td>

                              {/* Cột 2: Đơn vị tính */}
                              <td className="py-3.5 px-3 text-center align-middle">
                                {item.availableUnits && item.availableUnits.length > 1 ? (
                                  <select
                                    value={item.unitName}
                                    onChange={(e) => handleUnitChange(idx, e.target.value)}
                                    className="h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer shadow-2xs"
                                  >
                                    {(item.availableUnits || []).map((u) => (
                                      <option key={u.unit_name} value={u.unit_name}>
                                        {u.unit_name} (x{u.conversion_rate})
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="inline-flex items-center justify-center h-9 px-3 rounded-lg bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200">
                                    {item.unitName || item.baseUnit || 'Cái'}
                                  </span>
                                )}
                              </td>

                              {/* Cột 3: Số lượng (+/- stepper) */}
                              <td className="py-3.5 px-3 text-center align-middle">
                                <div className="inline-flex items-center h-9 border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityStep(idx, -1)}
                                    className="w-8 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors font-bold text-base cursor-pointer select-none"
                                    title="Giảm số lượng"
                                  >
                                    −
                                  </button>
                                  <input
                                    type="number"
                                    min="0.001"
                                    step="any"
                                    value={item.quantity === 0 ? '' : item.quantity}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                    onBlur={() => {
                                      if (!item.quantity || Number(item.quantity) <= 0) {
                                        handleQuantityChange(idx, 1);
                                      }
                                    }}
                                    className="w-14 h-9 text-center font-bold text-slate-800 text-sm focus:outline-none focus:bg-emerald-50/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    title="Nhập số lượng"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQuantityStep(idx, 1)}
                                    className="w-8 h-9 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors font-bold text-base cursor-pointer select-none"
                                    title="Tăng số lượng"
                                  >
                                    +
                                  </button>
                                </div>
                              </td>

                              {/* Cột 4: Đơn giá */}
                              <td className="py-3.5 px-4 text-right align-middle">
                                <div className="flex flex-col items-end justify-center">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1000"
                                    readOnly={!canEditPrice}
                                    value={item.sellPrice}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => canEditPrice && handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                                    className={`h-9 w-32 px-3 rounded-lg border text-right font-bold text-sm focus:outline-none focus:ring-2 shadow-2xs ${isBelowFloor
                                      ? 'border-amber-400 text-amber-700 bg-amber-50 focus:ring-amber-400'
                                      : 'border-slate-300 text-slate-900 focus:ring-emerald-500'
                                      } ${!canEditPrice ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'bg-white'}`}
                                    title={
                                      !canEditPrice
                                        ? 'Chỉ Sales và Admin được sửa giá'
                                        : floorVal !== null
                                          ? `Giá sàn: ${floorVal.toLocaleString('vi-VN')} đ`
                                          : undefined
                                    }
                                  />
                                  {isBelowFloor && (
                                    <div className="text-[10.5px] text-amber-600 font-semibold mt-1">
                                      Dưới giá sàn ({floorVal !== null ? floorVal.toLocaleString('vi-VN') : 0} đ)
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Cột 5: Thành tiền */}
                              <td className="py-3.5 px-4 text-right align-middle font-extrabold text-slate-900 text-sm whitespace-nowrap">
                                {itemTotal.toLocaleString('vi-VN')} đ
                              </td>

                              {/* Cột 6: Xóa */}
                              <td className="py-3.5 px-2 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="w-9 h-9 inline-flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Xóa mặt hàng khỏi đơn"
                                >
                                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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
          </div>

          {/* CỘT PHẢI (SIDEBAR): CÔNG NỢ & QUYẾT TOÁN & TẠO ĐƠN (5 CỘT LG / 4 CỘT XL, STICKY) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 lg:sticky lg:top-24">

            {/* CARD 1: CÔNG NỢ ĐẠI LÝ */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                    <span className="w-2 h-5 bg-blue-500 rounded-full inline-block"></span>
                    <span>Tình trạng Công nợ Đại lý</span>
                  </div>
                  {isLoadingCredit && <span className="text-xs text-blue-600 italic">Đang tải...</span>}
                </div>

                {/* Khối Card gộp 3 chỉ số công nợ */}
                {isLoadingCredit ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Đang kiểm tra hạn mức & công nợ đại lý...</span>
                  </div>
                ) : creditInfo ? (
                  <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 shadow-2xs">
                    {/* Hàng 1: Hạn mức được cấp */}
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                      <span className="text-xs sm:text-sm font-medium text-slate-600">Hạn mức được cấp</span>
                      <span className="text-sm sm:text-base font-semibold text-slate-800">
                        {creditInfo.credit_limit > 0
                          ? `${creditInfo.credit_limit.toLocaleString('vi-VN')} đ`
                          : 'Không giới hạn'}
                      </span>
                    </div>

                    {/* Hàng 2: Dư nợ hiện tại */}
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-100">
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-slate-600">Dư nợ hiện tại</span>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Tuổi nợ: <strong className={isOverdueBlocked ? 'text-red-600' : 'text-slate-600'}>{creditInfo.max_debt_age || 0} ngày</strong>
                          {creditInfo.overdue_days_allowed ? ` (cho phép ${creditInfo.overdue_days_allowed} ngày)` : ''}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm sm:text-base font-bold ${creditInfo.current_debt > 0 ? (isOverdueBlocked ? 'text-red-600' : 'text-amber-600') : 'text-slate-700'}`}>
                          {creditInfo.current_debt.toLocaleString('vi-VN')} đ
                        </span>
                      </div>
                    </div>

                    {/* Hàng 3: Hạn mức còn lại */}
                    {(() => {
                      const remain = creditInfo.credit_limit > 0
                        ? creditInfo.credit_limit - creditInfo.current_debt - totalAmount
                        : null;
                      const isNegative = remain !== null && remain < 0;
                      return (
                        <div className="flex justify-between items-center py-2.5">
                          <div>
                            <span className="text-xs sm:text-sm font-semibold text-slate-700">Hạn mức còn lại</span>
                            {totalAmount > 0 && creditInfo.credit_limit > 0 && (
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Đã tính đơn này: -{totalAmount.toLocaleString('vi-VN')} đ
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className={`text-sm sm:text-base font-extrabold ${isNegative ? 'text-red-600' : 'text-emerald-600'}`}>
                              {remain !== null ? `${remain.toLocaleString('vi-VN')} đ` : 'Vô hạn'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Thanh Progress Bar siêu mỏng */}
                    {creditInfo.credit_limit > 0 && (() => {
                      const usedDebt = creditInfo.current_debt + totalAmount;
                      const percent = Math.min(100, Math.max(0, Math.round((usedDebt / creditInfo.credit_limit) * 100)));
                      const isExceeded = usedDebt > creditInfo.credit_limit;
                      const barColor = isExceeded
                        ? 'bg-red-500'
                        : percent > 80
                          ? 'bg-amber-500'
                          : 'bg-emerald-500';

                      return (
                        <div className="mt-2 pt-2 border-t border-slate-200/60">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span>Sử dụng hạn mức (gồm đơn này)</span>
                            <span className={`font-bold ${isExceeded ? 'text-red-600' : 'text-slate-700'}`}>
                              {percent}% {isExceeded ? '(Vượt hạn mức)' : ''}
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${barColor} rounded-full transition-all duration-300`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 text-center italic">
                    Chưa có thông tin công nợ cho khách hàng này
                  </div>
                )}

                {/* Cảnh báo nợ quá hạn */}
                {isOverdueBlocked && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs sm:text-[13px] text-red-700 font-semibold space-y-1">
                    <div className="flex items-center gap-1.5 text-red-800 font-bold">
                      <span>⛔ Chặn tạo đơn do Nợ quá hạn</span>
                    </div>
                    <p>
                      Đại lý có khoản nợ quá hạn <strong>{creditInfo?.max_debt_age || 0} ngày</strong> (vượt hạn mức tối đa {creditInfo?.overdue_days_allowed || 30} ngày). Vui lòng thanh toán công nợ cũ trước khi tạo đơn tiếp!
                    </p>
                  </div>
                )}

                {/* Cảnh báo vượt hạn mức */}
                {isOverLimit && !isOverdueBlocked && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs sm:text-[13px] text-amber-800 font-medium space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-900">
                      <span>⚠️ Đơn hàng vượt hạn mức công nợ</span>
                    </div>
                    <p>
                      Tổng giá trị đơn hàng cộng công nợ hiện tại vượt quá hạn mức cho phép. Đơn hàng sẽ yêu cầu Quản lý kinh doanh phê duyệt.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 italic">
                * Dữ liệu công nợ được đồng bộ tự động từ hệ thống sổ nợ đại lý
              </div>
            </div>

            {/* CARD 2: THANH TOÁN & ĐẶT HÀNG */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-base">
                  <span className="w-2 h-5 bg-emerald-500 rounded-full inline-block"></span>
                  <span>Thanh Toán & Đặt Hàng</span>
                </div>
                {discountEvaluation.isQualified && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    {discountEvaluation.label}
                  </span>
                )}
              </div>

              {/* Chiết khấu & Ưu đãi */}
              <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-order-discount-percent" className="text-xs font-bold text-slate-700">
                    Chiết khấu (%)
                  </label>
                  {isManualDiscount && discountEvaluation.isQualified && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualDiscount(false);
                        setDiscountPercent(String(discountEvaluation.discountPercent));
                      }}
                      className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      ↺ Theo chính sách ({discountEvaluation.discountPercent}%)
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
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
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-bold text-slate-800 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <div className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm font-extrabold text-emerald-600 flex items-center justify-end">
                      − {discountAmount.toLocaleString('vi-VN')} đ
                    </div>
                  </div>
                </div>

                {isManualDiscount && safeDiscount > discountEvaluation.discountPercent && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed">
                    ⚠️ Mức chiết khấu ({safeDiscount}%) cao hơn định mức ({discountEvaluation.discountPercent}%). Đơn hàng sẽ cần Quản lý bán hàng phê duyệt.
                  </div>
                )}

                {isAnyBelowFloorPrice && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 font-semibold leading-relaxed">
                    ⚠️ Có sản phẩm bán dưới giá sàn. Đơn hàng sẽ tự động chuyển sang Chờ duyệt.
                  </div>
                )}
              </div>

              {/* Bảng tổng kết tiền */}
              <div className="space-y-2.5 text-sm pt-1">
                <div className="flex justify-between text-slate-600">
                  <span>Tiền hàng ({orderItems.length} SP, {totalQuantity} món):</span>
                  <span className="font-bold text-slate-800">{subtotalAmount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Giảm trừ chiết khấu ({safeDiscount}%):</span>
                  <span className="font-bold text-emerald-600">− {discountAmount.toLocaleString('vi-VN')} đ</span>
                </div>
                <div className="pt-3 border-t border-slate-200 flex items-baseline justify-between">
                  <span className="text-base font-extrabold text-slate-900">Tổng thanh toán:</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-emerald-600 tracking-tight">
                      {totalAmount.toLocaleString('vi-VN')} đ
                    </div>
                    <div className="text-xs text-slate-400">Đã bao gồm chiết khấu</div>
                  </div>
                </div>
              </div>

              {/* Hàng nút bấm thao tác */}
              <div className="pt-3 border-t border-slate-100 flex flex-col gap-2.5">
                <button
                  id="btn-submit-order"
                  type="submit"
                  disabled={
                    isSubmitting ||
                    orderItems.length === 0 ||
                    isLockedDealer ||
                    hasStockErrors ||
                    isOverdueBlocked ||
                    !canCreateOrder
                  }
                  className={`w-full py-3 rounded-xl font-bold text-sm text-white shadow-md transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2 ${orderItems.length === 0 || isLockedDealer || hasStockErrors || isOverdueBlocked || !canCreateOrder
                    ? 'bg-slate-400'
                    : isAnyBelowFloorPrice || isOverLimit || isCustomerRole
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/30'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30'
                    }`}
                  title={
                    !canCreateOrder
                      ? 'Chỉ Nhân viên kinh doanh, Quản trị hệ thống và Đại lý mới có quyền tạo đơn'
                      : isOverdueBlocked
                        ? `Đại lý "${selectedDealer?.name}" có khoản nợ quá hạn, bị chặn tạo đơn hoàn toàn`
                        : isLockedDealer
                          ? `Đại lý "${selectedDealer?.name}" hiện đang bị khóa giao dịch`
                          : hasStockErrors
                            ? 'Có sản phẩm vượt quá tồn khả dụng kho phục vụ'
                            : undefined
                  }
                >
                  {isSubmitting ? (
                    <span className="inline-flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                      </svg>
                      Đang lưu đơn hàng...
                    </span>
                  ) : !canCreateOrder ? (
                    'Không có quyền tạo đơn'
                  ) : isOverdueBlocked ? (
                    'Bị chặn do nợ quá hạn'
                  ) : isLockedDealer ? (
                    'Đại lý bị khóa'
                  ) : hasStockErrors ? (
                    'Vượt tồn khả dụng'
                  ) : isCustomerRole ? (
                    `Tạo đơn hàng (Chờ duyệt)`
                  ) : isAnyBelowFloorPrice ? (
                    'Gửi duyệt (Dưới giá sàn)'
                  ) : isOverLimit ? (
                    'Tạo đơn (Cần duyệt do nợ)'
                  ) : (
                    `Tạo đơn hàng (${orderItems.length} SP)`
                  )}
                </button>

                <Link
                  to="/orders"
                  onClick={(e) => {
                    if (onClose) {
                      e.preventDefault();
                      onClose();
                    }
                  }}
                  className="w-full py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center no-underline inline-block"
                >
                  Hủy bỏ
                </Link>
              </div>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
};

export default CreateOrderPage;
