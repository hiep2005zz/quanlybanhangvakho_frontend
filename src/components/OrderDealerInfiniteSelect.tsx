import React, { useState, useEffect, useRef, useCallback } from 'react';
import { OrderDealer, getOrderDealersApi } from '../services/api';

export interface OrderDealerInfiniteSelectProps {
  token: string;
  selectedId: number | string | null | undefined;
  selectedDealer?: OrderDealer | null;
  onSelect: (dealer: OrderDealer) => void;
  disabled?: boolean;
  placeholder?: string;
  isCustomer?: boolean;
  className?: string;
  id?: string;
  onDealersLoaded?: (dealers: OrderDealer[]) => void;
}

export const OrderDealerInfiniteSelect: React.FC<OrderDealerInfiniteSelectProps> = ({
  token,
  selectedId,
  selectedDealer,
  onSelect,
  disabled = false,
  placeholder = 'Chọn đại lý',
  isCustomer = false,
  className = '',
  id = 'order-dealer-infinite-select',
  onDealersLoaded,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dealers, setDealers] = useState<OrderDealer[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Initial load / search change handler: always load first 10 dealers
  const fetchInitialDealers = useCallback(async (query: string) => {
    if (!token) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getOrderDealersApi(token, {
        page: 1,
        page_size: 10,
        search: query.trim() || undefined,
      });
      setDealers(res);
      setPage(1);
      setHasMore(res.length === 10);
      onDealersLoaded?.(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tải danh sách đại lý.');
      setDealers([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
    }
  }, [token, onDealersLoaded]);

  // Fetch when dropdown is opened or search changes
  useEffect(() => {
    if (isOpen || dealers.length === 0) {
      fetchInitialDealers(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isOpen]);

  // Load next 10 dealers on scroll to bottom
  const loadMoreDealers = async () => {
    if (!token || isLoading || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await getOrderDealersApi(token, {
        page: nextPage,
        page_size: 10,
        search: debouncedSearch.trim() || undefined,
      });
      if (res.length === 0) {
        setHasMore(false);
      } else {
        setDealers((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const uniqueNewItems = res.filter((d) => !existingIds.has(d.id));
          return [...prev, ...uniqueNewItems];
        });
        setPage(nextPage);
        setHasMore(res.length === 10);
        onDealersLoaded?.(res);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Scroll detection
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 40) {
      if (hasMore && !isLoading && !isLoadingMore) {
        loadMoreDealers();
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

  // Auto focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelectItem = (dealer: OrderDealer) => {
    const isLocked = Boolean(
      dealer.status &&
      (dealer.status.toLowerCase().includes('khóa') || dealer.status.toLowerCase().includes('lock'))
    );
    if (isLocked) return;

    onSelect(dealer);
    setIsOpen(false);
    setSearchTerm('');
  };

  const currentDisplay = selectedDealer
    ? `${selectedDealer.code} — ${selectedDealer.name}`
    : placeholder;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled || isCustomer}
        onClick={() => !disabled && !isCustomer && setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2.5 rounded-lg border text-left text-sm font-medium transition-all flex items-center justify-between shadow-xs ${
          isOpen
            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-white text-slate-900'
            : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
        } ${disabled || isCustomer ? 'bg-slate-100 opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
        style={{ minHeight: '42px' }}
      >
        <span className={`truncate pr-2 ${selectedDealer ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
          {currentDisplay}
        </span>
        {!isCustomer && (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
          style={{ maxHeight: '380px' }}
        >
          {/* Search Bar */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="relative flex items-center">
              <svg
                width="15"
                height="15"
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
                placeholder="Tìm mã, tên, SĐT hoặc địa chỉ đại lý..."
                style={{ paddingLeft: '38px', paddingRight: '36px' }}
                className="w-full py-1.5 rounded-lg text-xs sm:text-sm bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
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
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Dealers List */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto divide-y divide-slate-100 flex-1"
            style={{ maxHeight: '300px' }}
          >
            {isLoading && dealers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải 10 đại lý đầu tiên...</span>
              </div>
            ) : errorMsg ? (
              <div className="p-4 text-center text-xs text-red-600 bg-red-50">
                {errorMsg}
              </div>
            ) : dealers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Không tìm thấy đại lý nào phù hợp.
              </div>
            ) : (
              dealers.map((dealer) => {
                const isSelected = String(dealer.id) === String(selectedId);
                const isLocked = Boolean(
                  dealer.status &&
                  (dealer.status.toLowerCase().includes('khóa') || dealer.status.toLowerCase().includes('lock'))
                );

                return (
                  <div
                    key={dealer.id}
                    onClick={() => handleSelectItem(dealer)}
                    className={`p-3 text-left transition-colors flex items-start justify-between gap-3 ${
                      isLocked
                        ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                        : isSelected
                          ? 'bg-blue-50/70 border-l-4 border-blue-600 cursor-pointer'
                          : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs text-slate-900">
                          {dealer.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-slate-100 text-slate-700 border border-slate-200">
                          {dealer.code}
                        </span>
                        {isLocked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                            Đã khóa
                          </span>
                        )}
                        {dealer.customer_group && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {dealer.customer_group}
                          </span>
                        )}
                      </div>

                      {(dealer.phone || dealer.address) && (
                        <div className="mt-1 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                          {dealer.phone && <span>SĐT: {dealer.phone}</span>}
                          {dealer.phone && dealer.address && <span className="text-slate-300">•</span>}
                          {dealer.address && <span className="truncate max-w-xs">{dealer.address}</span>}
                        </div>
                      )}

                      {dealer.credit_limit !== undefined && dealer.credit_limit > 0 && (
                        <div className="mt-1 text-[11px] text-slate-400">
                          Hạn mức: {dealer.credit_limit.toLocaleString('vi-VN')} đ • Dư nợ: {(dealer.current_debt || 0).toLocaleString('vi-VN')} đ
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <span className="text-blue-600 font-bold shrink-0 self-center">
                        ✓
                      </span>
                    )}
                  </div>
                );
              })
            )}

            {/* Loading More Indicator */}
            {isLoadingMore && (
              <div className="p-2.5 text-center text-xs text-slate-500 bg-slate-50 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải thêm 10 đại lý...</span>
              </div>
            )}

            {/* End of list */}
            {!hasMore && dealers.length > 0 && (
              <div className="p-2 text-center text-[11px] text-slate-400 bg-slate-50/50">
                Đã hiển thị tất cả ({dealers.length}) đại lý
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
