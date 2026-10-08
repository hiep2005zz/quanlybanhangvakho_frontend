import { useEffect, useMemo, useState } from 'react';
import { cancelOrderApi, createOrderApi, getOrderDealersApi, getOrdersApi, OrderDealer, OrderItem, ProductItem } from '../services/api';
import { emitStatusToast } from './StatusToast';
import OrderDetailsModal from './OrderDetailsModal';
import OrderCancelConfirmModal from './OrderCancelConfirmModal';
import './orders-view.css';

interface OrdersViewProps {
  token: string;
  username: string;
  products: ProductItem[];
  canCreateOrders: boolean;
  canManageOrders: boolean;
  onCreateOrderEntry: () => void;
  onBackToHome?: () => void;
}

interface DraftLine {
  productId: number;
  unit: string;
  quantity: number;
}

interface SavedOrderDraft {
  id: string;
  dealerId: string;
  deliveryPoint: string;
  deliveryDate: string;
  desiredDeliveryDate?: string;
  discountPercent: string;
  note: string;
  lines: DraftLine[];
  updatedAt: string;
}

const ORDER_UNITS = ['Cái', 'Hộp', 'Thùng', 'Bộ', 'Đôi'];
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const draftsStorageKey = (username: string) =>
  `sales-order-drafts:${encodeURIComponent(username.toLowerCase())}`;
const legacyDraftStorageKey = (username: string) =>
  `sales-order-draft:${username.toLocaleLowerCase()}`;

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Không xác định' : date.toLocaleString('vi-VN');
};

const getStatusLabel = (status: string) => {
  switch (status.toUpperCase()) {
    case 'CONFIRMED':
      return 'Đã xác nhận';
    case 'PENDING':
      return 'Chờ xử lý';
    case 'CANCELLED':
      return 'Đã hủy';
    case 'EDITED':
      return 'Đã chỉnh sửa';
    default:
      return status || 'Không xác định';
  }
};

