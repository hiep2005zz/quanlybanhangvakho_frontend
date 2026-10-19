import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface WarehouseItem {
  id: string;
  name: string;
}

export interface WarehouseSelectDropdownProps {
  warehouses: WarehouseItem[];
  selectedId: string | null | undefined;
  onSelect: (warehouseId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  compact?: boolean;
}

export const WarehouseSelectDropdown: React.FC<WarehouseSelectDropdownProps> = ({
  warehouses,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = '-- Chọn kho hàng --',
  id = 'warehouse-select-dropdown',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(5);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Lấy kho đang được chọn
  const selectedWarehouse = useMemo(() => {
    return warehouses.find((w) => w.id === selectedId) || null;
  }, [warehouses, selectedId]);

  // Lọc danh sách kho theo tên hoặc mã kho
  const filteredWarehouses = useMemo(() => {
    if (!searchTerm.trim()) return warehouses;
    const term = searchTerm.toLowerCase().trim();
    return warehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.id.toLowerCase().includes(term)
    );
  }, [warehouses, searchTerm]);

  // Khi đóng/mở dropdown hoặc khi thay đổi từ khóa / danh sách kho: reset về hiển thị 5 item đầu tiên
  useEffect(() => {
    setVisibleCount(5);
  }, [searchTerm, isOpen, warehouses]);

  // Tự động focus vào ô tìm kiếm khi mở
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    } else {
      setSearchTerm('');
      if (listContainerRef.current) {
        listContainerRef.current.scrollTop = 0;
      }
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

  // Đóng khi nhấn Escape
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

  // Danh sách hiển thị theo phân trang cuộn (load 5 item một lần)
  const displayedWarehouses = useMemo(() => {
    return filteredWarehouses.slice(0, visibleCount);
  }, [filteredWarehouses, visibleCount]);

  const hasMore = visibleCount < filteredWarehouses.length;

  // Xử lý cuộn xuống gần đáy thì load thêm 5 item
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 20) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + 5, filteredWarehouses.length));
      }
    }
  };

  const handleSelectItem = (whId: string) => {
    onSelect(whId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Nút bấm hiển thị ô chọn kho gửi (giống hình 2) */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full ${
          compact
            ? 'h-9 px-2.5 text-xs rounded-lg'
            : 'px-3.5 py-2.5 text-sm rounded-xl'
        } border text-left font-semibold transition-all flex items-center justify-between shadow-2xs cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white text-slate-900'
            : 'border-slate-300 bg-white text-slate-900 hover:border-slate-400'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className="truncate pr-1.5 font-semibold text-xs sm:text-sm">
          {selectedWarehouse ? (
            <span className="text-slate-900 truncate">
              {selectedWarehouse.name} ({selectedWarehouse.id})
            </span>
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
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
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown danh sách kho tích hợp ô tìm kiếm và phân trang cuộn 5 item giống hình 3 */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          className="absolute top-full left-0 right-0 w-full mt-1.5 z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in duration-150"
        >
          {/* Thanh tìm kiếm nhỏ gọn (đã bỏ 2 chữ Khả dụng & Đóng lại theo yêu cầu) */}
          <div className="p-2 border-b border-slate-200/80 bg-slate-50/90 shrink-0 rounded-t-xl">
            <div className="relative flex items-center w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 z-10 text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                ref={searchInputRef}
                type="text"
                style={{ paddingLeft: '28px', paddingRight: '24px' }}
                className="w-full h-7 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-slate-900 placeholder-slate-400 font-medium"
                placeholder="Tìm mã hoặc tên kho..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="absolute right-1.5 text-xs text-slate-400 hover:text-slate-600 px-1 py-0.5 cursor-pointer font-bold rounded z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Danh sách kho cuộn mượt: ban đầu load 5 kho, cuộn xuống load thêm 5 kho */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            className="overflow-y-auto divide-y divide-slate-100"
            style={{
              maxHeight: '260px',
              overscrollBehavior: 'contain',
            }}
          >
            {displayedWarehouses.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center text-center text-xs text-slate-500 gap-1.5">
                <span className="text-xl">🏬</span>
                <span className="font-semibold text-slate-700">
                  {searchTerm
                    ? `Không tìm thấy kho nào khớp từ khóa "${searchTerm}".`
                    : 'Không có dữ liệu kho hàng.'}
                </span>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-blue-600 hover:underline mt-1 font-medium"
                  >
                    Xóa từ khóa tìm kiếm
                  </button>
                )}
              </div>
            ) : (
              displayedWarehouses.map((w) => {
                const isSelected = w.id === selectedId;

                return (
                  <div
                    key={w.id}
                    onClick={() => handleSelectItem(w.id)}
                    className={`px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50/70 font-semibold text-blue-900'
                        : 'hover:bg-slate-50/90 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="font-mono text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                        {w.id}
                      </span>
                      <span className="truncate font-semibold text-xs text-slate-800">
                        {w.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          ✓ Đang chọn
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-2.5 py-0.5 rounded-md transition-colors cursor-pointer shadow-2xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectItem(w.id);
                          }}
                        >
                          + Chọn
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Thông báo đang tải thêm / còn bao nhiêu kho */}
            {hasMore && (
              <div className="py-2 text-center text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-1.5">
                <span>Cuộn xuống để tải thêm 5 kho tiếp theo...</span>
                <span className="text-slate-400 font-mono text-[10px]">
                  ({visibleCount}/{filteredWarehouses.length})
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
