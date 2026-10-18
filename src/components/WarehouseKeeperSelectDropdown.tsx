import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WarehouseKeeperItem, getWarehouseKeepersApi } from '../services/api';

export interface WarehouseKeeperSelectDropdownProps {
  token: string;
  selectedManagerName?: string;
  onSelectKeeper: (keeper: WarehouseKeeperItem) => void;
  onClearKeeper?: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export const WarehouseKeeperSelectDropdown: React.FC<WarehouseKeeperSelectDropdownProps> = ({
  token,
  selectedManagerName = '',
  onSelectKeeper,
  onClearKeeper,
  placeholder = 'Chọn thủ kho phụ trách...',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [keepers, setKeepers] = useState<WarehouseKeeperItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Tải danh sách thủ kho từ phân quyền hệ thống
  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    getWarehouseKeepersApi(token)
      .then((data) => {
        setKeepers(data);
      })
      .catch((err: any) => {
        console.error('Lỗi tải danh sách thủ kho:', err);
        setError(err.message || 'Không thể tải danh sách thủ kho');
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  // Click outside listener để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tự động focus ô tìm kiếm khi mở dropdown
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Tìm thủ kho đang được chọn
  const selectedKeeper = useMemo(() => {
    if (!selectedManagerName) return null;
    const clean = selectedManagerName.trim().toLowerCase();
    return keepers.find(
      (k) =>
        k.full_name.trim().toLowerCase() === clean ||
        k.username.trim().toLowerCase() === clean
    ) || null;
  }, [keepers, selectedManagerName]);

  // Lọc theo từ khóa tìm kiếm
  const filteredKeepers = useMemo(() => {
    if (!searchTerm.trim()) return keepers;
    const term = searchTerm.trim().toLowerCase();
    return keepers.filter(
      (k) =>
        k.full_name.toLowerCase().includes(term) ||
        k.username.toLowerCase().includes(term) ||
        (k.phone && k.phone.toLowerCase().includes(term)) ||
        (k.branch && k.branch.toLowerCase().includes(term)) ||
        (k.role_title && k.role_title.toLowerCase().includes(term))
    );
  }, [keepers, searchTerm]);

  const handleSelect = (k: WarehouseKeeperItem) => {
    onSelectKeeper(k);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClearKeeper) {
      onClearKeeper();
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'warehouse':
        return {
          bg: '#ecfdf5',
          text: '#047857',
          border: '#a7f3d0',
          label: 'Thủ kho',
        };
      case 'warehouse_manager':
        return {
          bg: '#eff6ff',
          text: '#1d4ed8',
          border: '#bfdbfe',
          label: 'Quản lý kho',
        };
      case 'admin':
      case 'system_admin':
        return {
          bg: '#f5f3ff',
          text: '#6d28d9',
          border: '#ddd6fe',
          label: 'Quản trị viên',
        };
      default:
        return {
          bg: '#f1f5f9',
          text: '#475569',
          border: '#cbd5e1',
          label: 'Nhân sự kho',
        };
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Nút bấm hiển thị người phụ trách được chọn (Trigger Input) */}
      <div
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          width: '100%',
          minHeight: '40px',
          padding: '8px 12px',
          backgroundColor: disabled ? '#f8fafc' : '#ffffff',
          border: isOpen ? '2px solid #059669' : '1px solid #cbd5e1',
          borderRadius: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          boxSizing: 'border-box',
          boxShadow: isOpen ? '0 0 0 3px rgba(5, 150, 105, 0.15)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {selectedKeeper ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: getRoleBadgeStyle(selectedKeeper.role).bg,
                  color: getRoleBadgeStyle(selectedKeeper.role).text,
                  border: `1px solid ${getRoleBadgeStyle(selectedKeeper.role).border}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {getRoleBadgeStyle(selectedKeeper.role).label}
              </span>
              <strong style={{ fontSize: '13.5px', color: '#0f172a', whiteSpace: 'nowrap' }}>
                {selectedKeeper.full_name}
              </strong>
              {selectedKeeper.phone && (
                <span style={{ fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                  ({selectedKeeper.phone})
                </span>
              )}
            </div>
          ) : selectedManagerName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>
                {selectedManagerName}
              </strong>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>(Nhập tự do)</span>
            </div>
          ) : (
            <span style={{ fontSize: '13.5px', color: '#94a3b8' }}>
              {placeholder}
            </span>
          )}
        </div>

        {/* Nút Xóa & Mũi tên Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {(selectedKeeper || selectedManagerName) && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Bỏ chọn người phụ trách"
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: 'transform 0.2s ease',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Dropdown Menu Đổ Xuống (Kiểu dáng giống hệt Ảnh 2) */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 9999,
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 15px 30px -5px rgba(0, 0, 0, 0.15), 0 10px 15px -5px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '320px',
          }}
        >
          {/* Hộp Tìm Kiếm Đầu Dropdown (Kính lúp + Input) */}
          <div
            style={{
              padding: '8px 10px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#64748b"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: '18px',
                pointerEvents: 'none',
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Tìm kiếm thủ kho theo họ tên, username, SĐT, kho..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 30px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '18px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          {/* Danh Sách Nhân Sự Thủ Kho (Cuộn dọc) */}
          <div
            style={{
              overflowY: 'auto',
              maxHeight: '260px',
              padding: '4px 0',
            }}
          >
            {isLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#059669', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid #059669', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span>Đang đồng bộ danh sách thủ kho...</span>
              </div>
            ) : error ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#dc2626', fontSize: '13px' }}>
                {error}
              </div>
            ) : filteredKeepers.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                {searchTerm
                  ? `Không tìm thấy nhân sự thủ kho nào khớp với "${searchTerm}".`
                  : 'Hệ thống chưa có nhân sự nào được phân quyền Thủ kho.'}
              </div>
            ) : (
              filteredKeepers.map((k) => {
                const isSelected = selectedKeeper?.id === k.id;
                const badge = getRoleBadgeStyle(k.role);

                return (
                  <div
                    key={k.id}
                    onClick={() => handleSelect(k)}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                      backgroundColor: isSelected ? '#ecfdf5' : '#ffffff',
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f0fdf4';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#ffffff';
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {/* Dòng 1: Badge vai trò + Họ tên + Username */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            flexShrink: 0,
                          }}
                        >
                          {badge.label}
                        </span>
                        <span style={{ fontSize: '13.5px', fontWeight: isSelected ? 700 : 600, color: '#0f172a' }}>
                          {k.full_name}
                        </span>
                        <span style={{ fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>
                          @{k.username}
                        </span>
                      </div>

                      {/* Dòng 2: Chi nhánh kho + Số điện thoại (Ảnh 2 style) */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', marginTop: '3px', flexWrap: 'wrap' }}>
                        <span>Kho: <strong style={{ color: '#334155' }}>{k.branch || 'Toàn quốc'}</strong></span>
                        <span>•</span>
                        {k.phone ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>
                            SĐT: {k.phone}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Chưa có SĐT</span>
                        )}
                        {k.email && (
                          <>
                            <span>•</span>
                            <span style={{ color: '#64748b' }}>{k.email}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Dấu Checkmark xanh lá khi được chọn (Như Ảnh 2) */}
                    {isSelected && (
                      <div style={{ color: '#059669', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
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
