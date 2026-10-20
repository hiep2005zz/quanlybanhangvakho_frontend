import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Supplier } from '../services/api';

export interface SupplierSelectDropdownProps {
  suppliers: Supplier[];
  selectedSupplierId: number | '';
  onSelectSupplier: (supplier: Supplier | null) => void;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
}

export const SupplierSelectDropdown: React.FC<SupplierSelectDropdownProps> = ({
  suppliers,
  selectedSupplierId,
  onSelectSupplier,
  disabled = false,
  hasError = false,
  placeholder = '-- Chọn nhà cung cấp --',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId) return null;
    return suppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  // Lọc danh sách nhà cung cấp theo từ khóa
  const filteredSuppliers = useMemo(() => {
    if (!searchTerm.trim()) return suppliers;
    const q = searchTerm.trim().toLowerCase();
    return suppliers.filter((s) => {
      const codeMatch = (s.code || '').toLowerCase().includes(q);
      const nameMatch = (s.name || '').toLowerCase().includes(q);
      const taxMatch = (s.tax_code || '').toLowerCase().includes(q);
      const contactMatch = (s.contact_person || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || taxMatch || contactMatch;
    });
  }, [suppliers, searchTerm]);

  // Tự động xóa từ khóa tìm kiếm, reset về 10 mục và focus khi mở lại dropdown
  useEffect(() => {
    setSearchTerm('');
    setVisibleCount(10);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
    if (isOpen) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  // Reset về 10 mục khi gõ từ khóa tìm kiếm mới
  useEffect(() => {
    setVisibleCount(10);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [searchTerm]);

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

  // Xử lý cuộn: lướt xuống gần đáy sẽ load tiếp thêm 10 thông tin nữa
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight <= 35) {
      if (visibleCount < filteredSuppliers.length) {
        setVisibleCount((prev) => Math.min(prev + 10, filteredSuppliers.length));
      }
    }
  };

  const displayedSuppliers = useMemo(() => {
    return filteredSuppliers.slice(0, visibleCount);
  }, [filteredSuppliers, visibleCount]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Nút bấm hiển thị thay thế ô select truyền thống */}
      <div
        id="supplier-select-trigger"
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: '7px',
          border: hasError ? '1.5px solid #ef4444' : isOpen ? '1.5px solid #10b981' : '1px solid #cbd5e1',
          background: disabled ? '#f1f5f9' : '#ffffff',
          color: selectedSupplier ? '#0f172a' : '#94a3b8',
          fontSize: '13px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          boxSizing: 'border-box',
          minHeight: '38px',
          boxShadow: isOpen ? '0 0 0 3px rgba(16, 185, 129, 0.15)' : 'none',
          transition: 'all 0.18s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
          {selectedSupplier ? (
            <>
              <span
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '1.5px 6px',
                  borderRadius: '5px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  flexShrink: 0,
                }}
              >
                [{selectedSupplier.code}]
              </span>
              <span
                style={{
                  fontWeight: '600',
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedSupplier.name}
              </span>
            </>
          ) : (
            <span>{placeholder}</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {selectedSupplier && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSupplier(null);
              }}
              title="Bỏ chọn nhà cung cấp"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '13px',
                fontWeight: '700',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              ✕
            </button>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Dropdown Panel xổ xuống - Thiết kế chuẩn theo Hình 3 */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: 'max(100%, 480px)',
            maxWidth: '650px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.15), 0 6px 12px -2px rgba(0, 0, 0, 0.08)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeInCard 0.15s ease-out',
          }}
        >
          {/* Hàng 1: Khung tìm kiếm kéo dài toàn bộ chiều rộng, viền trung tính, triệt để loại bỏ viền xanh focus bị lệch */}
          <div
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <style>{`
              .supplier-search-input {
                height: 30px !important;
                line-height: normal !important;
                font-size: 13px !important;
                padding: 2px 4px !important;
                caret-color: #2563eb !important;
              }
              .supplier-search-input,
              .supplier-search-input:focus,
              .supplier-search-input:focus-visible,
              .supplier-search-input:hover {
                box-shadow: none !important;
                outline: none !important;
                border: none !important;
                background: transparent !important;
              }
            `}</style>
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                boxSizing: 'border-box',
                minHeight: '38px',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="supplier-search-input"
                placeholder="Tìm nhanh theo mã hoặc tên nhà cung cấp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.outline = 'none';
                  e.currentTarget.style.border = 'none';
                }}
                style={{
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  width: '100%',
                  fontSize: '13px',
                  color: '#0f172a',
                  background: 'transparent',
                  padding: '2px 4px',
                  margin: 0,
                  height: '30px',
                  lineHeight: 'normal',
                  caretColor: '#2563eb',
                  boxSizing: 'border-box',
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '700',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Danh sách nhà cung cấp (Hiển thị 10 mục ban đầu, cuộn xuống tải tiếp thêm 1 mục) */}
          <div
            ref={listRef}
            onScroll={handleScroll}
            style={{
              maxHeight: '320px',
              overflowY: 'auto',
              background: '#ffffff',
            }}
          >
            {filteredSuppliers.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                Không tìm thấy nhà cung cấp nào khớp với "<strong>{searchTerm}</strong>".
              </div>
            ) : (
              displayedSuppliers.map((s) => {
                const isSelected = selectedSupplierId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectSupplier(s);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '10px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      cursor: 'pointer',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = '#ffffff';
                    }}
                  >
                    {/* Thông tin bên trái: Mã, Tên, MST, Người liên hệ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1, flexWrap: 'wrap' }}>
                      <span
                        style={{
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#047857',
                          fontSize: '11px',
                          fontWeight: '700',
                          padding: '2px 7px',
                          borderRadius: '6px',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                          flexShrink: 0,
                        }}
                      >
                        [{s.code}]
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                        {s.name}
                      </span>
                      {s.tax_code && (
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: '#64748b',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          MST: {s.tax_code}
                        </span>
                      )}
                      {s.contact_person && (
                        <span
                          style={{
                            fontSize: '10.5px',
                            color: '#475569',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          LH: {s.contact_person}
                        </span>
                      )}
                    </div>

                    {/* Nút bên phải: "+ Chọn" (hoặc "Đã chọn") chuẩn theo Hình 3 */}
                    <div style={{ flexShrink: 0 }}>
                      {isSelected ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#10b981',
                            color: '#ffffff',
                            padding: '4px 12px',
                            borderRadius: '7px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                          }}
                        >
                          ✓ Đã chọn
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSupplier(s);
                            setIsOpen(false);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            padding: '4px 12px',
                            borderRadius: '7px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(37, 99, 235, 0.2)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#1d4ed8')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#2563eb')}
                        >
                          + Chọn
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Dòng trạng thái cuộn tải thêm */}
            {filteredSuppliers.length > 0 && (
              <div
                style={{
                  padding: '7px 12px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#94a3b8',
                  background: '#f8fafc',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                {visibleCount < filteredSuppliers.length ? (
                  <span>
                    Đang hiển thị <strong>{visibleCount}</strong> / <strong>{filteredSuppliers.length}</strong> nhà cung cấp (cuộn xuống để xem tiếp +10)...
                  </span>
                ) : (
                  <span>Đã hiển thị tất cả <strong>{filteredSuppliers.length}</strong> nhà cung cấp.</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierSelectDropdown;
