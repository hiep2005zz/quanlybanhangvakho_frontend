import React, { useState, useEffect, useRef, useMemo } from 'react';

export interface WarehouseItem {
  id?: string;
  warehouse_id?: string;
  name?: string;
  warehouse_name?: string;
  code?: string;
  address?: string;
}

export interface WarehouseSelectDropdownProps {
  warehouses: WarehouseItem[];
  selectedId: string | null | undefined;
  onSelect: (warehouseId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  compact?: boolean;
  allowAll?: boolean;
  allLabel?: string;
  allValue?: string;
  initialCount?: number;
  stepCount?: number;
}

export const WarehouseSelectDropdown: React.FC<WarehouseSelectDropdownProps> = ({
  warehouses,
  selectedId,
  onSelect,
  disabled = false,
  placeholder = '-- Chọn kho hàng --',
  id = 'warehouse-select-dropdown',
  compact = false,
  allowAll = false,
  allLabel = 'Tất cả kho',
  allValue,
  initialCount = 10,
  stepCount = 10,
}) => {
  const effectiveAllValue = allValue !== undefined ? allValue : (selectedId === 'ALL' ? 'ALL' : 'all');
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(initialCount);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Chuẩn hóa danh sách kho
  const normalizedWarehouses = useMemo(() => {
    return warehouses.map((w) => {
      const wId = String(w.warehouse_id || w.id || '').trim();
      const wName = String(w.warehouse_name || w.name || '').trim();
      return {
        id: wId,
        name: wName || wId,
        code: w.code || wId,
        address: w.address,
      };
    }).filter((w) => Boolean(w.id));
  }, [warehouses]);

  // Lấy kho đang được chọn
  const isAllSelected =
    selectedId === 'all' ||
    selectedId === 'ALL' ||
    selectedId === effectiveAllValue ||
    (!selectedId && allowAll);
  const selectedWarehouse = useMemo(() => {
    if (isAllSelected) return null;
    return normalizedWarehouses.find((w) => w.id === selectedId) || null;
  }, [normalizedWarehouses, selectedId, isAllSelected]);

  // Lọc danh sách kho theo từ khóa tìm kiếm (mã kho hoặc tên kho)
  const filteredWarehouses = useMemo(() => {
    if (!searchTerm.trim()) return normalizedWarehouses;
    const term = searchTerm.toLowerCase().trim();
    return normalizedWarehouses.filter(
      (w) =>
        w.name.toLowerCase().includes(term) ||
        w.id.toLowerCase().includes(term) ||
        (w.code && w.code.toLowerCase().includes(term))
    );
  }, [normalizedWarehouses, searchTerm]);

  // Kiểm tra xem mục "Tất cả các kho" có khớp từ khóa tìm kiếm không
  const showAllOption = useMemo(() => {
    if (!allowAll) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      'tất cả các kho'.includes(term) ||
      'tat ca cac kho'.includes(term) ||
      'tat ca'.includes(term) ||
      'tất cả'.includes(term) ||
      'all'.includes(term) ||
      allLabel.toLowerCase().includes(term)
    );
  }, [allowAll, searchTerm, allLabel]);

  // Khi đóng/mở dropdown hoặc khi thay đổi từ khóa: reset hiển thị đúng 10 item ban đầu
  useEffect(() => {
    setVisibleCount(initialCount);
  }, [searchTerm, isOpen, initialCount]);

  // Tự động focus vào ô tìm kiếm khi mở
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
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

  // Danh sách hiển thị theo phân trang cuộn (mỗi lần hiển thị 10 kho)
  const displayedWarehouses = useMemo(() => {
    return filteredWarehouses.slice(0, visibleCount);
  }, [filteredWarehouses, visibleCount]);

  const hasMore = visibleCount < filteredWarehouses.length;

