import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProductItem, getProductsApi } from '../services/api';

export interface ProductSelectDropdownProps {
  token: string;
  selectedProductId: number;
  onSelectProduct: (product: ProductItem) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  compact?: boolean;
  autoSelectFirst?: boolean;
  dropdownMaxHeight?: string;
  fallbackProduct?: {
    id?: number;
    code?: string;
    name?: string;
    is_batch_managed?: boolean;
  } | null;
}

export const ProductSelectDropdown: React.FC<ProductSelectDropdownProps> = ({
  token,
  selectedProductId,
  onSelectProduct,
  disabled = false,
  placeholder = 'Chọn sản phẩm / SKU...',
  id = 'product-select-infinite-dropdown',
  compact = false,
  autoSelectFirst = false,
  dropdownMaxHeight,
  fallbackProduct = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const initialProductsRef = useRef<ProductItem[]>([]);
  const initialTotalRef = useRef<number>(0);
  const prevIsOpenRef = useRef<boolean>(isOpen);

  // 1. Debounce tìm kiếm (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 2. Tải 10 sản phẩm đầu tiên khi mở hoặc khi đổi từ khóa tìm kiếm
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

      // Lưu trữ 10 sản phẩm mặc định ban đầu khi không search để khôi phục nhanh
      if (!query.trim()) {
        initialProductsRef.current = items;
        initialTotalRef.current = res.total || items.length;
      }

      const more =
        res.has_more !== undefined
          ? res.has_more
          : items.length === 10 && items.length < (res.total || 0);
      setHasMore(more);

      // Nếu đang có selectedProductId, đồng bộ object selectedProduct
      if (selectedProductId && !selectedProduct) {
        const found = items.find((p) => p.id === selectedProductId);
        if (found) {
          setSelectedProduct(found);
        }
      } else if (!selectedProductId && items.length > 0 && autoSelectFirst) {
        // Tự động chọn sản phẩm đầu tiên nếu autoSelectFirst = true
        setSelectedProduct(items[0]);
        onSelectProduct(items[0]);
      }
    } catch {
      setProducts([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
    }
  }, [token, selectedProductId, selectedProduct, onSelectProduct, autoSelectFirst]);

  // Hàm khôi phục lại trạng thái ban đầu: 10 sản phẩm, cuộn ở đỉnh, xóa từ khóa tìm kiếm
  const resetToInitialState = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearch('');
    setPage(1);
    if (initialProductsRef.current.length > 0) {
      setProducts(initialProductsRef.current);
      setTotalCount(initialTotalRef.current);
      setHasMore(initialProductsRef.current.length < initialTotalRef.current);
    }
    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, []);

  // KHI TẮT ĐI LẠI QUAY VỀ BAN ĐẦU KHÔNG CẦN LƯU
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      resetToInitialState();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, resetToInitialState]);

  // Kích hoạt nạp khi mở hoặc khi từ khóa thay đổi
  useEffect(() => {
    fetchInitialProducts(debouncedSearch);
  }, [debouncedSearch]);

  // Đồng bộ selectedProduct khi selectedProductId từ props thay đổi
  useEffect(() => {
    if (!selectedProductId) {
      if (!autoSelectFirst) {
        setSelectedProduct(null);
      }
      return;
    }
    if (selectedProduct && selectedProduct.id === selectedProductId) return;
    const found = products.find((p) => p.id === selectedProductId);
    if (found) {
      setSelectedProduct(found);
    } else if (token) {
      // Nếu sản phẩm được chọn nằm ngoài 10 sản phẩm đầu tiên, truy vấn riêng để lấy thông tin
      getProductsApi(token, { page: 1, page_size: 100 })
        .then((res) => {
          const match = (res.items || []).find((p) => p.id === selectedProductId);
          if (match) {
            setSelectedProduct(match);
          }
        })
        .catch(() => {});
    }
  }, [selectedProductId, token, products, selectedProduct, autoSelectFirst]);

  // 3. Tải tiếp 10 sản phẩm tiếp theo khi cuộn xuống đáy (Infinite Scroll)
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
          const more =
            res.has_more !== undefined
              ? res.has_more
              : newItems.length === 10 && combined.length < (res.total || 0);
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

  // 4. Bắt sự kiện cuộn danh sách (Gần tới đáy trong phạm vi 30px)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 30) {
      if (hasMore && !isLoading && !isLoadingMore) {
        loadMoreProducts();
      }
    }
  };

  // Đóng dropdown khi bấm ra ngoài hoặc phím ESC
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

  // Tự động focus ô tìm kiếm & đảm bảo danh sách cuộn lên đầu khi mở dropdown
  useEffect(() => {
    if (isOpen) {
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
      const timer = setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelectItem = (prod: ProductItem) => {
    setSelectedProduct(prod);
    onSelectProduct(prod);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Nút bấm hiển thị sản phẩm được chọn */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full ${
          compact ? 'px-2.5 py-1.5 min-h-[34px] text-xs' : 'px-3.5 py-2.5 text-sm'
        } rounded-lg border text-left font-medium transition-all flex items-center justify-between shadow-2xs cursor-pointer ${
          isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-white text-slate-900'
            : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className="truncate pr-2 font-medium">
          {selectedProduct ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900">[{selectedProduct.code}]</span>
              <span className="text-slate-800 truncate">{selectedProduct.name}</span>
              {selectedProduct.is_batch_managed && (
                <span className="shrink-0 text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Lô: Bật
                </span>
              )}
            </span>
          ) : fallbackProduct && fallbackProduct.code ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-semibold text-slate-900">[{fallbackProduct.code}]</span>
              <span className="text-slate-800 truncate">{fallbackProduct.name || ''}</span>
              {fallbackProduct.is_batch_managed && (
                <span className="shrink-0 text-2xs font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Lô: Bật
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-600' : ''
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Menu Dropdown đổ xuống có thanh tìm kiếm & Infinite Scroll */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          className="absolute top-full left-0 right-0 w-full mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{
            maxHeight: dropdownMaxHeight ? `calc(${dropdownMaxHeight} + 65px)` : '380px',
            zIndex: 9999,
          }}
        >
          {/* Hộp tìm kiếm sản phẩm phía trên */}
          <div className="p-2.5 bg-slate-50/90 backdrop-blur-xs border-b border-slate-200 space-y-2 shrink-0">
            <div className="relative flex items-center">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400"
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
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
                placeholder="Tìm kiếm theo mã SKU, tên hàng hóa hoặc ngành hàng..."
                style={{ paddingLeft: '34px', paddingRight: '32px' }}
                className="w-full py-1.5 rounded-lg text-xs sm:text-sm bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Danh sách sản phẩm cuộn vô tận (Infinite Scroll) */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto divide-y divide-slate-100"
            style={{
              overscrollBehavior: 'contain',
              maxHeight: dropdownMaxHeight || '260px',
            }}
          >
            {isLoading && products.length === 0 ? (
              <div className="p-6 text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Đang tải danh sách sản phẩm...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs">
                Không tìm thấy sản phẩm nào phù hợp{searchTerm ? ` với từ khóa "${searchTerm}"` : ''}.
              </div>
            ) : (
              products.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectItem(p)}
                    className={`p-2.5 px-3 hover:bg-emerald-50/80 cursor-pointer transition-colors flex items-center justify-between gap-3 ${
                      isSelected ? 'bg-emerald-50/60 font-semibold text-emerald-950' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {p.code}
                        </span>
                        <span className="text-xs sm:text-sm font-medium truncate text-slate-900">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-2xs text-slate-500 mt-0.5">
                        <span>{p.category || 'Chưa phân loại'}</span>
                        <span>•</span>
                        <span>Tồn kho: <strong className="text-slate-700">{p.stock || 0}</strong> {p.base_unit || 'Cái'}</span>
                        {p.is_batch_managed ? (
                          <span className="text-emerald-600 font-semibold">• Quản lý lô: Đang bật</span>
                        ) : (
                          <span className="text-slate-400">• Chưa bật quản lý lô</span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="shrink-0 text-emerald-600">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Trạng thái đang tải thêm sản phẩm */}
            {isLoadingMore && (
              <div className="p-3 text-center text-xs font-semibold text-emerald-700 bg-slate-50/70 border-t border-slate-100 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Đang tải thêm sản phẩm...</span>
              </div>
            )}

            {/* Thông báo đã tải hết danh sách */}
            {!hasMore && products.length > 0 && (
              <div className="p-2.5 text-center text-2xs text-slate-400 bg-slate-50/50 border-t border-slate-100">
                Đã hiển thị toàn bộ {totalCount} sản phẩm
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
