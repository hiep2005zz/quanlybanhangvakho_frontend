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
  activeView?: 'products' | 'cart';
  onViewChange?: (view: 'products' | 'cart') => void;
}

const isOutOfStockProduct = (p?: { stock?: number | null; status?: string } | null): boolean => {
  if (!p) return true;
  return (p.stock ?? 0) <= 0 || p.status === 'inactive' || (p.status as string) === 'out_of_stock';
};

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  currentUser,
  token,
  products,
  appliedPriceBook,
  onRefreshProducts,
  onNavigateToOrders,
  onNavigateToDebt: _onNavigateToDebt,
  activeView = 'products',
  onViewChange,
}) => {
  const [customerDealer, setCustomerDealer] = useState<any | null>(null);
  const [creditInfo, setCreditInfo] = useState<DealerCreditInfo | null>(null);
  const [deliveryPoints, setDeliveryPoints] = useState<DeliveryPoint[]>([]);
  const [loadingDealer, setLoadingDealer] = useState(true);
  const [errorDealer, setErrorDealer] = useState<string | null>(null);

  // Chế độ xem: 'products' (Danh sách sản phẩm) hoặc 'cart' (Trang giỏ hàng của tôi)
  const [viewMode, setViewMode] = useState<'products' | 'cart'>(activeView || 'products');

  useEffect(() => {
    if (activeView && activeView !== viewMode) {
      setViewMode(activeView);
    }
  }, [activeView]);

  const handleSwitchView = (newView: 'products' | 'cart') => {
    setViewMode(newView);
    if (onViewChange) {
      onViewChange(newView);
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const CART_STORAGE_KEY = `ttcs_cart_${currentUser.username}`;

  // Cart State (Được nạp từ localStorage để giữ lại giỏ hàng)
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  // Tự động lưu và phát sự kiện đồng bộ giỏ hàng toàn app
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {}
    const count = cart.reduce((sum, it) => sum + it.quantity, 0);
    window.dispatchEvent(new CustomEvent('ttcs-cart-updated', { detail: { count } }));
  }, [cart, currentUser.username]);

  const totalCartCount = useMemo(() => {
    return cart.reduce((sum, it) => sum + it.quantity, 0);
  }, [cart]);

  const [selectedDeliveryPointId, setSelectedDeliveryPointId] = useState<string>('');
  const [customDeliveryAddress, setCustomDeliveryAddress] = useState<string>('');
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState<string>('');
  const [orderNote, setOrderNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedOrder, setSubmittedOrder] = useState<any | null>(null);

  // State modal xác nhận xóa toàn bộ giỏ hàng (thay thế hoàn toàn window.confirm / localhost:5173 cho biết)
  const [showClearCartConfirm, setShowClearCartConfirm] = useState<boolean>(false);

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

  // Tự động đồng bộ giỏ hàng theo dữ liệu tồn kho thực tế mới nhất từ serverProducts
  useEffect(() => {
    if (serverProducts.length === 0) return;
    setCart((prev) =>
      prev.map((item) => {
        const fresh = serverProducts.find((p) => p.id === item.product.id);
        if (!fresh) return item;
        const freshStock = fresh.stock ?? 0;
        const freshStatus = fresh.status;
        return {
          ...item,
          product: {
            ...item.product,
            stock: freshStock,
            status: freshStatus,
            sell_price: fresh.sell_price ?? item.product.sell_price,
          },
        };
      })
    );
  }, [serverProducts]);

  // Thêm vào giỏ
  const handleAddToCart = (product: ProductItem, qty: number = 1) => {
    const stock = product.stock ?? 0;
    const isOutOfStock = isOutOfStockProduct(product) || stock <= 0;
    if (isOutOfStock) {
      emitStatusToast({
        type: 'warning',
        title: 'Hết hàng',
        message: `Sản phẩm "${product.name}" hiện đã hết hàng, không thể chọn đặt hàng!`,
      });
      return;
    }

    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    if (currentQty + qty > stock) {
      emitStatusToast({
        type: 'warning',
        title: 'Tồn kho giới hạn',
        message: `Số lượng chọn (${currentQty + qty}) vượt quá số lượng tồn kho khả dụng hiện có (${stock} ${product.base_unit || 'sản phẩm'}). Không thể chọn thêm!`,
      });
      return;
    }

    setCart((prev) => {
      const existingItem = prev.find((item) => item.product.id === product.id);
      if (existingItem) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + qty }
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    emitStatusToast({
      actionType: 'create',
      type: 'success',
      title: 'Thêm vào giỏ hàng',
      message: `Đã thêm "${product.name}" vào giỏ hàng thành công.`,
    });
  };

  // Cập nhật số lượng qua nút bấm + / -
  const handleUpdateQuantity = (productId: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    const cartItem = cart.find((i) => i.product.id === productId);
    const stock = cartItem?.product.stock ?? 0;
    if (isOutOfStockProduct(cartItem?.product)) {
      emitStatusToast({
        type: 'warning',
        title: 'Hết hàng',
        message: `Sản phẩm hiện đã hết hàng, không thể tăng số lượng.`,
      });
      return;
    }
    if (newQty > stock) {
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
    let parsedQty = cleanDigits === '' ? 0 : parseInt(cleanDigits, 10);
    const cartItem = cart.find((i) => i.product.id === productId);
    const stock = cartItem?.product.stock ?? 0;
    if (stock > 0 && parsedQty > stock) {
      parsedQty = stock;
      emitStatusToast({
        type: 'warning',
        title: 'Vượt quá tồn kho',
        message: `Số lượng không thể vượt quá tồn kho hiện có (${stock}). Hệ thống đã tự điều chỉnh về tối đa ${stock}.`,
      });
    }
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
        const stock = item.product.stock ?? 0;
        if (isOutOfStockProduct(item.product)) {
          emitStatusToast({
            type: 'warning',
            title: 'Hết hàng',
            message: `Sản phẩm "${item.product.name}" đã hết hàng. Vui lòng xóa khỏi giỏ!`,
          });
          return item;
        }
        // 1. Nếu ô nhập bị trống, số âm hoặc bằng 0 -> ép về 1
        if (!qty || qty <= 0) {
          qty = 1;
        }
        // 2. Nếu vượt quá tồn kho -> ép về tồn tối đa
        if (qty > stock) {
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
  const handleRemoveFromCart = (productId: number, productName?: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    emitStatusToast({
      actionType: 'delete',
      type: 'success',
      title: 'Xóa sản phẩm',
      message: `Đã xóa sản phẩm ${productName ? `"${productName}"` : ''} khỏi giỏ hàng.`,
    });
  };

  // Mở modal xác nhận làm trống toàn bộ giỏ hàng (thay thế hoàn toàn window.confirm / localhost:5173)
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setShowClearCartConfirm(true);
  };

  // Thực hiện xóa sạch giỏ hàng khi người dùng bấm xác nhận trên Modal
  const handleConfirmClearCart = () => {
    setCart([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
    setShowClearCartConfirm(false);
    emitStatusToast({
      actionType: 'delete',
      type: 'success',
      title: 'Xóa giỏ hàng',
      message: 'Đã xóa toàn bộ sản phẩm trong giỏ hàng thành công.',
    });
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
  const isBlockedByPolicy = Boolean(
    (creditInfo?.is_overdue && creditInfo?.overdue_action === 'BLOCK') ||
    (isOverCredit && creditInfo?.over_limit_action === 'BLOCK')
  );

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

    // Kiểm tra sản phẩm hết hàng trong giỏ
    const outOfStockItems = cart.filter((item) => isOutOfStockProduct(item.product));
    if (outOfStockItems.length > 0) {
      emitStatusToast({
        type: 'error',
        title: 'Sản phẩm hết hàng',
        message: `Giỏ hàng chứa sản phẩm đã hết hàng (${outOfStockItems.map((i) => i.product.name).join(', ')}). Vui lòng xóa sản phẩm này trước khi đặt hàng!`,
      });
      return;
    }

    // Kiểm tra số lượng vượt tồn kho
    const overStockItems = cart.filter(
      (item) => item.product.stock !== undefined && item.product.stock !== null && item.quantity > item.product.stock
    );
    if (overStockItems.length > 0) {
      emitStatusToast({
        type: 'error',
        title: 'Vượt quá tồn kho',
        message: `Sản phẩm "${overStockItems[0].product.name}" đặt ${overStockItems[0].quantity} nhưng tồn kho chỉ còn ${overStockItems[0].product.stock}. Vui lòng giảm số lượng!`,
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

    // Cấu hình chính sách công nợ: Chặn khi nợ quá hạn
    if (creditInfo?.is_overdue && creditInfo?.overdue_action === 'BLOCK') {
      emitStatusToast({
        type: 'error',
        title: 'Chặn tạo đơn do nợ quá hạn',
        message: `Đại lý đang có khoản nợ quá hạn (${creditInfo.overdue_days_allowed || 30} ngày). Hệ thống đang cấu hình CHẶN đặt hàng mới theo chính sách công nợ. Vui lòng thanh toán công nợ cũ trước khi tiếp tục!`,
      });
      return;
    }

    // Cấu hình chính sách công nợ: Chặn khi vượt hạn mức
    if (isOverCredit && creditInfo?.over_limit_action === 'BLOCK') {
      emitStatusToast({
        type: 'error',
        title: 'Chặn tạo đơn do vượt hạn mức',
        message: 'Đại lý đang vượt hạn mức công nợ cho phép. Hệ thống đang cấu hình CHẶN tạo đơn mới. Vui lòng liên hệ Kế toán thanh toán công nợ cũ trước khi tiếp tục!',
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
      try {
        localStorage.removeItem(CART_STORAGE_KEY);
      } catch {}
      setOrderNote('');
      emitStatusToast({
        actionType: 'create',
        type: 'success',
        title: 'Đặt hàng thành công',
        message: `Đơn hàng ${result.order_code || ''} đã gửi thành công! Đang chờ Nhân viên phụ trách duyệt.`,
      });
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      const errMsg = err?.message || 'Không thể tạo đơn hàng. Vui lòng thử lại!';

      // Nếu lỗi báo vượt quá tồn khả dụng (ví dụ: tồn khả dụng = 0 hoặc thiếu hàng)
      if (errMsg.includes('vượt quá tồn') || errMsg.includes('tồn khả dụng') || errMsg.includes('hết hàng') || errMsg.includes('INSUFFICIENT_AVAILABLE_STOCK')) {
        // Trích xuất mã sản phẩm hoặc số lượng tối đa có thể đặt được
        const maxMatch = errMsg.match(/Số lượng tối đa có thể đặt(?: được)? là:\s*(\d+)/i) || errMsg.match(/Tồn khả dụng hiện tại:\s*(\d+)/i);
        const maxOrderable = maxMatch ? parseInt(maxMatch[1], 10) : 0;
        const codeMatch = errMsg.match(/\(([A-Za-z0-9_\-]+)\)/);
        const targetCode = codeMatch ? codeMatch[1] : null;

        // Cập nhật sản phẩm đó trong serverProducts và cart ngay lập tức
        setServerProducts((prev) =>
          prev.map((p) => {
            if ((targetCode && p.code === targetCode) || errMsg.includes(p.name)) {
              return {
                ...p,
                stock: maxOrderable,
                status: maxOrderable <= 0 ? 'out_of_stock' : p.status,
              };
            }
            return p;
          })
        );

        setCart((prev) =>
          prev.map((it) => {
            if ((targetCode && it.product.code === targetCode) || errMsg.includes(it.product.name)) {
              return {
                ...it,
                quantity: maxOrderable > 0 ? Math.min(it.quantity, maxOrderable) : it.quantity,
                product: {
                  ...it.product,
                  stock: maxOrderable,
                  status: maxOrderable <= 0 ? 'out_of_stock' : it.product.status,
                },
              };
            }
            return it;
          })
        );

        // Tự động tải lại danh sách sản phẩm từ server để đồng bộ toàn bộ kho
        loadCustomerProducts();

        emitStatusToast({
          type: 'error',
          title: maxOrderable <= 0 ? 'Sản phẩm đã hết hàng' : 'Vượt tồn khả dụng',
          message: maxOrderable <= 0
            ? `${errMsg} Hệ thống đã chuyển sản phẩm này sang trạng thái Hết hàng.`
            : errMsg,
        });
      } else {
        emitStatusToast({
          type: 'error',
          title: 'Không thể tạo đơn hàng',
          message: errMsg,
        });
      }
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
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
                {viewMode === 'cart' ? 'Giỏ Hàng Của Tôi' : 'Cổng Đặt Hàng Trực Tuyến'}
              </h1>
              <p className="text-xs text-gray-500">
                {viewMode === 'cart'
                  ? 'Kiểm tra lại số lượng các sản phẩm đã chọn và gửi đơn đặt hàng.'
                  : <>Chào mừng <span className="font-semibold text-gray-800">{customerDealer?.dealer_name || currentUser.full_name || currentUser.username}</span>. Chọn sản phẩm và gửi đơn đặt hàng nhanh chóng.</>}
              </p>
            </div>

            {/* Nút Giỏ Hàng ở góc trên bên phải */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                id="btn-portal-cart"
                onClick={() => handleSwitchView(viewMode === 'cart' ? 'products' : 'cart')}
                className={`flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer border select-none ${
                  viewMode === 'cart'
                    ? 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 active:scale-95 shadow-md hover:shadow-lg'
                }`}
                title="Giỏ hàng của bạn"
              >
                <div className="relative flex items-center justify-center">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="8" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                  </svg>
                  {totalCartCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-4.5 h-4.5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs">
                      {totalCartCount > 99 ? '99+' : totalCartCount}
                    </span>
                  )}
                </div>
                <span>{viewMode === 'cart' ? '← Xem Sản Phẩm' : 'Giỏ Hàng Của Bạn'}</span>
                {totalCartCount > 0 && viewMode !== 'cart' && (
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-lg bg-emerald-800/40 text-white text-xs font-mono font-bold">
                    {totalCartAmount.toLocaleString('vi-VN')} đ
                  </span>
                )}
              </button>
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
          </div>
        </div>
      </div>

      {/* =========================================================================
          KHỐI NỘI DUNG CUỘN (SCROLLABLE CONTAINER): Sản phẩm, Bộ lọc, Phân trang, Giỏ hàng
          - Cấu trúc 2 cột items-start để bên phải không bị kéo dãn và giỏ hàng sticky cố định tầm nhìn
      ========================================================================= */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full">
        {viewMode === 'products' ? (
          /* THÂN CỔNG ĐẶT HÀNG: DANH SÁCH SẢN PHẨM RỘNG RÃI TOÀN MÀN HÌNH */
          <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-5 flex flex-col gap-4 pb-20">
            {/* CỘT TRÁI: DANH SÁCH SẢN PHẨM & BỘ LỌC (Rộng toàn màn hình) */}
            <div className="w-full flex-1 min-w-0 flex flex-col gap-4">
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
                  const isOutOfStock = isOutOfStockProduct(p);
                  const hasStock = !isOutOfStock;
                  const primaryImage = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : null;

                  return (
                    <div
                      key={p.id}
                      id={`product-card-${p.id}`}
                      className={`rounded-2xl border p-3.5 transition-all flex flex-col justify-between group ${
                        hasStock
                          ? 'bg-white border-gray-200/90 shadow-xs hover:shadow-md'
                          : 'bg-slate-50/80 border-slate-200/90 opacity-80'
                      }`}
                    >
                      <div>
                        {/* Vùng ảnh sản phẩm */}
                        <div className="relative w-full h-44 sm:h-48 rounded-xl bg-slate-50 border border-gray-100 flex items-center justify-center overflow-hidden mb-3 select-none">
                          {primaryImage ? (
                            <img
                              src={getProductImageUrl(primaryImage)}
                              alt={p.name}
                              className={`w-full h-full object-contain p-2 transition-transform duration-200 ${
                                hasStock ? 'group-hover:scale-105' : 'grayscale-[40%] opacity-70'
                              }`}
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
                            className={`product-fallback-icon w-16 h-16 rounded-2xl flex items-center justify-center shadow-xs ${
                              hasStock ? 'bg-indigo-50/80 border border-indigo-100 text-indigo-500' : 'bg-gray-100 border border-gray-200 text-gray-400'
                            }`}
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

                          {/* Huy hiệu HẾT HÀNG nổi bật giữa khung ảnh */}
                          {!hasStock && (
                            <div className="absolute inset-0 bg-slate-900/15 backdrop-blur-[0.5px] flex items-center justify-center z-10 pointer-events-none">
                              <span className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold uppercase tracking-wider shadow-md">
                                Hết hàng
                              </span>
                            </div>
                          )}

                          {/* Huy hiệu tồn kho ở đáy ảnh (chỉ hiển thị khi còn hàng) */}
                          {hasStock && (
                            <div className="absolute bottom-2 left-0 right-0 flex justify-center px-2 pointer-events-none z-10">
                              <span className="px-3 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs backdrop-blur-xs">
                                Kho còn: {p.stock} {p.base_unit || 'Cái'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Thông tin mã SKU & Nhóm */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">
                            {p.code}
                          </span>
                          <div className="flex items-center gap-1">
                            {p.category && (
                              <span className="text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                {p.category}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Tên sản phẩm */}
                        <h3
                          className={`text-sm font-semibold leading-snug line-clamp-2 min-h-[38px] ${
                            hasStock ? 'text-gray-900' : 'text-gray-600'
                          }`}
                          title={p.name}
                        >
                          {p.name}
                        </h3>

                        {/* Giá bán đại lý */}
                        <div className="mt-2.5 flex items-baseline gap-1">
                          <span className={`text-base font-bold ${hasStock ? 'text-gray-900' : 'text-gray-500'}`}>
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
                            className="w-full py-2.5 px-3 bg-gray-100 text-gray-400 rounded-xl text-xs font-semibold flex items-center justify-center cursor-not-allowed border border-gray-200 select-none shadow-none"
                            title="Sản phẩm hiện đang hết hàng, không thể chọn"
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
                              disabled={currentQtyInCart >= (p.stock ?? 0)}
                              onClick={() => handleAddToCart(p, 1)}
                              className={`w-7 h-7 flex items-center justify-center rounded-lg font-bold shadow-xs transition-colors ${
                                currentQtyInCart >= (p.stock ?? 0)
                                  ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                              }`}
                              title={currentQtyInCart >= (p.stock ?? 0) ? 'Đã đạt số lượng tồn kho tối đa' : 'Thêm số lượng'}
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
        </div>
      ) : (
        /* =========================================================================
            TRANG GIỎ HÀNG CỦA TÔI (DEDICATED MY CART PAGE)
        ========================================================================= */
        <div className="max-w-7xl mx-auto w-full px-4 md:px-8 py-5 flex flex-col gap-5 pb-24">
          {/* Thanh điều hướng trang giỏ hàng */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="btn-back-to-products"
                onClick={() => handleSwitchView('products')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer select-none border border-slate-200"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                <span>Quay lại chọn sản phẩm</span>
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <span>Giỏ Hàng Của Tôi</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                    {totalCartCount} mặt hàng
                  </span>
                </h2>
              </div>
            </div>

            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Xóa sạch giỏ hàng</span>
              </button>
            )}
          </div>

          {/* Nội dung giỏ hàng */}
          {cart.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 sm:p-16 text-center shadow-xs flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-4 border border-emerald-100">
                🛒
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Giỏ hàng của bạn đang trống</h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto mb-6 leading-relaxed">
                Bạn chưa thêm sản phẩm nào vào giỏ hàng. Hãy xem qua danh mục sản phẩm đại lý với đơn giá ưu đãi để chọn mua!
              </p>
              <button
                type="button"
                id="btn-empty-cart-shop-now"
                onClick={() => handleSwitchView('products')}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-95"
              >
                Khám phá danh sách sản phẩm ngay →
              </button>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row items-start gap-6">
              {/* CỘT TRÁI: DANH SÁCH MẶT HÀNG TRONG GIỎ (lg:w-2/3) */}
              <div className="w-full lg:w-2/3 flex flex-col gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-100 bg-slate-50/70 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      Danh sách sản phẩm ({cart.length})
                    </span>
                    <span className="text-xs text-gray-400">
                      Tự động kiểm tra theo số lượng khả dụng
                    </span>
                  </div>

                  <div className="divide-y divide-gray-100 p-3 sm:p-4 space-y-3">
                    {cart.map((item) => {
                      const lineTotal = (item.product.sell_price || 0) * item.quantity;
                      const isItemOutOfStock = isOutOfStockProduct(item.product);
                      const isMaxStockReached = item.product.stock !== undefined && item.product.stock !== null && item.quantity >= item.product.stock;

                      return (
                        <div
                          key={item.product.id}
                          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-3.5 rounded-xl border transition-colors ${
                            isItemOutOfStock
                              ? 'bg-rose-50/70 border-rose-200'
                              : 'bg-white border-gray-100 hover:border-gray-200'
                          }`}
                        >
                          {/* Ảnh + Thông tin sản phẩm */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-slate-50 border border-gray-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {item.product.images && item.product.images.length > 0 ? (
                                <img
                                  src={getProductImageUrl(item.product.images[0])}
                                  alt=""
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <span className="text-gray-400 text-xs select-none">
                                  <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                                  </svg>
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-mono font-bold text-gray-400 uppercase">
                                  {item.product.code}
                                </span>
                                {item.product.category && (
                                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                    {item.product.category}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-semibold text-gray-900 text-sm truncate" title={item.product.name}>
                                {item.product.name}
                              </h4>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                <span>Đơn giá: <strong className="text-gray-900">{item.product.sell_price?.toLocaleString('vi-VN')} đ</strong></span>
                                <span>•</span>
                                <span>Kho: <span className="font-medium text-emerald-700">{item.product.stock} {item.product.base_unit || 'Cái'}</span></span>
                              </div>
                              {isItemOutOfStock ? (
                                <span className="inline-block mt-1 text-[11px] font-bold text-rose-600 bg-rose-100 border border-rose-300 px-2 py-0.5 rounded">
                                  Sản phẩm đã hết hàng
                                </span>
                              ) : isMaxStockReached ? (
                                <span className="inline-block mt-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded">
                                  Đã đạt tồn kho tối đa ({item.product.stock})
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {/* Bộ điều khiển số lượng & Thành tiền */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                            {/* Stepper */}
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 border border-gray-300 text-gray-700 font-bold hover:bg-gray-200 cursor-pointer select-none text-sm transition-colors"
                                title="Giảm số lượng"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                max={item.product.stock || undefined}
                                disabled={isItemOutOfStock || (item.product.stock ?? 0) <= 0}
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => handleQuantityInputChange(item.product.id, e.target.value)}
                                onBlur={() => handleQuantityInputBlur(item.product.id)}
                                className={`w-12 text-center border rounded-lg text-xs font-bold py-1 outline-none appearance-none focus:border-emerald-500 focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                  isItemOutOfStock || (item.product.stock ?? 0) <= 0
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-white border-gray-300'
                                }`}
                                title={isItemOutOfStock ? 'Sản phẩm hết hàng' : 'Nhập số lượng trực tiếp'}
                                aria-label={`Số lượng cho ${item.product.name}`}
                              />
                              <button
                                type="button"
                                disabled={isItemOutOfStock || isMaxStockReached}
                                onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                                className={`w-7 h-7 flex items-center justify-center rounded-lg border font-bold select-none text-sm transition-colors ${
                                  isItemOutOfStock || isMaxStockReached
                                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 cursor-pointer'
                                }`}
                                title={isItemOutOfStock ? 'Sản phẩm hết hàng' : isMaxStockReached ? 'Đã đạt tồn kho tối đa' : 'Tăng số lượng'}
                              >
                                +
                              </button>
                            </div>

                            {/* Thành tiền */}
                            <div className="text-right min-w-[110px]">
                              <div className="text-xs text-gray-400">Thành tiền</div>
                              <div className="text-sm font-extrabold text-emerald-700">
                                {lineTotal.toLocaleString('vi-VN')} đ
                              </div>
                            </div>

                            {/* Nút xóa */}
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.product.id, item.product.name)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Xóa khỏi giỏ"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="px-5 py-3 border-t border-gray-100 bg-slate-50/50 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handleSwitchView('products')}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      ← Tiếp tục mua thêm sản phẩm khác
                    </button>
                    <span className="text-xs text-gray-500">
                      Tổng cộng: <strong className="text-gray-900">{cart.length} loại sản phẩm ({totalCartCount} cái)</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: FORM ĐẶT HÀNG & TÍNH TOÁN CÔNG NỢ (lg:w-1/3) */}
              <div id="customer-cart-panel" className="w-full lg:w-1/3 flex-shrink-0 sticky top-4">
                <form onSubmit={handleSubmitOrder} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 flex flex-col gap-4">
                  <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-base">Thông Tin Đơn Hàng</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      {totalCartCount} sản phẩm
                    </span>
                  </div>

                  {/* BẢNG TÍNH TOÁN CÔNG NỢ & TỔNG TIỀN */}
                  <div className="bg-slate-50 border border-gray-200/90 rounded-xl p-3.5 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-gray-600">
                      <span className="font-medium text-gray-500">Hạn mức công nợ còn lại:</span>
                      <span className="font-bold text-gray-900" id="cart-widget-credit-left">
                        {creditInfo ? `${creditInfo.remaining_credit.toLocaleString('vi-VN')} đ` : '—'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold pt-1.5 border-t border-gray-200">
                      <span className="text-gray-900 text-sm">Tổng tiền giỏ hàng:</span>
                      <span className="text-base sm:text-lg font-extrabold text-emerald-700" id="cart-widget-total-amount">
                        {totalCartAmount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    <div className={`flex justify-between items-center pt-1 font-semibold ${isOverCredit ? 'text-amber-700' : 'text-slate-600'}`}>
                      <span className="font-medium text-gray-500">Hạn mức còn lại sau đơn:</span>
                      <span className="font-bold">
                        {remainingAfterOrder.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    {isOverCredit && (
                      <div className={`mt-1.5 p-2 rounded-lg text-xs leading-relaxed ${
                        creditInfo?.over_limit_action === 'BLOCK'
                          ? 'bg-rose-50 border border-rose-300 text-rose-800'
                          : 'bg-amber-50 border border-amber-300 text-amber-800'
                      }`}>
                        ⚠️ <strong>Vượt hạn mức tín dụng:</strong>{' '}
                        {creditInfo?.over_limit_action === 'BLOCK'
                          ? 'Đại lý đang vượt quá hạn mức công nợ. Hệ thống đang cấu hình CHẶN tạo đơn mới. Vui lòng liên hệ Kế toán thanh toán công nợ!'
                          : 'Đơn hàng sẽ ở trạng thái Chờ Quản Lý Duyệt trước khi được xuất kho.'}
                      </div>
                    )}

                    {creditInfo?.is_overdue && (
                      <div className={`mt-1.5 p-2 rounded-lg text-xs leading-relaxed ${
                        creditInfo?.overdue_action === 'BLOCK'
                          ? 'bg-rose-50 border border-rose-300 text-rose-800'
                          : 'bg-amber-50 border border-amber-300 text-amber-800'
                      }`}>
                        ⚠️ <strong>Khoản nợ quá hạn ({creditInfo.overdue_days_allowed || 30} ngày):</strong>{' '}
                        {creditInfo?.overdue_action === 'BLOCK'
                          ? 'Hệ thống đang cấu hình CHẶN đặt hàng mới. Vui lòng thanh toán công nợ quá hạn!'
                          : 'Đơn hàng sẽ ở trạng thái Chờ Quản Lý Duyệt trước khi được xuất kho.'}
                      </div>
                    )}
                  </div>

                  {/* FORM ĐIỂM NHẬN HÀNG & THỜI GIAN GIAO HÀNG */}
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
                          className="w-full p-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs font-medium text-gray-800"
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
                          className="w-full mt-1.5 p-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-gray-800"
                          required
                        />
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          Ngày nhận
                        </label>
                        <input
                          type="date"
                          id="input-desired-delivery-date"
                          value={desiredDeliveryDate}
                          onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full p-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-gray-800"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-gray-700 mb-1">
                          Ghi chú
                        </label>
                        <input
                          type="text"
                          id="input-order-note"
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          placeholder="Ghi chú đóng gói..."
                          className="w-full p-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-xs text-gray-800"
                        />
                      </div>
                    </div>
                  </div>

                  {cart.some((it) => isOutOfStockProduct(it.product) || (it.product.stock !== undefined && it.product.stock !== null && it.quantity > it.product.stock)) && (
                    <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs leading-snug flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">⚠️</span>
                        <span className="font-medium">Giỏ hàng chứa sản phẩm đã hết hàng hoặc vượt tồn kho.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCart((prev) =>
                            prev.filter((it) => !isOutOfStockProduct(it.product) && (it.product.stock === undefined || it.product.stock === null || it.quantity <= it.product.stock))
                          );
                        }}
                        className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shrink-0 cursor-pointer shadow-xs"
                      >
                        Xóa ngay
                      </button>
                    </div>
                  )}

                  {/* NÚT ĐẶT HÀNG */}
                  <button
                    type="submit"
                    id="btn-submit-dealer-order"
                    disabled={
                      isSubmitting ||
                      cart.length === 0 ||
                      isBlockedByPolicy ||
                      cart.some((it) => isOutOfStockProduct(it.product)) ||
                      cart.some((it) => it.product.stock !== undefined && it.product.stock !== null && it.quantity > it.product.stock)
                    }
                    className={`w-full py-3 px-4 rounded-xl text-sm font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                      isSubmitting ||
                      cart.length === 0 ||
                      isBlockedByPolicy ||
                      cart.some((it) => isOutOfStockProduct(it.product)) ||
                      cart.some((it) => it.product.stock !== undefined && it.product.stock !== null && it.quantity > it.product.stock)
                        ? 'bg-gray-400 cursor-not-allowed opacity-70'
                        : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] cursor-pointer hover:shadow-lg'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        <span>Đang gửi đơn hàng...</span>
                      </>
                    ) : isBlockedByPolicy ? (
                      <span>CHẶN ĐẶT HÀNG THEO CẤU HÌNH CÔNG NỢ</span>
                    ) : (
                      <>
                        <span>GỬI ĐƠN ĐẶT HÀNG</span>
                        <span>({totalCartAmount.toLocaleString('vi-VN')} đ)</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
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
                onClick={() => {
                  setSubmittedOrder(null);
                  handleSwitchView('products');
                }}
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

      {/* Modal Xác Nhận Xóa Sạch Giỏ Hàng (Thay cho window.confirm / popup localhost:5173 cho biết) */}
      {showClearCartConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowClearCartConfirm(false);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #fee2e2',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '440px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              color: '#0f172a',
              textAlign: 'center',
              padding: '28px 24px',
              animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Red Warning/Trash Icon */}
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: '#fee2e2',
                border: '2px solid #fecaca',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 8px', color: '#0f172a' }}>
              Xóa Sạch Giỏ Hàng?
            </h3>

            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
              Bạn có chắc chắn muốn xóa toàn bộ <strong style={{ color: '#dc2626' }}>{totalCartCount} sản phẩm</strong> trong giỏ hàng không? Thao tác này không thể hoàn tác.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setShowClearCartConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Huỷ bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmClearCart}
                style={{
                  flex: 1,
                  padding: '10px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.35)',
                  transition: 'all 0.2s',
                }}
              >
                Xóa sạch giỏ hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CustomerPortalView;
