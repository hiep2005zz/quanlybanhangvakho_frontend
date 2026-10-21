import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProductItem, getProductsApi, getStockBookApi, StockBookItem } from '../services/api';

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
  warehouseId?: string;
  onlyInStock?: boolean;
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
  warehouseId,
  onlyInStock = false,
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

  const onSelectProductRef = useRef(onSelectProduct);
  onSelectProductRef.current = onSelectProduct;

  const autoSelectFirstRef = useRef(autoSelectFirst);
  autoSelectFirstRef.current = autoSelectFirst;

  const selectedProductIdRef = useRef(selectedProductId);
  selectedProductIdRef.current = selectedProductId;

  // Helper chuyển đổi từ StockBookItem sang ProductItem để giao diện hiển thị đúng tồn kho của kho đó
  const convertStockBookItemToProduct = useCallback((it: StockBookItem): ProductItem => {
    return {
      id: it.product_id,
      code: it.product_code,
      name: it.product_name,
      category: it.category || 'Thời trang',
      stock: it.actual_stock || 0,
      sell_price: it.sell_price || 0,
      cost_price: it.cost_price ?? null,
      base_unit: it.base_unit || 'Cái',
      is_batch_managed: it.is_batch_managed || false,
      min_stock: it.min_stock,
    };
  }, []);

  // 1. Debounce tìm kiếm (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 2. Tải sản phẩm đầu tiên khi mở, khi đổi từ khóa tìm kiếm hoặc khi đổi kho
  const fetchInitialProducts = useCallback(async (query: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      let items: ProductItem[] = [];
      let total = 0;
      let more = false;

      if (warehouseId && warehouseId !== 'all') {
        const res = await getStockBookApi(token, {
          warehouse_id: warehouseId,
          search: query.trim() || undefined,
          page: 1,
          page_size: 10,
        });
        let rawItems = res.items || [];
        if (onlyInStock) {
          rawItems = rawItems.filter((it) => (it.actual_stock || 0) > 0);
        }
        items = rawItems.map(convertStockBookItemToProduct);
        total = res.total || items.length;
        more = (res.page || 1) * (res.page_size || 10) < (res.total || 0);
      } else {
        const res = await getProductsApi(token, {
          page: 1,
          page_size: 10,
          search: query.trim() || undefined,
        });
        items = res.items || [];
        total = res.total || items.length;
        more =
          res.has_more !== undefined
            ? res.has_more
            : items.length === 10 && items.length < (res.total || 0);
      }

      setProducts(items);
      setPage(1);
      setTotalCount(total);
      setHasMore(more);

      // Lưu trữ sản phẩm mặc định ban đầu khi không search để khôi phục nhanh
      if (!query.trim()) {
        initialProductsRef.current = items;
        initialTotalRef.current = total;
      }

      // Nếu đang có selectedProductId, đồng bộ object selectedProduct
      const curSelectedId = selectedProductIdRef.current;
      if (curSelectedId) {
        const found = items.find((p) => p.id === curSelectedId);
        if (found) {
          setSelectedProduct(found);
        } else if (items.length === 0) {
          setSelectedProduct(null);
        }
      } else if (items.length > 0 && autoSelectFirstRef.current) {
        // Tự động chọn sản phẩm đầu tiên nếu autoSelectFirst = true
        setSelectedProduct(items[0]);
        if (onSelectProductRef.current) {
          onSelectProductRef.current(items[0]);
        }
      } else if (items.length === 0) {
        setSelectedProduct(null);
      }
    } catch {
      setProducts([]);
      setHasMore(false);
      setSelectedProduct(null);
    } finally {
      setIsLoading(false);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
    }
  }, [token, warehouseId, onlyInStock, convertStockBookItemToProduct]);

  // Hàm khôi phục lại trạng thái ban đầu: cuộn ở đỉnh, xóa từ khóa tìm kiếm
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

  // Kích hoạt nạp khi từ khóa thay đổi hoặc khi đổi kho
  useEffect(() => {
    fetchInitialProducts(debouncedSearch);
  }, [debouncedSearch, fetchInitialProducts]);

  // Đồng bộ selectedProduct khi selectedProductId từ props thay đổi
  useEffect(() => {
    if (!selectedProductId) {
      if (!autoSelectFirstRef.current) {
        setSelectedProduct(null);
      }
      return;
    }
    setSelectedProduct((prev) => {
      if (prev && prev.id === selectedProductId) return prev;
      const found = products.find((p) => p.id === selectedProductId);
      if (found) return found;
      return prev;
    });

    if (token) {
      if (warehouseId && warehouseId !== 'all') {
        getStockBookApi(token, { warehouse_id: warehouseId, page_size: 100 })
          .then((res) => {
            const match = (res.items || []).find((p) => p.product_id === selectedProductId);
            if (match) {
              setSelectedProduct(convertStockBookItemToProduct(match));
            }
          })
          .catch(() => {});
      } else {
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
    }
  }, [selectedProductId, token, warehouseId, convertStockBookItemToProduct]);

  // 3. Tải tiếp sản phẩm tiếp theo khi cuộn xuống đáy (Infinite Scroll)
  const loadMoreProducts = async () => {
    if (!token || isLoading || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      let newItems: ProductItem[] = [];
      let total = 0;
      let more = false;

      if (warehouseId && warehouseId !== 'all') {
        const res = await getStockBookApi(token, {
          warehouse_id: warehouseId,
          search: debouncedSearch.trim() || undefined,
          page: nextPage,
          page_size: 10,
        });
        let rawItems = res.items || [];
        if (onlyInStock) {
          rawItems = rawItems.filter((it) => (it.actual_stock || 0) > 0);
        }
        newItems = rawItems.map(convertStockBookItemToProduct);
        total = res.total || 0;
        more = nextPage * 10 < total;
      } else {
        const res = await getProductsApi(token, {
          page: nextPage,
          page_size: 10,
          search: debouncedSearch.trim() || undefined,
        });
        newItems = res.items || [];
        total = res.total || 0;
        more =
          res.has_more !== undefined
            ? res.has_more
            : newItems.length === 10 && (products.length + newItems.length) < total;
      }

      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setProducts((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const uniqueNewItems = newItems.filter((p) => !existingIds.has(p.id));
          const combined = [...prev, ...uniqueNewItems];
          return combined;
        });
        setPage(nextPage);
        setTotalCount(total);
        setHasMore(more);
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

  // Tự động focus ô tìm kiếm & đảm bảo danh sách luôn cuộn lên đầu (không bị che/lẹm tiêu đề sản phẩm đầu tiên)
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
      }, 40);
      const raf = requestAnimationFrame(() => {
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = 0;
        }
      });
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(raf);
      };
    }
  }, [isOpen, products.length]);

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
          ) : fallbackProduct && fallbackProduct.code && (products.length > 0 || !warehouseId) ? (
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
            <span className="text-slate-400">
              {warehouseId && products.length === 0 && !isLoading
                ? 'Kho này chưa có hàng để điều chỉnh'
                : placeholder}
            </span>
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
          className="absolute top-full left-0 right-0 w-full mt-1 z-50 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{
            maxHeight: dropdownMaxHeight ? `calc(${dropdownMaxHeight} + 48px)` : '240px',
            zIndex: 9999,
          }}
        >
          {/* Hộp tìm kiếm sản phẩm phía trên (tối ưu gọn gàng) */}
          <div style={{ padding: '6px 8px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: 'absolute',
                  left: '8px',
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
                style={{
                  width: '100%',
                  height: '24px',
                  minHeight: '24px',
                  maxHeight: '24px',
                  paddingLeft: '24px',
                  paddingRight: '22px',
                  fontSize: '11px',
                  borderRadius: '5px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#10b981';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#cbd5e1';
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Danh sách sản phẩm cuộn vô tận (Infinite Scroll) - Luôn hiển thị trọn vẹn tiêu đề dòng đầu tiên */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto divide-y divide-slate-100"
            style={{
              overscrollBehavior: 'contain',
              maxHeight: dropdownMaxHeight || '210px',
              scrollPaddingTop: '4px',
              paddingTop: '2px',
              paddingBottom: '2px',
            }}
          >
            {isLoading && products.length === 0 ? (
              <div className="p-4 text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Đang tải danh sách sản phẩm...</span>
              </div>
            ) : products.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                {searchTerm
                  ? `Không tìm thấy sản phẩm nào phù hợp với từ khóa "${searchTerm}".`
                  : warehouseId
                  ? 'Kho này hiện chưa có mặt hàng nào có tồn kho để điều chỉnh.'
                  : 'Không tìm thấy sản phẩm nào trong hệ thống.'}
              </div>
            ) : (
              products.map((p) => {
                const isSelected = selectedProduct?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectItem(p)}
                    className={`py-1.5 px-2.5 hover:bg-emerald-50/80 cursor-pointer transition-colors flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-emerald-50/60 font-semibold text-emerald-950' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] font-bold text-slate-900 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 shrink-0">
                          {p.code}
                        </span>
                        <span className="text-xs font-medium truncate text-slate-900">
                          {p.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                        <span>{p.category || 'Chưa phân loại'}</span>
                        <span className="text-slate-300">•</span>
                        <span>
                          Tồn kho: <strong className="text-slate-800 font-bold">{p.stock || 0}</strong> {p.base_unit || 'Cái'}
                        </span>
                        <span className="text-slate-300">•</span>
                        {p.is_batch_managed ? (
                          <span className="text-emerald-700 font-semibold">Quản lý lô: Đang bật</span>
                        ) : (
                          <span className="text-slate-400">Chưa bật quản lý lô</span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <div className="shrink-0 text-emerald-600 pl-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
                {warehouseId
                  ? `Đã hiển thị toàn bộ ${products.length} sản phẩm có tồn kho tại kho này`
                  : `Đã hiển thị toàn bộ ${totalCount} sản phẩm`}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
