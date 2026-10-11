import React, { useState, useEffect, useMemo } from 'react';
import {
  ProductItem,
  User,
  DealerCreditInfo,
  getDealerCreditInfoApi,
  getOrderDealersApi,
  createOrderApi,
  listDeliveryPointsApi,
  DeliveryPoint,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface CartItem {
  product: ProductItem;
  quantity: number;
}

interface CustomerPortalViewProps {
  currentUser: User;
  token: string;
  products: ProductItem[];
  onRefreshProducts?: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToDebt?: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  currentUser,
  token,
  products,
  onRefreshProducts,
  onNavigateToOrders,
  onNavigateToDebt: _onNavigateToDebt,
}) => {
  const [customerDealer, setCustomerDealer] = useState<any | null>(null);
  const [creditInfo, setCreditInfo] = useState<DealerCreditInfo | null>(null);
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([]);
  const [loadingDealer, setLoadingDealer] = useState(true);
  const [errorDealer, setErrorDealer] = useState<string | null>(null);

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedDeliveryPointId, setSelectedDeliveryPointId] = useState<string>('');
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState<string>('');
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState<string>('');
  const [orderNote, setOrderNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<any | null>(null);

  // Search & Filter
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Lấy thông tin Đại lý & Công nợ của Customer
  useEffect(() => {
    let isMounted = true;
    const fetchDealerAndCredit = async () => {
      setLoadingDealer(true);
      setErrorDealer(null);
      try {
        const dealers = await getOrderDealersApi(token);
        if (!dealers || dealers.length === 0) {
          throw new Error('Không tìm thấy hồ sơ đại lý liên kết với tài khoản này.');
        }
        const myDealer = dealers[0];
        if (!isMounted) return;
        setCustomerDealer(myDealer);

        // Lấy credit info
        const credit = await getDealerCreditInfoApi(token, myDealer.id);
        if (!isMounted) return;
        setCreditInfo(credit);

        // Lấy delivery points
        try {
          const points = await listDeliveryPointsApi(token, myDealer.id);
          if (isMounted) {
            setDeliveryPoints(points || []);
            const defaultPt = (points || []).find((p) => p.is_default);
            if (defaultPt) {
              setSelectedDeliveryPointId(String(defaultPt.id));
            } else if (points && points.length > 0) {
              setSelectedDeliveryPointId(String(points[0].id));
            } else if (myDealer.address) {
              setCustomDeliveryAddress(myDealer.address);
            }
          }
        } catch {
          // ignore delivery points error
          if (myDealer.address && isMounted) {
            setCustomDeliveryAddress(myDealer.address);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setErrorDealer(err.message || 'Lỗi khi tải thông tin đại lý');
        }
      } finally {
        if (isMounted) {
          setLoadingDealer(false);
        }
      }
    };

    fetchDealerAndCredit();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Danh mục sản phẩm duy nhất
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Lọc sản phẩm
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchKeyword =
        !searchKeyword ||
        p.name.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        p.code.toLowerCase().includes(searchKeyword.toLowerCase());
      const matchCat =
        selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchKeyword && matchCat;
    });
  }, [products, searchKeyword, selectedCategory]);

  // Thêm vào giỏ
  const handleAddToCart = (product: ProductItem, qty: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    emitStatusToast({
      type: 'info',
      title: 'Giỏ hàng',
      message: `Đã thêm "${product.name}" vào giỏ hàng.`,
    });
  };

  // Cập nhật số lượng trong giỏ
  const handleUpdateQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  // Xóa khỏi giỏ
  const handleRemoveFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Tính tổng tiền giỏ hàng
  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => {
      const price = item.product.sell_price || 0;
      return sum + price * item.quantity;
    }, 0);
  }, [cart]);

  // Hạn mức công nợ còn lại & ước tính sau đơn
  const remainingCredit = creditInfo ? creditInfo.remaining_credit : 0;
  const remainingAfterOrder = remainingCredit - totalCartAmount;
  const isOverCredit = remainingAfterOrder < 0;

  // Gửi đơn đặt hàng
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerDealer) {
      emitStatusToast({
        type: 'error',
        title: 'Thông tin đại lý',
        message: 'Không xác định được thông tin đại lý!',
      });
      return;
    }
    if (cart.length === 0) {
      emitStatusToast({
        type: 'warning',
        title: 'Giỏ hàng trống',
        message: 'Giỏ hàng đang trống! Vui lòng chọn ít nhất 1 sản phẩm.',
      });
      return;
    }

    let deliveryPointText = customDeliveryAddress.trim();
    let deliveryPointId: number | null = null;
    if (selectedDeliveryPointId && selectedDeliveryPointId !== 'custom') {
      const pt = deliveryPoints.find((p) => String(p.id) === selectedDeliveryPointId);
      if (pt) {
        deliveryPointText = pt.label ? `${pt.label} - ${pt.address}` : pt.address;
        deliveryPointId = pt.id;
      }
    }

    if (!deliveryPointText) {
      emitStatusToast({
        type: 'warning',
        title: 'Điểm nhận hàng',
        message: 'Vui lòng chọn hoặc nhập điểm nhận hàng!',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const orderPayload = {
        dealer_id: customerDealer.id,
        delivery_point: deliveryPointText,
        delivery_point_id: deliveryPointId,
        desired_delivery_date: desiredDeliveryDate || undefined,
        note: orderNote.trim() || undefined,
        items: cart.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.sell_price || 0,
        })),
      };

      const result = await createOrderApi(token, orderPayload);
      setSubmittedOrder(result);
      setCart([]);
      setOrderNote('');
      emitStatusToast({
        type: 'success',
        title: 'Đặt hàng thành công',
        message: `Đơn hàng ${result.order_code || ''} đã gửi thành công! Đang chờ Nhân viên phụ trách duyệt.`,
      });
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Không thể tạo đơn hàng',
        message: err.message || 'Không thể tạo đơn hàng. Vui lòng thử lại!',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-screen flex-1 overflow-y-auto bg-slate-50 flex flex-col pb-20">
      {/* Header Chào Mừng & Banner Đại Lý */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4 sm:py-5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {customerDealer?.customer_group || 'Đại lý chính thức'}
              </span>
              <span className="text-xs text-gray-500">
                Mã: {customerDealer?.dealer_code || currentUser.username}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
              Cổng Đặt Hàng Trực Tuyến
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5">
              Chào mừng <span className="font-semibold text-gray-900">{customerDealer?.dealer_name || currentUser.full_name || currentUser.username}</span>. Chọn sản phẩm và gửi đơn đặt hàng nhanh chóng.
            </p>
          </div>
        </div>

        {/* Thanh KPI Hạn mức công nợ tinh gọn dàn ngang */}
        <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-sm text-gray-500 font-medium">Hạn mức công nợ được cấp</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
                {creditInfo ? `${creditInfo.credit_limit.toLocaleString('vi-VN')} đ` : '—'}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs">
              <div className="text-sm text-gray-500 font-medium">Dư nợ hiện tại</div>
              <div className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">
                {creditInfo ? `${creditInfo.current_debt.toLocaleString('vi-VN')} đ` : '—'}
              </div>
            </div>

            <div className={`border rounded-xl p-3.5 shadow-xs ${
              remainingCredit > 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50 border-rose-200'
            }`}>
              <div className="text-sm font-medium flex items-center justify-between">
                <span className={remainingCredit > 0 ? 'text-emerald-800' : 'text-rose-800'}>Hạn mức công nợ còn lại</span>
                {remainingCredit > 0 && (
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                )}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1" id="label-remaining-credit">
                {creditInfo ? `${creditInfo.remaining_credit.toLocaleString('vi-VN')} đ` : '—'}
              </div>
            </div>
          </div>

          {creditInfo?.is_overdue && (
            <div className="mt-3 px-3 py-2 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span><strong>Cảnh báo quá hạn:</strong> Đại lý có khoản công nợ đã vượt quá số ngày cho phép ({creditInfo.overdue_days_allowed} ngày). Đơn hàng đặt mới sẽ yêu cầu Quản lý xét duyệt!</span>
            </div>
          )}
        </div>
      </div>

      {/* Thân Cổng Đặt Hàng: Responsive flex-col hoặc lg:flex-row */}
      <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-6 flex-1 flex flex-col lg:flex-row gap-6">
        {/* CỘT TRÁI: DANH SÁCH SẢN PHẨM & BỘ LỌC */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Thanh tìm kiếm & phân loại */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 flex items-center">
              <div
                className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-gray-400 z-10"
                style={{ width: '18px', height: '18px' }}
              >
                <svg
                  className="w-4 h-4 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ display: 'block', width: '16px', height: '16px' }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <input
                type="text"
                id="input-product-search"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm sản phẩm theo tên hoặc mã SKU..."
                style={{ paddingLeft: '44px' }}
                className="w-full pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-gray-900 placeholder:text-gray-400 transition-colors"
              />
            </div>

            <select
              id="select-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="py-2.5 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-gray-700"
            >
              <option value="ALL">Tất cả danh mục ({products.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {errorDealer && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              ⚠️ {errorDealer}
            </div>
          )}
          {loadingDealer && (
            <div className="text-center py-1 text-xs text-gray-400">
              Đang đồng bộ dữ liệu đại lý...
            </div>
          )}

          {/* Lưới sản phẩm */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 shadow-sm">
              <div className="text-3xl mb-2">🔍</div>
              <div className="font-semibold text-gray-800 text-base">Không tìm thấy sản phẩm phù hợp</div>
              <p className="text-sm text-gray-500 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProducts.map((p) => {
                const cartItem = cart.find((it) => it.product.id === p.id);
                const currentQtyInCart = cartItem ? cartItem.quantity : 0;
                const unitPrice = p.sell_price || 0;
                const hasStock = (p.stock ?? 0) > 0;

                return (
                  <div
                    key={p.id}
                    id={`product-card-${p.id}`}
                    className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {p.code}
                        </span>
                        {p.category && (
                          <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {p.category}
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2" title={p.name}>
                        {p.name}
                      </h3>

                      <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                        {p.base_unit && <div>Đơn vị: <strong className="text-gray-700">{p.base_unit}</strong></div>}
                        {p.packaging_specification && <div>Quy cách: <span className="text-gray-700">{p.packaging_specification}</span></div>}
                        <div>
                          Tồn kho: <strong className={hasStock ? 'text-emerald-600' : 'text-rose-500'}>
                            {p.stock ?? 0} {p.base_unit || 'cái'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="flex items-baseline justify-between mb-3">
                        <span className="text-xs text-gray-500">Giá đại lý:</span>
                        <div className="text-right">
                          <span className="text-lg font-bold text-emerald-700">
                            {unitPrice.toLocaleString('vi-VN')} đ
                          </span>
                          <span className="text-[10px] text-gray-400 block">/ {p.base_unit || 'sản phẩm'}</span>
                        </div>
                      </div>

                      {/* Bộ điều khiển thêm vào giỏ */}
                      {currentQtyInCart > 0 ? (
                        <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-1 border border-emerald-200">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(p.id, currentQtyInCart - 1)}
                            className="w-7 h-7 flex items-center justify-center rounded bg-white text-emerald-800 font-bold border border-emerald-200 shadow-xs hover:bg-emerald-100 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-emerald-900 px-2">
                            {currentQtyInCart} trong giỏ
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddToCart(p, 1)}
                            className="w-7 h-7 flex items-center justify-center rounded bg-emerald-600 text-white font-bold shadow-xs hover:bg-emerald-700 cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          id={`btn-add-product-${p.id}`}
                          onClick={() => handleAddToCart(p, 1)}
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                        >
                          Thêm vào giỏ hàng
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: GIỎ HÀNG & THÔNG TIN ĐẶT HÀNG (RESPONSIVE CART PANEL) */}
        <div id="customer-cart-panel" className="w-full lg:w-96 flex-shrink-0 scroll-mt-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm sticky top-4 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-gray-900 text-base">Giỏ Hàng Của Bạn</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {cart.reduce((sum, it) => sum + it.quantity, 0)} mặt hàng
              </span>
            </div>

            <form onSubmit={handleSubmitOrder} className="p-5 flex flex-col gap-4">
              {/* Danh sách sản phẩm trong giỏ */}
              {cart.length === 0 ? (
                <div className="py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  <p className="text-sm">Chưa có sản phẩm nào trong giỏ</p>
                  <span className="text-xs text-gray-400 mt-1 block">Chọn sản phẩm ở danh sách bên trái</span>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                  {cart.map((item) => {
                    const lineTotal = (item.product.sell_price || 0) * item.quantity;
                    return (
                      <div
                        key={item.product.id}
                        className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-gray-50 border border-gray-200/80 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 truncate" title={item.product.name}>
                            {item.product.name}
                          </div>
                          <div className="text-gray-500 mt-0.5">
                            {item.product.sell_price?.toLocaleString('vi-VN')} đ × {item.quantity}
                          </div>
                          <div className="text-sm font-semibold text-emerald-700 mt-0.5">
                            = {lineTotal.toLocaleString('vi-VN')} đ
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-xs">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            className="w-6 h-6 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.product.id)}
                            className="w-6 h-6 flex items-center justify-center rounded text-rose-500 hover:bg-rose-50 ml-1 cursor-pointer"
                            title="Xóa khỏi giỏ"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* BẢNG TÍNH TOÁN CÔNG NỢ & TỔNG TIỀN */}
              <div className="bg-slate-50 border border-gray-200 rounded-lg p-3.5 space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-600">
                  <span className="font-medium text-gray-500">Hạn mức công nợ còn lại:</span>
                  <span className="font-bold text-gray-900" id="cart-widget-credit-left">
                    {creditInfo ? `${creditInfo.remaining_credit.toLocaleString('vi-VN')} đ` : '—'}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t border-gray-200">
                  <span className="text-gray-900">Tổng tiền giỏ hàng:</span>
                  <span className="text-lg font-bold text-emerald-700" id="cart-widget-total-amount">
                    {totalCartAmount.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div className={`flex justify-between items-center pt-1 font-semibold ${
                  isOverCredit ? 'text-amber-700' : 'text-slate-600'
                }`}>
                  <span className="font-medium text-gray-500">Hạn mức còn lại sau đơn:</span>
                  <span className="font-bold">
                    {remainingAfterOrder.toLocaleString('vi-VN')} đ
                  </span>
                </div>

                {isOverCredit && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-300 rounded text-amber-800 text-[11px] leading-tight">
                    ⚠️ <strong>Vượt hạn mức tín dụng:</strong> Đơn hàng sẽ tự động đưa vào trạng thái <strong>Chờ Quản Lý Duyệt</strong>.
                  </div>
                )}
              </div>

              {/* Form thông tin giao nhận */}
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Điểm nhận hàng <span className="text-rose-500">*</span>
                  </label>
                  {deliveryPoints.length > 0 ? (
                    <select
                      id="select-delivery-point"
                      value={selectedDeliveryPointId}
                      onChange={(e) => setSelectedDeliveryPointId(e.target.value)}
                      className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      {deliveryPoints.map((dp) => (
                        <option key={dp.id} value={String(dp.id)}>
                          {dp.label ? `${dp.label} - ${dp.address}` : dp.address}
                        </option>
                      ))}
                      <option value="custom">-- Nhập địa chỉ khác --</option>
                    </select>
                  ) : null}

                  {(deliveryPoints.length === 0 || selectedDeliveryPointId === 'custom') && (
                    <input
                      type="text"
                      id="input-custom-delivery-address"
                      value={customDeliveryAddress}
                      onChange={(e) => setCustomDeliveryAddress(e.target.value)}
                      placeholder="Nhập địa chỉ nhận hàng chi tiết..."
                      className="w-full mt-1.5 p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Ngày yêu cầu giao hàng
                  </label>
                  <input
                    type="date"
                    id="input-desired-delivery-date"
                    value={desiredDeliveryDate}
                    onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Ghi chú đơn hàng (nếu có)
                  </label>
                  <textarea
                    id="input-order-note"
                    rows={2}
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Ghi chú đóng gói, thời gian giao thuận tiện..."
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              </div>

              {/* Nút gửi đơn hàng */}
              <button
                type="submit"
                id="btn-submit-dealer-order"
                disabled={isSubmitting || cart.length === 0}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                  isSubmitting || cart.length === 0
                    ? 'bg-gray-400 cursor-not-allowed opacity-70'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Đang gửi đơn hàng...
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    Gửi Đơn Đặt Hàng ({totalCartAmount.toLocaleString('vi-VN')} đ)
                  </>
                )}
              </button>

              <div className="text-[11px] text-gray-500 text-center">
                Đơn hàng của Đại lý sẽ được tự động tạo với trạng thái <strong>Chờ Duyệt</strong> để Bộ phận Bán hàng xác nhận và giữ chỗ kho.
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Floating Action Button (FAB) trên Mobile để xem và cuộn nhanh xuống Giỏ Hàng */}
      <div className="lg:hidden fixed bottom-5 right-5 z-40">
        <button
          type="button"
          id="btn-mobile-floating-cart"
          onClick={() => {
            const cartElement = document.getElementById('customer-cart-panel');
            if (cartElement) {
              cartElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }}
          className="flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white px-4 py-3 rounded-full shadow-2xl transition-all cursor-pointer font-medium text-sm border border-emerald-500/30"
          title="Xem giỏ hàng"
        >
          <span className="font-semibold">
            Giỏ hàng ({cart.reduce((sum, it) => sum + it.quantity, 0)})
          </span>
          {totalCartAmount > 0 && (
            <span className="bg-emerald-800/80 px-2 py-0.5 rounded-full text-xs font-bold">
              {totalCartAmount.toLocaleString('vi-VN')} đ
            </span>
          )}
        </button>
      </div>

      {/* MODAL THÔNG BÁO TẠO ĐƠN THÀNH CÔNG */}
      {submittedOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 text-center animate-in fade-in zoom-in duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl mb-4">
              ✓
            </div>
            <h3 className="text-xl font-bold text-gray-900">Đặt Hàng Thành Công!</h3>
            <p className="text-sm text-gray-600 mt-1">
              Đơn hàng của bạn đã được tiếp nhận thành công vào hệ thống.
            </p>

            <div className="bg-slate-50 rounded-xl p-4 my-4 text-left text-xs space-y-1.5 border border-gray-200">
              <div className="flex justify-between">
                <span className="text-gray-500">Mã đơn hàng:</span>
                <span className="font-bold text-gray-900" id="success-order-code">
                  {submittedOrder.order_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Trạng thái:</span>
                <span className="font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {submittedOrder.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : submittedOrder.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tổng giá trị:</span>
                <span className="text-base font-bold text-emerald-700">
                  {(submittedOrder.total_amount || totalCartAmount).toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                id="btn-close-success-modal"
                onClick={() => setSubmittedOrder(null)}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition-colors cursor-pointer"
              >
                Tiếp tục mua hàng
              </button>
              {onNavigateToOrders && (
                <button
                  type="button"
                  id="btn-goto-my-orders"
                  onClick={() => {
                    setSubmittedOrder(null);
                    onNavigateToOrders();
                  }}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-sm transition-colors cursor-pointer shadow-sm"
                >
                  Xem đơn hàng của tôi
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CustomerPortalView;