  // Xử lý cuộn xuống gần đáy thì load thêm 10 kho tiếp theo
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 25) {
      if (hasMore) {
        setVisibleCount((prev) => Math.min(prev + stepCount, filteredWarehouses.length));
      }
    }
  };

  const handleSelectWarehouse = (whId: string) => {
    onSelect(whId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Nút bấm hiển thị ô chọn kho (Trigger Button) */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          height: compact ? '35px' : '42px',
          padding: compact ? '0 10px' : '0 14px',
          borderRadius: compact ? '8px' : '10px',
          border: isOpen ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
          backgroundColor: '#ffffff',
          color: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.15s ease',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
          boxSizing: 'border-box',
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: compact ? '13px' : '14px',
            fontWeight: selectedWarehouse || isAllSelected ? '600' : '400',
            textAlign: 'left',
          }}
        >
          {isAllSelected ? (
            <span style={{ color: '#0f172a' }}>{allLabel}</span>
          ) : selectedWarehouse ? (
            <span>
              <strong style={{ color: '#0f172a' }}>{selectedWarehouse.name}</strong>{' '}
              <span style={{ color: '#64748b', fontWeight: '500' }}>({selectedWarehouse.id})</span>
            </span>
          ) : (
            <span style={{ color: '#94a3b8' }}>{placeholder}</span>
          )}
        </span>

        {/* Mũi tên chỉ hướng đóng/mở */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
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

      {/* Menu xổ xuống có thanh tìm kiếm & Phân trang cuộn 10 mục (Load More on Scroll) */}
      {isOpen && (
        <div
          onWheel={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            minWidth: 'max(100%, 300px)',
            maxWidth: 'min(92vw, 420px)',
            marginTop: '4px',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Ô tìm kiếm tức thì ở trên cùng (Thiết kế chuẩn như hình 3) */}
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
                placeholder="Tìm mã hoặc tên kho..."
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

          {/* Danh sách kho cuộn tải thêm: Mỗi lần hiển thị 10 thông tin, cuộn xuống tải thêm */}
          <div
            ref={listContainerRef}
            onScroll={handleScroll}
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              scrollPaddingTop: '4px',
              paddingTop: '2px',
              paddingBottom: '2px',
            }}
          >
            {/* Lựa chọn "Tất cả các kho" nếu được bật */}
            {showAllOption && (
              <div
                onClick={() => handleSelectWarehouse(effectiveAllValue)}
                style={{
                  padding: '9px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: isAllSelected ? '#eff6ff' : '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isAllSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isAllSelected ? '#eff6ff' : '#ffffff';
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
                        backgroundColor: '#dbeafe',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      TẤT CẢ
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                      {allLabel}
                    </span>
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
            )}

            {/* Các kho hàng khớp tìm kiếm */}
            {displayedWarehouses.length === 0 && !showAllOption ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12.5px', color: '#64748b' }}>
                <div>Không tìm thấy kho hàng phù hợp với &ldquo;{searchTerm}&rdquo;.</div>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: '600',
                      cursor: 'pointer',
                      marginTop: '6px',
                      fontSize: '12px',
                    }}
                  >
                    Xóa từ khóa tìm kiếm
                  </button>
                )}
              </div>
            ) : (
              displayedWarehouses.map((w) => {
                const isSelected = selectedWarehouse?.id === w.id;

                return (
                  <div
                    key={w.id}
                    onClick={() => handleSelectWarehouse(w.id)}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = isSelected ? '#eff6ff' : '#ffffff';
                    }}
                  >
                    {/* Hàng 1: Tên kho và Nhãn mã kho */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: '700',
                          color: isSelected ? '#1d4ed8' : '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {w.name}
                      </div>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '10.5px',
                          fontWeight: '700',
                          color: '#047857',
                          backgroundColor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          flexShrink: 0,
                        }}
                      >
                        {w.id}
                      </span>
                    </div>

                    {/* Hàng 2: Chi tiết mã kho và dấu tích chọn */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Mã: <strong style={{ color: '#334155' }}>{w.id}</strong>
                      </div>
                      {isSelected && (
                        <div style={{ color: '#2563eb' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
