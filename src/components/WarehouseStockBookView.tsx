import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getStockBookApi,
  StockBookResponse,
  StockBookFilterParams,
  getClientSession,
  User,
} from '../services/api';
import { StockCardModal } from './StockCardModal';
import { StockCardView } from './StockCardView';

interface WarehouseStockBookViewProps {
  token: string;
  currentUser?: User;
  onBackToHome?: () => void;
  onNavigateToTab?: (tab: string, queryParam?: string) => void;
  onOpenStockCard?: (productId: number, productName: string, productCode: string) => void;
  canAccessStockCard?: boolean;
  onOpenTurnoverReport?: () => void;
  onNavigateToAdjustments?: () => void;
}

export const WarehouseStockBookView: React.FC<WarehouseStockBookViewProps> = ({
  token,
  currentUser,
  onBackToHome: _onBackToHome,
  onNavigateToTab,
  onOpenStockCard,
  canAccessStockCard = true,
  onOpenTurnoverReport: _onOpenTurnoverReport,
  onNavigateToAdjustments,
}) => {
  // Lấy thông tin user hiện tại từ props hoặc session
  const activeUser = currentUser || getClientSession().user;
  const userRoles = [
    activeUser?.role,
    ...(activeUser?.roles || []),
  ].filter(Boolean) as string[];

  // Chỉ Admin và Quản lý kho (warehouse_manager) mới được phép thấy nút và xuất Excel.
  // Thủ kho (warehouse) và các vai trò khác không nhìn thấy nút này.
  const canExportExcel = userRoles.some((r) => ['admin', 'warehouse_manager'].includes(r));
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
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Phân trang
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Modal Thẻ kho
  const [selectedStockCardProduct, setSelectedStockCardProduct] = useState<{
    productId: number;
    productCode: string;
    productName: string;
    warehouseId?: string | number;
    warehouseName?: string;
  } | null>(null);

  // Quyền truy cập điều chỉnh tồn kho: Hiển thị cho Admin, Quản lý kho và Thủ kho. Ẩn hoàn toàn với các vai trò khác (sales, sales_manager, accountant, etc.)
  const canAccessAdjustments = useMemo(() => {
    if (!currentUser) return false;
    const r = currentUser.role ? currentUser.role.toLowerCase() : '';
    const roles: string[] = [r];
    if ((currentUser as any).roles && Array.isArray((currentUser as any).roles)) {
      roles.push(...(currentUser as any).roles.map((x: string) => (x || '').toLowerCase()));
    }
    return (
      roles.includes('admin') ||
      roles.includes('system_admin') ||
      roles.includes('warehouse_manager') ||
      roles.includes('warehouse_mgr') ||
      roles.includes('warehouse')
    );
  }, [currentUser]);

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

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      setError(null);

      // Lấy toàn bộ danh sách bản ghi theo bộ lọc đang áp dụng (không phân trang)
      const params: StockBookFilterParams = {
        warehouse_id: selectedWarehouse,
        category: selectedCategory,
        stock_status: selectedStatus,
        search: debouncedSearch,
      };
      const res = await getStockBookApi(token, params);
      const exportItems = res.items || [];

      if (exportItems.length === 0) {
        alert('Không có dữ liệu tồn kho để xuất theo bộ lọc hiện tại.');
        return;
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const warehouseCode = selectedWarehouse === 'all' ? 'TAT_CA_KHO' : selectedWarehouse;
      const warehouseNameLabel = selectedWarehouse === 'all'
        ? 'Tất cả các kho'
        : (warehouses.find((w) => w.warehouse_id === selectedWarehouse)?.warehouse_name || selectedWarehouse);
      const categoryLabel = selectedCategory === 'all' ? 'Tất cả ngành hàng' : selectedCategory;
      const statusLabel = selectedStatus === 'all'
        ? 'Tất cả trạng thái'
        : selectedStatus === 'available'
        ? 'Còn hàng (Khả dụng > 0)'
        : selectedStatus === 'low_stock'
        ? 'Thiếu hàng (Dưới định mức)'
        : 'Hết hàng bán (Khả dụng = 0)';

      let totalActual = 0;
      let totalReserved = 0;
      let totalAvailable = 0;

      const rowsHtml = exportItems.map((item, idx) => {
        totalActual += item.actual_stock || 0;
        totalReserved += item.reserved_stock || 0;
        totalAvailable += item.available_stock || 0;

        const statusText = item.status === 'out_of_stock'
          ? 'Hết hàng bán'
          : item.status === 'low_stock'
          ? 'Thiếu hàng'
          : 'Còn hàng';

        return `
          <tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td style="mso-number-format:'\\@'; font-weight: 600; text-align: center;">${item.warehouse_id}</td>
            <td>${item.warehouse_name}</td>
            <td style="mso-number-format:'\\@'; font-weight: 600;">${item.product_code}</td>
            <td>${item.product_name}</td>
            <td>${item.category || ''}</td>
            <td style="text-align: center;">${item.base_unit || 'Cái'}</td>
            <td style="text-align: right; font-weight: 600; color: #0284c7;">${(item.actual_stock || 0).toLocaleString('vi-VN')}</td>
            <td style="text-align: right; font-weight: 600; color: #d97706;">${(item.reserved_stock || 0).toLocaleString('vi-VN')}</td>
            <td style="text-align: right; font-weight: 700; color: #16a34a;">${(item.available_stock || 0).toLocaleString('vi-VN')}</td>
            <td style="text-align: right;">${(item.min_stock || 0).toLocaleString('vi-VN')}</td>
            <td style="text-align: center;">${statusText}</td>
          </tr>
        `;
      }).join('');

      const excelTemplate = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>BaoCaoTonKho</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; }
            table { border-collapse: collapse; width: 100%; }
            th { background-color: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; padding: 8px 12px; font-weight: bold; }
            td { border: 1px solid #e2e8f0; padding: 6px 10px; }
            .title { font-size: 18px; font-weight: bold; color: #0f172a; text-align: center; }
            .meta { font-size: 12px; color: #475569; }
            .sum-row { background-color: #f8fafc; font-weight: bold; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="12" class="title" style="padding: 14px 0; font-size: 18px; font-weight: bold; text-align: center;">
                BÁO CÁO TỒN KHO CHI TIẾT THEO KHO & SKU
              </td>
            </tr>
            <tr>
              <td colspan="12" class="meta" style="color: #475569;">
                <strong>Kho lưu trữ:</strong> ${warehouseNameLabel} (${warehouseCode}) | 
                <strong>Ngành hàng:</strong> ${categoryLabel} | 
                <strong>Trạng thái:</strong> ${statusLabel} | 
                <strong>Ngày xuất:</strong> ${todayStr}
              </td>
            </tr>
            ${debouncedSearch ? `
            <tr>
              <td colspan="12" class="meta" style="color: #475569;">
                <strong>Từ khóa tìm kiếm:</strong> ${debouncedSearch}
              </td>
            </tr>
            ` : ''}
            <tr><td colspan="12"></td></tr>
            <thead>
              <tr>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">STT</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">Mã kho</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: left;">Tên kho</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">Mã SP</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: left;">Tên sản phẩm</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: left;">Ngành hàng</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">ĐVT</th>
                <th style="background-color: #bae6fd; border: 1px solid #0284c7; text-align: right;">Tồn thực tế</th>
                <th style="background-color: #fef08a; border: 1px solid #ca8a04; text-align: right;">Tồn giữ chỗ</th>
                <th style="background-color: #bbf7d0; border: 1px solid #16a34a; text-align: right;">Tồn khả dụng</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: right;">Định mức tối thiểu</th>
                <th style="background-color: #e2e8f0; border: 1px solid #94a3b8; text-align: center;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
              <tr class="sum-row" style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #64748b;">
                <td colspan="7" style="text-align: right; padding: 8px 10px;">TỔNG CỘNG:</td>
                <td style="text-align: right; color: #0284c7; padding: 8px 10px;">${totalActual.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #d97706; padding: 8px 10px;">${totalReserved.toLocaleString('vi-VN')}</td>
                <td style="text-align: right; color: #16a34a; padding: 8px 10px;">${totalAvailable.toLocaleString('vi-VN')}</td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const fileName = `bao_cao_ton_kho_${warehouseCode}_${todayStr}.xls`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting stock book to Excel:', err);
      setError(err?.message || 'Có lỗi xảy ra khi xuất báo cáo tồn kho ra Excel.');
    } finally {
      setIsExporting(false);
    }
  };

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
      <div
        style={{
          marginBottom: '14px',
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
            Hàng Tồn Kho Theo Kho & SKU
          </h1>
          <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
            Theo dõi tồn kho thực tế, tồn khả dụng và lịch sử biến động Thẻ kho
          </div>
        </div>

        {/* Nút Chuyển sang Trang Điều chỉnh tồn kho: Hiển thị cho Admin, Quản lý kho và Thủ kho */}
        {canAccessAdjustments && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => {
                if (onNavigateToAdjustments) {
                  onNavigateToAdjustments();
                } else {
                  try {
                    window.history.pushState({}, '', '/stock-adjustments');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  } catch { }
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
              }}
            >
              Điều chỉnh tồn kho
            </button>
          </div>
        )}
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
            Tồn giữ chỗ cho đơn hàng
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

        {/* Nút Làm mới & Xuất Excel */}
        <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px' }}>
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

          {canExportExcel && (
            <button
              id="btn-export-stock-book-excel"
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              title="Xuất báo cáo tồn kho ra file Excel theo bộ lọc hiện tại (Dành cho Quản lý kho & Admin)"
              style={{
                padding: '0 16px',
                height: '35px',
                backgroundColor: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.7 : 1,
                boxShadow: '0 2px 4px rgba(22,163,74,0.2)',
                transition: 'background-color 0.15s ease',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                justifyContent: 'center',
              }}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {isExporting ? 'Đang xuất Excel...' : 'Xuất Excel'}
            </button>
          )}
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
                  Tồn giữ chỗ
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
                    Thao tác
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
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                      {selectedWarehouse !== 'all' ? 'Kho này hiện chưa có mặt hàng nào' : 'Không tìm thấy mặt hàng nào phù hợp với bộ lọc'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#64748b' }}>
                      {selectedWarehouse !== 'all'
                        ? 'Vui lòng thực hiện nhập kho hoặc chuyển kho nội bộ để lưu trữ và phân bổ sản phẩm vào kho này.'
                        : 'Hãy thử chọn kho khác hoặc thay đổi từ khóa tìm kiếm.'}
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
                                setSelectedStockCardProduct({
                                  productId: it.product_id,
                                  productCode: it.product_code,
                                  productName: it.product_name,
                                  warehouseId: it.warehouse_id,
                                  warehouseName: it.warehouse_name,
                                });
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
        {totalItems > 0 && (
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
      )}
    </div>

      {/* Modal Thẻ kho chi tiết cho từng sản phẩm */}
      {selectedStockCardProduct && (
        <StockCardModal
          token={token}
          isOpen={!!selectedStockCardProduct}
          onClose={() => setSelectedStockCardProduct(null)}
          productId={selectedStockCardProduct.productId}
          productCode={selectedStockCardProduct.productCode}
          productName={selectedStockCardProduct.productName}
          warehouseId={selectedStockCardProduct.warehouseId}
          warehouseName={selectedStockCardProduct.warehouseName}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
