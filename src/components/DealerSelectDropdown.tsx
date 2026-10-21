import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DealerItem } from '../services/api';

export interface DealerSelectDropdownProps {
  dealers: DealerItem[];
  selectedId: number | 'all' | '' | null | undefined;
  onSelect?: (dealer: DealerItem) => void;
  onSelectId?: (id: number | 'all') => void;
  disabled?: boolean;
  placeholder?: string;
  allowAll?: boolean;
  allLabel?: string;
  compact?: boolean;
  id?: string;
}

export const DealerSelectDropdown: React.FC<DealerSelectDropdownProps> = ({
  dealers,
  selectedId,
  onSelect,
  onSelectId,
  disabled = false,
  placeholder = '-- Chọn đại lý cần đối chiếu --',
  allowAll = false,
  allLabel = '-- Tất cả đại lý --',
  compact = false,
  id = 'dealer-select-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Tạo danh sách tổng bao gồm cả tùy chọn "Tất cả đại lý" nếu allowAll = true
  const allOptions = useMemo(() => {
    const list: Array<{ isAll: boolean; dealer?: DealerItem }> = [];
    if (allowAll) {
      list.push({ isAll: true });
    }
    dealers.forEach((d) => {
      list.push({ isAll: false, dealer: d });
    });
    return list;
  }, [dealers, allowAll]);

  // Lọc danh sách theo từ khóa tìm kiếm
  const filteredOptions = useMemo(() => {
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
      const region = (d.region || '').toLowerCase();
      return (
        code.includes(term) ||
        name.includes(term) ||
        phone.includes(term) ||
        region.includes(term)
      );
    });
  }, [allOptions, searchTerm, allLabel]);

  // Mỗi lần từ khóa thay đổi hoặc khi mở dropdown: reset hiển thị 5 item đầu tiên
  useEffect(() => {
    setVisibleCount(5);
  }, [searchTerm, isOpen]);

  // Tự động focus vào ô tìm kiếm khi mở
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

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

  // Đại lý hiện đang được chọn
  const isAllSelected = selectedId === 'all';
  const selectedDealer = useMemo(() => {
    if (!selectedId || selectedId === 'all') return null;
    return dealers.find((d) => d.id === Number(selectedId)) || null;
  }, [dealers, selectedId]);

  // Danh sách hiển thị theo phân trang lười (5 item mỗi lần)
  const displayedOptions = useMemo(() => {
    return filteredOptions.slice(0, visibleCount);
  }, [filteredOptions, visibleCount]);

  const hasMore = visibleCount < filteredOptions.length;

  // Xử lý sự kiện cuộn xuống gần đáy để tải tiếp 5 item kế tiếp
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 15) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + 5, filteredOptions.length));
      }
    }
  };

  const handleSelectOption = (opt: { isAll: boolean; dealer?: DealerItem }) => {
    if (opt.isAll) {
      if (onSelectId) onSelectId('all');
      if (onSelect) onSelect(null as any);
    } else if (opt.dealer) {
      if (onSelectId) onSelectId(opt.dealer.id);
      if (onSelect) onSelect(opt.dealer);
    }
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Nút bấm hiển thị đại lý đang được chọn */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full ${
          compact ? 'h-8 px-2.5 text-xs rounded-md' : 'min-h-[36px] px-3 py-1.5 text-xs rounded-lg'
        } border text-left font-medium transition-all flex items-center justify-between shadow-2xs cursor-pointer ${
          isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-white text-slate-900'
            : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className="truncate pr-1.5 font-medium text-xs">
          {isAllSelected ? (
            <span className="font-semibold text-slate-800 text-xs">{allLabel}</span>
          ) : selectedDealer ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-mono text-[10px] font-bold text-slate-900 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 shrink-0">
                {selectedDealer.code}
              </span>
              <span className="text-slate-900 font-medium truncate text-xs">{selectedDealer.name}</span>
              {selectedDealer.region && (
                <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                  {selectedDealer.region}
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 font-normal text-xs">{placeholder}</span>
          )}
        </span>

        <svg
          width="13"
          height="13"
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

      {/* Menu Dropdown đổ xuống có thanh tìm kiếm & Phân trang cuộn vô tận (Lazy Load 5 item) */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          className="absolute top-full left-0 w-full min-w-[310px] sm:min-w-[330px] mt-1 z-[99999] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{
            maxHeight: '250px',
          }}
        >
          {/* Hộp tìm kiếm đại lý phía trên */}
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
                placeholder="Tìm mã, tên đại lý, SĐT..."
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
                    justifyContent: 'center',
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

          {/* Danh sách đại lý (Chỉ hiển thị 5 item đầu tiên, cuộn xuống tải tiếp 5 item) */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto divide-y divide-slate-100"
            style={{
              overscrollBehavior: 'contain',
              maxHeight: '190px',
              scrollPaddingTop: '2px',
              paddingTop: '1px',
              paddingBottom: '1px',
            }}
          >
            {displayedOptions.length === 0 ? (
              <div className="p-3 text-center text-slate-500 text-[11px]">
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
                      className={`py-1.5 px-2.5 hover:bg-emerald-50/80 cursor-pointer transition-colors flex items-center justify-between gap-2.5 min-h-[36px] ${
                        isAllSelected ? 'bg-emerald-50/70 font-semibold text-emerald-950' : 'text-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-200 shrink-0">
                            TẤT CẢ
                          </span>
                          <span className="text-xs font-semibold truncate text-slate-900">
                            {allLabel}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          Xem toàn bộ đại lý hệ thống
                        </div>
                      </div>

                      {isAllSelected && (
                        <div className="shrink-0 text-emerald-600">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                }

                const d = opt.dealer!;
                const isSelected = selectedDealer?.id === d.id;
                return (
                  <div
                    key={d.id}
                    onClick={() => handleSelectOption(opt)}
                    className={`py-1.5 px-2.5 hover:bg-emerald-50/80 cursor-pointer transition-colors flex items-center justify-between gap-2.5 min-h-[38px] ${
                      isSelected ? 'bg-emerald-50/70 font-semibold text-emerald-950' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                          {d.code}
                        </span>
                        <span className="text-xs font-medium truncate text-slate-900">
                          {d.name}
                        </span>
                        {d.region && (
                          <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                            {d.region}
                          </span>
                        )}
                      </div>
                      {d.phone && (
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                          SĐT: <strong className="text-slate-700">{d.phone}</strong>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className="shrink-0 text-emerald-600">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Thông báo cuộn để tải thêm khi còn đại lý */}
            {hasMore && (
              <div className="py-1 text-center text-[10px] text-slate-400 bg-slate-50/60 font-medium">
                Cuộn xuống để xem thêm ({visibleCount}/{filteredOptions.length})
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
