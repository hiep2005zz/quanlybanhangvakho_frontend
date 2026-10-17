import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SalespersonOption } from '../services/salesTargetApi';

export interface SalespersonSelectDropdownProps {
  options: SalespersonOption[];
  selectedId: number | null | undefined;
  onSelect: (salesperson: SalespersonOption) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export const SalespersonSelectDropdown: React.FC<SalespersonSelectDropdownProps> = ({
  options,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = 'Chọn nhân viên kinh doanh...',
  id = 'salesperson-select-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Tìm kiếm nhân viên theo tên, username hoặc chức vụ
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase().trim();
    return options.filter((sp) => {
      const name = (sp.full_name || '').toLowerCase();
      const username = (sp.username || '').toLowerCase();
      const role = (sp.role_label || sp.role || '').toLowerCase();
      return name.includes(term) || username.includes(term) || role.includes(term);
    });
  }, [options, searchTerm]);

  // Mỗi lần tìm kiếm thay đổi hoặc mở dropdown: reset hiển thị 5 item đầu tiên
  useEffect(() => {
    setVisibleCount(5);
  }, [searchTerm, isOpen]);

  // Tự động focus vào ô tìm kiếm khi mở dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Đóng khi click ra ngoài
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

  // Xử lý phím Escape
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

  // Nhân viên hiện đang được chọn
  const selectedPerson = useMemo(() => {
    if (selectedId === null || selectedId === undefined) return null;
    return options.find((sp) => sp.id === selectedId) || null;
  }, [options, selectedId]);

  // Danh sách hiển thị theo phân trang lười (Lazy load 5 item mỗi lần)
  const displayedOptions = useMemo(() => {
    return filteredOptions.slice(0, visibleCount);
  }, [filteredOptions, visibleCount]);

  const hasMore = visibleCount < filteredOptions.length;

  // Xử lý sự kiện cuộn xuống đáy để load tiếp 5 thông tin tiếp theo
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 15) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + 5, filteredOptions.length));
      }
    }
  };

  const handleSelect = (sp: SalespersonOption) => {
    onSelect(sp);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Nút bấm hiển thị nhân viên được chọn */}
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
          {selectedPerson ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-semibold text-slate-900 truncate text-xs">{selectedPerson.full_name}</span>
              <span className="text-[11px] text-slate-500 font-normal shrink-0">
                ({selectedPerson.role_label || selectedPerson.role})
              </span>
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

      {/* Menu dropdown xổ ra kèm ô tìm kiếm và Infinite Scroll */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          className="absolute top-full left-0 right-0 w-full mt-1 z-[99999] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{
            maxHeight: '250px',
          }}
        >
          {/* Ô tìm kiếm phía trên có kính lúp và nút xóa */}
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
                placeholder="Tìm tên, chức vụ, tài khoản..."
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

          {/* Danh sách nhân viên (Tối đa 5 dòng hiển thị ban đầu, cuộn xuống tải tiếp 5 dòng) */}
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
                  ? `Không tìm thấy nhân viên phù hợp với "${searchTerm}".`
                  : 'Chưa có thông tin nhân viên nào.'}
              </div>
            ) : (
              displayedOptions.map((sp) => {
                const isSelected = selectedPerson?.id === sp.id;
                return (
                  <div
                    key={sp.id}
                    onClick={() => handleSelect(sp)}
                    className={`py-1.5 px-2.5 hover:bg-emerald-50/80 cursor-pointer transition-colors flex items-center justify-between gap-2.5 min-h-[38px] ${
                      isSelected ? 'bg-emerald-50/70 font-semibold text-emerald-950' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-100 px-1 py-0.2 rounded border border-slate-200 shrink-0">
                          ID {sp.id}
                        </span>
                        <span className="text-xs font-medium truncate text-slate-900">
                          {sp.full_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 truncate">
                        <span className="text-emerald-700 font-medium">{sp.role_label || sp.role}</span>
                        <span>•</span>
                        <span>@{sp.username}</span>
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

            {/* Thông báo tải thêm khi cuộn */}
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
