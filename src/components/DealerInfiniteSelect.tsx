import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DealerItem, getDealersPaginatedApi } from '../services/api';

export interface DealerInfiniteSelectProps {
  token: string;
  selectedDealer: DealerItem | null;
  onSelectDealer: (dealer: DealerItem) => void;
  onClearDealer?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

export const DealerInfiniteSelect: React.FC<DealerInfiniteSelectProps> = ({
  token,
  selectedDealer,
  onSelectDealer,
  onClearDealer,
  disabled = false,
  placeholder = 'Gõ tên, mã đại lý hoặc số điện thoại...',
  className = '',
  id = 'dealer-infinite-select',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [dealers, setDealers] = useState<DealerItem[]>([]);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Debounce tìm kiếm (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Tải 10 đại lý ban đầu hoặc khi đổi từ khóa tìm kiếm
  const fetchInitialDealers = useCallback(async (query: string) => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await getDealersPaginatedApi(token, {
        page: 1,
        page_size: 10,
        search: query.trim() || undefined,
      });
      const items = res.items || [];
      setDealers(items);
      setPage(1);
      setTotalCount(res.total || items.length);
      setHasMore(res.has_more ?? (items.length === 10 && items.length < (res.total || 0)));
    } catch (err) {
      console.error('Lỗi tải đại lý ban đầu:', err);
      setDealers([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
    }
  }, [token]);

  // Kích hoạt tải dữ liệu khi mở dropdown hoặc thay đổi từ khóa
  useEffect(() => {
    if (isOpen || dealers.length === 0) {
      fetchInitialDealers(debouncedSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, isOpen]);

  // Cuộn xuống tải tiếp 10 đại lý tiếp theo (Infinite Scroll)
  const loadMoreDealers = async () => {
    if (!token || isLoading || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await getDealersPaginatedApi(token, {
        page: nextPage,
        page_size: 10,
        search: debouncedSearch.trim() || undefined,
      });
      const newItems = res.items || [];
      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setDealers((prev) => {
          const existingIds = new Set(prev.map((d) => d.id));
          const filtered = newItems.filter((d) => !existingIds.has(d.id));
          return [...prev, ...filtered];
        });
        setPage(nextPage);
        setTotalCount(res.total || 0);
        setHasMore(res.has_more ?? (newItems.length === 10));
      }
    } catch (err) {
      console.error('Lỗi tải thêm đại lý:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Bắt sự kiện cuộn khi chạm gần đáy (cách đáy <= 40px)
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 40) {
      if (hasMore && !isLoading && !isLoadingMore) {
        loadMoreDealers();
      }
    }
  };

  // Đóng dropdown khi click ra ngoài hoặc nhấn phím ESC
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

  // Tự động focus vào ô tìm kiếm khi mở menu
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const handleSelectItem = (dealer: DealerItem) => {
    onSelectDealer(dealer);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClearDealer) {
      onClearDealer();
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* TRIGGER BUTTON: Hiển thị trạng thái đại lý đã chọn hoặc placeholder */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full px-3.5 py-2.5 rounded-xl border-2 text-left text-sm font-semibold transition-all flex items-center justify-between shadow-xs cursor-pointer ${
          isOpen
            ? 'border-emerald-600 ring-4 ring-emerald-500/20 bg-emerald-50/20 text-slate-900'
            : selectedDealer
            ? 'border-emerald-500/80 bg-emerald-50/15 text-slate-900 hover:border-emerald-600'
            : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {selectedDealer ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                {selectedDealer.code}
              </span>
              <span className="font-bold text-slate-900 truncate">
                {selectedDealer.name}
              </span>
              {(selectedDealer.phone || selectedDealer.region) && (
                <span className="text-xs text-slate-500 font-normal truncate hidden sm:inline">
                  • {selectedDealer.phone || ''} {selectedDealer.region ? `(${selectedDealer.region})` : ''}
                </span>
              )}
            </div>
          ) : (
            <span className="text-slate-400 font-normal text-xs sm:text-sm truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedDealer && !disabled && onClearDealer && (
            <span
              onClick={handleClear}
              title="Bỏ chọn đại lý"
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            >
              ✕
            </span>
          )}
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-slate-500 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-600' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* DROPDOWN MENU KHI MỞ: Ô TÌM KIẾM TRÊN ĐẦU + CUỘN VÔ TẬN 10 ĐẠI LÝ TIẾP THEO */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-emerald-300 ring-1 ring-black/5 overflow-hidden flex flex-col"
          style={{ maxHeight: '420px' }}
        >
          {/* Ô TÌM KIẾM NHANH Ở TRÊN CÙNG */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="relative flex items-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
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
                placeholder="Tìm kiếm theo mã đại lý, tên hoặc số điện thoại..."
                style={{ paddingLeft: '38px', paddingRight: '36px' }}
                className="w-full py-2 rounded-lg text-xs sm:text-sm bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
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
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer border-0 bg-transparent"
                  title="Xóa tìm kiếm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* DANH SÁCH ĐẠI LÝ CUỘN VÔ TẬN (10 ĐẠI LÝ / LẦN CUỘN) */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto max-h-[300px] divide-y divide-slate-100"
          >
            {isLoading && dealers.length === 0 ? (
              <div className="p-8 text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang tải danh sách 10 đại lý đầu tiên...</span>
              </div>
            ) : dealers.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                Không tìm thấy đại lý nào phù hợp{searchTerm ? ` với từ khóa "${searchTerm}"` : ''}.
              </div>
            ) : (
              dealers.map((d) => {
                const isSelected = selectedDealer?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => handleSelectItem(d)}
                    className={`p-3 transition-colors flex items-center justify-between group cursor-pointer ${
                      isSelected ? 'bg-emerald-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs px-2 py-0.5 rounded font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          {d.code}
                        </span>
                        <strong className="text-xs sm:text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                          {d.name}
                        </strong>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        {d.phone && (
                          <span className="font-medium">
                            SĐT: <span className="text-slate-700">{d.phone}</span>
                          </span>
                        )}
                        {d.region && (
                          <span className="font-medium text-slate-500">
                            • Khu vực: <span className="text-indigo-600 font-semibold">{d.region}</span>
                          </span>
                        )}
                      </div>

                      {d.address && (
                        <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                          {d.address}
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="shrink-0 text-emerald-600">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* TRẠNG THÁI TẢI THÊM 10 ĐẠI LÝ TIẾP THEO KHI CUỘN ĐÁY */}
            {isLoadingMore && (
              <div className="p-3 text-center text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2 bg-slate-50/80 border-t border-slate-100">
                <svg className="animate-spin h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Đang tải thêm 10 đại lý tiếp theo...</span>
              </div>
            )}

            {!hasMore && dealers.length > 0 && !isLoading && (
              <div className="p-2.5 text-center text-[11px] text-slate-400 bg-slate-50/50">
                Đã hiển thị tất cả {dealers.length} / {totalCount} đại lý.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default DealerInfiniteSelect;
