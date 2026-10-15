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
  getProductImageUrl,
  getProductsApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { getOrderStatusLabel } from '../utils/orderPermissions';

interface CartItem {
  product: ProductItem;
  quantity: number;
}

interface CustomerPortalViewProps {
  currentUser: User;
  token: string;
  products: ProductItem[];
  appliedPriceBook?: string | null;
  onRefreshProducts?: () => void;
  onNavigateToOrders?: () => void;
  onNavigateToDebt?: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  currentUser,
  token,
  products,
  appliedPriceBook,
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Phân trang Server-Side (20 sản phẩm/trang - chống lag cho kho 10.000 sản phẩm)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [serverProducts, setServerProducts] = useState<ProductItem[]>([]);
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);

  // Tham chiếu vùng cuộn danh sách sản phẩm để cuộn mượt mà khi chuyển trang
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Debounce tìm kiếm 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  // Reset về trang 1 khi thay đổi từ khóa hoặc danh mục
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory]);

  // Tải danh sách sản phẩm phân trang từ Server
  const loadCustomerProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const res = await getProductsApi(token, {
        page: currentPage,
        limit: 20,
        search: debouncedSearch.trim() || undefined,
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
      });
      const items = res.data || res.items || [];
      setServerProducts(items);
      setTotalProducts(res.total ?? items.length);
      setTotalPages(res.total_pages || Math.ceil((res.total ?? items.length) / 20) || 1);
    } catch (err) {
      console.warn('Lỗi tải sản phẩm phân trang:', err);
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadCustomerProducts();
  }, [token, currentPage, debouncedSearch, selectedCategory]);

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
    ['Thời trang', 'Giày dép', 'Phụ kiện', 'Đồ uống'].forEach((c) => set.add(c));
    (products || []).forEach((p) => {
      if (p.category) set.add(p.category);
    });
    serverProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products, serverProducts]);

  // Danh sách sản phẩm hiển thị đã được phân trang & lọc từ Server
  const displayProducts = serverProducts;

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

  // Cập nhật số lượng qua nút bấm + / -
  const handleUpdateQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    const cartItem = cart.find((i) => i.product.id === productId);
    const stock = cartItem?.product.stock;
    if (stock !== undefined && stock !== null && stock > 0 && newQty > stock) {
      emitStatusToast({
        type: 'warning',
        title: 'Tồn kho giới hạn',
        message: `Số lượng không thể vượt quá tồn kho hiện có (${stock} sản phẩm).`,
      });
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: newQty } : item
      )
    );
  };

  // Cập nhật số lượng khi gõ trực tiếp trong ô input (onChange)
  const handleQuantityInputChange = (productId: number, rawValue: string) => {
    const cleanDigits = rawValue.replace(/[^0-9]/g, '');
    const parsedQty = cleanDigits === '' ? 0 : parseInt(cleanDigits, 10);
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity: parsedQty } : item
      )
    );
  };

  // Kiểm duyệt số lượng khi click ra ngoài ô input (onBlur)
  const handleQuantityInputBlur = (productId: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product.id !== productId) return item;
        let qty = item.quantity;
        // 1. Nếu ô nhập bị trống, số âm hoặc bằng 0 -> ép về 1
        if (!qty || qty <= 0) {
          qty = 1;
        }
        // 2. Nếu vượt quá tồn kho (nếu có check) -> ép về tồn tối đa
        const stock = item.product.stock;
        if (stock !== undefined && stock !== null && stock > 0 && qty > stock) {
          qty = stock;
          emitStatusToast({
            type: 'warning',
            title: 'Điều chỉnh số lượng',
            message: `Số lượng vượt quá tồn kho (${stock}). Hệ thống đã tự điều chỉnh về ${stock}.`,
          });
        }
        return { ...item, quantity: qty };
      })
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
    <div className="w-full h-full flex-1 bg-slate-50 flex flex-col overflow-hidden">
      {/* =========================================================================
          KHỐI CỐ ĐỊNH TRÊN CÙNG (IMMOBILE FIXED HEADER): TOÀN BỘ TIÊU ĐỀ ĐẠI LÝ VÀ 3 THẺ CÔNG NỢ
          - Thu gọn tối đa chiều dọc (vertical space) để không chiếm diện tích màn hình
      ========================================================================= */}
      <div className="flex-shrink-0 z-30 bg-white border-b border-gray-200 shadow-xs">
        {/* 1. Header Chào Mừng & Banner Đại Lý - Tinh gọn */}
        <div className="px-4 md:px-8 py-2.5 border-b border-gray-100">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  {customerDealer?.customer_group || 'Đại lý Cấp 1'}
                </span>
                <span className="text-[11px] text-gray-500 font-mono">
                  Mã: {customerDealer?.dealer_code || currentUser.username}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-800 tracking-tight">
                Cổng Đặt Hàng Trực Tuyến
              </h1>
              <p className="text-xs text-gray-500">
                Chào mừng <span className="font-semibold text-gray-800">{customerDealer?.dealer_name || currentUser.full_name || currentUser.username}</span>. Chọn sản phẩm và gửi đơn đặt hàng nhanh chóng.
              </p>
            </div>
          </div>
        </div>

        {/* 2. Cụm 3 thẻ chỉ số tài chính / Hạn mức công nợ - Thu gọn padding & font-size dạng dải card nhỏ gọn */}
        <div className="px-4 md:px-8 py-2 bg-slate-50/60">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-white border border-gray-200/90 rounded-lg py-2 px-3.5 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Hạn mức công nợ được cấp</div>
                  <div className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                    {creditInfo ? `${creditInfo.credit_limit.toLocaleString('vi-VN')} đ` : '—'}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200/90 rounded-lg py-2 px-3.5 shadow-2xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-gray-500 font-medium">Dư nợ hiện tại</div>
                  <div className="text-base sm:text-lg font-bold text-amber-700 leading-tight">
                    {creditInfo ? `${creditInfo.current_debt.toLocaleString('vi-VN')} đ` : '—'}
                  </div>
                </div>
              </div>

              <div className={`border rounded-lg py-2 px-3.5 shadow-2xs flex items-center justify-between ${
                remainingCredit > 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50 border-rose-200'
              }`}>
                <div>
                  <div className="text-[11px] font-medium flex items-center gap-1.5">
                    <span className={remainingCredit > 0 ? 'text-emerald-800' : 'text-rose-800'}>Hạn mức công nợ còn lại</span>
                    {remainingCredit > 0 && (
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-emerald-700 leading-tight" id="label-remaining-credit">
                    {creditInfo ? `${creditInfo.remaining_credit.toLocaleString('vi-VN')} đ` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {creditInfo?.is_overdue && (
              <div className="mt-2 px-2.5 py-1.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span><strong>Cảnh báo quá hạn:</strong> Đại lý có khoản công nợ đã vượt quá số ngày cho phép ({creditInfo.overdue_days_allowed} ngày). Đơn hàng đặt mới sẽ yêu cầu Quản lý xét duyệt!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          KHỐI NỘI DUNG CUỘN (SCROLLABLE CONTAINER): Sản phẩm, Bộ lọc, Phân trang, Giỏ hàng
          - Cấu trúc 2 cột items-start để bên phải không bị kéo dãn và giỏ hàng sticky cố định tầm nhìn
      ========================================================================= */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full">
        {/* Thân Cổng Đặt Hàng: items-start để 2 cột độc lập chiều cao */}
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-5 flex flex-col lg:flex-row items-start gap-6 pb-20">
          {/* CỘT TRÁI: DANH SÁCH SẢN PHẨM & BỘ LỌC (lg:w-2/3) */}
          <div className="w-full lg:w-2/3 flex-1 min-w-0 flex flex-col gap-4">
            {/* Banner Bảng giá áp dụng cho đại lý */}
            <div className="bg-blue-50/90 border border-blue-200/90 rounded-2xl px-4 py-2.5 sm:py-3 flex items-center gap-3 text-xs sm:text-sm text-slate-700 shadow-xs">
              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs font-bold select-none">
                ℹ
              </div>
              <div className="leading-relaxed">
                Đang áp dụng <strong className="text-slate-900 font-semibold">{appliedPriceBook || `Bảng giá đại lý (${customerDealer?.customer_group || 'Đại lý Cấp 1'})`}</strong>. Đơn giá hiển thị dưới đây đã được tính tự động theo mức chiết khấu quy định cho nhóm của bạn.
              </div>
            </div>

            {/* Thanh tìm kiếm & phân loại */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-3">
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
                <option value="ALL">Tất cả danh mục ({totalProducts})</option>
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
            {isLoadingProducts && (
              <div className="flex items-center justify-center gap-2.5 py-3 px-4 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs font-semibold text-indigo-700 shadow-xs">
                <svg className="w-4 h-4 animate-spin text-indigo-600 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Đang tải 20 sản phẩm trang {currentPage} từ máy chủ... (Tải phân trang theo yêu cầu)</span>
              </div>
            )}

            {/* Lưới sản phẩm */}
            {isLoadingProducts && displayProducts.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="bg-white rounded-2xl border border-gray-200 p-3.5 flex flex-col justify-between">
                    <div>
                      <div className="w-full h-44 rounded-xl bg-gray-100 mb-3" />
                      <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
                      <div className="h-4 w-3/4 bg-gray-200 rounded mb-3" />
                      <div className="h-5 w-1/2 bg-gray-200 rounded" />
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-gray-100">
                      <div className="h-8 bg-gray-200 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 shadow-sm">
                <div className="text-3xl mb-2">🔍</div>
                <div className="font-semibold text-gray-800 text-base">Không tìm thấy sản phẩm phù hợp</div>
                <p className="text-sm text-gray-500 mt-1">Thử thay đổi từ khóa tìm kiếm hoặc chọn danh mục khác.</p>
              </div>
            ) : (
              <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-200 ${isLoadingProducts ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {displayProducts.map((p) => {
                  const cartItem = cart.find((it) => it.product.id === p.id);
                  const currentQtyInCart = cartItem ? cartItem.quantity : 0;
                  const unitPrice = p.sell_price || 0;
                  const hasStock = (p.stock ?? 0) > 0;
                  const primaryImage = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;

                  return (
                    <div
                      key={p.id}
                      id={`product-card-${p.id}`}
                      className="bg-white rounded-2xl border border-gray-200/90 p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
                    >
                      <div>
                        {/* Vùng ảnh sản phẩm */}
                        <div className="relative w-full h-44 sm:h-48 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center overflow-hidden mb-3 select-none">
                          {primaryImage ? (
                            <img
                              src={getProductImageUrl(primaryImage)}
                              alt={p.name}
                              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                              onError={(e) => {
                                // Khi link ảnh bị lỗi, ẩn thẻ img và hiển thị fallback icon
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.parentElement?.querySelector('.product-fallback-icon');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }}
                            />
                          ) : null}

                          {/* Fallback box icon (khi không có ảnh hoặc ảnh lỗi) */}
                          <div
                            className="product-fallback-icon w-16 h-16 rounded-2xl bg-indigo-50/80 border border-indigo-100 flex items-center justify-center text-indigo-500 shadow-xs"
                            style={{ display: primaryImage ? 'none' : 'flex' }}
                          >
                            <svg
                              className="w-8 h-8"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m7.5 4.27 9 5.15" />
                              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                              <path d="m3.3 7 8.7 5 8.7-5" />
                              <path d="M12 22V12" />
                            </svg>
                          </div>

                          {/* Huy hiệu tồn kho ở đáy ảnh */}
                          <div className="absolute bottom-2 left-0 right-0 flex justify-center px-2 pointer-events-none">
                            {hasStock ? (
                              <span className="px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs backdrop-blur-xs">
                                Kho còn: {p.stock} {p.base_unit || 'Cái'}
                              </span>
                            ) : (
                              <span className="px-3 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-600 border border-rose-200 shadow-xs backdrop-blur-xs">
                                Hết hàng (Tồn: 0)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Thông tin mã SKU & Nhóm */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                            {p.code}
                          </span>
                          {p.category && (
                            <span className="text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                              {p.category}
                            </span>
                          )}
                        </div>

                        {/* Tên sản phẩm */}
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 min-h-[38px]" title={p.name}>
                          {p.name}
                        </h3>

                        {/* Giá bán đại lý */}
                        <div className="mt-2.5 flex items-baseline gap-1">
                          <span className="text-base font-bold text-gray-900">
                            {unitPrice.toLocaleString('vi-VN')} đ
                          </span>
                          <span className="text-xs font-normal text-gray-400">/{p.base_unit || 'sp'}</span>
                        </div>
                      </div>

                      {/* Nút thao tác thêm vào giỏ */}
                      <div className="mt-3 pt-2.5 border-t border-gray-100">
                        {!hasStock ? (
                          <button
                            type="button"
                            disabled
                            className="w-full py-2.5 px-3 bg-gray-100 text-gray-400 rounded-xl text-xs font-semibold flex items-center justify-center cursor-not-allowed border border-gray-200"
                          >
                            Hết hàng
                          </button>
                        ) : currentQtyInCart > 0 ? (
                          <div className="flex items-center justify-between bg-indigo-50/70 rounded-xl p-1 border border-indigo-200">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(p.id, currentQtyInCart - 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-indigo-700 font-bold border border-indigo-200 shadow-xs hover:bg-indigo-100 cursor-pointer"
                              title="Giảm số lượng"
                            >
                              -
                            </button>
                            <span className="text-xs font-bold text-indigo-900 px-2">
                              {currentQtyInCart} trong giỏ
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddToCart(p, 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
                              title="Thêm số lượng"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            id={`btn-add-product-${p.id}`}
                            onClick={() => handleAddToCart(p, 1)}
                            className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            Thêm giỏ
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Thanh Điều Hướng Phân Trang Server-Side (Pagination Controls) */}
            {(totalProducts > 0 || displayProducts.length > 0) && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-gray-200 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                  <span>
                    Hiển thị trang <strong className="text-gray-900 font-semibold">{currentPage}</strong> / <strong className="text-gray-900 font-semibold">{totalPages}</strong> (Tổng <strong className="text-indigo-600 font-semibold">{totalProducts}</strong> sản phẩm)
                  </span>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                    20 sản phẩm / trang
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    id="btn-prev-page"
                    disabled={currentPage <= 1 || isLoadingProducts}
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage((p) => p - 1);
                        scrollToTop();
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1 ${
                      currentPage <= 1 || isLoadingProducts
                        ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:bg-gray-100 shadow-xs cursor-pointer'
                    }`}
                  >
                    &larr; Trang trước
                  </button>

                  {/* Các nút số trang */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((pageNumber) => {
                        return (
                          pageNumber === 1 ||
                          pageNumber === totalPages ||
                          Math.abs(pageNumber - currentPage) <= 1
                        );
                      })
                      .map((pageNumber, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsis = prev && pageNumber - prev > 1;
                        return (
                          <React.Fragment key={pageNumber}>
                            {showEllipsis && (
                              <span className="px-1 text-xs text-gray-400 select-none">...</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setCurrentPage(pageNumber);
                                scrollToTop();
                              }}
                              className={`min-w-[32px] h-8 px-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                                currentPage === pageNumber
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {pageNumber}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    id="btn-next-page"
                    disabled={currentPage >= totalPages || isLoadingProducts}
                    onClick={() => {
                      if (currentPage < totalPages) {
                        setCurrentPage((p) => p + 1);
                        scrollToTop();
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1 ${
                      currentPage >= totalPages || isLoadingProducts
                        ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 active:bg-gray-100 shadow-xs cursor-pointer'
                    }`}
                  >
                    Trang sau &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CỘT PHẢI: GIỎ HÀNG & THÔNG TIN ĐẶT HÀNG (STICKY & ÉP CỨNG CHIỀU CAO) */}
          <div id="customer-cart-panel" className="w-full lg:w-1/3 flex-shrink-0 sticky top-4 flex flex-col h-[calc(100vh-120px)] max-h-[calc(100vh-120px)]">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-full max-h-full overflow-hidden">
              
              {/* PHẦN 1: HEADER (Tiêu đề Giỏ Hàng Của Bạn) */}
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-slate-50/70 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-gray-900 text-sm sm:text-base">Giỏ Hàng Của Bạn</h2>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                  {cart.reduce((sum, it) => sum + it.quantity, 0)} mặt hàng
                </span>
              </div>

              {/* Form đặt hàng bọc Body và Footer, giữ nguyên layout flex cột */}
              <form onSubmit={handleSubmitOrder} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                
                {/* PHẦN 2: BODY (Chỉ cuộn danh sách món hàng đã chọn) */}
                <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-2.5 pr-2">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-8 text-center text-gray-400 border border-dashed border-gray-200 rounded-lg">
                      <p className="text-sm font-medium">Chưa có sản phẩm nào trong giỏ</p>
                      <span className="text-xs text-gray-400 mt-1 block">Chọn sản phẩm ở danh sách bên trái</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((item) => {
                        const lineTotal = (item.product.sell_price || 0) * item.quantity;
                        return (
                          <div
                            key={item.product.id}
                            className="flex items-start justify-between gap-2.5 p-2 rounded-xl bg-gray-50 border border-gray-200/80 text-xs"
                          >
                            {/* Thumbnail ảnh sản phẩm trong giỏ */}
                            <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {item.product.images && item.product.images.length > 0 ? (
                                <img
                                  src={getProductImageUrl(item.product.images[0])}
                                  alt=""
                                  className="w-full h-full object-contain p-0.5"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-gray-400 text-xs select-none">📦</span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-gray-900 truncate" title={item.product.name}>
                                {item.product.name}
                              </div>
                              <div className="text-gray-500 mt-0.5">
                                {item.product.sell_price?.toLocaleString('vi-VN')} đ × {item.quantity}
                              </div>
                              <div className="text-xs font-semibold text-emerald-700 mt-0.5">
                                = {lineTotal.toLocaleString('vi-VN')} đ
                              </div>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                                className="w-5.5 h-5.5 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 cursor-pointer select-none"
                                title="Giảm số lượng"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={item.product.stock || undefined}
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => handleQuantityInputChange(item.product.id, e.target.value)}
                                onBlur={() => handleQuantityInputBlur(item.product.id)}
                                className="w-10 text-center bg-transparent border border-gray-300 rounded text-xs font-bold py-0.5 outline-none appearance-none focus:border-emerald-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                title="Nhập số lượng trực tiếp"
                                aria-label={`Số lượng cho ${item.product.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                                className="w-5.5 h-5.5 flex items-center justify-center rounded bg-white border border-gray-300 text-gray-700 font-bold hover:bg-gray-100 cursor-pointer select-none"
                                title="Tăng số lượng"
                              >
                                +
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveFromCart(item.product.id)}
                                className="w-5.5 h-5.5 flex items-center justify-center rounded text-rose-500 hover:bg-rose-50 ml-0.5 cursor-pointer"
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
                </div>

                {/* PHẦN 3: FOOTER (Tổng tiền + Form Điểm nhận hàng + Nút Đặt hàng) - GHIM CỐ ĐỊNH Ở ĐÁY KHÔNG BỊ CO GIÃN */}
                <div className="shrink-0 mt-auto bg-white pt-3 px-3.5 pb-3 border-t border-gray-200 shadow-xs space-y-2.5">
                  {/* BẢNG TÍNH TOÁN CÔNG NỢ & TỔNG TIỀN */}
                  <div className="bg-slate-50 border border-gray-200/90 rounded-lg p-2.5 space-y-1 text-xs">
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="font-medium text-gray-500">Hạn mức công nợ còn lại:</span>
                      <span className="font-bold text-gray-900" id="cart-widget-credit-left">
                        {creditInfo ? `${creditInfo.remaining_credit.toLocaleString('vi-VN')} đ` : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-gray-200">
                      <span className="text-gray-900">Tổng tiền giỏ hàng:</span>
                      <span className="text-sm font-bold text-emerald-700" id="cart-widget-total-amount">
                        {totalCartAmount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    <div className={`flex justify-between items-center pt-0.5 font-semibold ${isOverCredit ? 'text-amber-700' : 'text-slate-600'}`}>
                      <span className="font-medium text-gray-500">Hạn mức còn lại sau đơn:</span>
                      <span className="font-bold">
                        {remainingAfterOrder.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    {isOverCredit && (
                      <div className="mt-1 p-1.5 bg-amber-50 border border-amber-300 rounded text-amber-800 text-[10.5px] leading-tight">
                        ⚠️ <strong>Vượt hạn mức tín dụng:</strong> Sẽ chuyển sang trạng thái <strong>Chờ Quản Lý Duyệt</strong>.
                      </div>
                    )}
                  </div>

                  {/* FORM ĐIỂM NHẬN HÀNG & THỜI GIAN GIAO HÀNG */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="font-semibold text-gray-700">
                          Điểm nhận hàng <span className="text-rose-500">*</span>
                        </label>
                      </div>
                      {deliveryPoints.length > 0 ? (
                        <select
                          id="select-delivery-point"
                          value={selectedDeliveryPointId}
                          onChange={(e) => setSelectedDeliveryPointId(e.target.value)}
                          className="w-full p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
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
                          className="w-full mt-1 p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
                          required
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-0.5">
                          Ngày nhận
                        </label>
                        <input
                          type="date"
                          id="input-desired-delivery-date"
                          value={desiredDeliveryDate}
                          onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-0.5">
                          Ghi chú
                        </label>
                        <input
                          type="text"
                          id="input-order-note"
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          placeholder="Ghi chú đóng gói..."
                          className="w-full p-1.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* NÚT ĐẶT HÀNG */}
                  <button
                    type="submit"
                    id="btn-submit-dealer-order"
                    disabled={isSubmitting || cart.length === 0}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-1.5 ${isSubmitting || cart.length === 0
                      ? 'bg-gray-400 cursor-not-allowed opacity-70'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] cursor-pointer'
                      }`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-3.5 w-3.5 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Đang gửi đơn hàng...
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Gửi Đơn Đặt Hàng ({totalCartAmount.toLocaleString('vi-VN')} đ)
                      </>
                    )}
                  </button>

                  <div className="text-[10px] text-gray-400 text-center leading-tight">
                    Đơn hàng sẽ tạo với trạng thái <strong>Chờ Duyệt</strong> để Bộ phận Bán hàng xác nhận và giữ kho.
                  </div>
                </div>

              </form>
            </div>
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
                  {getOrderStatusLabel(submittedOrder.status)}
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
