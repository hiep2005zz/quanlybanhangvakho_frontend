import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  WarehouseThresholdItem,
  WarehouseInfo,
  getInventoryWarehousesApi,
  getWarehouseThresholdsApi,
  updateWarehouseThresholdApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

interface StockThresholdManagementViewProps {
  token: string;
  canManageThresholds?: boolean;
  onBackToHome: () => void;
  onThresholdsUpdated?: () => void;
}

export const StockThresholdManagementView: React.FC<StockThresholdManagementViewProps> = ({
  token,
  canManageThresholds = true,
  onBackToHome: _onBackToHome,
  onThresholdsUpdated,
}) => {
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [items, setItems] = useState<WarehouseThresholdItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc & Tìm kiếm
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'LOW_ONLY'>('ALL');

  // Phân trang Backend (20 thông tin mỗi trang)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;
  const [_totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Thống kê KPI tổng quan (nhận trực tiếp từ backend phân trang, không fetch lại 26.000 dòng)
  const [stats, setStats] = useState<{
    totalCount: number;
    lowCount: number;
    safeCount: number;
    activeWarehouses: number;
  }>({
    totalCount: 0,
    lowCount: 0,
    safeCount: 0,
    activeWarehouses: 3,
  });

  // State chỉnh sửa
  // State chỉnh sửa (dùng string để cho phép xóa sạch về rỗng mà không bị tự nhảy lại số 0 hoặc bị dính số 0 đằng trước)
  const [editingValues, setEditingValues] = useState<{ [key: string]: string }>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);

  // Debounce tìm kiếm 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // 1. Tải danh sách kho
  useEffect(() => {
    const loadWarehouses = async () => {
      try {
        const whs = await getInventoryWarehousesApi(token);
        setWarehouses(whs);
      } catch (err: any) {
        console.error('Không thể tải danh sách kho:', err);
      }
    };
    loadWarehouses();
  }, [token]);

  // 2. Tải danh sách định mức phân trang từ backend (20 dòng/trang, <5ms)
  const loadPaginatedThresholds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const whIdParam = selectedWarehouseId === 'ALL' ? undefined : selectedWarehouseId;
      const res = await getWarehouseThresholdsApi(
        token,
        whIdParam,
        currentPage,
        pageSize,
        debouncedSearch,
        filterMode
      );

      if (Array.isArray(res)) {
        // Fallback an toàn nếu backend trả về mảng trực tiếp: phân trang Client-side để luôn đảm bảo chỉ hiện đúng pageSize (20) dòng
        const start = (currentPage - 1) * pageSize;
        setItems(res.slice(start, start + pageSize));
        setTotalItems(res.length);
        setTotalPages(Math.max(1, Math.ceil(res.length / pageSize)));
        const low = res.filter((i) => i.is_low_stock).length;
        setStats({
          totalCount: res.length,
          lowCount: low,
          safeCount: Math.max(0, res.length - low),
          activeWarehouses: new Set(res.map((i) => i.warehouse_id)).size || 1,
        });
        const initialEdits: { [key: string]: string } = {};
        res.forEach((it) => {
          initialEdits[`${it.warehouse_id}_${it.product_id}`] = String(it.min_stock);
        });
        setEditingValues((prev) => ({ ...initialEdits, ...prev }));
      } else {
        // Server-side paginated response
        setItems(res.items);
        setTotalItems(res.total);
        setTotalPages(res.total_pages || Math.max(1, Math.ceil(res.total / pageSize)));
        if (res.total_count !== undefined) {
          setStats({
            totalCount: res.total_count ?? res.total,
            lowCount: res.low_count ?? 0,
            safeCount: res.safe_count ?? 0,
            activeWarehouses: res.active_warehouses ?? (selectedWarehouseId === 'ALL' ? 3 : 1),
          });
        }
        const initialEdits: { [key: string]: string } = {};
        res.items.forEach((it) => {
          initialEdits[`${it.warehouse_id}_${it.product_id}`] = String(it.min_stock);
        });
        setEditingValues((prev) => ({ ...initialEdits, ...prev }));
      }
    } catch (err: any) {
      setError(err?.message || 'Lỗi tải dữ liệu định mức tồn tối thiểu.');
    } finally {
      setLoading(false);
    }
  }, [token, selectedWarehouseId, currentPage, pageSize, debouncedSearch, filterMode]);

  useEffect(() => {
    loadPaginatedThresholds();
  }, [loadPaginatedThresholds]);

  // Đếm số dòng đã chỉnh sửa trên trang hiện tại nhưng chưa lưu
  const changedItemsOnPage = useMemo(() => {
    return items.filter((it) => {
      const key = `${it.warehouse_id}_${it.product_id}`;
      const valStr = editingValues[key];
      if (valStr === undefined) return false;
      const numVal = valStr === '' ? 0 : (parseInt(valStr, 10) || 0);
      return numVal !== it.min_stock;
    });
  }, [items, editingValues]);

  // Xử lý khi người dùng nhập số: cho phép xóa về rỗng "", tự động loại bỏ số 0 thừa phía trước
  const handleMinStockChange = (warehouseId: string, productId: number, rawVal: string) => {
    const key = `${warehouseId}_${productId}`;
    if (rawVal === '') {
      setEditingValues((prev) => ({
        ...prev,
        [key]: '',
      }));
      return;
    }

    // Chỉ giữ lại các chữ số
    let clean = rawVal.replace(/\D/g, '');

    // Nếu gõ số khác sau số 0 (ví dụ "010" -> "10", "01" -> "1"), tự động bỏ số 0 ở đầu
    if (clean.length > 1 && clean.startsWith('0')) {
      clean = clean.replace(/^0+/, '') || '0';
    }

    setEditingValues((prev) => ({
      ...prev,
      [key]: clean,
    }));
  };

  // Khi click ra ngoài (blur): nếu ô đang để trống "" thì tự động điền về "0"
  const handleMinStockBlur = (warehouseId: string, productId: number) => {
    const key = `${warehouseId}_${productId}`;
    setEditingValues((prev) => {
      const current = prev[key];
      if (current === '' || current === undefined) {
        return { ...prev, [key]: '0' };
      }
      return prev;
    });
  };

  // Lưu 1 dòng
  const handleSaveThreshold = async (it: WarehouseThresholdItem) => {
    const key = `${it.warehouse_id}_${it.product_id}`;
    const valStr = editingValues[key];
    if (valStr === undefined) return;
    const newMin = valStr === '' ? 0 : Math.max(0, parseInt(valStr, 10) || 0);

    setSavingKey(key);
    try {
      const updated = await updateWarehouseThresholdApi(token, {
        warehouse_id: it.warehouse_id,
        product_id: it.product_id,
        min_stock: newMin,
      });

      setItems((prev) =>
        prev.map((item) =>
          item.warehouse_id === updated.warehouse_id && item.product_id === updated.product_id
            ? updated
            : item
        )
      );

      setEditingValues((prev) => ({
        ...prev,
        [key]: String(newMin),
      }));

      // Cập nhật lại danh sách và thống kê
      loadPaginatedThresholds();

      emitStatusToast({
        title: 'Cập nhật thành công',
        message: `Đã đặt định mức tối thiểu cho ${it.product_code} tại ${it.warehouse_name} là ${newMin} ${it.base_unit}.`,
      });

      if (onThresholdsUpdated) {
        onThresholdsUpdated();
      }
    } catch (err: any) {
      emitStatusToast({
        title: 'Cập nhật thất bại',
        message: err.message || 'Không thể lưu định mức tồn tối thiểu.',
        type: 'error',
      });
    } finally {
      setSavingKey(null);
    }
  };

  // Lưu hàng loạt tất cả các dòng đã thay đổi trên trang
  const handleSaveAllChanged = async () => {
    if (changedItemsOnPage.length === 0) return;
    setIsSavingAll(true);
    let successCount = 0;
    try {
      for (const it of changedItemsOnPage) {
        const key = `${it.warehouse_id}_${it.product_id}`;
        const valStr = editingValues[key];
        if (valStr !== undefined) {
          const newMin = valStr === '' ? 0 : Math.max(0, parseInt(valStr, 10) || 0);
          const updated = await updateWarehouseThresholdApi(token, {
            warehouse_id: it.warehouse_id,
            product_id: it.product_id,
            min_stock: newMin,
          });
          setItems((prev) =>
            prev.map((item) =>
              item.warehouse_id === updated.warehouse_id && item.product_id === updated.product_id
                ? updated
                : item
            )
          );

          successCount++;
        }
      }
      loadPaginatedThresholds();
      emitStatusToast({
        title: 'Lưu thành công',
        message: `Đã cập nhật định mức tồn cho ${successCount} mặt hàng thành công!`,
      });
      if (onThresholdsUpdated) {
        onThresholdsUpdated();
      }
    } catch (err: any) {
      emitStatusToast({
        title: 'Cập nhật thất bại',
        message: err.message || 'Có lỗi xảy ra khi lưu định mức hàng loạt.',
        type: 'error',
      });
    } finally {
      setIsSavingAll(false);
    }
  };

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
      {/* 1. Header Tiêu Đề */}
      <div style={{ marginBottom: '14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1
              style={{
                fontSize: '22px',
                fontWeight: '800',
                color: '#0f172a',
                margin: 0,
                letterSpacing: '-0.02em',
              }}
            >
              Khai Báo Định Mức Tồn Tối Thiểu (Theo SKU & Kho)
            </h1>
          </div>

          {/* Nút thao tác nhanh trên header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {changedItemsOnPage.length > 0 && canManageThresholds && (
              <button
                type="button"
                onClick={handleSaveAllChanged}
                disabled={isSavingAll}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#0fad89',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSavingAll ? 'default' : 'pointer',
                  boxShadow: '0 2px 4px rgba(15, 173, 137, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isSavingAll ? 'Đang lưu tất cả...' : `Lưu thay đổi trang này (${changedItemsOnPage.length})`}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                loadPaginatedThresholds();
              }}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                cursor: loading ? 'default' : 'pointer',
              }}
              title="Làm mới dữ liệu định mức"
            >
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 Thẻ KPI Thống Kê Tổng Quan */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '12px',
          marginBottom: '14px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
            Tổng số cấu hình SKU
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
            {stats.totalCount} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>dòng</span>
          </div>
        </div>

        <div
          style={{
            background: stats.lowCount > 0 ? '#fff5f5' : '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: stats.lowCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: stats.lowCount > 0 ? '#b91c1c' : '#64748b',
              fontWeight: '600',
              marginBottom: '4px',
            }}
          >
            Dưới định mức tối thiểu
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: stats.lowCount > 0 ? '#dc2626' : '#15803d' }}>
            {stats.lowCount} <span style={{ fontSize: '13px', fontWeight: '500' }}>mặt hàng</span>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
            Trạng thái an toàn
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#16a34a' }}>
            {stats.safeCount} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>mặt hàng</span>
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px 16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '4px' }}>
            Kho áp dụng
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
            {selectedWarehouseId === 'ALL' ? `${stats.activeWarehouses} kho` : '1 kho đã chọn'}
          </div>
        </div>
      </div>

      {/* 3. Thanh Điều Khiển & Bộ Lọc */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '12px 16px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Chọn kho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Chọn kho:</span>
            <select
              value={selectedWarehouseId}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: '600',
                color: '#1e293b',
                background: '#f8fafc',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="ALL">Tất cả các kho</option>
              {warehouses.map((w) => (
                <option key={w.warehouse_id} value={w.warehouse_id}>
                  {w.warehouse_name} ({w.warehouse_id})
                </option>
              ))}
            </select>
          </div>

          {/* Tabs chuyển đổi bộ lọc */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setFilterMode('ALL');
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: filterMode === 'ALL' ? '#ffffff' : 'transparent',
                color: filterMode === 'ALL' ? '#0f172a' : '#64748b',
                fontWeight: filterMode === 'ALL' ? '700' : '500',
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: filterMode === 'ALL' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Tất cả ({stats.totalCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterMode('LOW_ONLY');
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: filterMode === 'LOW_ONLY' ? '#fee2e2' : 'transparent',
                color: filterMode === 'LOW_ONLY' ? '#b91c1c' : '#64748b',
                fontWeight: filterMode === 'LOW_ONLY' ? '700' : '500',
                fontSize: '12.5px',
                cursor: 'pointer',
                boxShadow: filterMode === 'LOW_ONLY' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              Dưới định mức ({stats.lowCount})
            </button>
          </div>
        </div>

        {/* Tìm kiếm */}
        <div style={{ position: 'relative', minWidth: '280px' }}>
          <input
            type="text"
            placeholder="Tìm theo mã SKU, tên SP, kho..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
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
                color: '#94a3b8',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 4. Bảng Danh Sách Định Mức Tồn Kho */}
      <div
        style={{
          flex: 1,
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>⏳</div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang tải danh sách định mức tồn kho...</div>
            </div>
          ) : error ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#dc2626' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️</div>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>{error}</div>
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔍</div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                Không tìm thấy mặt hàng nào phù hợp
              </div>
              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Vui lòng kiểm tra lại từ khóa tìm kiếm hoặc đổi điều kiện lọc kho.
              </div>
            </div>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                fontSize: '13px',
              }}
            >
              <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '12px' }}>
                  <th style={{ padding: '12px 14px', fontWeight: '700', width: '60px', textAlign: 'center' }}>STT</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Kho Phục Vụ</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Mã SKU</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700' }}>Tên Sản Phẩm</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'right' }}>Tồn Thực Tế</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'right' }}>Tồn Khả Dụng</th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'center', width: '160px' }}>
                    Định Mức Tối Thiểu
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'center', width: '180px', whiteSpace: 'nowrap' }}>
                    Trạng Thái
                  </th>
                  <th style={{ padding: '12px 14px', fontWeight: '700', textAlign: 'right', width: '100px' }}>
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const key = `${it.warehouse_id}_${it.product_id}`;
                  const currentEditVal = editingValues[key] !== undefined ? editingValues[key] : String(it.min_stock);
                  const numEditVal = currentEditVal === '' ? 0 : (parseInt(currentEditVal, 10) || 0);
                  const hasChanged = editingValues[key] !== undefined && numEditVal !== it.min_stock;
                  const isSaving = savingKey === key || isSavingAll;
                  const rowNumber = (currentPage - 1) * pageSize + idx + 1;

                  return (
                    <tr
                      key={key}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: it.is_low_stock ? '#fff8f8' : hasChanged ? '#f0f9ff' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!it.is_low_stock && !hasChanged) e.currentTarget.style.background = '#f8fafc';
                      }}
                      onMouseLeave={(e) => {
                        if (!it.is_low_stock && !hasChanged) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        {rowNumber}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155', fontWeight: '600' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '3px 8px',
                            borderRadius: '5px',
                            border: '1px solid #e2e8f0',
                            fontWeight: '600',
                          }}
                        >
                          {it.warehouse_name}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>
                        {it.product_code}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b' }}>
                        {it.product_name}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                        {it.actual_stock.toLocaleString()}{' '}
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>{it.base_unit}</span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#0284c7' }}>
                        {it.available_stock.toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            disabled={!canManageThresholds || isSaving}
                            value={currentEditVal}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) =>
                              handleMinStockChange(it.warehouse_id, it.product_id, e.target.value)
                            }
                            onBlur={() => handleMinStockBlur(it.warehouse_id, it.product_id)}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                const next = (parseInt(currentEditVal || '0', 10) || 0) + 1;
                                handleMinStockChange(it.warehouse_id, it.product_id, String(next));
                              } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                const next = Math.max(0, (parseInt(currentEditVal || '0', 10) || 0) - 1);
                                handleMinStockChange(it.warehouse_id, it.product_id, String(next));
                              }
                            }}
                            style={{
                              width: '90px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              border: hasChanged ? '2px solid #0284c7' : '1px solid #cbd5e1',
                              fontSize: '13px',
                              textAlign: 'center',
                              fontWeight: '700',
                              color: '#0f172a',
                              background: '#ffffff',
                              outline: 'none',
                              boxShadow: hasChanged ? '0 0 0 2px rgba(2, 132, 199, 0.15)' : 'none',
                            }}
                          />
                          <span style={{ fontSize: '12px', color: '#64748b' }}>{it.base_unit}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        {it.is_low_stock ? (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              borderRadius: '999px',
                              padding: '3px 12px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Dưới mức ({it.shortage_quantity > 0 ? `Thiếu ${it.shortage_quantity}` : 'Chạm ngưỡng'})
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #bbf7d0',
                              borderRadius: '999px',
                              padding: '3px 12px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            An toàn
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        {canManageThresholds && (
                          <button
                            type="button"
                            disabled={!hasChanged || isSaving}
                            onClick={() => handleSaveThreshold(it)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              background: hasChanged ? '#0fad89' : '#e2e8f0',
                              color: hasChanged ? '#ffffff' : '#94a3b8',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: hasChanged && !isSaving ? 'pointer' : 'default',
                              transition: 'all 0.15s ease',
                              boxShadow: hasChanged ? '0 1px 3px rgba(15, 173, 137, 0.3)' : 'none',
                            }}
                          >
                            {isSaving ? 'Lưu...' : 'Lưu'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 5. Thanh Điều Khiển Phân Trang (Phong cách gọn bên phải giống Hàng tồn kho) */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexShrink: 0,
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
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
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

                const isActive = p === currentPage;
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

export default StockThresholdManagementView;
