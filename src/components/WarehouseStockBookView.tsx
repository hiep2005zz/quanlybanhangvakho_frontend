import React, { useState, useEffect, useCallback } from 'react';
import {
  getStockBookApi,
  StockBookResponse,
  StockBookFilterParams,
} from '../services/api';
import { StockCardView } from './StockCardView';

interface WarehouseStockBookViewProps {
  token: string;
  onBackToHome?: () => void;
  onNavigateToTab?: (tab: string, queryParam?: string) => void;
  onOpenStockCard?: (productId: number, productName: string, productCode: string) => void;
  canAccessStockCard?: boolean;
}

export const WarehouseStockBookView: React.FC<WarehouseStockBookViewProps> = ({
  token,
  onBackToHome: _onBackToHome,
  onNavigateToTab,
  onOpenStockCard,
  canAccessStockCard = true,
}) => {
  const [data, setData] = useState<StockBookResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProductForStockCard, setSelectedProductForStockCard] = useState<{ id: number; name: string; code: string } | null>(null);

  // Bộ lọc
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Debounce tìm kiếm 300ms để không gọi API và render liên tục theo từng phím gõ
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const loadStockBook = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    setError(null);
    try {
      const params: StockBookFilterParams = {
        warehouse_id: selectedWarehouse,
        category: selectedCategory,
        stock_status: selectedStatus,
        search: debouncedSearch,
        page: currentPage,
        page_size: pageSize,
      };
      const res = await getStockBookApi(token, params);
      setData(res);
    } catch (err: any) {
      console.error('Error fetching stock book:', err);
      setError(err?.message || 'Không thể tải dữ liệu sổ tồn kho.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [token, selectedWarehouse, selectedCategory, selectedStatus, debouncedSearch, currentPage, pageSize]);

  useEffect(() => {
    loadStockBook();
  }, [loadStockBook]);

  // Format số nguyên có phân cách hàng nghìn
  const formatNumber = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0';
    return Number(val).toLocaleString('vi-VN');
  };

  const summary = data?.summary || {
    total_actual_stock: 0,
    total_reserved_stock: 0,
    total_available_stock: 0,
    total_skus: 0,
  };

  const items = data?.items || [];
  const warehouses = data?.warehouses || [];
  const categories = data?.categories || [];

  // Tính toán dữ liệu phân trang (Hỗ trợ cả phân trang server-side 4KB lẫn client-side fallback)
  const totalItems = data?.total !== undefined && data?.total !== null ? data.total : (summary.total_skus || items.length);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pageItems = items.length > pageSize ? items.slice(startIndex, endIndex) : items;

  if (selectedProductForStockCard && canAccessStockCard) {
    return (
      <StockCardView
        productId={selectedProductForStockCard.id}
        productName={selectedProductForStockCard.name}
        productCode={selectedProductForStockCard.code}
        token={token}
        onBack={() => setSelectedProductForStockCard(null)}
        onNavigateToTab={onNavigateToTab}
      />
    );
  }

  return (
    <div
      style={{
        padding: '16px 24px',
        backgroundColor: '#f8fafc',
        height: '100%',
        maxHeight: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {/* Tiêu đề & Điều hướng */}
      <div style={{ marginBottom: '14px', flexShrink: 0 }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
          Hàng Tồn Kho Theo Kho & SKU
        </h1>
      </div>

      {/* 4 Thẻ KPI Tóm tắt nhanh */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '12px',
          flexShrink: 0,
        }}
      >
        {/* KPI 1: Tổng số mặt hàng SKU */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            padding: '12px 16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
            Tổng số bản ghi SKU
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b' }}>
            {formatNumber(summary.total_skus)} <span style={{ fontSize: '12px', fontWeight: '500', color: '#94a3b8' }}>mặt hàng</span>
          </div>
        </div>

        {/* KPI 2: Tồn thực tế */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            padding: '12px 16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#0369a1', marginBottom: '4px' }}>
            Tổng tồn thực tế trong kho
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0284c7' }}>
            {formatNumber(summary.total_actual_stock)}
          </div>
        </div>

        {/* KPI 3: Tồn đang giữ chỗ */}
        <div
          style={{
            borderRadius: '10px',
            padding: '12px 16px',
            border: '1px solid #fed7aa',
            backgroundColor: '#fffbeb',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#b45309', marginBottom: '4px' }}>
            Đang giữ chỗ cho đơn hàng
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#d97706' }}>
            {formatNumber(summary.total_reserved_stock)}
          </div>
        </div>

        {/* KPI 4: Tồn khả dụng (Bán được) - Điểm nhấn chính */}
        <div
          style={{
            borderRadius: '10px',
            padding: '12px 16px',
            border: '1px solid #86efac',
            backgroundColor: '#f0fdf4',
            boxShadow: '0 2px 4px rgba(22,163,74,0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#15803d' }}>
              Khả dụng có thể bán ngay
            </span>
            <span style={{ fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#166534' }}>
              Sẵn sàng bán
            </span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#16a34a' }}>
            {formatNumber(summary.total_available_stock)}
          </div>
        </div>
      </div>

      {/* Thanh bộ lọc dữ liệu */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          padding: '10px 16px',
          border: '1px solid #e2e8f0',
          marginBottom: '12px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          flexShrink: 0,
        }}
      >
        {/* 1. Lọc theo Kho */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '180px', flex: '1 1 180px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Kho lưu trữ
          </label>
          <select
            value={selectedWarehouse}
            onChange={(e) => {
              setSelectedWarehouse(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#1e293b',
              backgroundColor: '#f8fafc',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả các kho</option>
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.warehouse_name} ({w.warehouse_id})
              </option>
            ))}
          </select>
        </div>

        {/* 2. Lọc theo Nhóm ngành hàng */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '160px', flex: '1 1 160px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Nhóm hàng / Ngành hàng
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#1e293b',
              backgroundColor: '#f8fafc',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả ngành hàng</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Lọc theo Trạng thái tồn */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '180px', flex: '1 1 180px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Trạng thái tồn kho
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              color: '#1e293b',
              backgroundColor: '#f8fafc',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="available">Còn hàng (Khả dụng &gt; 0)</option>
            <option value="low_stock">Thiếu hàng (Dưới định mức)</option>
            <option value="out_of_stock">Hết hàng bán (Khả dụng = 0)</option>
          </select>
        </div>

        {/* 4. Tìm kiếm SKU hoặc Tên sản phẩm */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '220px', flex: '2 1 220px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569' }}>
            Tìm kiếm mã SKU / Tên sản phẩm
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Nhập mã SP (SP001, ...) hoặc tên..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#1e293b',
                backgroundColor: '#f8fafc',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#94a3b8"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: 'absolute', left: '9px', top: '9px' }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '7px',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Nút Làm mới */}
        <div style={{ alignSelf: 'flex-end' }}>
          <button
            type="button"
            onClick={() => loadStockBook(true)}
            disabled={isRefreshing}
            style={{
              padding: '0 16px',
              height: '35px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.7 : 1,
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              transition: 'background-color 0.15s ease',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isRefreshing ? 'Đang cập nhật...' : 'Làm mới'}
          </button>
        </div>

        {/* Nút đặt lại bộ lọc */}
        {(selectedWarehouse !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all' || searchTerm !== '') && (
          <div style={{ alignSelf: 'flex-end', paddingBottom: '2px' }}>
            <button
              type="button"
              onClick={() => {
                setSelectedWarehouse('all');
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSearchTerm('');
                setDebouncedSearch('');
                setCurrentPage(1);
              }}
              style={{
                padding: '7px 12px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#64748b',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Xóa lọc
            </button>
          </div>
        )}
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#b91c1c',
            fontSize: '13px',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Bảng Sổ tồn kho chi tiết */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '1060px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13.5px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155' }}>
                <th style={{ padding: '10px 14px', fontWeight: '700', width: '80px', minWidth: '75px', backgroundColor: '#f1f5f9' }}>Mã SKU</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', minWidth: '250px', backgroundColor: '#f1f5f9' }}>Tên sản phẩm</th>
                <th style={{ padding: '10px 14px', fontWeight: '700', width: '160px', minWidth: '150px', backgroundColor: '#f1f5f9' }}>Kho lưu trữ</th>
                <th style={{ padding: '10px 12px', fontWeight: '700', width: '105px', minWidth: '95px', backgroundColor: '#f1f5f9' }}>Ngành hàng</th>
                <th
                  style={{
                    padding: '10px 12px',
                    fontWeight: '700',
                    width: '105px',
                    minWidth: '95px',
                    textAlign: 'right',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                  }}
                >
                  Tồn thực tế
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    fontWeight: '700',
                    width: '125px',
                    minWidth: '115px',
                    textAlign: 'right',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Đang giữ chỗ
                </th>
                <th
                  style={{
                    padding: '10px 14px',
                    fontWeight: '700',
                    width: '135px',
                    minWidth: '125px',
                    textAlign: 'right',
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                  }}
                >
                  Tồn khả dụng
                </th>
                <th style={{ padding: '10px 14px', fontWeight: '700', width: '115px', minWidth: '105px', textAlign: 'center', backgroundColor: '#f1f5f9' }}>
                  Trạng thái
                </th>
                {canAccessStockCard && (
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '115px', minWidth: '100px', textAlign: 'center', backgroundColor: '#f1f5f9' }}>
                    Thẻ kho
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {isLoading && !data ? (
                <tr>
                  <td colSpan={canAccessStockCard ? 9 : 8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Đang tải dữ liệu hàng tồn kho...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={canAccessStockCard ? 9 : 8} style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                      Không tìm thấy mặt hàng nào phù hợp với bộ lọc
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      Hãy thử chọn kho khác hoặc thay đổi từ khóa tìm kiếm.
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map((it, idx) => {
                  const isAvailableZero = it.available_stock <= 0;
                  const isLow = it.is_low_stock;

                  return (
                    <tr
                      key={`${it.warehouse_id}-${it.product_id}`}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {/* Mã SKU */}
                      <td style={{ padding: '10px 14px', fontWeight: '700', color: '#2563eb', whiteSpace: 'nowrap' }}>
                        {it.product_code}
                      </td>

                      {/* Tên SP */}
                      <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b', minWidth: '250px', lineHeight: 1.35 }}>
                        {it.product_name}
                      </td>

                      {/* Kho */}
                      <td style={{ padding: '10px 14px', color: '#475569' }}>
                        <span style={{ fontWeight: '600' }}>{it.warehouse_name}</span>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Mã: {it.warehouse_id}</div>
                      </td>

                      {/* Ngành hàng */}
                      <td style={{ padding: '10px 12px', color: '#64748b' }}>
                        {it.category || '—'}
                      </td>

                      {/* 1. TỒN THỰC TẾ */}
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontWeight: '700',
                          color: '#0284c7',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatNumber(it.actual_stock)}
                      </td>

                      {/* 2. ĐANG GIỮ CHỖ */}
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          fontWeight: '700',
                          color: it.reserved_stock > 0 ? '#d97706' : '#94a3b8',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatNumber(it.reserved_stock)}
                      </td>

                      {/* 3. TỒN KHẢ DỤNG (BÁN ĐƯỢC) */}
                      <td
                        style={{
                          padding: '10px 14px',
                          textAlign: 'right',
                          fontWeight: '800',
                          fontSize: '14.5px',
                          color: isAvailableZero ? '#dc2626' : '#15803d',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatNumber(it.available_stock)}
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        {isAvailableZero ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              padding: '4px 10px',
                              minWidth: '80px',
                              minHeight: '34px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              lineHeight: '1.3',
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              boxSizing: 'border-box',
                            }}
                          >
                            Hết hàng bán
                          </span>
                        ) : isLow ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              padding: '4px 10px',
                              minWidth: '80px',
                              minHeight: '34px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              lineHeight: '1.3',
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fcd34d',
                              boxSizing: 'border-box',
                            }}
                            title={`Tồn thực tế (${it.actual_stock}) <= Định mức tối thiểu (${it.min_stock})`}
                          >
                            Thiếu hàng
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              textAlign: 'center',
                              padding: '4px 10px',
                              minWidth: '80px',
                              minHeight: '34px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              lineHeight: '1.3',
                              backgroundColor: '#dcfce7',
                              color: '#166534',
                              boxSizing: 'border-box',
                            }}
                          >
                            Còn hàng
                          </span>
                        )}
                      </td>

                      {/* Thao tác xem thẻ kho */}
                      {canAccessStockCard && (
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenStockCard) {
                                onOpenStockCard(it.product_id, it.product_name, it.product_code);
                              } else {
                                setSelectedProductForStockCard({ id: it.product_id, name: it.product_name, code: it.product_code });
                              }
                            }}
                            title={`Xem thẻ kho của ${it.product_name}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '5px',
                              padding: '5px 12px',
                              height: '32px',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: '12.5px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              boxSizing: 'border-box',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#dbeafe';
                              e.currentTarget.style.borderColor = '#93c5fd';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.borderColor = '#bfdbfe';
                            }}
                          >
                            <span>Thẻ kho</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Chân trang bảng: Khối phân trang liền thanh chuẩn theo thiết kế thu nhỏ */}
        <div
          style={{
            padding: '8px 18px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b',
            flexShrink: 0,
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
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
                const isLastItem = idx === arr.length - 1;
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
          </div>
        </div>
      </div>
    </div>
  );
};
