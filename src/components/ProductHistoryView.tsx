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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dStr;
  };

  const dateRangeLabel = useMemo(() => {
    if (fromDate && toDate) {
      const fromParts = fromDate.split('-');
      const toParts = toDate.split('-');
      if (fromParts.length === 3 && toParts.length === 3) {
        return `${fromParts[2]}/${fromParts[1]} – ${toParts[2]}/${toParts[1]}/${toParts[0]}`;
      }
      return `${fromDate} – ${toDate}`;
    }
    if (fromDate) return `Từ ${formatDisplayDate(fromDate)}`;
    if (toDate) return `Đến ${formatDisplayDate(toDate)}`;
    return '01/10 – 07/10/2026';
  }, [fromDate, toDate]);

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

  // 5. Phân trang danh sách lịch sử
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedProductCode, filterType, textSearch, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, safePage, pageSize]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1680px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* HEADER BAR CỦA TRANG */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '16px 20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          flexShrink: 0,
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
                margin: 0,
                fontSize: '20px',
                fontWeight: '800',
                color: '#0f172a',
                letterSpacing: '-0.02em',
              }}
            >
              Lịch Sử Thay Đổi Sản Phẩm
            </h1>
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
            <span>{loading ? 'Đang tải...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* 3. THẺ THÔNG TIN SẢN PHẨM & THANH CÔNG CỤ LỌC (LAYOUT THEO ẢNH 3) */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 18px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          marginBottom: '14px',
          flexShrink: 0,
        }}
      >
        {/* HÀNG 1: CHỌN SẢN PHẨM & 3 CHỈ SỐ (TỒN KHO, GIÁ BÁN, GIÁ VỐN) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {/* Chọn sản phẩm */}
          <div ref={productPickerRef} style={{ position: 'relative', flex: '1 1 340px', minWidth: '280px' }}>
            <button
              type="button"
              onClick={() => setIsProductPickerOpen((prev) => !prev)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '9px 14px',
                borderRadius: '8px',
                border: isProductPickerOpen ? '1px solid #2563eb' : '1px solid #cbd5e1',
                background: '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedProductCode
                  ? `${selectedProductCode} · ${selectedProduct?.name || 'Sản phẩm'}`
                  : 'Vui lòng chọn sản phẩm'}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginLeft: '8px' }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
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

          {/* 3 Thẻ chỉ số: Tồn kho, Giá bán, Giá vốn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Tồn kho */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 14px',
                textAlign: 'center',
                minWidth: '85px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Tồn kho</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', marginTop: '2px' }}>
                {selectedProduct ? `${selectedProduct.stock} ${selectedProduct.base_unit || 'Cái'}` : '0 Cái'}
              </div>
            </div>

            {/* Giá bán */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '6px 14px',
                textAlign: 'center',
                minWidth: '95px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Giá bán</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1d4ed8', marginTop: '2px' }}>
                {selectedProduct ? `${selectedProduct.sell_price.toLocaleString('vi-VN')} đ` : '0 đ'}
              </div>
            </div>

            {/* Giá vốn */}
            {isCostVisible && (
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '6px 14px',
                  textAlign: 'center',
                  minWidth: '95px',
                }}
              >
                <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Giá vốn</div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#b45309', marginTop: '2px' }}>
                  {selectedProduct && selectedProduct.cost_price !== undefined && selectedProduct.cost_price !== null
                    ? `${selectedProduct.cost_price.toLocaleString('vi-VN')} đ`
                    : '0 đ'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ĐƯỜNG PHÂN CÁCH NGANG */}
        <div style={{ height: '1px', background: '#e2e8f0', margin: '14px 0' }} />

        {/* HÀNG 2: TABS PHÂN LOẠI & TÌM KIẾM + LỌC NGÀY */}
        <style>{`
          .history-search-input,
          .history-search-input:hover,
          .history-search-input:focus {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            background: transparent !important;
            padding: 0 !important;
            border-radius: 0 !important;
          }
        `}</style>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Tabs phân loại */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Tab Tất cả */}
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              style={{
                height: '38px',
                boxSizing: 'border-box',
                padding: '0 12px',
                borderRadius: '8px',
                border: filterType === 'ALL' ? '1px solid #0fad89' : '1px solid #cbd5e1',
                background: filterType === 'ALL' ? '#ecfdf5' : '#ffffff',
                color: filterType === 'ALL' ? '#065f46' : '#475569',
                fontWeight: filterType === 'ALL' ? '700' : '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Tất cả</span>
              <span
                style={{
                  background: filterType === 'ALL' ? '#ffffff' : '#f1f5f9',
                  color: filterType === 'ALL' ? '#1d4ed8' : '#64748b',
                  padding: '1px 7px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '700',
                }}
              >
                {logs.length}
              </span>
            </button>

            {/* Tab Thay đổi giá */}
            <button
              type="button"
              onClick={() => setFilterType('PRICE_CHANGE')}
              style={{
                height: '38px',
                boxSizing: 'border-box',
                padding: '0 12px',
                borderRadius: '8px',
                border: filterType === 'PRICE_CHANGE' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                background: filterType === 'PRICE_CHANGE' ? '#dbeafe' : '#ffffff',
                color: filterType === 'PRICE_CHANGE' ? '#1d4ed8' : '#475569',
                fontWeight: filterType === 'PRICE_CHANGE' ? '700' : '500',
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Thay đổi giá</span>
              <span
                style={{
                  background: filterType === 'PRICE_CHANGE' ? '#ffffff' : '#f1f5f9',
                  color: filterType === 'PRICE_CHANGE' ? '#1d4ed8' : '#64748b',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {priceLogsCount}
              </span>
            </button>

            {/* Tab Điều chỉnh kho */}
            <button
              type="button"
              onClick={() => setFilterType('INVENTORY_ADJUST')}
              style={{
                height: '38px',
                boxSizing: 'border-box',
                padding: '0 12px',
                borderRadius: '8px',
                border: filterType === 'INVENTORY_ADJUST' ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                background: filterType === 'INVENTORY_ADJUST' ? '#dbeafe' : '#ffffff',
                color: filterType === 'INVENTORY_ADJUST' ? '#1d4ed8' : '#475569',
                fontWeight: filterType === 'INVENTORY_ADJUST' ? '700' : '500',
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>Điều chỉnh kho</span>
              <span
                style={{
                  background: filterType === 'INVENTORY_ADJUST' ? '#ffffff' : '#f1f5f9',
                  color: filterType === 'INVENTORY_ADJUST' ? '#1d4ed8' : '#64748b',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  fontSize: '12px',
                  fontWeight: '600',
                }}
              >
                {inventoryLogsCount}
              </span>
            </button>
          </div>

          {/* Tìm kiếm & Khoảng ngày */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Tìm kiếm người sửa, lý do */}
            <div
              style={{
                height: '38px',
                boxSizing: 'border-box',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0 12px',
                background: '#ffffff',
                minWidth: '220px',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#64748b"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                type="text"
                className="history-search-input"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                placeholder="Tìm người sửa, lý do"
                style={{
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  borderRadius: 0,
                  padding: 0,
                  height: '100%',
                  fontSize: '13.5px',
                  color: '#1e293b',
                  width: '100%',
                  background: 'transparent',
                }}
              />
              {textSearch && (
                <button
                  type="button"
                  onClick={() => setTextSearch('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    fontSize: '13px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Nút lọc ngày (mở popover) */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsDatePickerOpen((prev) => !prev)}
                style={{
                  height: '38px',
                  boxSizing: 'border-box',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  border: isDatePickerOpen ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '0 12px',
                  background: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  color: '#334155',
                  fontWeight: '500',
                  lineHeight: '1',
                }}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0 }}
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>{dateRangeLabel}</span>
              </button>

              {/* Popover chọn ngày */}
              {isDatePickerOpen && (
                <>
                  <div
                    onClick={() => setIsDatePickerOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      right: 0,
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '10px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                      zIndex: 101,
                      padding: '14px',
                      minWidth: '260px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>
                        Từ ngày:
                      </label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: '600' }}>
                        Đến ngày:
                      </label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      {(fromDate || toDate) && (
                        <button
                          type="button"
                          onClick={() => {
                            setFromDate('');
                            setToDate('');
                          }}
                          style={{
                            background: '#f1f5f9',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            color: '#475569',
                          }}
                        >
                          Xóa ngày
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        style={{
                          background: '#2563eb',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '5px 12px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          color: '#ffffff',
                          fontWeight: '600',
                        }}
                      >
                        Áp dụng
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. DANH SÁCH THẺ NHẬT KÝ LỊCH SỬ THAY ĐỔI (TRONG 1 Ô VUÔNG DUY NHẤT & PHÂN TRANG NHƯ ẢNH 2) */}
      <div
        style={{
          width: '100%',
          flex: 1,
          minHeight: 0,
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
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
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: '#fef2f2',
              color: '#dc2626',
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
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
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
              }}
            >
              {paginatedLogs.map((log, index) => {
              const isLast = index === paginatedLogs.length - 1;
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
                    padding: '18px 22px',
                    borderBottom: isLast ? 'none' : '1px solid #e2e8f0',
                    background: '#ffffff',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fcfdfe')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
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

                  {/* Hàng chứa Lý do và Nút Xem chi tiết */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: log.reason ? 'space-between' : 'flex-end', gap: '12px', marginTop: '6px' }}>
                    {log.reason ? (
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                          fontSize: '13px',
                          color: '#334155',
                          background: '#f8fafc',
                          padding: '8px 14px',
                          borderRadius: '10px',
                          border: '1px dashed #cbd5e1',
                          lineHeight: '1.5',
                        }}
                      >
                        <strong style={{ color: '#0f172a' }}>Lý do:</strong> {log.reason}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setSelectedDetailLog(log)}
                      style={{
                        flexShrink: 0,
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        color: '#2563eb',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#eff6ff';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f1f5f9';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* KHỐI PHÂN TRANG NHƯ ẢNH 2 */}
          {filteredLogs.length > 0 && (
            <div
              style={{
                padding: '8px 18px',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                fontSize: '12px',
                color: '#64748b',
                flexShrink: 0,
                marginTop: 'auto',
              }}
            >
              {/* Khối phân trang liền thanh */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'stretch',
                  border: '1px solid #d1d5db',
                  borderRadius: '5px',
                  overflow: 'hidden',
                  background: '#ffffff',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  height: '24px',
                }}
              >
                {/* Nút trang trước (<) */}
                {safePage > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      minWidth: '24px',
                      height: '100%',
                      padding: '0 6px',
                      border: 'none',
                      borderRight: '1px solid #e5e7eb',
                      background: '#ffffff',
                      color: '#4b5563',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    title="Trang trước"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                )}

                {/* Danh sách các số trang */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx, arr) => {
                    const hasNext = safePage < totalPages;
                    const isLastItem = idx === arr.length - 1 && !hasNext;
                    if (typeof p === 'string') {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          style={{
                            minWidth: '22px',
                            height: '100%',
                            padding: '0 4px',
                            borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                            background: '#ffffff',
                            color: '#6b7280',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            userSelect: 'none',
                          }}
                        >
                          ...
                        </span>
                      );
                    }

                    const isActive = p === safePage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        style={{
                          minWidth: '24px',
                          height: '100%',
                          padding: '0 7px',
                          border: 'none',
                          borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                          background: isActive ? '#2ba1f4' : '#ffffff',
                          color: isActive ? '#ffffff' : '#374151',
                          cursor: isActive ? 'default' : 'pointer',
                          fontSize: '11.5px',
                          fontWeight: isActive ? '700' : '500',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                        }}
                      >
                        {p}
                      </button>
                    );
                  })}

                {/* Nút trang sau (>) */}
                {safePage < totalPages && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      minWidth: '24px',
                      height: '100%',
                      padding: '0 6px',
                      border: 'none',
                      background: '#ffffff',
                      color: '#4b5563',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                    title="Trang sau"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
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
