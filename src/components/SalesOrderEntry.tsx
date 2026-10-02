import { useEffect, useMemo, useState } from 'react';
import {
  createOrderApi,
  getOrderDealersApi,
  OrderDealer,
  ProductItem,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import './sales-order-entry.css';

interface SalesOrderEntryProps {
  token: string;
  username: string;
  products: ProductItem[];
  onClose: () => void;
}

interface OrderLine {
  productId: number;
  code: string;
  name: string;
  price: number;
  unit: string;
  quantity: number;
}

interface OrderDraft {
  id: string;
  dealerId: string;
  deliveryPoint: string;
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
    typeof line.unit === 'string' &&
    typeof line.quantity === 'number';
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
    Array.isArray(draft.lines) &&
    draft.lines.every(isOrderLine);
};

const ORDER_UNITS = ['Cái', 'Hộp', 'Thùng', 'Bộ', 'Đôi'];
const getToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
const draftStorageKey = (username: string) => `sales-order-drafts:${encodeURIComponent(username.toLowerCase())}`;

export default function SalesOrderEntry({ token, username, products, onClose }: SalesOrderEntryProps) {
  const [dealers, setDealers] = useState<OrderDealer[]>([]);
  const [isLoadingDealers, setIsLoadingDealers] = useState(true);
  const [dealerLoadError, setDealerLoadError] = useState<string | null>(null);
  const [dealerId, setDealerId] = useState('');
  const [deliveryPoint, setDeliveryPoint] = useState('');
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState(getToday);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    try {
      const storedDrafts = localStorage.getItem(draftStorageKey(username));
      if (!storedDrafts) return;
      const parsed: unknown = JSON.parse(storedDrafts);
      if (!Array.isArray(parsed) || !parsed.every(isOrderDraft)) {
        throw new Error('Dữ liệu bản nháp không hợp lệ.');
      }
      setDrafts(parsed);
    } catch (loadError) {
      setError(loadError instanceof Error ? `Không thể đọc bản nháp: ${loadError.message}` : 'Không thể đọc bản nháp đã lưu.');
    }
  }, [username]);

  const selectedDealer = dealers.find((dealer) => String(dealer.id) === dealerId);
  const deliveryPointMode = selectedDealer?.address && deliveryPoint === selectedDealer.address
    ? 'registered'
    : selectedDealer
      ? 'custom'
      : '';
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
  const parsedDiscount = Number(discountPercent);
  const safeDiscount = Number.isFinite(parsedDiscount) ? Math.min(100, Math.max(0, parsedDiscount)) : 0;
  const discountAmount = Math.round(subtotal * safeDiscount / 100);
  const totalDue = subtotal - discountAmount;

  const resetForm = () => {
    setDealerId('');
    setDeliveryPoint('');
    setDesiredDeliveryDate(getToday());
    setDiscountPercent('0');
    setNote('');
    setLines([]);
    setProductQuery('');
    setActiveDraftId(null);
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
    setDesiredDeliveryDate(draft.desiredDeliveryDate || getToday());
    setDiscountPercent(draft.discountPercent || '0');
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
    setLines((current) => {
      const existingIndex = current.findIndex((line) => line.productId === product.id && line.unit === ORDER_UNITS[0]);
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
        unit: ORDER_UNITS[0],
        quantity: 1,
      }];
    });
    setProductQuery('');
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
      setError('Vui lòng nhập điểm giao hàng.');
      return;
    }
    if (!desiredDeliveryDate) {
      setError('Vui lòng chọn ngày giao mong muốn.');
      return;
    }
    if (!lines.length) {
      setError('Vui lòng thêm ít nhất một dòng hàng.');
      return;
    }
    if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 100) {
      setError('Chiết khấu phải từ 0% đến 100%.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const created = await createOrderApi(token, {
        dealer_id: selectedDealer.id,
        delivery_point: deliveryPoint.trim(),
        desired_delivery_date: desiredDeliveryDate,
        discount_percent: parsedDiscount,
        items: lines.map((line) => ({
          product_id: line.productId,
          quantity: line.quantity,
          price: line.price,
          unit: line.unit,
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
        message: `Đã tạo đơn ${created.order_code} thành công. Tổng phải thu: ${formatCurrency(created.total_amount)}.`,
      });
      if (draftCleanupWarning) setError(draftCleanupWarning);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Không thể tạo đơn hàng.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="sales-order-page">
      <div className="sales-order-heading">
        <div>
          <p className="sales-order-eyebrow">BÁN HÀNG</p>
          <h1>Tạo đơn hàng</h1>
          <p className="sales-order-subtitle">Nhập đơn trực tiếp tại cửa hàng của đại lý.</p>
        </div>
        <button type="button" className="sales-order-secondary-button" onClick={onClose}>Quay lại kho hàng</button>
      </div>

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
                    const dealer = dealers.find((item) => String(item.id) === nextId);
                    setDealerId(nextId);
                    setDeliveryPoint(dealer?.address || '');
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
                  value={deliveryPointMode}
                  disabled={!selectedDealer}
                  onChange={(event) => {
                    if (event.target.value === 'registered') {
                      setDeliveryPoint(selectedDealer?.address || '');
                    } else {
                      setDeliveryPoint('');
                    }
                  }}
                >
                  <option value="" disabled>Chọn đại lý trước</option>
                  {selectedDealer?.address && (
                    <option value="registered">Địa chỉ đại lý — {selectedDealer.address}</option>
                  )}
                  <option value="custom">Điểm giao khác</option>
                </select>
                {deliveryPointMode === 'custom' && (
                  <input
                    aria-label="Địa chỉ giao hàng khác"
                    value={deliveryPoint}
                    onChange={(event) => setDeliveryPoint(event.target.value)}
                    placeholder="Nhập địa chỉ giao hàng"
                    maxLength={500}
                  />
                )}
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
                        <select value={line.unit} onChange={(event) => updateLine(index, { unit: event.target.value })}>
                          {ORDER_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
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
            <p className="sales-order-hint">Giá niêm yết được áp dụng cho mỗi đơn vị tính đã chọn.</p>
          </section>
        </section>

        <aside className="sales-order-sidebar">
          <section className="sales-order-card sales-order-summary">
            <h2>Tổng kết đơn hàng</h2>
            <div className="sales-order-summary-row">
              <span>Tổng tiền hàng</span><strong>{formatCurrency(subtotal)}</strong>
            </div>
            <label className="sales-order-discount">
              <span>Chiết khấu (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
              />
            </label>
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
          </section>
        </aside>
      </div>
    </main>
  );
}
