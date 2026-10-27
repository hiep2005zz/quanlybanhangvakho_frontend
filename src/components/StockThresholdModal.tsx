import React, { useState, useEffect, useMemo } from 'react';
import {
  WarehouseThresholdItem,
  WarehouseInfo,
  getInventoryWarehousesApi,
  getWarehouseThresholdsApi,
  updateWarehouseThresholdApi,
} from '../services/api';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';
import { WarehouseSelectDropdown } from './WarehouseSelectDropdown';

interface StockThresholdModalProps {
  isOpen: boolean;
  token: string;
  canManageThresholds?: boolean;
  onClose: () => void;
  onThresholdsUpdated?: () => void;
}

export const StockThresholdModal: React.FC<StockThresholdModalProps> = ({
  isOpen,
  token,
  canManageThresholds = true,
  onClose,
  onThresholdsUpdated,
}) => {
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL');
  const [items, setItems] = useState<WarehouseThresholdItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'LOW_ONLY'>('ALL');
  const [editingValues, setEditingValues] = useState<{ [key: string]: number }>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const loadWarehouses = async () => {
      try {
        const whs = await getInventoryWarehousesApi(token);
        setWarehouses(whs);
      } catch (err: any) {
        console.error('Không thể tải danh sách kho:', err);
      }
    };
    loadWarehouses();
  }, [isOpen, token]);

  const loadThresholds = async () => {
    setLoading(true);
    setError(null);
    try {
      const whIdParam = selectedWarehouseId === 'ALL' ? undefined : selectedWarehouseId;
      const res = await getWarehouseThresholdsApi(token, whIdParam);
      const data = Array.isArray(res) ? res : res.items;
      setItems(data);
      const initialEdits: { [key: string]: number } = {};
      data.forEach((it) => {
        initialEdits[`${it.warehouse_id}_${it.product_id}`] = it.min_stock;
      });
      setEditingValues(initialEdits);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải dữ liệu định mức tồn tối thiểu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadThresholds();
    }
  }, [isOpen, selectedWarehouseId, token]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((it) => {
      const matchSearch =
        !q ||
        it.product_code.toLowerCase().includes(q) ||
        it.product_name.toLowerCase().includes(q) ||
        it.warehouse_name.toLowerCase().includes(q);
      const matchFilter = filterMode === 'ALL' || it.is_low_stock;
      return matchSearch && matchFilter;
    });
  }, [items, searchTerm, filterMode]);

  const handleMinStockChange = (warehouseId: string, productId: number, val: number) => {
    const key = `${warehouseId}_${productId}`;
    setEditingValues((prev) => ({
      ...prev,
      [key]: Math.max(0, val),
    }));
  };

  const handleSaveThreshold = async (it: WarehouseThresholdItem) => {
    const key = `${it.warehouse_id}_${it.product_id}`;
    const newMin = editingValues[key];
    if (newMin === undefined || newMin < 0) return;

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

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99990,
          padding: '16px',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1050px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Khai Báo Định Mức Tồn Tối Thiểu (Theo SKU & Kho)
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                Thiết lập ngưỡng tồn an toàn để hệ thống cảnh báo kịp thời trước khi đứt hàng
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#e2e8f0',
                border: 'none',
                borderRadius: '8px',
                width: '32px',
                height: '32px',
                fontSize: '18px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Controls Bar */}
          <div
            style={{
              padding: '12px 24px',
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
              {/* Search Input */}
              <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 220px', maxWidth: '300px' }}>
                <input
                  type="text"
                  placeholder="Tìm mã SKU, tên SP..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    height: '35px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Warehouse selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>Chọn kho:</span>
                <div style={{ minWidth: '190px' }}>
                  <WarehouseSelectDropdown
                    warehouses={warehouses}
                    selectedId={selectedWarehouseId}
                    onSelect={(whId) => setSelectedWarehouseId(whId)}
                    allowAll={true}
                    allLabel="Tất cả kho"
                    allValue="ALL"
                    compact={true}
                    placeholder="Tất cả kho"
                    id="modal-threshold-warehouse-select"
                  />
                </div>
              </div>
            </div>

            {/* Quick filter tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: filterMode === 'ALL' ? '#ffffff' : 'transparent',
                  color: filterMode === 'ALL' ? '#0f172a' : '#64748b',
                  fontWeight: filterMode === 'ALL' ? '700' : '500',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  boxShadow: filterMode === 'ALL' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                Tất cả ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('LOW_ONLY')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: filterMode === 'LOW_ONLY' ? '#fee2e2' : 'transparent',
                  color: filterMode === 'LOW_ONLY' ? '#b91c1c' : '#64748b',
                  fontWeight: filterMode === 'LOW_ONLY' ? '700' : '500',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Dưới định mức ({items.filter((i) => i.is_low_stock).length})
              </button>
            </div>
          </div>

          {/* Table content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 16px' }}>
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                Đang tải danh sách định mức tồn kho...
              </div>
            ) : error ? (
              <div style={{ padding: '30px', textAlign: 'center', color: '#dc2626' }}>{error}</div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: '50px', textAlign: 'center', color: '#64748b' }}>
                Không tìm thấy mặt hàng nào phù hợp với điều kiện lọc.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#ffffff', zIndex: 5 }}>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px' }}>
                    <th style={{ padding: '10px 8px', fontWeight: '700' }}>Kho Phục Vụ</th>
                    <th style={{ padding: '10px 8px', fontWeight: '700' }}>Mã SKU</th>
                    <th style={{ padding: '10px 8px', fontWeight: '700' }}>Tên Sản Phẩm</th>
                    <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'right' }}>Tồn Thực Tế</th>
                    <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'right' }}>Tồn Khả Dụng</th>
                    <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'center', width: '150px' }}>
                      Định Mức Tối Thiểu
                    </th>
                    <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'center' }}>Trạng Thái</th>
                    <th style={{ padding: '10px 8px', fontWeight: '700', textAlign: 'right' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((it) => {
                    const key = `${it.warehouse_id}_${it.product_id}`;
                    const currentEditVal = editingValues[key] !== undefined ? editingValues[key] : it.min_stock;
                    const hasChanged = currentEditVal !== it.min_stock;
                    const isSaving = savingKey === key;

                    return (
                      <tr
                        key={key}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: it.is_low_stock ? '#fff5f5' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '9px 8px', color: '#334155', fontWeight: '600' }}>
                          <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                            {it.warehouse_name}
                          </span>
                        </td>
                        <td style={{ padding: '9px 8px', fontFamily: 'monospace', fontWeight: '700', color: '#0f172a' }}>
                          {it.product_code}
                        </td>
                        <td style={{ padding: '9px 8px', fontWeight: '600', color: '#1e293b' }}>
                          {it.product_name}
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                          {it.actual_stock.toLocaleString()} <span style={{ fontSize: '11px', color: '#64748b' }}>{it.base_unit}</span>
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: '600', color: '#0284c7' }}>
                          {it.available_stock.toLocaleString()}
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            disabled={!canManageThresholds || isSaving}
                            value={currentEditVal}
                            onChange={(e) =>
                              handleMinStockChange(it.warehouse_id, it.product_id, parseInt(e.target.value) || 0)
                            }
                            style={{
                              width: '80px',
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: hasChanged ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                              fontSize: '13px',
                              textAlign: 'center',
                              fontWeight: '700',
                              color: '#0f172a',
                              background: '#ffffff',
                            }}
                          />
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                          {it.is_low_stock ? (
                            <span
                              style={{
                                display: 'inline-block',
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                borderRadius: '999px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                fontWeight: '700',
                              }}
                            >
                              ⚠️ Dưới mức ({it.shortage_quantity > 0 ? `Thiếu ${it.shortage_quantity}` : 'Chạm ngưỡng'})
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-block',
                                background: '#dcfce7',
                                color: '#15803d',
                                border: '1px solid #bbf7d0',
                                borderRadius: '999px',
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                              }}
                            >
                              ✓ An toàn
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '9px 8px', textAlign: 'right' }}>
                          {canManageThresholds && (
                            <button
                              type="button"
                              disabled={!hasChanged || isSaving}
                              onClick={() => handleSaveThreshold(it)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: hasChanged ? '#0fad89' : '#e2e8f0',
                                color: hasChanged ? '#ffffff' : '#94a3b8',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: hasChanged ? 'pointer' : 'default',
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

          {/* Footer */}
          <div
            style={{
              padding: '12px 24px',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '12.5px', color: '#64748b' }}>
              Đang hiển thị <strong>{filteredItems.length}</strong> dòng SKU theo kho
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 18px',
                background: '#334155',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
