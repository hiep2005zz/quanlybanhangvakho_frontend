import { useEffect, useMemo, useState } from 'react';
import {
  createOrderApi,
  getOrderDealersApi,
  getDiscountPoliciesApi,
  DiscountPolicy,
  listDeliveryPointsApi,
  OrderDealer,
  ProductItem,
  getDealerPurchaseHistoryApi,
  DealerPurchaseHistory,
  PurchaseHistoryItem,
} from '../services/api';
import type { DeliveryPoint } from '../types/deliveryPoint';
import { evaluateBestDiscountPolicy, parseStoredPolicies } from '../utils/discountEngine';
import { emitStatusToast } from './StatusToast';
import './sales-order-entry.css';

interface SalesOrderEntryProps {
  token: string;
  username: string;
  products: ProductItem[];
  onClose?: () => void;
  onCreated: () => void;
}

interface OrderLine {
  productId: number;
  code: string;
  name: string;
  price: number;
  unit: string;
  conversionRate: number;
  quantity: number;
}

interface OrderDraft {
  id: string;
  dealerId: string;
  deliveryPoint: string;
  deliveryPointId?: number | null;
  desiredDeliveryDate: string;
  discountPercent: string;
  note: string;
  lines: OrderLine[];
  updatedAt: string;
}

const isOrderLine = (value: unknown): value is OrderLine => {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return typeof line.productId === 'number' &&
    typeof line.code === 'string' &&
    typeof line.name === 'string' &&
    typeof line.price === 'number' &&
    Number.isFinite(line.price) &&
    line.price >= 0 &&
    typeof line.unit === 'string' &&
    line.unit.length > 0 &&
    typeof line.conversionRate === 'number' &&
    Number.isFinite(line.conversionRate) &&
    line.conversionRate > 0 &&
    typeof line.quantity === 'number' &&
    Number.isInteger(line.quantity) &&
    line.quantity > 0;
};

const isOrderDraft = (value: unknown): value is OrderDraft => {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.id === 'string' &&
    typeof draft.dealerId === 'string' &&
    typeof draft.deliveryPoint === 'string' &&
    typeof draft.desiredDeliveryDate === 'string' &&
    typeof draft.discountPercent === 'string' &&
    typeof draft.note === 'string' &&
    typeof draft.updatedAt === 'string' &&
    Number.isFinite(Date.parse(draft.updatedAt)) &&
    Array.isArray(draft.lines) &&
    draft.lines.every(isOrderLine);
};

const ORDER_UNITS = ['Cái', 'Hộp', 'Thùng', 'Bộ', 'Đôi'];
const getAvailableUnits = (product?: ProductItem, fallbackUnit = 'Cái') => {
  const units = new Map<string, number>([[product?.base_unit || fallbackUnit, 1]]);
  ORDER_UNITS.forEach((unit) => {
    if (!units.has(unit)) units.set(unit, 1);
  });
  product?.units?.forEach((unit) => {
    if (unit.unit_name && Number.isFinite(unit.conversion_rate) && unit.conversion_rate > 0) {
      units.set(unit.unit_name, unit.conversion_rate);
    }
  });
  return Array.from(units, ([unit_name, conversion_rate]) => ({ unit_name, conversion_rate }));
};
const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const draftStorageKey = (username: string) => `sales-order-drafts:${encodeURIComponent(username.toLowerCase())}`;