export default function OrdersView({ token, username, products, canCreateOrders, canManageOrders, onCreateOrderEntry, onBackToHome: _onBackToHome }: OrdersViewProps) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [dealers, setDealers] = useState<OrderDealer[]>([]);
  const [dealerId, setDealerId] = useState('');
  const [deliveryPoint, setDeliveryPoint] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(getToday);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [note, setNote] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [drafts, setDrafts] = useState<SavedOrderDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [isDraftPickerOpen, setIsDraftPickerOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDealers, setIsLoadingDealers] = useState(false);
  const [cancellingOrderCode, setCancellingOrderCode] = useState<string | null>(null);
  const [orderToCancel, setOrderToCancel] = useState<OrderItem | null>(null);
  const [selectedOrderCode, setSelectedOrderCode] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftsStorageKey(username));
      const legacyStored = localStorage.getItem(legacyDraftStorageKey(username));
      const parsedStored: unknown = stored ? JSON.parse(stored) : [];
      const parsedLegacy: unknown = legacyStored ? JSON.parse(legacyStored) : null;
      let nextDrafts: SavedOrderDraft[] = Array.isArray(parsedStored)
        ? parsedStored.filter((draft): draft is SavedOrderDraft =>
            typeof draft?.id === 'string' &&
            typeof draft?.dealerId === 'string' &&
            Array.isArray(draft?.lines)
          ).map((draft) => ({
            ...draft,
            deliveryDate: typeof draft.deliveryDate === 'string'
              ? draft.deliveryDate
              : typeof draft.desiredDeliveryDate === 'string'
                ? draft.desiredDeliveryDate
                : getToday(),
            discountPercent: typeof draft.discountPercent === 'string' ? draft.discountPercent : '0',
            deliveryPoint: typeof draft.deliveryPoint === 'string' ? draft.deliveryPoint : '',
            note: typeof draft.note === 'string' ? draft.note : '',
            updatedAt: typeof draft.updatedAt === 'string' ? draft.updatedAt : new Date().toISOString(),
          }))
        : [];

      if (parsedLegacy && typeof parsedLegacy === 'object' && !Array.isArray(parsedLegacy)) {
        const draft = parsedLegacy as Partial<SavedOrderDraft>;
        if (Array.isArray(draft.lines)) {
          nextDrafts = [{
            id: typeof draft.id === 'string' ? draft.id : `legacy-${Date.now()}`,
            dealerId: draft.dealerId || '',
            deliveryPoint: draft.deliveryPoint || '',
            deliveryDate: draft.deliveryDate || getToday(),
            discountPercent: draft.discountPercent || '0',
            note: draft.note || '',
            lines: draft.lines,
            updatedAt: draft.updatedAt || new Date().toISOString(),
          }, ...nextDrafts];
          localStorage.removeItem(legacyDraftStorageKey(username));
          localStorage.setItem(draftsStorageKey(username), JSON.stringify(nextDrafts));
        }
      }
      setDrafts(nextDrafts);
    } catch (draftError) {
      setCreateError(draftError instanceof Error
        ? `Không thể đọc bản nháp: ${draftError.message}`
        : 'Không thể đọc các bản nháp đã lưu.');
    }
  }, [username]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);
    getOrdersApi(token)
      .then((result) => {
        if (isMounted) setOrders(result);
      })
      .catch((loadError: unknown) => {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách đơn hàng.');
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [token, reloadVersion]);

  useEffect(() => {
    if (!isCreating || dealers.length > 0) return;
    let isMounted = true;
    setIsLoadingDealers(true);
    getOrderDealersApi(token)
      .then((result) => {
        if (isMounted) setDealers(result);
      })
      .catch((loadError: unknown) => {
        if (isMounted) setCreateError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách đại lý.');
      })
      .finally(() => {
        if (isMounted) setIsLoadingDealers(false);
      });
    return () => {
      isMounted = false;
    };
  }, [dealers.length, isCreating, token]);

  const selectedDealer = dealers.find((dealer) => String(dealer.id) === dealerId);
  const productResults = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase('vi');
    if (!query) return [];
    return products.filter((product) =>
      product.code.toLocaleLowerCase('vi').includes(query) ||
      product.name.toLocaleLowerCase('vi').includes(query)
    ).slice(0, 6);
  }, [productQuery, products]);
  const subtotal = lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return sum + (product?.sell_price ?? 0) * line.quantity;
  }, 0);
  const discount = Number(discountPercent);
  const safeDiscount = Number.isFinite(discount) ? Math.min(100, Math.max(0, discount)) : 0;
  const discountAmount = Math.round(subtotal * safeDiscount / 100);

  const resetOrderForm = () => {
    setDealerId('');
    setDeliveryPoint('');
    setDeliveryDate(getToday());
    setDiscountPercent('0');
    setNote('');
    setLines([]);
    setProductQuery('');
    setActiveDraftId(null);
    setCreateError(null);
  };

  const saveDraft = () => {
    try {
      const id = activeDraftId || `${Date.now()}`;
      const draft: SavedOrderDraft = {
        id,
        dealerId,
        deliveryPoint,
        deliveryDate,
        discountPercent,
        note,
        lines,
        updatedAt: new Date().toISOString(),
      };
      const updatedDrafts = [draft, ...drafts.filter((item) => item.id !== id)];
      localStorage.setItem(draftsStorageKey(username), JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
      setActiveDraftId(id);
      emitStatusToast({ title: 'Lưu bản nháp thành công', message: 'Bản nháp đơn hàng đã được lưu trên thiết bị này.' });
      setCreateError(null);
    } catch (draftError) {
      setCreateError(draftError instanceof Error ? `Không thể lưu bản nháp: ${draftError.message}` : 'Không thể lưu bản nháp.');
    }
  };

  const openDraft = (draft: SavedOrderDraft) => {
    try {
      setDealerId(draft.dealerId || '');
      setDeliveryPoint(draft.deliveryPoint || '');
      setDeliveryDate(draft.deliveryDate || getToday());
      setDiscountPercent(draft.discountPercent || '0');
      setNote(draft.note || '');
      setLines(draft.lines);
      setActiveDraftId(draft.id);
      setIsDraftPickerOpen(false);
      setCreateError(null);
      const dealerName = dealers.find((dealer) => String(dealer.id) === draft.dealerId)?.name || 'chưa chọn đại lý';
      emitStatusToast({ title: 'Mở bản nháp thành công', message: `Đã mở bản nháp của ${dealerName}.` });
    } catch (draftError) {
      setCreateError(draftError instanceof Error ? `Không thể mở bản nháp: ${draftError.message}` : 'Không thể mở bản nháp.');
    }
  };

  const deleteDraft = (draftId: string) => {
    try {
      const updatedDrafts = drafts.filter((draft) => draft.id !== draftId);
      localStorage.setItem(draftsStorageKey(username), JSON.stringify(updatedDrafts));
      setDrafts(updatedDrafts);
      if (activeDraftId === draftId) setActiveDraftId(null);
      emitStatusToast({ title: 'Xóa bản nháp thành công', message: 'Đã xóa bản nháp khỏi thiết bị này.' });
      setCreateError(null);
    } catch (draftError) {
      setCreateError(draftError instanceof Error ? `Không thể xóa bản nháp: ${draftError.message}` : 'Không thể xóa bản nháp.');
    }
  };

  const submitOrder = async () => {
    if (!selectedDealer) return setCreateError('Vui lòng chọn đại lý.');
    const isLockedDealer = Boolean(
      selectedDealer?.status &&
      (selectedDealer.status.toLowerCase().includes('khóa') ||
       selectedDealer.status.toLowerCase().includes('lock') ||
       selectedDealer.status.toLowerCase().includes('ngừng'))
    );
    if (isLockedDealer) {
      setCreateError(`Đại lý "${selectedDealer.name}" hiện đang bị KHÓA giao dịch. Không thể tạo đơn hàng.`);
      emitStatusToast({
        title: 'Đại lý bị khóa giao dịch',
        message: `Đại lý "${selectedDealer.name}" hiện đang bị KHÓA giao dịch. Vui lòng liên hệ quản trị viên.`,
        type: 'error',
      });
      return;
    }
    if (!deliveryPoint.trim()) return setCreateError('Vui lòng nhập điểm giao hàng.');
    if (!deliveryDate) return setCreateError('Vui lòng chọn ngày giao mong muốn.');
    if (!lines.length) return setCreateError('Vui lòng thêm ít nhất một dòng hàng.');
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      return setCreateError('Chiết khấu phải từ 0% đến 100%.');
    }

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const created = await createOrderApi(token, {
        dealer_id: selectedDealer.id,
        delivery_point: deliveryPoint.trim(),
        desired_delivery_date: deliveryDate,
        discount_percent: discount,
        items: lines.map(({ productId, quantity, unit }) => {
          const product = products.find((item) => item.id === productId);
          if (!product) {
            throw new Error('Một sản phẩm trong đơn không còn tồn tại. Vui lòng tải lại trang và chọn lại sản phẩm.');
          }
          return { product_id: productId, quantity, unit, price: product.sell_price };
        }),
        note: note.trim() || undefined,
      });
      let draftCleanupWarning: string | null = null;
      try {
        if (activeDraftId) {
          const updatedDrafts = drafts.filter((draft) => draft.id !== activeDraftId);
          localStorage.setItem(draftsStorageKey(username), JSON.stringify(updatedDrafts));
          setDrafts(updatedDrafts);
        }
      } catch (storageError) {
        draftCleanupWarning = storageError instanceof Error
          ? `Đơn đã tạo nhưng không xóa được bản nháp: ${storageError.message}`
          : 'Đơn đã tạo nhưng không xóa được bản nháp trên thiết bị.';
      }
      setIsDraftPickerOpen(false);
      setIsCreating(false);
      resetOrderForm();
      setReloadVersion((value) => value + 1);
      emitStatusToast({
        title: 'Tạo đơn hàng thành công',
        message: `Đã tạo đơn ${created.order_code} thành công.${draftCleanupWarning ? ` ${draftCleanupWarning}` : ''}`,
      });
    } catch (submitError) {
      setCreateError(submitError instanceof Error ? submitError.message : 'Không thể tạo đơn hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    const order = orderToCancel;
    setCancellingOrderCode(order.order_code);
    try {
      const result = await cancelOrderApi(token, order.order_code, 'Người dùng yêu cầu hủy đơn hàng.');
      setOrderToCancel(null);
      emitStatusToast({ title: 'Đã hủy đơn hàng', message: result.message });
      setReloadVersion((value) => value + 1);
    } catch (cancelError) {
      emitStatusToast({
        title: 'Không thể hủy đơn hàng',
        message: cancelError instanceof Error ? cancelError.message : 'Đã xảy ra lỗi khi hủy đơn hàng.',
      });
    } finally {
      setCancellingOrderCode(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase('vi');
    const matched = !query
      ? orders
      : orders.filter((order) =>
          [order.order_code, order.dealer_name, order.created_by, getStatusLabel(order.status)]
            .some((value) => value.toLocaleLowerCase('vi').includes(query))
        );
    return [...matched].sort((a, b) => {
      const isAPending = a.status === 'PENDING_APPROVAL' || a.status === 'PENDING';
      const isBPending = b.status === 'PENDING_APPROVAL' || b.status === 'PENDING';
      if (isAPending !== isBPending) {
        return isBPending ? 1 : -1;
      }
      return (b.id || 0) - (a.id || 0);
    });
  }, [orders, searchTerm]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const visibleOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const pageNumbers = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : Array.from(
        new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages].filter((page) => page >= 1 && page <= totalPages))
      ).sort((left, right) => left - right);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  if (isCreating) {
    return (
      <main className="orders-page">
        {createError && <div className="orders-create-error" role="alert">{createError}</div>}
        {isDraftPickerOpen && (
          <section className="orders-draft-picker" aria-label="Chọn bản nháp">
            <div className="orders-draft-picker-heading">
              <div><h2>Chọn bản nháp</h2><span>{drafts.length} bản nháp đã lưu</span></div>
              <button type="button" className="orders-back-button" onClick={() => setIsDraftPickerOpen(false)}>Đóng</button>
            </div>
            {drafts.length === 0 ? (
              <p className="orders-create-empty">Chưa có bản nháp nào. Hãy lưu đơn hiện tại để có thể mở lại sau.</p>
            ) : (
              <div className="orders-draft-list">
                {drafts.map((draft) => {
                  const dealerName = dealers.find((dealer) => String(dealer.id) === draft.dealerId)?.name || 'Chưa chọn đại lý';
                  const amount = draft.lines.reduce((sum, line) => {
                    const product = products.find((item) => item.id === line.productId);
                    return sum + (product?.sell_price ?? 0) * line.quantity;
                  }, 0);
                  return (
                    <article className="orders-draft-item" key={draft.id}>
                      <div className="orders-draft-info">
                        <strong>{dealerName}</strong>
                        <span>{draft.lines.length} dòng hàng · {formatCurrency(amount)}</span>
                        <span>Lưu lúc {formatDate(draft.updatedAt)}</span>
                      </div>
                      <div className="orders-draft-actions">
                        <button type="button" className="orders-create-submit" onClick={() => openDraft(draft)}>Mở bản nháp</button>
                        <button type="button" className="orders-draft-delete" onClick={() => deleteDraft(draft.id)}>Xóa</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
        <section className="orders-card orders-create-card">
          <div className="orders-create-fields">
            <label>Đại lý
              <select value={dealerId} disabled={isLoadingDealers} onChange={(event) => {
                const nextDealerId = event.target.value;
                setDealerId(nextDealerId);
                setDeliveryPoint(dealers.find((dealer) => String(dealer.id) === nextDealerId)?.address || '');
              }}>
                <option value="">{isLoadingDealers ? 'Đang tải đại lý...' : 'Chọn đại lý'}</option>
                {dealers.map((dealer) => {
                  const isLocked = Boolean(
                    dealer.status &&
                    (dealer.status.toLowerCase().includes('khóa') ||
                     dealer.status.toLowerCase().includes('lock') ||
                     dealer.status.toLowerCase().includes('ngừng'))
                  );
                  return (
                    <option key={dealer.id} value={dealer.id} disabled={isLocked}>
                      {dealer.code} — {dealer.name}{isLocked ? ' [Đã khóa]' : ''}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>Điểm giao hàng
              <input value={deliveryPoint} onChange={(event) => setDeliveryPoint(event.target.value)} placeholder="Địa chỉ giao hàng" maxLength={500} />
            </label>
            <label>Ngày giao mong muốn
              <input type="date" min={getToday()} value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
            </label>
            <label>Ghi chú
              <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Không bắt buộc" />
            </label>
          </div>
          <label className="orders-create-search">Tìm sản phẩm theo mã hoặc tên
            <input type="search" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Nhập mã hoặc tên sản phẩm" />
          </label>
          {productQuery.trim() && (
            <div className="orders-product-results">
              {productResults.length ? productResults.map((product) => (
                <button type="button" key={product.id} onClick={() => {
                  setLines((current) => {
                    const existing = current.find((line) => line.productId === product.id && line.unit === ORDER_UNITS[0]);
                    return existing
                      ? current.map((line) => line === existing ? { ...line, quantity: line.quantity + 1 } : line)
                      : [...current, { productId: product.id, unit: ORDER_UNITS[0], quantity: 1 }];
                  });
                  setProductQuery('');
                }}>
                  <span>{product.code} — {product.name}</span><strong>{formatCurrency(product.sell_price)}</strong>
                </button>
              )) : <p>Không tìm thấy sản phẩm phù hợp.</p>}
            </div>
          )}
          <div className="orders-create-lines">
            {lines.map((line, index) => {
              const product = products.find((item) => item.id === line.productId);
              if (!product) return null;
              return (
                <div className="orders-create-line" key={`${line.productId}-${index}`}>
                  <div><strong>{product.code} — {product.name}</strong><span>{formatCurrency(product.sell_price)} / đơn vị</span></div>
                  <select aria-label={`Đơn vị tính của ${product.name}`} value={line.unit} onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, unit: event.target.value } : item))}>
                    {ORDER_UNITS.map((unit) => <option key={unit}>{unit}</option>)}
                  </select>
                  <input aria-label={`Số lượng ${product.name}`} type="number" min={1} step={1} value={line.quantity} onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: Math.max(1, Math.floor(Number(event.target.value) || 1)) } : item))} />
                  <strong>{formatCurrency(product.sell_price * line.quantity)}</strong>
                  <button type="button" aria-label={`Xóa ${product.name}`} onClick={() => setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))}>Xóa</button>
                </div>
              );
            })}
            {lines.length === 0 && <p className="orders-create-empty">Chưa có sản phẩm. Tìm theo mã hoặc tên để thêm hàng.</p>}
          </div>
          <div className="orders-create-summary">
            <label>Chiết khấu (%)
              <input type="number" min={0} max={100} step="0.1" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
            </label>
            <span>Tổng tiền hàng <strong>{formatCurrency(subtotal)}</strong></span>
            <span>Tiền chiết khấu <strong>− {formatCurrency(discountAmount)}</strong></span>
            <span className="orders-create-total">Tổng phải thu <strong>{formatCurrency(subtotal - discountAmount)}</strong></span>
          </div>
          <div className="orders-create-actions">
            <button type="button" className="orders-back-button" onClick={() => { setCreateError(null); setIsDraftPickerOpen(true); }}>Mở bản nháp ({drafts.length})</button>
            <button type="button" className="orders-back-button" onClick={saveDraft}>Lưu nháp</button>
            <button type="button" className="orders-create-submit" disabled={isSubmitting || isLoadingDealers || dealers.length === 0} onClick={submitOrder}>
              {isSubmitting ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}
            </button>
          </div>
          <p className="orders-create-hint">Bản nháp chỉ lưu trên trình duyệt và thiết bị này. Giá niêm yết áp dụng cho mỗi đơn vị tính đã chọn.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="orders-page">
      <header className="orders-page-heading">
        <div>
          <p className="orders-page-eyebrow">BÁN HÀNG</p>
          <h1>Đơn hàng</h1>
          <p className="orders-page-subtitle">Theo dõi các đơn hàng đã được tạo trên hệ thống.</p>
        </div>
        <div className="orders-page-actions">
          {canCreateOrders && <button type="button" className="orders-create-submit" onClick={onCreateOrderEntry}>＋ Tạo đơn mới</button>}
        </div>
      </header>

      <section className="orders-card" aria-label="Danh sách đơn hàng">
        <div className="orders-toolbar">
          <div>
            <h2>Danh sách đơn hàng</h2>
            <span>{orders.length} đơn hàng</span>
          </div>
          <label className="orders-search">
            <span className="orders-visually-hidden">Tìm đơn hàng</span>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Tìm mã đơn, đại lý, nhân viên..."
            />
          </label>
        </div>

        {error && (
          <div className="orders-state orders-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setReloadVersion((value) => value + 1)}>Thử lại</button>
          </div>
        )}
        {!error && isLoading && <div className="orders-state" role="status">Đang tải danh sách đơn hàng...</div>}
        {!error && !isLoading && orders.length === 0 && (
          <div className="orders-state">Chưa có đơn hàng nào được tạo.</div>
        )}
        {!error && !isLoading && orders.length > 0 && filteredOrders.length === 0 && (
          <div className="orders-state">Không tìm thấy đơn hàng phù hợp.</div>
        )}

        {!error && !isLoading && filteredOrders.length > 0 && (
          <div className="orders-table-wrap">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Đại lý</th>
                  <th>Người tạo</th>
                  <th>Ngày tạo</th>
                  <th>Trạng thái</th>
                  <th className="orders-amount">Tổng tiền</th>
                  <th><span className="orders-visually-hidden">Thao tác</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleOrders.map((order) => (
                  <tr key={order.order_code}>
                    <td data-label="Mã đơn"><strong className="orders-code">{order.order_code}</strong></td>
                    <td data-label="Đại lý">{order.dealer_name}</td>
                    <td data-label="Người tạo">{order.created_by}</td>
                    <td data-label="Ngày tạo">{formatDate(order.created_at)}</td>
                    <td data-label="Trạng thái">
                      <span className={`orders-status orders-status--${order.status.toLowerCase()}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>
                    <td data-label="Tổng tiền" className="orders-amount">{formatCurrency(order.total_amount)}</td>
                    <td data-label="Thao tác" className="orders-row-actions">
                      <button
                        type="button"
                        className="orders-detail-button"
                        onClick={() => setSelectedOrderCode(order.order_code)}
                      >
                        Chi tiết
                      </button>
                      {order.status.toUpperCase() !== 'CANCELLED' &&
                        canCreateOrders &&
                        (canManageOrders || order.created_by.toLowerCase() === username.toLowerCase()) && (
                          <button
                            type="button"
                            className="orders-delete-button"
                            onClick={() => setOrderToCancel(order)}
                            disabled={cancellingOrderCode === order.order_code}
                          >
                            {cancellingOrderCode === order.order_code ? 'Đang hủy...' : 'Hủy đơn'}
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && !isLoading && filteredOrders.length > 0 && (
          <nav className="orders-pagination" aria-label="Phân trang danh sách đơn hàng">
            <span className="orders-pagination-count">
              Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredOrders.length)} trong {filteredOrders.length} đơn
            </span>
            <div className="orders-pagination-controls">
              <button
                type="button"
                className="orders-page-button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                aria-label="Trang trước"
              >
                ‹
              </button>
              {pageNumbers.map((page, index) => (
                <span className="orders-page-number-wrap" key={page}>
                  {index > 0 && page - pageNumbers[index - 1] > 1 && <span className="orders-page-ellipsis" aria-hidden="true">…</span>}
                  <button
                    type="button"
                    className={`orders-page-button${page === currentPage ? ' active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                    aria-current={page === currentPage ? 'page' : undefined}
                    aria-label={`Trang ${page}`}
                  >
                    {page}
                  </button>
                </span>
              ))}
              <button
                type="button"
                className="orders-page-button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                aria-label="Trang sau"
              >
                ›
              </button>
            </div>
          </nav>
        )}
      </section>
      {selectedOrderCode && (
        <OrderDetailsModal
          token={token}
          orderCode={selectedOrderCode}
          onClose={() => setSelectedOrderCode(null)}
        />
      )}
      {orderToCancel && (
        <OrderCancelConfirmModal
          order={orderToCancel}
          isSubmitting={cancellingOrderCode === orderToCancel.order_code}
          onCancel={() => {
            if (!cancellingOrderCode) setOrderToCancel(null);
          }}
          onConfirm={() => void handleCancelOrder()}
        />
      )}
    </main>
  );
}
