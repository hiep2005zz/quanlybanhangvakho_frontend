import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  AuditLogItem,
  getEntityAuditLogsApi,
  getAvatarUrl,
  ProductItem,
  User,
} from '../services/api';
import { AuditDetailModal } from './AuditDetailModal';
import { formatLocalDateTime } from '../utils/dateUtils';

interface ProductHistoryViewProps {
  currentUser: User;
  token: string;
  products: ProductItem[];
  initialProductCode?: string;
  initialProductName?: string;
  isCostVisible?: boolean;
  onBackToInventory?: () => void;
}

export const ProductHistoryView: React.FC<ProductHistoryViewProps> = ({
  token,
  products,
  initialProductCode,
  isCostVisible = false,
  onBackToInventory: _onBackToInventory,
}) => {
  // 1. Quản lý sản phẩm đang chọn
  const [selectedProductCode, setSelectedProductCode] = useState<string>(() => {
    if (initialProductCode) return initialProductCode;
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code') || params.get('productCode');
    if (codeParam) return codeParam;
    return products.length > 0 ? products[0].code : '';
  });

  // Tìm thông tin sản phẩm đầy đủ trong danh mục
  const selectedProduct = useMemo(() => {
    return products.find(
      (p) => p.code.toLowerCase() === (selectedProductCode || '').toLowerCase()
    );
  }, [products, selectedProductCode]);

  // Bộ tìm kiếm sản phẩm trong dropdown
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);
  const productPickerRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài mà KHÔNG dùng fixed overlay chặn thao tác cuộn trang
  useEffect(() => {
    if (!isProductPickerOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (productPickerRef.current && !productPickerRef.current.contains(e.target as Node)) {
        setIsProductPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProductPickerOpen]);

  // 2. Trạng thái tải nhật ký lịch sử
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 3. Bộ lọc
  const [filterType, setFilterType] = useState<'ALL' | 'PRICE_CHANGE' | 'INVENTORY_ADJUST'>('ALL');
  const [textSearch, setTextSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // 4. Modal chi tiết Diff
  const [selectedDetailLog, setSelectedDetailLog] = useState<AuditLogItem | null>(null);

  // Đồng bộ URL parameter khi thay đổi sản phẩm
  const handleSelectProduct = (code: string) => {
    setSelectedProductCode(code);
    setIsProductPickerOpen(false);
    setProductSearchTerm('');
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('code', code);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // ignore
    }
  };

  // Tải dữ liệu nhật ký của sản phẩm từ Backend
  const fetchLogs = (code: string) => {
    if (!code) {
      setLogs([]);
      return;
    }
    setLoading(true);
    setError(null);
    getEntityAuditLogsApi(token, 'Product', code)
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Lỗi tải lịch sử thao tác của sản phẩm.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedProductCode) {
      fetchLogs(selectedProductCode);
    }
  }, [selectedProductCode, token]);

  // Cập nhật selectedProductCode nếu ban đầu trống nhưng products được nạp
  useEffect(() => {
    if (!selectedProductCode && products.length > 0) {
      const firstCode = products[0].code;
      setSelectedProductCode(firstCode);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('code', firstCode);
        window.history.replaceState({}, '', url.toString());
      } catch {
        // ignore
      }
    }
  }, [products, selectedProductCode]);

  // Helper parse JSON an toàn
  const parseJSON = (str?: string | null): any => {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  };

  // Số lượng log theo từng loại
  const priceLogsCount = useMemo(() => {
    return logs.filter((l) => l.action_type === 'PRICE_CHANGE').length;
  }, [logs]);

  const inventoryLogsCount = useMemo(() => {
    return logs.filter((l) => l.action_type === 'INVENTORY_ADJUST').length;
  }, [logs]);

  // Lọc danh sách sản phẩm trong dropdown
  const filteredProductOptions = useMemo(() => {
    const q = productSearchTerm.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
    );
  }, [products, productSearchTerm]);

  // Lọc logs theo tab, từ khóa tìm kiếm và khoảng ngày
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Lọc theo loại thao tác
      if (filterType !== 'ALL' && log.action_type !== filterType) {
        return false;
      }

      // 2. Lọc theo từ khóa (người sửa, lý do)
      if (textSearch.trim()) {
        const q = textSearch.trim().toLowerCase();
        const matchUser = (log.user_name || '').toLowerCase().includes(q);
        const matchReason = (log.reason || '').toLowerCase().includes(q);
        if (!matchUser && !matchReason) return false;
      }

      // 3. Lọc theo ngày
      if (fromDate) {
        const logDate = log.created_at ? log.created_at.substring(0, 10) : '';
        if (logDate && logDate < fromDate) return false;
      }
      if (toDate) {
        const logDate = log.created_at ? log.created_at.substring(0, 10) : '';
        if (logDate && logDate > toDate) return false;
      }

      return true;
    });
  }, [logs, filterType, textSearch, fromDate, toDate]);

  return (
    <div style={{ padding: '0 0 40px 0', width: '100%' }}>
      {/* HEADER BAR CỦA TRANG */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #bfdbfe',
              flexShrink: 0,
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                margin: '0 0 4px 0',
                fontSize: '20px',
                fontWeight: '800',
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Lịch Sử Thay Đổi Sản Phẩm
            </h1>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
              Theo dõi chi tiết các lần điều chỉnh tồn kho, biến động giá bán và giá vốn theo từng sản phẩm
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => fetchLogs(selectedProductCode)}
            disabled={loading}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '9px 16px',
              fontSize: '13.5px',
              color: '#334155',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s ease',
            }}
            title="Làm mới lịch sử"
          >
            <span>{loading ? 'Đang tải...' : 'Làm mới 🔄'}</span>
          </button>
        </div>
      </div>

      {/* 3. THẺ THÔNG TIN SẢN PHẨM & DROPDOWN CHỌN SẢN PHẨM */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '16px',
            marginBottom: '16px',
          }}
        >
          {/* Chọn sản phẩm */}
          <div ref={productPickerRef} style={{ position: 'relative', minWidth: '320px', flex: '1 1 320px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12.5px',
                fontWeight: '700',
                color: '#475569',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              Chọn sản phẩm xem lịch sử:
            </label>

            <button
              type="button"
              onClick={() => setIsProductPickerOpen((prev) => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '10px',
                border: isProductPickerOpen ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: '#f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                <span
                  style={{
                    background: '#e0e7ff',
                    color: '#4338ca',
                    fontFamily: 'monospace',
                    fontWeight: '700',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    flexShrink: 0,
                  }}
                >
                  {selectedProductCode || 'Chưa chọn'}
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {selectedProduct?.name || 'Vui lòng chọn sản phẩm'}
                </span>
              </div>
              <span style={{ color: '#64748b', fontSize: '13px', marginLeft: '8px' }}>▼</span>
            </button>

            {/* Menu Dropdown danh sách sản phẩm */}
            {isProductPickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '12px',
                  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.15)',
                  zIndex: 101,
                  padding: '10px',
                  maxHeight: '380px',
                  display: 'flex',
                  flexDirection: 'column',
                  boxSizing: 'border-box',
                }}
              >
                <input
                  type="text"
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  placeholder="Tìm theo mã hoặc tên sản phẩm..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    marginBottom: '8px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    maxHeight: '280px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3px',
                    overscrollBehavior: 'contain',
                  }}
                >
                  {filteredProductOptions.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                      Không tìm thấy sản phẩm nào
                    </div>
                  ) : (
                    filteredProductOptions.map((p) => {
                      const isSelected = p.code === selectedProductCode;
                      return (
                        <div
                          key={p.code}
                          onClick={() => handleSelectProduct(p.code)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: isSelected ? '#eff6ff' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = '#f8fafc';
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <span
                              style={{
                                background: isSelected ? '#bfdbfe' : '#f1f5f9',
                                color: isSelected ? '#1e40af' : '#475569',
                                fontFamily: 'monospace',
                                fontWeight: '700',
                                padding: '2px 6px',
                                borderRadius: '5px',
                                fontSize: '12px',
                                flexShrink: 0,
                              }}
                            >
                              {p.code}
                            </span>
                            <span
                              style={{
                                fontSize: '13.5px',
                                fontWeight: isSelected ? '700' : '500',
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.name}
                            </span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#64748b', flexShrink: 0, marginLeft: '8px' }}>
                            Tồn: <strong>{p.stock}</strong>
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Các chỉ số tổng quan của sản phẩm */}
          {selectedProduct && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>TỒN KHO HIỆN TẠI</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
                  {selectedProduct.stock} {selectedProduct.base_unit || 'đơn vị'}
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '8px 14px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>GIÁ BÁN HIỆN TẠI</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: '#0284c7', marginTop: '2px' }}>
                  {selectedProduct.sell_price.toLocaleString('vi-VN')} đ
                </div>
              </div>

              {isCostVisible && selectedProduct.cost_price !== undefined && selectedProduct.cost_price !== null && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#92400e', fontWeight: '600' }}>GIÁ VỐN HIỆN TẠI</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#b45309', marginTop: '2px' }}>
                    {selectedProduct.cost_price.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              )}

              {selectedProduct.category && (
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '8px 14px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>DANH MỤC</div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#334155', marginTop: '2px' }}>
                    {selectedProduct.category}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. THANH CÔNG CỤ LỌC & TAB PHÂN LOẠI */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Tab Phân loại */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filterType === 'ALL' ? '1px solid #0fad89' : '1px solid #cbd5e1',
                background: filterType === 'ALL' ? '#ecfdf5' : '#ffffff',
                color: filterType === 'ALL' ? '#065f46' : '#475569',
                fontWeight: filterType === 'ALL' ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Tất cả ({logs.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterType('PRICE_CHANGE')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filterType === 'PRICE_CHANGE' ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                background: filterType === 'PRICE_CHANGE' ? '#fef3c7' : '#ffffff',
                color: filterType === 'PRICE_CHANGE' ? '#b45309' : '#475569',
                fontWeight: filterType === 'PRICE_CHANGE' ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Thay đổi giá</span>
              <span
                style={{
                  background: filterType === 'PRICE_CHANGE' ? '#fde68a' : '#f1f5f9',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                {priceLogsCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('INVENTORY_ADJUST')}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: filterType === 'INVENTORY_ADJUST' ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                background: filterType === 'INVENTORY_ADJUST' ? '#dbeafe' : '#ffffff',
                color: filterType === 'INVENTORY_ADJUST' ? '#1e40af' : '#475569',
                fontWeight: filterType === 'INVENTORY_ADJUST' ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Điều chỉnh kho</span>
              <span
                style={{
                  background: filterType === 'INVENTORY_ADJUST' ? '#bfdbfe' : '#f1f5f9',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: '700',
                }}
              >
                {inventoryLogsCount}
              </span>
            </button>
          </div>

          {/* Ô tìm kiếm người sửa / lý do & lọc ngày */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={textSearch}
              onChange={(e) => setTextSearch(e.target.value)}
              placeholder="Tìm theo người sửa, lý do..."
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                minWidth: '200px',
                outline: 'none',
              }}
            />

            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="Từ ngày"
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
              }}
            />

            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="Đến ngày"
              style={{
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
              }}
            />

            {(textSearch || fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setTextSearch('');
                  setFromDate('');
                  setToDate('');
                }}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '7px 10px',
                  fontSize: '12px',
                  color: '#475569',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                Xóa lọc
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. DANH SÁCH THẺ NHẬT KÝ LỊCH SỬ THAY ĐỔI */}
      <div style={{ width: '100%' }}>
        {loading ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '60px 20px',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
            <p style={{ margin: 0, fontSize: '14.5px', fontWeight: '600' }}>
              Đang tải nhật ký lịch sử thay đổi của sản phẩm...
            </p>
          </div>
        ) : error ? (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              borderRadius: '16px',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              padding: '60px 20px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📋</div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              Chưa có lịch sử thay đổi nào
            </h3>
            <p style={{ margin: 0, fontSize: '13.5px', color: '#64748b' }}>
              {filterType === 'PRICE_CHANGE'
                ? 'Sản phẩm này chưa ghi nhận lần thay đổi giá bán hoặc giá vốn nào.'
                : filterType === 'INVENTORY_ADJUST'
                ? 'Sản phẩm này chưa ghi nhận lần điều chỉnh kho hoặc nhập/xuất kho nào.'
                : 'Mọi thao tác thay đổi giá hoặc số lượng tồn kho của sản phẩm sẽ được tự động ghi lại tại đây.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {filteredLogs.map((log) => {
              const oldObj = parseJSON(log.old_values);
              const newObj = parseJSON(log.new_values);

              const isPriceChange = log.action_type === 'PRICE_CHANGE';
              const hasSellPrice =
                newObj?.sell_price !== undefined || oldObj?.sell_price !== undefined;
              const oldSellPrice = oldObj?.sell_price;
              const newSellPrice = newObj?.sell_price;
              const diffSellPrice =
                typeof newSellPrice === 'number' && typeof oldSellPrice === 'number'
                  ? newSellPrice - oldSellPrice
                  : null;
              const diffSellPercent =
                diffSellPrice !== null && oldSellPrice > 0
                  ? Math.round((diffSellPrice / oldSellPrice) * 1000) / 10
                  : null;

              const hasCostPrice =
                isCostVisible &&
                (newObj?.cost_price !== undefined || oldObj?.cost_price !== undefined);
              const oldCostPrice = oldObj?.cost_price;
              const newCostPrice = newObj?.cost_price;
              const diffCostPrice =
                typeof newCostPrice === 'number' && typeof oldCostPrice === 'number'
                  ? newCostPrice - oldCostPrice
                  : null;

              const isInventoryAdjust = log.action_type === 'INVENTORY_ADJUST';
              const oldStock = oldObj?.stock;
              const newStock = newObj?.stock;
              const diffStock =
                typeof newStock === 'number' && typeof oldStock === 'number'
                  ? newStock - oldStock
                  : null;

              return (
                <div
                  key={log.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '18px 22px',
                    background: '#ffffff',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Header thẻ: Loại thao tác & Thời điểm */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        background: isPriceChange
                          ? '#fef3c7'
                          : isInventoryAdjust
                          ? '#dbeafe'
                          : '#f1f5f9',
                        color: isPriceChange
                          ? '#b45309'
                          : isInventoryAdjust
                          ? '#1d4ed8'
                          : '#475569',
                      }}
                    >
                      {isPriceChange
                        ? 'Thay đổi giá'
                        : isInventoryAdjust
                        ? 'Điều chỉnh kho'
                        : log.action_type}
                    </span>

                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                      Thời điểm: <strong>{formatLocalDateTime(log.created_at)}</strong>
                    </span>
                  </div>

                  {/* Khối hiển thị chi tiết GIÁ CŨ & GIÁ MỚI */}
                  {isPriceChange && hasSellPrice && (
                    <div
                      style={{
                        background: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        marginBottom: '12px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#92400e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                          }}
                        >
                          Giá bán niêm yết
                        </span>
                        {diffSellPrice !== null && diffSellPrice !== 0 && (
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: '700',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: diffSellPrice > 0 ? '#dcfce7' : '#fee2e2',
                              color: diffSellPrice > 0 ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {diffSellPrice > 0
                              ? `+${diffSellPrice.toLocaleString('vi-VN')} đ`
                              : `${diffSellPrice.toLocaleString('vi-VN')} đ`}
                            {diffSellPercent !== null
                              ? ` (${diffSellPercent > 0 ? `+${diffSellPercent}%` : `${diffSellPercent}%`})`
                              : ''}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', color: '#78716c' }}>Giá cũ</span>
                          <span
                            style={{
                              color: '#78716c',
                              textDecoration: 'line-through',
                              fontWeight: '600',
                              fontSize: '14.5px',
                            }}
                          >
                            {oldSellPrice !== undefined
                              ? `${Number(oldSellPrice).toLocaleString('vi-VN')} đ`
                              : '—'}
                          </span>
                        </div>

                        <span style={{ color: '#b45309', fontWeight: '700', fontSize: '16px', margin: '8px 4px 0' }}>
                          ➔
                        </span>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', color: '#b45309', fontWeight: '600' }}>
                            Giá mới áp dụng
                          </span>
                          <span
                            style={{
                              color: '#0f172a',
                              fontWeight: '800',
                              fontSize: '16px',
                            }}
                          >
                            {newSellPrice !== undefined
                              ? `${Number(newSellPrice).toLocaleString('vi-VN')} đ`
                              : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Giá vốn (chỉ hiển thị nếu người dùng có quyền COST_READ) */}
                      {hasCostPrice && (
                        <div
                          style={{
                            marginTop: '10px',
                            paddingTop: '10px',
                            borderTop: '1px dashed #fde68a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '8px',
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                              Giá vốn:{' '}
                            </span>
                            <span
                              style={{
                                color: '#78716c',
                                textDecoration: 'line-through',
                                fontSize: '13px',
                              }}
                            >
                              {oldCostPrice !== undefined
                                ? `${Number(oldCostPrice).toLocaleString('vi-VN')} đ`
                                : '—'}
                            </span>
                            <span style={{ color: '#b45309', margin: '0 6px', fontSize: '13px' }}>
                              ➔
                            </span>
                            <span
                              style={{
                                color: '#0f172a',
                                fontWeight: '700',
                                fontSize: '13.5px',
                              }}
                            >
                              {newCostPrice !== undefined
                                ? `${Number(newCostPrice).toLocaleString('vi-VN')} đ`
                                : '—'}
                            </span>
                          </div>
                          {diffCostPrice !== null && diffCostPrice !== 0 && (
                            <span
                              style={{
                                fontSize: '11.5px',
                                color: diffCostPrice > 0 ? '#b45309' : '#15803d',
                                fontWeight: '700',
                              }}
                            >
                              {diffCostPrice > 0
                                ? `+${diffCostPrice.toLocaleString('vi-VN')} đ`
                                : `${diffCostPrice.toLocaleString('vi-VN')} đ`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Khối hiển thị chi tiết TỒN KHO CŨ & TỒN KHO MỚI */}
                  {isInventoryAdjust && (newStock !== undefined || oldStock !== undefined) && (
                    <div
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        marginBottom: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: '600' }}>
                          Số lượng tồn:
                        </span>
                        <span
                          style={{
                            color: '#64748b',
                            textDecoration: 'line-through',
                            fontSize: '14px',
                          }}
                        >
                          {oldStock ?? '—'}
                        </span>
                        <span style={{ color: '#2563eb', fontWeight: '700', fontSize: '15px' }}>
                          ➔
                        </span>
                        <span
                          style={{
                            color: '#0f172a',
                            fontWeight: '800',
                            fontSize: '15px',
                          }}
                        >
                          {newStock ?? '—'}
                        </span>
                      </div>
                      {diffStock !== null && diffStock !== 0 && (
                        <span
                          style={{
                            fontSize: '12.5px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: diffStock > 0 ? '#dcfce7' : '#fee2e2',
                            color: diffStock > 0 ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {diffStock > 0 ? `+${diffStock}` : `${diffStock}`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Người sửa có Avatar */}
                  <div
                    style={{
                      margin: '0 0 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#64748b' }}>Người sửa:</span>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: log.user_avatar
                            ? '#f1f5f9'
                            : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '12px',
                          overflow: 'hidden',
                          border: '1.5px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                          flexShrink: 0,
                        }}
                      >
                        {log.user_avatar ? (
                          <img
                            src={getAvatarUrl(log.user_avatar)}
                            alt={log.user_name || 'U'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          (log.user_name || 'H').charAt(0).toUpperCase()
                        )}
                      </div>
                      <strong style={{ color: '#0f172a', fontSize: '13.5px' }}>
                        {log.user_name || 'Hệ thống'}
                      </strong>
                    </div>
                  </div>

                  {/* Lý do điều chỉnh */}
                  {log.reason && (
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#334155',
                        background: '#f8fafc',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        marginBottom: '12px',
                        border: '1px dashed #cbd5e1',
                        lineHeight: '1.5',
                      }}
                    >
                      <strong style={{ color: '#0f172a' }}>Lý do:</strong> {log.reason}
                    </div>
                  )}

                  {/* Footer thẻ: Nút xem chi tiết */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedDetailLog(log)}
                      style={{
                        background: '#f1f5f9',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#2563eb',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. MODAL CHI TIẾT DIFF NGUYÊN BẢN */}
      <AuditDetailModal
        log={selectedDetailLog}
        onClose={() => setSelectedDetailLog(null)}
      />
    </div>
  );
};
