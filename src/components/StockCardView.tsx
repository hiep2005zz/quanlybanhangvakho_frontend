import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getStockCardApi,
  getProductsApi,
  StockCardResponse,
  StockCardFilterParams,
  StockCardVoucherInfo,
  ProductItem,
} from '../services/api';

interface StockCardViewProps {
  productId: number;
  productName?: string;
  productCode?: string;
  token: string;
  onBack: () => void;
  onNavigateToTab?: (tab: string, queryParam?: string) => void;
}

export const StockCardView: React.FC<StockCardViewProps> = ({
  productId: initialProductId,
  productName: initialProductName,
  productCode: initialProductCode,
  token,
  onBack,
  onNavigateToTab,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<number>(initialProductId);
  const [productsList, setProductsList] = useState<ProductItem[]>([]);
  const [data, setData] = useState<StockCardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc theo kho và khoảng thời gian (Tiêu chí 3)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [activeVoucher, setActiveVoucher] = useState<{ code: string; type: string; url?: string | null } | null>(null);

  // Phân trang 20 dòng / sản phẩm mỗi trang theo đúng yêu cầu
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Tải danh sách sản phẩm để cho phép chọn nhanh sản phẩm khác ngay trên trang này
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      try {
        const res = await getProductsApi(token);
        if (isMounted && res?.items) {
          setProductsList(res.items);
        }
      } catch (e) {
        console.warn('Không thể tải danh sách sản phẩm cho bộ chọn thẻ kho:', e);
      }
    };
    fetchProducts();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Cập nhật selectedProductId khi initialProductId thay đổi
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    }
  }, [initialProductId]);

  const fetchStockCard = useCallback(async () => {
    if (!selectedProductId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params: StockCardFilterParams = {
        product_id: selectedProductId,
        warehouse_id: selectedWarehouse !== 'all' ? selectedWarehouse : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };
      const res = await getStockCardApi(token, params);
      setData(res);
      setCurrentPage(1); // Reset về trang 1 khi đổi bộ lọc
    } catch (err: any) {
      console.error('Lỗi khi tải thẻ kho:', err);
      setError(err?.message || 'Không thể tải dữ liệu thẻ kho sản phẩm.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProductId, selectedWarehouse, fromDate, toDate, token]);

  useEffect(() => {
    if (selectedProductId) {
      fetchStockCard();
    }
  }, [selectedProductId, fetchStockCard]);

  const summary = data?.summary;
  const entries = useMemo(() => data?.entries || [], [data?.entries]);
  const warehouses = data?.warehouses || [];

  // Tính toán phân trang 20 dòng / trang
  const totalEntries = entries.length;
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalEntries);
  const paginatedEntries = entries.slice(startIndex, endIndex);

  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0';
    return Number(val).toLocaleString('vi-VN');
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month}/${year} ${hours}:${mins}`;
    } catch {
      return dateStr;
    }
  };

  // Huy hiệu loại phát sinh (Dạng chữ phẳng, không chứa icon)
  const renderTransactionTypeBadge = (type: string, label: string) => {
    switch (type) {
      case 'RECEIPT':
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: '600',
              backgroundColor: '#dcfce7',
              color: '#15803d',
              border: '1px solid #bbf7d0',
              whiteSpace: 'nowrap',
            }}
          >
            {label || 'Nhập kho'}
          </span>
        );
      case 'ISSUE':
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: '600',
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              border: '1px solid #fecaca',
              whiteSpace: 'nowrap',
            }}
          >
            {label || 'Xuất kho'}
          </span>
        );
      case 'TRANSFER':
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: '600',
              backgroundColor: '#e0f2fe',
              color: '#0369a1',
              border: '1px solid #bae6fd',
              whiteSpace: 'nowrap',
            }}
          >
            {label || 'Chuyển kho'}
          </span>
        );
      case 'ADJUST':
      default:
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '11.5px',
              fontWeight: '600',
              backgroundColor: '#f3e8ff',
              color: '#7e22ce',
              border: '1px solid #e9d5ff',
              whiteSpace: 'nowrap',
            }}
          >
            {label || 'Điều chỉnh'}
          </span>
        );
    }
  };

  // Xử lý mở thông tin chứng từ gốc (Tiêu chí 2)
  const handleVoucherClick = (voucherInfo?: StockCardVoucherInfo | null, refCode?: string) => {
    const code = voucherInfo?.voucher_code || refCode || '';
    const vType = voucherInfo?.voucher_type || 'other';

    setActiveVoucher({
      code,
      type: vType,
      url: voucherInfo?.url,
    });
  };

  const handleNavigateVoucher = () => {
    if (!activeVoucher) return;
    const { code, type } = activeVoucher;
    if (onNavigateToTab) {
      if (type === 'grn' || code.startsWith('GRN-') || code.startsWith('PNK-')) {
        onNavigateToTab('goods-receipt', code);
      } else if (type === 'order' || code.startsWith('ORD') || code.startsWith('DH')) {
        onNavigateToTab('orders', code);
      } else if (type === 'transfer' || code.startsWith('CK-')) {
        onNavigateToTab('stock-transfers', code);
      } else if (type === 'audit' || code.startsWith('PKK-')) {
        onNavigateToTab('stock-audits', code);
      }
    }
  };

  const handleResetFilters = () => {
    setSelectedWarehouse('all');
    setFromDate('');
    setToDate('');
  };

  const currentProductFromList = productsList.find((p) => p.id === selectedProductId);
  const displayProductName = summary?.product_name || currentProductFromList?.name || initialProductName || `Sản phẩm #${selectedProductId}`;
  const displayProductCode = summary?.product_code || currentProductFromList?.code || initialProductCode || '';
  const displayCategory = summary?.category || currentProductFromList?.category || '';
  const displayUnit = summary?.base_unit || currentProductFromList?.base_unit || 'Cái';

  return (
    <div
      style={{
        padding: '8px 12px',
        backgroundColor: '#f1f5f9',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* THẺ CONTAINER CHÍNH CHUẨN THIẾT KẾ CARD TRANG NHÃ */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          height: '100%',
          maxHeight: '100%',
        }}
      >
        {/* HEADER TRANG (THU GỌN VỪA VẶN MÀN HÌNH 100%) */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  color: '#0f172a',
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                Thẻ kho: {displayProductName}
              </h1>

              {displayProductCode && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '5px',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: '1px solid #bfdbfe',
                    whiteSpace: 'nowrap',
                  }}
                >
                  SKU: {displayProductCode}
                </span>
              )}

              {displayUnit && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '5px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '11px',
                    fontWeight: '600',
                    border: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ĐVT: {displayUnit}
                </span>
              )}

              {displayCategory && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '5px',
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    fontSize: '11px',
                    border: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayCategory}
                </span>
              )}
            </div>

            <p
              style={{
                fontSize: '11.5px',
                color: '#64748b',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              Nhật ký truy nguyên toàn bộ biến động nhập, xuất, chuyển kho và điều chỉnh để xác định nguyên nhân lệch tồn.
            </p>
          </div>

          {/* NÚT QUAY LẠI TRANG CHỦ / HÀNG TỒN KHO */}
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '6px 14px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            ← Quay lại
          </button>
        </div>

        {/* NỘI DUNG CHÍNH (CỐ ĐỊNH PHẦN TRÊN, CHỈ CUỘN TRONG BẢNG DỮ LIỆU) */}
        <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* 5 THẺ THỐNG KÊ (CỐ ĐỊNH, THU GỌN VỪA VẶN MÀN HÌNH 100%) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {/* 1. TỒN ĐẦU KỲ */}
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tồn đầu kỳ</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(summary?.opening_stock)}
              </div>
            </div>

            {/* 2. TỔNG NHẬP TRONG KỲ */}
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tổng nhập trong kỳ</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(summary?.total_receipt)}
              </div>
            </div>

            {/* 3. TỔNG XUẤT TRONG KỲ */}
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tổng xuất trong kỳ</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(summary?.total_issue)}
              </div>
            </div>

            {/* 4. TỒN CUỐI KỲ */}
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tồn cuối kỳ</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(summary?.closing_stock)}
              </div>
            </div>

            {/* 5. TỒN THỰC TẾ HIỆN TẠI TRÊN HỆ THỐNG */}
            <div
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '2px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Tồn thực tế hiện tại</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(summary?.current_actual_stock)}
              </div>
            </div>
          </div>

          {/* BỘ LỌC THEO KHO, THỜI GIAN VÀ CHỌN SẢN PHẨM (THU GỌN 1 DÒNG VỪA MÀN HÌNH 100%) */}
          <div
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Chọn sản phẩm trực tiếp (Nếu muốn chuyển sang xem sản phẩm khác) */}
              {productsList.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                    Sản phẩm:
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(Number(e.target.value))}
                    style={{
                      height: '30px',
                      padding: '0 8px',
                      fontSize: '11.5px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#1e293b',
                      fontWeight: '500',
                      outline: 'none',
                      cursor: 'pointer',
                      maxWidth: '190px',
                    }}
                  >
                    {productsList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code ? `[${p.code}] ` : ''}{p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lọc theo kho */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                  Kho hàng:
                </label>
                <select
                  value={selectedWarehouse}
                  onChange={(e) => setSelectedWarehouse(e.target.value)}
                  style={{
                    height: '30px',
                    padding: '0 8px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    fontWeight: '500',
                    outline: 'none',
                    cursor: 'pointer',
                    maxWidth: '135px',
                  }}
                >
                  <option value="all">Tất cả kho</option>
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>
                      {w.warehouse_name} ({w.warehouse_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Lọc khoảng thời gian: Từ ngày */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                  Từ ngày:
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  style={{
                    height: '30px',
                    padding: '0 6px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    width: '120px',
                  }}
                />
              </div>

              {/* Lọc khoảng thời gian: Đến ngày */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
                  Đến ngày:
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    height: '30px',
                    padding: '0 6px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none',
                    width: '120px',
                  }}
                />
              </div>

              {/* Nút Xóa lọc */}
              {(selectedWarehouse !== 'all' || fromDate || toDate) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  style={{
                    height: '30px',
                    padding: '0 10px',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                  Xóa lọc
                </button>
              )}
            </div>

            {/* Thông tin số lượng dòng phát sinh */}
            <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '500', whiteSpace: 'nowrap' }}>
              Tìm thấy <strong style={{ color: '#0f172a' }}>{entries.length}</strong> phát sinh trong kỳ
            </div>
          </div>

          {/* THÔNG BÁO LỖI NẾU CÓ */}
          {error && (
            <div
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '13px',
                flexShrink: 0,
              }}
            >
              {error}
            </div>
          )}

          {/* BẢNG DỮ LIỆU THẺ KHO CHI TIẾT (VÙNG DUY NHẤT CUỘN NỘI DUNG) */}
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead
                  style={{
                    backgroundColor: '#f8fafc',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    borderBottom: '2px solid #e2e8f0',
                  }}
                >
                  <tr>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '45px', textAlign: 'center', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      #
                    </th>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '135px', whiteSpace: 'nowrap', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Thời gian
                    </th>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '130px', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Loại nghiệp vụ
                    </th>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '150px', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Chứng từ gốc
                    </th>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '140px', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Kho hàng
                    </th>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', textAlign: 'right', width: '90px', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Nhập (+)
                    </th>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', textAlign: 'right', width: '90px', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Xuất (-)
                    </th>
                    <th
                      style={{
                        padding: '8px 12px',
                        fontWeight: '700',
                        color: '#475569',
                        textAlign: 'right',
                        width: '120px',
                        backgroundColor: '#f8fafc',
                        fontSize: '12px',
                      }}
                    >
                      Tồn sau phát sinh
                    </th>
                    <th style={{ padding: '8px 10px', fontWeight: '700', color: '#475569', width: '120px', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Người thực hiện
                    </th>
                    <th style={{ padding: '8px 12px', fontWeight: '700', color: '#475569', minWidth: '180px', backgroundColor: '#f8fafc', fontSize: '12px' }}>
                      Diễn giải / Ghi chú
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && !data ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>
                        Đang tải dữ liệu thẻ kho...
                      </td>
                    </tr>
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '56px 24px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                          Không có phát sinh kho nào trong điều kiện lọc này
                        </div>
                        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                          Thử chọn khoảng thời gian rộng hơn hoặc chọn "Tất cả kho" để xem toàn bộ lịch sử.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedEntries.map((entry, idx) => {
                      const isReceipt = entry.quantity > 0;
                      const isIssue = entry.quantity < 0;
                      const itemIndex = startIndex + idx + 1;

                      return (
                        <tr
                          key={entry.id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                            transition: 'background-color 0.1s ease',
                          }}
                        >
                          {/* STT */}
                          <td style={{ padding: '7px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '11.5px' }}>
                            {itemIndex}
                          </td>

                          {/* Thời gian */}
                          <td style={{ padding: '7px 10px', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}>
                            {formatDateTime(entry.created_at)}
                          </td>

                          {/* Loại nghiệp vụ (Không có icon) */}
                          <td style={{ padding: '7px 10px' }}>
                            {renderTransactionTypeBadge(entry.transaction_type, entry.transaction_label)}
                          </td>

                          {/* Liên kết chứng từ gốc */}
                          <td style={{ padding: '7px 10px' }}>
                            <button
                              type="button"
                              onClick={() => handleVoucherClick(entry.voucher_info, entry.reference_code)}
                              title={`Bấm để truy nguyên chứng từ gốc ${entry.reference_code}`}
                              style={{
                                padding: '2px 8px',
                                borderRadius: '5px',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#0284c7',
                                fontWeight: '700',
                                fontSize: '11.5px',
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#e0f2fe';
                                e.currentTarget.style.borderColor = '#7dd3fc';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '#f8fafc';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                              }}
                            >
                              {entry.reference_code}
                            </button>
                          </td>

                          {/* Kho hàng */}
                          <td style={{ padding: '7px 10px', color: '#475569', fontSize: '12px' }}>
                            <div style={{ fontWeight: '600' }}>{entry.warehouse_name}</div>
                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{entry.warehouse_id}</div>
                          </td>

                          {/* Số lượng nhập (+) */}
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontWeight: '700',
                              color: isReceipt ? '#15803d' : '#94a3b8',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: '12px',
                            }}
                          >
                            {isReceipt ? `+${formatNumber(entry.receipt_quantity || entry.quantity)}` : '—'}
                          </td>

                          {/* Số lượng xuất (-) */}
                          <td
                            style={{
                              padding: '7px 10px',
                              textAlign: 'right',
                              fontWeight: '700',
                              color: isIssue ? '#b91c1c' : '#94a3b8',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: '12px',
                            }}
                          >
                            {isIssue ? `-${formatNumber(entry.issue_quantity || Math.abs(entry.quantity))}` : '—'}
                          </td>

                          {/* TỒN SAU PHÁT SINH */}
                          <td
                            style={{
                              padding: '7px 12px',
                              textAlign: 'right',
                              fontWeight: '800',
                              fontSize: '12.5px',
                              color: '#1e293b',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatNumber(entry.balance_stock)}
                          </td>

                          {/* Người thực hiện */}
                          <td style={{ padding: '7px 10px', color: '#475569', fontSize: '12px' }}>
                            {entry.performed_by || '—'}
                          </td>

                          {/* Diễn giải / Ghi chú */}
                          <td style={{ padding: '7px 12px', color: '#64748b', fontSize: '12px', lineHeight: 1.3 }}>
                            {entry.note || '—'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* THANH PHÂN TRANG: 20 DÒNG / TRANG CHUẨN THEO YÊU CẦU */}
            {totalEntries > 0 && (
              <div
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#ffffff',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '11.5px',
                  color: '#64748b',
                  flexWrap: 'wrap',
                  gap: '8px',
                  flexShrink: 0,
                }}
              >
                <div>
                  Hiển thị <strong>{startIndex + 1}</strong> - <strong>{endIndex}</strong> trên tổng số{' '}
                  <strong style={{ color: '#0f172a' }}>{totalEntries}</strong> phát sinh
                  {totalPages > 1 && ` (Trang ${safeCurrentPage} / ${totalPages})`}
                </div>

                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'stretch',
                      border: '1px solid #d1d5db',
                      borderRadius: '5px',
                      overflow: 'hidden',
                    }}
                  >
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        borderRight: '1px solid #d1d5db',
                        backgroundColor: safeCurrentPage <= 1 ? '#f3f4f6' : '#ffffff',
                        color: safeCurrentPage <= 1 ? '#9ca3af' : '#374151',
                        cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '11.5px',
                        fontWeight: '600',
                      }}
                    >
                      ‹ Trước
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                      .reduce<(number | string)[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                          acc.push('...');
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) => {
                        if (typeof p === 'string') {
                          return (
                            <span
                              key={`ellipsis-${idx}`}
                              style={{
                                padding: '4px 8px',
                                borderRight: '1px solid #d1d5db',
                                backgroundColor: '#f9fafb',
                                color: '#9ca3af',
                                fontSize: '11.5px',
                              }}
                            >
                              {p}
                            </span>
                          );
                        }
                        const isActive = p === safeCurrentPage;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setCurrentPage(p)}
                            style={{
                              padding: '4px 10px',
                              border: 'none',
                              borderRight: '1px solid #d1d5db',
                              backgroundColor: isActive ? '#2563eb' : '#ffffff',
                              color: isActive ? '#ffffff' : '#374151',
                              cursor: isActive ? 'default' : 'pointer',
                              fontSize: '11.5px',
                              fontWeight: isActive ? '700' : '500',
                              minWidth: '28px',
                            }}
                          >
                            {p}
                          </button>
                        );
                      })}

                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '4px 10px',
                        border: 'none',
                        backgroundColor: safeCurrentPage >= totalPages ? '#f3f4f6' : '#ffffff',
                        color: safeCurrentPage >= totalPages ? '#9ca3af' : '#374151',
                        cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '11.5px',
                        fontWeight: '600',
                      }}
                    >
                      Sau ›
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CHÂN TRANG FOOTER */}
        <div
          style={{
            padding: '6px 16px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#64748b' }}>
            <span>Đơn vị tính: <strong>{displayUnit}</strong></span>
            <span style={{ margin: '0 8px' }}>•</span>
            <span>Trạng thái: <strong>Đồng bộ thẻ kho trực tiếp từ CSDL</strong></span>
          </div>

          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '4px 14px',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
          >
            Đóng
          </button>
        </div>
      </div>

      {/* DIALOG CHI TIẾT CHỨNG TỪ GỐC */}
      {activeVoucher && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveVoucher(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Chi tiết chứng từ gốc
              </h3>
              <button
                type="button"
                onClick={() => setActiveVoucher(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '14px 16px', borderRadius: '8px', marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Số hiệu chứng từ</div>
              <div style={{ fontSize: '17px', fontWeight: '800', color: '#0284c7' }}>
                {activeVoucher.code}
              </div>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px' }}>
                Loại chứng từ:{' '}
                <strong>
                  {activeVoucher.code.startsWith('GRN-') || activeVoucher.code.startsWith('PNK-')
                    ? 'Phiếu nhập kho nhà cung cấp'
                    : activeVoucher.code.startsWith('ORD') || activeVoucher.code.startsWith('DH')
                    ? 'Đơn hàng bán xuất kho'
                    : activeVoucher.code.startsWith('CK-')
                    ? 'Phiếu xuất / nhập chuyển kho nội bộ'
                    : activeVoucher.code.startsWith('PKK-')
                    ? 'Phiếu kiểm kê điều chỉnh cân đối tồn'
                    : activeVoucher.code.startsWith('DK-')
                    ? 'Số dư ban đầu khi thiết lập kho'
                    : 'Phiếu điều chỉnh kho'}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveVoucher(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: '#475569',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
              {onNavigateToTab && !activeVoucher.code.startsWith('DK-') && !activeVoucher.code.startsWith('TX-') && (
                <button
                  type="button"
                  onClick={handleNavigateVoucher}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Mở phiếu chứng từ
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
