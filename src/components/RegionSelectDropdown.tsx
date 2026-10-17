import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface RegionSelectDropdownProps {
  regions: string[];
  selectedRegion: string | null | undefined;
  onSelect: (region: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export const RegionSelectDropdown: React.FC<RegionSelectDropdownProps> = ({
  regions,
  selectedRegion,
  onSelect,
  disabled = false,
  placeholder = 'Chọn khu vực...',
  id = 'region-select-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Lọc danh sách khu vực theo từ khóa tìm kiếm
  const filteredRegions = useMemo(() => {
    if (!searchTerm.trim()) return regions;
    const term = searchTerm.toLowerCase().trim();
    return regions.filter((r) => r.toLowerCase().includes(term));
  }, [regions, searchTerm]);

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

  // Danh sách hiển thị theo phân trang lười (5 item mỗi trang)
  const displayedRegions = useMemo(() => {
    return filteredRegions.slice(0, visibleCount);
  }, [filteredRegions, visibleCount]);

  const hasMore = visibleCount < filteredRegions.length;

  // Xử lý sự kiện cuộn xuống gần đáy để tải tiếp 5 item kế tiếp
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 15) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + 5, filteredRegions.length));
      }
    }
  };

  const handleSelectItem = (region: string) => {
    onSelect(region);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Nút bấm hiển thị khu vực đang được chọn */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full h-8 px-2.5 text-xs rounded-lg border text-left font-medium transition-all flex items-center justify-between shadow-2xs cursor-pointer ${
          isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-white text-slate-900'
            : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className="truncate pr-1.5 font-medium text-xs">
          {selectedRegion ? (
            <span className="flex items-center gap-1.5 truncate">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="font-semibold text-slate-900 truncate text-xs">{selectedRegion}</span>
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
          className="absolute top-full left-0 right-0 w-full mt-1 z-[99999] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{
            maxHeight: '250px',
          }}
        >
          {/* Hộp tìm kiếm khu vực phía trên */}
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
                placeholder="Tìm tên khu vực..."
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

          {/* Danh sách khu vực (Chỉ hiển thị 5 item đầu tiên, cuộn xuống tải tiếp 5 item) */}
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
            {displayedRegions.length === 0 ? (
              <div className="p-3 text-center text-slate-500 text-[11px]">
                {searchTerm
                  ? `Không tìm thấy khu vực phù hợp với "${searchTerm}".`
                  : 'Danh sách khu vực đang trống.'}
              </div>
            ) : (
              displayedRegions.map((r) => {
                const isSelected = selectedRegion === r;
                return (
                  <div
                    key={r}
                    onClick={() => handleSelectItem(r)}
                    className={`py-1.5 px-2.5 hover:bg-emerald-50/80 cursor-pointer transition-colors flex items-center justify-between gap-2.5 min-h-[38px] ${
                      isSelected ? 'bg-emerald-50/70 font-semibold text-emerald-950' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2 truncate">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 shrink-0">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                      <div className="truncate">
                        <div className="text-xs font-medium truncate text-slate-900">
                          {r}
                        </div>
                        <div className="text-[10px] text-slate-400">Khu vực đồng bộ đại lý</div>
                      </div>
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

            {/* Thông báo cuộn để tải thêm khi còn khu vực */}
            {hasMore && (
              <div className="py-1 text-center text-[10px] text-slate-400 bg-slate-50/60 font-medium">
                Cuộn xuống để xem thêm ({visibleCount}/{filteredRegions.length})
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
