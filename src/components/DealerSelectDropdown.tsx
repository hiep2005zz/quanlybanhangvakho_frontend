import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DealerItem } from '../services/api';
import { DealerSearchItem, searchDealers } from '../services/dealerSearchApi';

export type AnyDealer = DealerItem | DealerSearchItem;

export interface DealerSelectDropdownProps {
  dealers?: AnyDealer[];
  selectedId?: number | 'all' | '' | null | undefined;
  selectedDealerId?: number | null;
  onSelect?: (dealer: any) => void;
  onSelectDealer?: (dealer: any) => void;
  onSelectId?: (id: any) => void;
  disabled?: boolean;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  compact?: boolean;
  id?: string;
  token?: string;
  autoSelectFirst?: boolean;
  dropdownMaxHeight?: string;
  initialDealer?: any;
  refreshKey?: number;
  initialCount?: number;
  stepCount?: number;
}

export const DealerSelectDropdown: React.FC<DealerSelectDropdownProps> = ({
  dealers: externalDealers,
  selectedId,
  selectedDealerId,
  onSelect,
  onSelectDealer,
  onSelectId,
  disabled = false,
  placeholder = '-- Chọn đại lý / khách hàng --',
  allowAll = false,
  allLabel = '-- Tất cả đại lý hệ thống --',
  compact = false,
  id = 'dealer-select-dropdown',
  token,
  autoSelectFirst = false,
  dropdownMaxHeight = '240px',
  initialDealer = null,
  refreshKey = 0,
  initialCount = 10,
  stepCount = 10,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialCount);

  // Dành cho chế độ nạp trực tiếp qua API (khi không truyền danh sách externalDealers)
  const [apiDealers, setApiDealers] = useState<DealerSearchItem[]>([]);
  const [apiPage, setApiPage] = useState<number>(1);
  const [apiTotal, setApiTotal] = useState<number>(0);
  const [apiHasMore, setApiHasMore] = useState<boolean>(true);
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [apiLoadingMore, setApiLoadingMore] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const initialApiDealersRef = useRef<DealerSearchItem[]>([]);
  const initialApiTotalRef = useRef<number>(0);
  const prevIsOpenRef = useRef<boolean>(isOpen);

  // Xác định ID đang chọn (hỗ trợ cả selectedId và selectedDealerId)
  const effectiveSelectedId = selectedDealerId !== undefined ? selectedDealerId : selectedId;
  const isAllSelected = effectiveSelectedId === 'all';

  // Lưu trữ các callback và prop vào ref để tránh re-render gây vòng lặp vô tận
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSelectDealerRef = useRef(onSelectDealer);
  onSelectDealerRef.current = onSelectDealer;
  const onSelectIdRef = useRef(onSelectId);
  onSelectIdRef.current = onSelectId;
  const autoSelectFirstRef = useRef(autoSelectFirst);
  autoSelectFirstRef.current = autoSelectFirst;
  const effectiveSelectedIdRef = useRef(effectiveSelectedId);
  effectiveSelectedIdRef.current = effectiveSelectedId;
  const hasInitializedSelectionRef = useRef(false);

  // 1. Debounce tìm kiếm (250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 2. Chế độ API: Khi không có externalDealers, tự động gọi API lấy 10 đại lý
  const isApiMode = !externalDealers;

  const fetchInitialApiDealers = useCallback(
    async (query: string) => {
      if (!isApiMode) return;
      setApiLoading(true);
      try {
        const res = await searchDealers(token || '', {
          keyword: query.trim() || undefined,
          page: 1,
          page_size: initialCount,
        });
        const items = res?.items || [];
        const total = res?.total || items.length;
        const more = items.length === initialCount && items.length < total;

        setApiDealers(items);
        setApiPage(1);
        setApiTotal(total);
        setApiHasMore(more);

        if (!query.trim()) {
          initialApiDealersRef.current = items;
          initialApiTotalRef.current = total;
        }

        // Chỉ tự động chọn ở lần đầu tải nếu chưa có đại lý nào được chọn
        if (!hasInitializedSelectionRef.current) {
          hasInitializedSelectionRef.current = true;
          const curId = effectiveSelectedIdRef.current;
          if (curId) {
            const found = items.find((d) => d.id === Number(curId));
            if (found) {
              onSelectRef.current?.(found);
              onSelectDealerRef.current?.(found);
            }
          } else if (items.length > 0 && autoSelectFirstRef.current) {
            onSelectRef.current?.(items[0]);
            onSelectDealerRef.current?.(items[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching api dealers:', err);
      } finally {
        setApiLoading(false);
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = 0;
        }
      }
    },
    [isApiMode, token, initialCount]
  );

  useEffect(() => {
    if (isApiMode) {
      fetchInitialApiDealers(debouncedSearch);
    }
  }, [isApiMode, debouncedSearch, fetchInitialApiDealers, refreshKey]);

  // Cuộn tải thêm ở chế độ API
  const loadMoreApiDealers = async () => {
    if (!isApiMode || apiLoading || apiLoadingMore || !apiHasMore) return;
    setApiLoadingMore(true);
    const nextPage = apiPage + 1;
    try {
      const res = await searchDealers(token || '', {
        keyword: debouncedSearch.trim() || undefined,
        page: nextPage,
        page_size: stepCount,
      });
      const newItems = res?.items || [];
      const total = res?.total || apiTotal;
      const more = nextPage * stepCount < total;

      if (newItems.length === 0) {
        setApiHasMore(false);
      } else {
        setApiDealers((prev) => {
          const ids = new Set(prev.map((d) => d.id));
          const unique = newItems.filter((d) => !ids.has(d.id));
          return [...prev, ...unique];
        });
        setApiPage(nextPage);
        setApiTotal(total);
        setApiHasMore(more);
      }
    } catch (err) {
      console.error('Error loading more api dealers:', err);
      setApiHasMore(false);
    } finally {
      setApiLoadingMore(false);
    }
  };

  // 3. Chế độ Client: Tìm kiếm & phân trang lười trên danh sách externalDealers
  const effectiveDealers: AnyDealer[] = useMemo(() => {
    return isApiMode ? apiDealers : externalDealers || [];
  }, [isApiMode, apiDealers, externalDealers]);

  const allOptions = useMemo(() => {
    const list: Array<{ isAll: boolean; dealer?: AnyDealer }> = [];
    if (allowAll) {
      list.push({ isAll: true });
    }
    effectiveDealers.forEach((d) => {
      list.push({ isAll: false, dealer: d });
    });
    return list;
  }, [effectiveDealers, allowAll]);

  const filteredOptions = useMemo(() => {
    if (isApiMode) {
      return allOptions; // API đã lọc ở server
    }
    if (!searchTerm.trim()) return allOptions;
    const term = searchTerm.toLowerCase().trim();
    return allOptions.filter((opt) => {
      if (opt.isAll) {
        return (
          allLabel.toLowerCase().includes(term) ||
          'tat ca dai ly'.includes(term) ||
          'all'.includes(term)
        );
      }
      const d = opt.dealer;
      if (!d) return false;
      const code = (d.code || '').toLowerCase();
      const name = (d.name || '').toLowerCase();
      const phone = (d.phone || '').toLowerCase();
      const region = ('region' in d && d.region ? d.region : '').toLowerCase();
      return (
        code.includes(term) ||
        name.includes(term) ||
        phone.includes(term) ||
        region.includes(term)
      );
    });
  }, [allOptions, isApiMode, searchTerm, allLabel]);

  // Hiển thị số lượng mục theo phân trang lười (bắt đầu 10 mục)
  const displayedOptions = useMemo(() => {
    if (isApiMode) {
      return allOptions;
    }
    return filteredOptions.slice(0, visibleCount);
  }, [isApiMode, allOptions, filteredOptions, visibleCount]);

  const clientHasMore = !isApiMode && visibleCount < filteredOptions.length;

  // 4. Reset về trạng thái ban đầu: xóa từ khóa, reset 10 đại lý, cuộn ở đỉnh
  const resetToInitialState = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearch('');
    setVisibleCount(initialCount);

    if (isApiMode) {
      setApiPage(1);
      if (initialApiDealersRef.current.length > 0) {
        setApiDealers(initialApiDealersRef.current);
        setApiTotal(initialApiTotalRef.current);
        setApiHasMore(initialApiDealersRef.current.length < initialApiTotalRef.current);
      }
    }

    if (listContainerRef.current) {
      listContainerRef.current.scrollTop = 0;
    }
  }, [initialCount, isApiMode]);

  // KHI TẮT ĐI (BẤM RA NGOÀI HOẶC ESC) QUAY VỀ BAN ĐẦU - KHÔNG LƯU DỮ LIỆU ĐÃ CUỘN XUỐNG
  useEffect(() => {
    if (prevIsOpenRef.current && !isOpen) {
      resetToInitialState();
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, resetToInitialState]);

  // Đóng khi click bên ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Đóng khi nhấn phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Tự động focus vào ô tìm kiếm khi mở
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
        if (listContainerRef.current) {
          listContainerRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Xử lý sự kiện cuộn xuống gần đáy để tải tiếp 10 item kế tiếp
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 30) {
      if (isApiMode) {
        if (apiHasMore && !apiLoading && !apiLoadingMore) {
          loadMoreApiDealers();
        }
      } else {
        if (clientHasMore) {
          setVisibleCount((prev) => Math.min(prev + stepCount, filteredOptions.length));
        }
      }
    }
  };

  // Đại lý đang được chọn để hiển thị trên nút bấm
  const selectedDealer = useMemo(() => {
    if (!effectiveSelectedId || effectiveSelectedId === 'all') {
      return initialDealer || null;
    }
    const found = effectiveDealers.find((d) => d.id === Number(effectiveSelectedId));
    return found || initialDealer || null;
  }, [effectiveSelectedId, effectiveDealers, initialDealer]);

  const handleSelectOption = (opt: { isAll: boolean; dealer?: AnyDealer }) => {
    if (opt.isAll) {
      if (onSelectId) onSelectId('all');
      if (onSelect) onSelect(null);
      if (onSelectDealer) onSelectDealer(null as any);
    } else if (opt.dealer) {
      if (onSelectId) onSelectId(opt.dealer.id);
      if (onSelect) onSelect(opt.dealer);
      if (onSelectDealer) onSelectDealer(opt.dealer);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Nút bấm hiển thị đại lý đang được chọn */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          height: compact ? '32px' : '42px',
          padding: compact ? '0 10px' : '0 14px',
          borderRadius: compact ? '6px' : '8px',
          border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          boxShadow: isOpen ? '0 0 0 2px rgba(37, 99, 235, 0.2)' : 'none',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'all 0.15s ease',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: compact ? '12px' : '14px',
            textAlign: 'left',
          }}
        >
          {isAllSelected ? (
            <span style={{ fontWeight: '700', color: '#1e293b' }}>{allLabel}</span>
          ) : selectedDealer ? (
            <span>
              <strong style={{ color: '#0f172a', fontWeight: '700' }}>{selectedDealer.name}</strong>{' '}
              <span style={{ color: '#64748b', fontWeight: '500' }}>({selectedDealer.code})</span>
            </span>
          ) : (
            <span style={{ color: '#94a3b8' }}>{placeholder}</span>
          )}
        </span>

        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{
            color: '#64748b',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '8px',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Menu Dropdown đổ xuống có thanh tìm kiếm & Infinite Scroll */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            minWidth: 'max(100%, 360px)',
            maxWidth: 'min(92vw, 480px)',
            marginTop: '4px',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Hộp tìm kiếm tức thì ở trên cùng */}
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              flexShrink: 0,
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: 'absolute',
                  left: '10px',
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
                placeholder="Tìm mã, tên đại lý, SĐT..."
                style={{
                  width: '100%',
                  height: '34px',
                  paddingLeft: '32px',
                  paddingRight: '28px',
                  fontSize: '13px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
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
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Xóa tìm kiếm"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Danh sách đại lý cuộn vô tận (Infinite Scroll) */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            style={{
              maxHeight: dropdownMaxHeight,
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              scrollPaddingTop: '4px',
              paddingTop: '2px',
              paddingBottom: '2px',
            }}
          >
            {isApiMode && apiLoading && apiDealers.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #2563eb',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }}
                />
                <span>Đang tải danh sách đại lý...</span>
              </div>
            ) : displayedOptions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '13px', color: '#64748b' }}>
                {searchTerm
                  ? `Không tìm thấy đại lý phù hợp với "${searchTerm}".`
                  : 'Danh sách đại lý đang trống.'}
              </div>
            ) : (
              displayedOptions.map((opt) => {
                if (opt.isAll) {
                  return (
                    <div
                      key="option-all-dealers"
                      onClick={() => handleSelectOption(opt)}
                      style={{
                        padding: '10px 14px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        background: isAllSelected ? '#eff6ff' : '#ffffff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isAllSelected) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isAllSelected ? '#eff6ff' : '#ffffff';
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '10px',
                              fontWeight: '700',
                              color: '#1e40af',
                              background: '#dbeafe',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            TẤT CẢ
                          </span>
                          <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                            {allLabel}
                          </span>
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          Xem toàn bộ đại lý hệ thống
                        </div>
                      </div>
                      {isAllSelected && (
                        <div style={{ color: '#2563eb' }}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                }

                const d = opt.dealer!;
                const isSelected = selectedDealer?.id === d.id;
                const customerGroup = 'customer_group' in d && d.customer_group ? d.customer_group : 'Đại lý';
                const region = 'region' in d && d.region ? d.region : undefined;

                return (
                  <div
                    key={d.id}
                    onClick={() => handleSelectOption(opt)}
                    style={{
                      padding: '9px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isSelected ? '#eff6ff' : '#ffffff';
                    }}
                  >
                    {/* Hàng 1: Tên đại lý và nhóm khách hàng */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '13.5px',
                          fontWeight: '700',
                          color: isSelected ? '#1d4ed8' : '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={d.name}
                      >
                        {d.name}
                      </div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: isSelected ? '#dbeafe' : '#f1f5f9',
                          color: isSelected ? '#1e40af' : '#475569',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                        }}
                      >
                        {customerGroup}
                      </span>
                    </div>

                    {/* Hàng 2: Mã đại lý, SĐT, Vùng nằm trọn vẹn trên 1 dòng */}
                    <div
                      style={{
                        fontSize: '11.5px',
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <span>
                        Mã:{' '}
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#334155' }}>
                          {d.code}
                        </span>
                      </span>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <span>SĐT: {d.phone || '—'}</span>
                      {region && (
                        <>
                          <span style={{ color: '#cbd5e1' }}>|</span>
                          <span>Vùng: {region}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Chỉ báo cuộn tải thêm ở chế độ API */}
            {isApiMode && apiLoadingMore && (
              <div
                style={{
                  padding: '10px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div
                  style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid #2563eb',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite',
                  }}
                />
                <span>Đang tải thêm đại lý...</span>
              </div>
            )}

            {/* Thông báo cuộn để tải thêm ở chế độ Client */}
            {clientHasMore && (
              <div
                style={{
                  padding: '8px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#64748b',
                  backgroundColor: '#f8fafc',
                }}
              >
                Cuộn xuống để xem thêm ({visibleCount}/{filteredOptions.length})
              </div>
            )}

            {isApiMode && !apiHasMore && apiDealers.length > 0 && (
              <div
                style={{
                  padding: '8px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#94a3b8',
                  backgroundColor: '#f8fafc',
                }}
              >
                Đã tải hết {apiTotal} đại lý
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