export default function SalesOrderEntry({ token, username, products, onClose: _onClose, onCreated }: SalesOrderEntryProps) {
  const [dealers, setDealers] = useState<OrderDealer[]>([]);
  const [isLoadingDealers, setIsLoadingDealers] = useState(true);
  const [dealerLoadError, setDealerLoadError] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState('');
  const [deliveryPoint, setDeliveryPoint] = useState('');
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([]);
  const [isLoadingDeliveryPoints, setIsLoadingDeliveryPoints] = useState(false);
  const [deliveryPointId, setDeliveryPointId] = useState<number | null>(null);
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState(getToday);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [policies, setPolicies] = useState<DiscountPolicy[]>([]);
  const [isManualOverride, setIsManualOverride] = useState(false);
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<DealerPurchaseHistory | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyForbidden, setHistoryForbidden] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const localPolicies = parseStoredPolicies();
    if (localPolicies.length > 0) {
      setPolicies(localPolicies);
    }
    getDiscountPoliciesApi(token, { is_active: true })
      .then((result) => {
        if (isMounted && result.items) {
          const merged = [...result.items];
          localPolicies.forEach((lp) => {
            if (!merged.some((p) => p.code === lp.code)) {
              merged.push(lp);
            }
          });
          setPolicies(merged);
        }
      })
      .catch(() => {
        if (isMounted && localPolicies.length > 0) {
          setPolicies(localPolicies);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingDealers(true);
    getOrderDealersApi(token)
      .then((result) => {
        if (isMounted) {
          setDealers(result);
          setDealerLoadError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setDealerLoadError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách đại lý.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingDealers(false);
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!dealerId) {
      setDeliveryPoints([]);
      setDeliveryPointId(null);
      setDeliveryPoint('');
      return;
    }
    let isMounted = true;
    setIsLoadingDeliveryPoints(true);
    listDeliveryPointsApi(token, Number(dealerId))
      .then((points) => {
        if (!isMounted) return;
        setDeliveryPoints(points);
        // Tự động chọn điểm giao mặc định nếu có
        const defaultPt = points.find((p) => p.is_default && p.is_active);
        if (defaultPt) {
          setDeliveryPointId(defaultPt.id);
          setDeliveryPoint(`${defaultPt.label} — ${defaultPt.address}`);
        } else if (points.length > 0 && points[0].is_active) {
          setDeliveryPointId(points[0].id);
          setDeliveryPoint(`${points[0].label} — ${points[0].address}`);
        } else {
          const d = dealers.find((item) => String(item.id) === dealerId);
          setDeliveryPointId(null);
          setDeliveryPoint(d?.address || '');
        }
      })
      .catch((loadErr) => {
        console.error('Không thể tải điểm giao hàng:', loadErr);
        if (!isMounted) return;
        setDeliveryPoints([]);
        const d = dealers.find((item) => String(item.id) === dealerId);
        setDeliveryPointId(null);
        setDeliveryPoint(d?.address || '');
      })
      .finally(() => {
        if (isMounted) setIsLoadingDeliveryPoints(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dealerId, token, dealers]);
  useEffect(() => {
    if (!dealerId) {
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
        if (err instanceof Error && err.message.includes('phân công')) {
          setHistoryForbidden(true);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingHistory(false);
      });

    return () => {
      isMounted = false;
    };
  }, [dealerId, token]);

  useEffect(() => {
    try {
      const storedDrafts = localStorage.getItem(draftStorageKey(username));
      if (!storedDrafts) return;
      const parsed: unknown = JSON.parse(storedDrafts);
      const compatibleDrafts = Array.isArray(parsed) ? parsed.map((draft) => {
        if (typeof draft !== 'object' || draft === null || !Array.isArray((draft as Record<string, unknown>).lines)) {
          return draft;
        }
        const draftRecord = draft as Record<string, unknown>;
        return {
          ...draftRecord,
          lines: (draftRecord.lines as unknown[]).map((line) =>
            typeof line === 'object' && line !== null && !('conversionRate' in line)
              ? { ...line, conversionRate: 1 }
              : line
          ),
        };
      }) : parsed;
      if (!Array.isArray(compatibleDrafts) || !compatibleDrafts.every(isOrderDraft)) {
        throw new Error('Dữ liệu bản nháp không hợp lệ.');
      }
      setDrafts(compatibleDrafts);
    } catch (loadError) {
      setError(loadError instanceof Error ? `Không thể đọc bản nháp: ${loadError.message}` : 'Không thể đọc bản nháp đã lưu.');
    }
  }, [username]);

  const selectedDealer = dealers.find((dealer) => String(dealer.id) === dealerId);
  const deliveryPointSelectValue = useMemo(() => {
    if (deliveryPointId && deliveryPoints.some((p) => p.id === deliveryPointId)) {
      return `point_${deliveryPointId}`;
    }
    if (selectedDealer?.address && deliveryPoint === selectedDealer.address) {
      return 'dealer_address';
    }
    if (deliveryPoint) {
      return 'custom';
    }
    return '';
  }, [deliveryPointId, deliveryPoints, selectedDealer, deliveryPoint]);
  const searchResults = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase('vi');
    if (query.length < 1) return [];
    return products
      .filter((product) =>
        product.code.toLocaleLowerCase('vi').includes(query) ||
        product.name.toLocaleLowerCase('vi').includes(query)
      )
      .slice(0, 6);
  }, [productQuery, products]);

  const subtotal = lines.reduce((total, line) => total + line.quantity * line.price, 0);
  const totalQuantity = lines.reduce((total, line) => total + line.quantity, 0);

  // Tự động kiểm tra danh sách chính sách chiết khấu đang áp dụng theo Best Price Rule
  const discountEvaluation = useMemo(() => {
    return evaluateBestDiscountPolicy(
      policies,
      lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        price: line.price,
        name: line.name,
        code: line.code,
      })),
      selectedDealer
        ? {
            id: selectedDealer.id,
            customer_group: (selectedDealer as any).customer_group || '',
            name: selectedDealer.name,
          }
        : null,
      totalQuantity,
      subtotal
    );
  }, [policies, lines, selectedDealer, totalQuantity, subtotal]);

  // Tự động điền giá trị % vào ô "Chiết khấu (%)" khi số lượng thỏa mãn các bậc
  useEffect(() => {
    if (!isManualOverride) {
      if (discountEvaluation.isQualified) {
        setDiscountPercent(String(discountEvaluation.discountPercent));
      } else {
        setDiscountPercent('0');
      }
    }
  }, [discountEvaluation, isManualOverride]);

  const parsedDiscount = Number(discountPercent);
  const safeDiscount = Number.isFinite(parsedDiscount) ? Math.min(100, Math.max(0, parsedDiscount)) : 0;
  const discountAmount = Math.round(subtotal * safeDiscount / 100);
  const totalDue = subtotal - discountAmount;

  const resetForm = () => {
    setDealerId('');
    setDeliveryPoint('');
    setDeliveryPointId(null);
    setDeliveryPoints([]);
    setDesiredDeliveryDate(getToday());
    setDiscountPercent('0');
    setIsManualOverride(false);
    setNote('');
    setLines([]);
    setProductQuery('');
    setActiveDraftId(null);
    setPurchaseHistory(null);
    setHistoryForbidden(false);
    setError(null);
  };

  const storeDrafts = (updatedDrafts: OrderDraft[]) => {
    localStorage.setItem(draftStorageKey(username), JSON.stringify(updatedDrafts));
    setDrafts(updatedDrafts);
  };

  const handleSaveDraft = () => {
    setError(null);
    try {
      const id = activeDraftId || `${Date.now()}`;
      const draft: OrderDraft = {
        id,
        dealerId,
        deliveryPoint,
        deliveryPointId,
        desiredDeliveryDate,
        discountPercent,
        note,
        lines,
        updatedAt: new Date().toISOString(),
      };
      const updatedDrafts = [draft, ...drafts.filter((item) => item.id !== id)];
      storeDrafts(updatedDrafts);
      setActiveDraftId(id);
      emitStatusToast({
        title: 'Lưu bản nháp thành công',
        message: 'Đã lưu bản nháp trên thiết bị này. Bạn có thể mở lại để tiếp tục nhập.',
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? `Không thể lưu bản nháp: ${saveError.message}` : 'Không thể lưu bản nháp.');
    }
  };

  const handleOpenDraft = (draft: OrderDraft) => {
    setDealerId(draft.dealerId);
    setDeliveryPoint(draft.deliveryPoint);
    setDeliveryPointId(draft.deliveryPointId ?? null);
    setDesiredDeliveryDate(draft.desiredDeliveryDate || getToday());
    setDiscountPercent(draft.discountPercent || '0');
    setIsManualOverride(true);
    setNote(draft.note || '');
    setLines(draft.lines || []);
    setActiveDraftId(draft.id);
    emitStatusToast({
      title: 'Mở bản nháp thành công',
      message: `Đã mở bản nháp lưu ngày ${new Date(draft.updatedAt).toLocaleString('vi-VN')}.`,
    });
    setError(null);
  };

  const handleDeleteDraft = (id: string) => {
    try {
      storeDrafts(drafts.filter((draft) => draft.id !== id));
      if (activeDraftId === id) setActiveDraftId(null);
      emitStatusToast({ title: 'Xóa bản nháp thành công', message: 'Đã xóa bản nháp.' });
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? `Không thể xóa bản nháp: ${deleteError.message}` : 'Không thể xóa bản nháp.');
    }
  };

  const addProduct = (product: ProductItem) => {
    const baseUnit = product.base_unit || 'Cái';
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.productId === product.id && line.unit === baseUnit);
      if (existingIndex >= 0) {
        return current.map((line, index) =>
          index === existingIndex ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [...current, {
        productId: product.id,
        code: product.code,
        name: product.name,
        price: product.sell_price,
        unit: baseUnit,
        conversionRate: 1,
        quantity: 1,
      }];
    });
    setProductQuery('');
  };

  const handleAddAllPreviousItems = () => {
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

    setLines((current) => {
      const updated = [...current];
      itemsToAdd.forEach((item) => {
        const itemUnit = item.unit || 'Cái';
        const existingIndex = updated.findIndex((line) => line.productId === item.product_id && line.unit === itemUnit);
        const qtyToAdd = Math.max(1, Math.round(item.quantity || 1));
        if (existingIndex >= 0) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + qtyToAdd,
          };
        } else {
          updated.push({
            productId: item.product_id,
            code: item.product_code,
            name: item.product_name,
            price: item.price,
            unit: itemUnit,
            conversionRate: item.conversion_rate || 1,
            quantity: qtyToAdd,
          });
        }
      });
      return updated;
    });

    emitStatusToast({
      title: 'Đã thêm nhóm hàng',
      message: `Đã thêm nhanh cả nhóm ${itemsToAdd.length} mặt hàng đã mua lần trước vào đơn mới!`,
    });
  };

  const handleAddHistoryItem = (item: PurchaseHistoryItem) => {
    const itemUnit = item.unit || 'Cái';
    const qtyToAdd = Math.max(1, Math.round(item.last_order_quantity || item.avg_quantity || 1));
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.productId === item.product_id && line.unit === itemUnit);
      if (existingIndex >= 0) {
        return current.map((line, idx) =>
          idx === existingIndex ? { ...line, quantity: line.quantity + qtyToAdd } : line
        );
      }
      return [
        ...current,
        {
          productId: item.product_id,
          code: item.product_code,
          name: item.product_name,
          price: item.price,
          unit: itemUnit,
          conversionRate: item.conversion_rate || 1,
          quantity: qtyToAdd,
        },
      ];
    });
    emitStatusToast({
      title: 'Đã thêm sản phẩm',
      message: `Đã thêm ${item.product_name} (${qtyToAdd} ${itemUnit}) vào đơn hàng.`,
    });
  };

  const updateLine = (index: number, changes: Partial<OrderLine>) => {
    setLines((current) => current.map((line, lineIndex) =>
      lineIndex === index ? { ...line, ...changes } : line
    ));
  };

  const handleCreateOrder = async () => {
    if (!selectedDealer) {
      setError('Vui lòng chọn đại lý.');
      return;
    }
    if (!deliveryPoint.trim()) {
      setError('Vui lòng nhập hoặc chọn điểm giao hàng.');
      return;
    }
    if (!desiredDeliveryDate) {
      setError('Vui lòng chọn ngày giao mong muốn.');
      return;
    }
    if (desiredDeliveryDate < getToday()) {
      setError('Ngày giao mong muốn không được ở quá khứ.');
      return;
    }
    if (!lines.length) {
      setError('Vui lòng thêm ít nhất một dòng hàng.');
      return;
    }
    if (!discountPercent.trim() || !Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
      setError('Chiết khấu phải từ 0% đến 100%.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const created = await createOrderApi(token, {
        dealer_id: selectedDealer.id,
        delivery_point: deliveryPoint.trim(),
        delivery_point_id: deliveryPointId ?? undefined,
        desired_delivery_date: desiredDeliveryDate,
        discount_percent: safeDiscount,
        items: lines.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
          price: line.price,
          unit: line.unit,
          conversion_rate: line.conversionRate,
        })),
        note: note.trim() || undefined,
      });
      let draftCleanupWarning: string | null = null;
      if (activeDraftId) {
        try {
          const updatedDrafts = drafts.filter((draft) => draft.id !== activeDraftId);
          storeDrafts(updatedDrafts);
        } catch (cleanupError) {
          draftCleanupWarning = cleanupError instanceof Error
            ? ` Đơn đã tạo thành công nhưng chưa xóa được bản nháp: ${cleanupError.message}`
            : ' Đơn đã tạo thành công nhưng chưa xóa được bản nháp trên thiết bị.';
        }
      }
      resetForm();
      emitStatusToast({
        title: 'Tạo đơn hàng thành công',
        message: `Đã tạo đơn ${created.order_code} thành công. Tổng phải thu: ${formatCurrency(created.total_amount)}.${draftCleanupWarning || ''}`,
      });
      onCreated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể tạo đơn hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="sales-order-page">
      {error && <div className="sales-order-alert error" role="alert">{error}</div>}

      <div className="sales-order-layout">
        <section className="sales-order-main">
          <section className="sales-order-card">
            <h2>Thông tin giao hàng</h2>
            <div className="sales-order-fields">
              <label className="sales-order-field">
                <span>Đại lý <b aria-hidden="true">*</b></span>
                <select
                  value={dealerId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    setDealerId(nextId);
                  }}
                  disabled={isLoadingDealers || !!dealerLoadError}
                >
                  <option value="">{isLoadingDealers ? 'Đang tải đại lý...' : 'Chọn đại lý'}</option>
                  {dealers.map((dealer) => (
                    <option key={dealer.id} value={dealer.id}>{dealer.code} — {dealer.name}</option>
                  ))}
                </select>
                {!isLoadingDealers && !dealerLoadError && dealers.length === 0 && (
                  <span className="sales-order-field-error">
                    Tài khoản chưa được phân công đại lý. Vui lòng liên hệ quản lý để được hỗ trợ.
                  </span>
                )}
                {dealerLoadError && (
                  <span className="sales-order-field-error">
                    {dealerLoadError}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setDealerLoadError(null);
                        setIsLoadingDealers(true);
                        getOrderDealersApi(token)
                          .then(setDealers)
                          .catch((loadError: unknown) => setDealerLoadError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách đại lý.'))
                          .finally(() => setIsLoadingDealers(false));
                      }}
                    >
                      Thử lại
                    </button>
                  </span>
                )}
              </label>
              <label className="sales-order-field">
                <span>Điểm giao hàng <b aria-hidden="true">*</b></span>
                <select
                  value={deliveryPointSelectValue}
                  disabled={!selectedDealer || isLoadingDeliveryPoints}
                  onChange={(event) => {
                    const val = event.target.value;
                    if (val.startsWith('point_')) {
                      const pId = Number(val.replace('point_', ''));
                      const pt = deliveryPoints.find((p) => p.id === pId);
                      setDeliveryPointId(pId);
                      setDeliveryPoint(pt ? `${pt.label} — ${pt.address}` : '');
                    } else if (val === 'dealer_address') {
                      setDeliveryPointId(null);
                      setDeliveryPoint(selectedDealer?.address || '');
                    } else if (val === 'custom') {
                      setDeliveryPointId(null);
                      setDeliveryPoint('');
                    }
                  }}
                >
                  <option value="" disabled>
                    {!selectedDealer
                      ? 'Chọn đại lý trước'
                      : isLoadingDeliveryPoints
                      ? 'Đang tải điểm giao hàng...'
                      : 'Chọn điểm giao hàng'}
                  </option>
                  {deliveryPoints
                    .filter((p) => p.is_active)
                    .map((p) => (
                      <option key={p.id} value={`point_${p.id}`}>
                        {p.label} — {p.address}
                        {p.receiver_name ? ` (${p.receiver_name}${p.receiver_phone ? ' - ' + p.receiver_phone : ''})` : ''}
                        {p.is_default ? ' [Mặc định]' : ''}
                      </option>
                    ))}
                  {selectedDealer?.address && !deliveryPoints.some((p) => p.address === selectedDealer.address) && (
                    <option value="dealer_address">Địa chỉ đại lý — {selectedDealer.address}</option>
                  )}
                  <option value="custom">Điểm giao khác</option>
                </select>
                {deliveryPointSelectValue === 'custom' && (
                  <input
                    aria-label="Địa chỉ giao hàng khác"
                    value={deliveryPoint}
                    onChange={(event) => setDeliveryPoint(event.target.value)}
                    placeholder="Nhập địa chỉ giao hàng cụ thể"
                    maxLength={500}
                  />
                )}
                {deliveryPointId && (() => {
                  const pt = deliveryPoints.find((p) => p.id === deliveryPointId);
                  if (!pt) return null;
                  return (
                    <div style={{ fontSize: '11px', color: '#047857', marginTop: '4px', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a7f3d0', lineHeight: 1.35 }}>
                      <strong>Người nhận:</strong> {pt.receiver_name || selectedDealer?.name || 'Đại lý'}
                      {pt.receiver_phone ? ` • SĐT: ${pt.receiver_phone}` : ''}
                      {pt.route_note ? ` • Tuyến: ${pt.route_note}` : ''}
                    </div>
                  );
                })()}
              </label>
              <label className="sales-order-field">
                <span>Ngày giao mong muốn <b aria-hidden="true">*</b></span>
                <input
                  type="date"
                  min={getToday()}
                  value={desiredDeliveryDate}
                  onChange={(event) => setDesiredDeliveryDate(event.target.value)}
                />
              </label>
              <label className="sales-order-field">
                <span>Ghi chú</span>
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ghi chú cho đơn hàng (không bắt buộc)"
                  maxLength={1000}
                />
              </label>
            </div>
          </section>

          {/* SCRUM-52 / SCRUM-57: Lịch sử mua hàng của đại lý & Gợi ý mặt hàng */}
          {selectedDealer && !historyForbidden && (
            <section className="sales-order-card sales-order-history-card">
              <div className="sales-order-history-header">
                <div className="sales-order-history-title-group">
                  <div className="sales-order-history-badge">
                    <span className="history-badge-icon">💡</span>
                    <span>Gợi ý theo lịch sử mua hàng</span>
                  </div>
                  <h2 className="sales-order-history-title">
                    Mặt hàng đại lý thường lấy (3 tháng gần nhất)
                  </h2>
                  <p className="sales-order-history-subtitle">
                    {isLoadingHistory ? (
                      'Đang tra cứu lịch sử mua hàng của đại lý...'
                    ) : purchaseHistory && purchaseHistory.has_history ? (
                      <>
                        Đại lý <strong>{selectedDealer.name}</strong> đã đặt <strong>{purchaseHistory.total_orders_3_months} đơn hàng</strong> trong 3 tháng qua.
                        {purchaseHistory.last_order && (
                          <span className="history-last-order-tag">
                            {' '}• Lần mua gần nhất: <strong>{purchaseHistory.last_order.order_code}</strong> ({purchaseHistory.last_order.created_at})
                          </span>
                        )}
                      </>
                    ) : (
                      <>Đại lý <strong>{selectedDealer.name}</strong> chưa có lịch sử mua hàng trong 3 tháng gần nhất.</>
                    )}
                  </p>
                </div>

                {purchaseHistory && purchaseHistory.has_history && (
                  <div className="sales-order-history-actions">
                    <button
                      type="button"
                      className="sales-order-btn-add-batch"
                      onClick={handleAddAllPreviousItems}
                      title="Thêm toàn bộ nhóm hàng đã mua ở đơn gần nhất vào đơn mới"
                    >
                      <span className="btn-icon">⚡</span>
                      <span>Thêm nhanh cả nhóm hàng đã mua lần trước vào đơn mới</span>
                      <span className="batch-count-badge">
                        {purchaseHistory.last_order_items?.length || purchaseHistory.items.length} món
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {isLoadingHistory && (
                <div className="sales-order-history-loading">
                  <div className="history-loading-spinner" />
                  <span>Đang tải dữ liệu sản lượng bình quân...</span>
                </div>
              )}

              {!isLoadingHistory && purchaseHistory && purchaseHistory.has_history && (
                <div className="sales-order-history-table-wrapper">
                  <table className="sales-order-history-table">
                    <thead>
                      <tr>
                        <th>Mã SP</th>
                        <th>Tên mặt hàng</th>
                        <th>ĐVT</th>
                        <th style={{ textAlign: 'center' }}>SL bình quân (3 tháng)</th>
                        <th style={{ textAlign: 'center' }}>SL lần trước</th>
                        <th style={{ textAlign: 'right' }}>Đơn giá</th>
                        <th style={{ textAlign: 'center' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseHistory.items.map((item) => (
                        <tr key={item.product_id} className="history-row">
                          <td className="history-col-code">
                            <span className="code-badge">{item.product_code}</span>
                          </td>
                          <td className="history-col-name">
                            <div className="product-name-text">{item.product_name}</div>
                            {item.last_purchased_date && (
                              <span className="product-last-date">Mua gần nhất: {item.last_purchased_date}</span>
                            )}
                          </td>
                          <td className="history-col-unit">{item.unit}</td>
                          <td className="history-col-avg" style={{ textAlign: 'center' }}>
                            <span className="avg-qty-badge" title={`Tổng ${item.total_quantity} ${item.unit} qua ${item.order_count} đơn hàng`}>
                              <strong>{item.avg_quantity}</strong> {item.unit}/đơn
                            </span>
                          </td>
                          <td className="history-col-last" style={{ textAlign: 'center' }}>
                            {item.last_order_quantity > 0 ? (
                              <span className="last-qty-text">{item.last_order_quantity} {item.unit}</span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="history-col-price" style={{ textAlign: 'right' }}>
                            {formatCurrency(item.price)}
                          </td>
                          <td className="history-col-action" style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-add-single-history"
                              onClick={() => handleAddHistoryItem(item)}
                              title={`Thêm ${item.product_name} vào đơn`}
                            >
                              + Thêm
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className="sales-order-card">
            <h2>Sản phẩm</h2>
            <label className="sales-order-field">
              <span>Tìm theo mã hoặc tên sản phẩm</span>
              <input
                type="search"
                value={productQuery}
                onChange={(event) => setProductQuery(event.target.value)}
                placeholder="Ví dụ: SP001 hoặc Áo thun Polo"
                autoComplete="off"
              />
            </label>
            {productQuery.trim() && (
              <div className="sales-order-search-results">
                {searchResults.length ? searchResults.map((product) => (
                  <button type="button" key={product.id} onClick={() => addProduct(product)}>
                    <span><b>{product.code}</b> — {product.name}</span>
                    <strong>{formatCurrency(product.sell_price)}</strong>
                  </button>
                )) : <p>Không tìm thấy sản phẩm phù hợp.</p>}
              </div>
            )}

            {lines.length === 0 ? (
              <div className="sales-order-empty">Chưa có sản phẩm. Tìm theo mã hoặc tên để thêm hàng.</div>
            ) : (
              <div className="sales-order-lines">
                {lines.map((line, index) => (
                  <article className="sales-order-line" key={`${line.productId}-${index}`}>
                    <div className="sales-order-line-heading">
                      <div>
                        <span className="sales-order-product-code">{line.code}</span>
                        <h3>{line.name}</h3>
                        <span className="sales-order-unit-price">{formatCurrency(line.price)} / đơn vị</span>
                      </div>
                      <button
                        type="button"
                        className="sales-order-remove-button"
                        aria-label={`Xóa ${line.name}`}
                        onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}
                      >
                        Xóa
                      </button>
                    </div>
                    <div className="sales-order-line-controls">
                      <label className="sales-order-field">
                        <span>Đơn vị tính</span>
                        <select
                          value={line.unit}
                          onChange={(event) => {
                            const product = products.find((item) => item.id === line.productId);
                            const selectedUnit = getAvailableUnits(product, line.unit)
                              .find((unit) => unit.unit_name === event.target.value);
                            if (selectedUnit) {
                              updateLine(index, {
                                unit: selectedUnit.unit_name,
                                conversionRate: selectedUnit.conversion_rate,
                              });
                            }
                          }}
                        >
                          {getAvailableUnits(
                            products.find((item) => item.id === line.productId),
                            line.unit,
                          ).map((unit) => (
                            <option key={unit.unit_name} value={unit.unit_name}>{unit.unit_name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="sales-order-field">
                        <span>Số lượng</span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          onChange={(event) => updateLine(index, { quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) })}
                        />
                      </label>
                      <div className="sales-order-line-total">
                        <span>Thành tiền</span>
                        <strong>{formatCurrency(line.price * line.quantity)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="sales-order-sidebar">
          <section className="sales-order-card sales-order-summary">
            <h2>Tổng kết đơn hàng</h2>
            <div className="sales-order-summary-row">
              <span>Tổng tiền hàng</span><strong>{formatCurrency(subtotal)}</strong>
            </div>
            <div className="sales-order-discount-block">
              <label className="sales-order-discount">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span>Chiết khấu (%)</span>
                  {isManualOverride && discountEvaluation.isQualified && (
                    <button
                      type="button"
                      className="sales-order-discount-override-btn"
                      onClick={() => {
                        setIsManualOverride(false);
                        setDiscountPercent(String(discountEvaluation.discountPercent));
                      }}
                      title="Khôi phục lại mức chiết khấu tự động từ chính sách"
                    >
                      ↺ Theo chính sách ({discountEvaluation.discountPercent}%)
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={discountPercent}
                  onChange={(event) => {
                    setIsManualOverride(true);
                    setDiscountPercent(event.target.value);
                  }}
                  placeholder="0"
                />
              </label>

              {discountEvaluation.isQualified && (
                <div
                  className="sales-order-policy-badge"
                  title={discountEvaluation.label || 'Chính sách chiết khấu tự động'}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <span>{discountEvaluation.label}</span>
                </div>
              )}

              {isManualOverride && safeDiscount > discountEvaluation.discountPercent && (
                <div className="sales-order-discount-warning">
                  ⚠️ Chiết khấu bạn nhập ({safeDiscount}%) cao hơn mức chính sách ({discountEvaluation.discountPercent}%). Đơn hàng sẽ cần Quản lý phê duyệt.
                </div>
              )}
            </div>
            <div className="sales-order-summary-row muted">
              <span>Tiền chiết khấu</span><strong>− {formatCurrency(discountAmount)}</strong>
            </div>
            <div className="sales-order-summary-row total">
              <span>Tổng phải thu</span><strong>{formatCurrency(totalDue)}</strong>
            </div>
            <button
              type="button"
              className="sales-order-primary-button"
              onClick={handleCreateOrder}
              disabled={isSaving || isLoadingDealers || !!dealerLoadError || dealers.length === 0}
            >
              {isSaving ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}
            </button>
            <button type="button" className="sales-order-secondary-button full" onClick={handleSaveDraft}>
              Lưu nháp
            </button>
            <p className="sales-order-hint">Bản nháp chỉ lưu trên trình duyệt và thiết bị này.</p>
          </section>

          <section className="sales-order-card sales-order-drafts">
            <div className="sales-order-drafts-heading">
              <h2>Bản nháp đã lưu</h2>
              <button type="button" className="sales-order-new-button" onClick={resetForm}>Đơn mới</button>
            </div>
            <div className="sales-order-drafts-list">
              {drafts.length === 0 ? (
                <p className="sales-order-empty compact">Chưa có bản nháp.</p>
              ) : drafts.map((draft) => {
                const dealerName = dealers.find((dealer) => String(dealer.id) === draft.dealerId)?.name || 'Chưa chọn đại lý';
                return (
                  <div className={`sales-order-draft ${draft.id === activeDraftId ? 'active' : ''}`} key={draft.id}>
                    <button type="button" className="sales-order-draft-open" onClick={() => handleOpenDraft(draft)}>
                      <strong>{dealerName}</strong>
                      <span>{draft.lines.length} dòng hàng · {new Date(draft.updatedAt).toLocaleString('vi-VN')}</span>
                    </button>
                    <button
                      type="button"
                      className="sales-order-remove-button"
                      aria-label={`Xóa bản nháp của ${dealerName}`}
                      onClick={() => handleDeleteDraft(draft.id)}
                    >
                      Xóa
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
