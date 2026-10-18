import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProductItem, getProductsApi } from '../services/api';

export interface ProductInfiniteSelectProps {
  token: string;
  orderItems?: Array<{ productId: number; quantity: number | string }>;
  onSelectProduct: (product: ProductItem) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  stockMap?: Map<number, { available_stock: number; actual_stock: number; reserved_stock: number }>;
}

export const ProductInfiniteSelect: React.FC<ProductInfiniteSelectProps> = ({
  token,
  orderItems = [],
  onSelectProduct,
  disabled = false,
  placeholder = 'Bấm vào đây để tìm và chọn sản phẩm thêm vào đơn hàng...',
  className = '',
  id = 'select-order-product-infinite',
  stockMap,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Debounce search input (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Initial load / search change handler: always load first 10 products
  const fetchInitialProducts = useCallback(async (query: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await getProductsApi(token, {
        page: 1,
        page_size: 10,
        search: query.trim() || undefined,
      });
      const items = res.items || [];
      setProducts(items);
      setPage(1);
      setTotalCount(res.total || items.length);

      const more = res.has_more !== undefined
        ? res.has_more
        : (items.length === 10 && items.length < (res.total || 0));
      setHasMore(more);
    } catch {
      // fallback in case of error
      setProducts([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      // scroll list to top on new search
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
    }
  }, [token]);

  // Trigger search / initial fetch when search changes or dropdown opens
  useEffect(() => {
    if (isOpen || products.length === 0) {
      fetchInitialProducts(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isOpen]);

  // Load next 10 products on infinite scroll
  const loadMoreProducts = async () => {
    if (!token || isLoading || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await getProductsApi(token, {
        page: nextPage,
        page_size: 10,
        search: debouncedSearch.trim() || undefined,
      });
      const newItems = res.items || [];
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNewItems = newItems.filter((p) => !existingIds.has(p.id));
          const combined = [...prev, ...uniqueNewItems];
          const more = res.has_more !== undefined
            ? res.has_more
            : (newItems.length === 10 && combined.length < (res.total || 0));
          setHasMore(more);
          return combined;
        });
        setPage(nextPage);
        setTotalCount(res.total || 0);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Infinite scroll detection on list container
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // When user scrolls close to bottom (within 40px)
    if (scrollHeight - scrollTop - clientHeight <= 40) {
      if (hasMore && !isLoading && !isLoadingMore) {
        loadMoreProducts();
      }
    }
  };

  // Close dropdown on click outside or ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Auto-focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelectItem = (prod: ProductItem) => {
    onSelectProduct(prod);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button - Looks and feels like a sleek select box */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full px-4 py-3 rounded-xl border-2 text-left text-sm font-semibold transition-all flex items-center justify-between shadow-xs cursor-pointer ${
          isOpen
            ? 'border-emerald-600 ring-4 ring-emerald-500/20 bg-emerald-50/30 text-slate-900'
            : 'border-emerald-500/80 bg-emerald-50/20 text-slate-800 hover:border-emerald-600 hover:bg-emerald-50/30'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className="truncate pr-2 text-slate-700">
          {placeholder}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-emerald-700 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Downward Dropdown Menu - Dài xuống dưới */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-emerald-300 ring-1 ring-black/5 overflow-hidden flex flex-col"
          style={{ maxHeight: '420px' }}
        >
          {/* Top Search & Filter Bar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 space-y-2 shrink-0">
            <div className="relative flex items-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nhập mã SKU hoặc tên sản phẩm để tìm kiếm..."
                style={{ paddingLeft: '38px', paddingRight: '36px' }}
                className="w-full py-2 rounded-lg text-xs sm:text-sm bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    zIndex: 2,
                  }}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Products List */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto max-h-[300px] divide-y divide-slate-100"
          >
            {isLoading && products.length === 0 ? (
              <div className="p-8 text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang tải danh sách sản phẩm...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                Không tìm thấy sản phẩm nào phù hợp{searchTerm ? ` với từ khóa "${searchTerm}"` : ''}.
              </div>
            ) : (
              products.map((p) => {
                const addedItem = orderItems.find((item) => item.productId === p.id);
                const isAdded = Boolean(addedItem);
                const itemQty = addedItem
                  ? typeof addedItem.quantity === 'number'
                    ? addedItem.quantity
                    : parseFloat(addedItem.quantity) || 1
                  : 0;
                const stockItem = stockMap ? stockMap.get(p.id) : undefined;
                const availableStock = stockItem ? stockItem.available_stock : (p.stock ?? 0);
                const isOutOfStock = availableStock <= 0 || p.status === 'out_of_stock' || p.status === 'inactive';

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      if (!isOutOfStock) {
                        handleSelectItem(p);
                      }
                    }}
                    className={`p-3 transition-colors flex items-center justify-between group ${
                      isOutOfStock
                        ? 'bg-slate-50/80 opacity-70 cursor-not-allowed'
                        : 'hover:bg-emerald-50/80 cursor-pointer'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-3">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200 group-hover:border-emerald-300 group-hover:bg-emerald-100/50">
                          {p.code}
                        </span>
                        <span className="font-bold text-slate-900 text-sm truncate">
                          {p.name}
                        </span>
                        {isOutOfStock && (
                          <span className="px-1.5 py-0.5 rounded text-[10.5px] font-bold bg-rose-100 text-rose-700 border border-rose-300">
                            Hết hàng
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                        <span>
                          Tồn kho:{' '}
                          {isOutOfStock ? (
                            <strong className="text-red-600 font-bold bg-red-50 border border-red-200 px-1 py-0.5 rounded text-[11px]">
                              Hết hàng (0)
                            </strong>
                          ) : (
                            <strong className="text-emerald-700 font-bold">{availableStock}</strong>
                          )}{' '}
                          {p.base_unit || 'Cái'}
                        </span>
                        {p.sell_price > 0 && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span>
                              Giá niêm yết: <strong className="text-slate-800 font-bold">{p.sell_price.toLocaleString('vi-VN')} đ</strong>
                            </span>
                          </>
                        )}
                        {p.category && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400 italic">{p.category}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isAdded && (
                        <span className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Đã chọn ({itemQty})
                        </span>
                      )}
                      {isOutOfStock ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed select-none">
                          Hết hàng
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white transition-all cursor-pointer shadow-2xs"
                        >
                          + Thêm
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Nút bấm tải thêm hoặc trạng thái đang tải */}
            {isLoadingMore && (
              <div className="p-3 text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2 bg-emerald-50/40 border-t border-emerald-100">
                <svg className="animate-spin h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang tải thêm sản phẩm...</span>
              </div>
            )}

            {hasMore && !isLoadingMore && products.length > 0 && (
              <div className="p-2.5 text-center bg-slate-50/90 border-t border-slate-100 flex items-center justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    loadMoreProducts();
                  }}
                  className="text-xs text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <span>Tải thêm sản phẩm</span>
                  <svg className="w-3.5 h-3.5 inline animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </button>
              </div>
            )}

            {!hasMore && products.length > 0 && (
              <div className="p-2.5 text-center text-[11.5px] text-slate-400 italic bg-slate-50/80 border-t border-slate-100">
                Đã hiển thị toàn bộ {totalCount} sản phẩm
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductInfiniteSelect;
