import React, { useState, useEffect, useCallback } from 'react';
import {
  getStockCardLedgersApi,
  StockCardItem,
  getStockAdjustmentsApi,
  StockAdjustmentResponse,
  approveStockAdjustmentApi,
} from '../services/api';

interface StockCardModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  productId: number;
  productCode: string;
  productName: string;
  warehouseId?: string | number;
  warehouseName?: string;
  currentUser?: {
    id?: number;
    username?: string;
    full_name?: string;
    role?: string;
  };
}

export const StockCardModal: React.FC<StockCardModalProps> = ({
  token,
  isOpen,
  onClose,
  productId,
  productCode,
  productName,
  warehouseId,
  warehouseName,
  currentUser,
}) => {
  const [ledgers, setLedgers] = useState<StockCardItem[]>([]);
  const [pendingAdjustments, setPendingAdjustments] = useState<StockAdjustmentResponse[]>([]);
  const [approvingAdjId, setApprovingAdjId] = useState<number | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const isWarehousePersonnel =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'warehouse_manager' ||
    currentUser?.role === 'warehouse' ||
    currentUser?.role === 'system_admin';

  const isManagerOrAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'warehouse_manager' ||
    currentUser?.role === 'system_admin';

  const fetchLedgers = useCallback(async () => {
    if (!isOpen || !productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getStockCardLedgersApi(token, {
        product_id: productId,
        warehouse_id: warehouseId ? String(warehouseId) : undefined,
        limit: 100,
      });
      setLedgers(res.items || []);
    } catch (err: any) {
      console.error('Error fetching stock card ledgers:', err);
      setError(err?.message || 'Không thể tải dữ liệu Thẻ kho.');
    } finally {
      setIsLoading(false);
    }

    // Tải thông tin các phiếu điều chỉnh đang ở trạng thái 'PENDING' (Chờ duyệt) cho sản phẩm này
    try {
      const pendingRes = await getStockAdjustmentsApi(token, {
        status: 'PENDING',
        warehouse_id: warehouseId ? String(warehouseId) : undefined,
        limit: 50,
      });
      const relevant = (pendingRes.items || []).filter((adj) =>
        adj.items?.some((it) => it.product_id === productId || it.product_code === productCode)
      );
      setPendingAdjustments(relevant);
    } catch (pendErr) {
      console.warn('Could not load pending adjustments for stock card:', pendErr);
    }
  }, [token, isOpen, productId, productCode, warehouseId]);

  const handleQuickApprovePending = async (adj: StockAdjustmentResponse) => {
    setApprovingAdjId(adj.id);
    try {
      await approveStockAdjustmentApi(token, adj.id, 'Phê duyệt trực tiếp từ màn hình Thẻ kho');
      setActionSuccessMsg(`Đã phê duyệt thành công phiếu ${adj.code}. Tồn kho và Thẻ kho đã được cập nhật!`);
      setTimeout(() => setActionSuccessMsg(null), 5000);
      await fetchLedgers();
    } catch (apprErr: any) {
      setError(apprErr?.message || 'Không thể phê duyệt phiếu điều chỉnh.');
    } finally {
      setApprovingAdjId(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLedgers();
    }
  }, [isOpen, fetchLedgers]);

  if (!isOpen) return null;

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('vi-VN');
  };

  const formatDate = (isoStr: string | undefined | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  // Lọc theo loại giao dịch nếu cần
  const filteredLedgers = ledgers.filter((item) => {
    if (filterType === 'all') return true;
    if (filterType === 'IMPORT') return item.transaction_type === 'IMPORT' || item.transaction_type === 'RECEIPT' || item.quantity > 0;
    if (filterType === 'EXPORT') return (item.transaction_type === 'EXPORT' || item.transaction_type === 'ISSUE' || item.transaction_type === 'SALE') && item.quantity < 0;
    if (filterType === 'ADJUST') return item.transaction_type === 'ADJUST' || item.reference_code?.startsWith('ADJ-');
    return true;
  });

  // Tính tổng biến động
  const totalImport = ledgers
    .filter((l) => l.quantity > 0)
    .reduce((sum, l) => sum + l.quantity, 0);

  const totalExport = ledgers
    .filter((l) => (l.transaction_type === 'EXPORT' || l.transaction_type === 'ISSUE' || l.transaction_type === 'SALE') && l.quantity < 0)
    .reduce((sum, l) => sum + Math.abs(l.quantity), 0);

  const totalAdjustmentLoss = ledgers
    .filter((l) => l.transaction_type === 'ADJUST' || l.reference_code?.startsWith('ADJ-'))
    .reduce((sum, l) => sum + Math.abs(l.quantity), 0);

  const currentBalance = ledgers.length > 0 ? ledgers[0].new_stock : 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: '1080px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#0f172a',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(37, 99, 235, 0.2)',
                border: '1px solid #3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                <line x1="9" y1="7" x2="15" y2="7" />
                <line x1="9" y1="11" x2="15" y2="11" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '-0.01em', color: '#ffffff' }}>
                  THẺ KHO CHI TIẾT
                </h2>
                <span
                  style={{
                    backgroundColor: '#1e293b',
                    color: '#93c5fd',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: '1px solid #334155',
                  }}
                >
                  {productCode}
                </span>
                {warehouseName && (
                  <span
                    style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '600',
                    }}
                  >
                    {warehouseName}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13px', color: '#cbd5e1', marginTop: '2px' }}>
                {productName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '22px',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Thẻ KPI thống kê nhanh Thẻ kho */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'grid',
            gridTemplateColumns: isWarehousePersonnel
              ? 'repeat(4, 1fr)'
              : 'repeat(3, 1fr)',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {/* KPI 1: Tổng nhập */}
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Tổng nhập ghi nhận</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#16a34a', marginTop: '2px' }}>
              +{formatNumber(totalImport)}
            </div>
          </div>

          {/* KPI 2: Tổng xuất bán/chuyển */}
          <div
            style={{
              backgroundColor: '#ffffff',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b' }}>Tổng xuất giao hàng</div>
            <div style={{ fontSize: '18px', fontWeight: '800', color: '#ea580c', marginTop: '2px' }}>
              -{formatNumber(totalExport)}
            </div>
          </div>

          {/* KPI 3: Điều chỉnh tổn thất (Hiển thị cho toàn bộ nhân sự quản lý & thủ kho) */}
          {isWarehousePersonnel && (
            <div
              style={{
                backgroundColor: '#fff7ed',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #fed7aa',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#c2410c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Điều chỉnh tổn thất (Hỏng/Mất)
              </div>
              <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626', marginTop: '2px' }}>
                -{formatNumber(totalAdjustmentLoss)}
              </div>
            </div>
          )}

          {/* KPI 4: Tồn cuối hiện tại */}
          <div
            style={{
              backgroundColor: '#eff6ff',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#1d4ed8' }}>Tồn sổ sách hiện tại</div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#2563eb', marginTop: '2px' }}>
              {formatNumber(currentBalance)}
            </div>
          </div>
        </div>

        {/* Thanh công cụ lọc loại giao dịch & Làm mới */}
        <div
          style={{
            padding: '10px 24px',
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#475569' }}>Lọc giao dịch:</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'IMPORT', label: 'Nhập kho' },
                { key: 'EXPORT', label: 'Xuất kho' },
                ...(isWarehousePersonnel ? [{ key: 'ADJUST', label: 'Phiếu điều chỉnh tổn thất' }] : []),
              ].map((btn) => (
                <button
                  key={btn.key}
                  type="button"
                  onClick={() => setFilterType(btn.key)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: filterType === btn.key ? '#2563eb' : '#cbd5e1',
                    backgroundColor: filterType === btn.key ? '#eff6ff' : '#ffffff',
                    color: filterType === btn.key ? '#1d4ed8' : '#475569',
                    fontSize: '12px',
                    fontWeight: filterType === btn.key ? '700' : '500',
                    cursor: 'pointer',
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={fetchLedgers}
              disabled={isLoading}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                fontSize: '12px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              {isLoading ? 'Đang tải...' : 'Tải lại'}
            </button>
          </div>
        </div>

        {/* Nội dung bảng Thẻ kho */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 24px' }}>
          {/* Thông báo thao tác thành công */}
          {actionSuccessMsg && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                color: '#15803d',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {actionSuccessMsg}
            </div>
          )}

          {/* Cảnh báo phiếu điều chỉnh đang ở trạng thái Chờ duyệt (kèm nút duyệt ngay) */}
          {pendingAdjustments.length > 0 && (
            <div
              style={{
                padding: '12px 16px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '8px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#fef3c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#b45309',
                    flexShrink: 0,
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                    Có {pendingAdjustments.length} phiếu điều chỉnh tồn kho đang ở trạng thái Chờ duyệt
                  </div>
                  <div style={{ fontSize: '12px', color: '#b45309', marginTop: '2px' }}>
                    Mã phiếu: <strong>{pendingAdjustments.map((p) => p.code).join(', ')}</strong> — Phiếu này chưa trừ tồn kho chính thức và chưa ghi Thẻ kho cho đến khi được duyệt.
                  </div>
                </div>
              </div>

              {isManagerOrAdmin && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  {pendingAdjustments.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleQuickApprovePending(p)}
                      disabled={approvingAdjId === p.id}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: approvingAdjId === p.id ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                      title={`Phê duyệt ngay phiếu ${p.code} để cập nhật vào Thẻ kho`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {approvingAdjId === p.id ? 'Đang duyệt...' : `Duyệt ${p.code}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#b91c1c',
                fontSize: '13px',
                marginBottom: '12px',
              }}
            >
              {error}
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang tải dữ liệu thẻ kho...</div>
            </div>
          ) : filteredLedgers.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                Chưa có giao dịch biến động kho nào
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                Các giao dịch nhập, xuất hoặc điều chỉnh tồn kho được duyệt sẽ được ghi tự động vào Thẻ kho này.
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#334155', width: '130px' }}>Ngày giờ</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#334155', width: '120px' }}>Số chứng từ</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#334155', width: '150px' }}>Loại giao dịch</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#334155', width: '100px', textAlign: 'right' }}>Biến động</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#334155', width: '100px', textAlign: 'right' }}>Tồn trước</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#334155', width: '100px', textAlign: 'right' }}>Tồn sau</th>
                    <th style={{ padding: '10px 12px', fontWeight: '700', color: '#334155', minWidth: '220px' }}>Diễn giải / Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLedgers.map((item, index) => {
                    const isAdjustment =
                      item.transaction_type === 'ADJUST' ||
                      item.reference_code?.startsWith('ADJ-');
                    const isImport = item.quantity > 0;
                    const isExport = item.quantity < 0 && !isAdjustment;

                    return (
                      <tr
                        key={item.id || index}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isAdjustment
                            ? '#fff7ed' // Highlight nhẹ dòng điều chỉnh tồn kho cho Quản lý & Admin dễ nhận biết
                            : index % 2 === 0
                            ? '#ffffff'
                            : '#fafafa',
                        }}
                      >
                        {/* Ngày giờ */}
                        <td style={{ padding: '10px 12px', color: '#475569', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {formatDate(item.created_at)}
                        </td>

                        {/* Số chứng từ */}
                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#1e293b' }}>
                          <span
                            style={{
                              backgroundColor: isAdjustment ? '#fed7aa' : '#e2e8f0',
                              color: isAdjustment ? '#9a3412' : '#334155',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontFamily: 'monospace',
                            }}
                          >
                            {item.reference_code || '—'}
                          </span>
                        </td>

                        {/* Loại giao dịch */}
                        <td style={{ padding: '10px 12px' }}>
                          {isAdjustment ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                              }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                              </svg>
                              Điều chỉnh tổn thất
                            </span>
                          ) : isImport ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: '#dcfce7',
                                color: '#15803d',
                              }}
                            >
                              Nhập kho
                            </span>
                          ) : isExport ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                backgroundColor: '#ffedd5',
                                color: '#c2410c',
                              }}
                            >
                              Xuất kho
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                backgroundColor: '#f1f5f9',
                                color: '#475569',
                              }}
                            >
                              {item.transaction_type}
                            </span>
                          )}
                        </td>

                        {/* Biến động (+/-) */}
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            fontWeight: '800',
                            fontVariantNumeric: 'tabular-nums',
                            color: isAdjustment
                              ? '#dc2626'
                              : item.quantity > 0
                              ? '#16a34a'
                              : '#ea580c',
                          }}
                        >
                          {item.quantity > 0 ? `+${formatNumber(item.quantity)}` : formatNumber(item.quantity)}
                        </td>

                        {/* Tồn trước */}
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            color: '#64748b',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatNumber(item.previous_stock)}
                        </td>

                        {/* Tồn sau */}
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            fontWeight: '700',
                            color: '#0f172a',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatNumber(item.new_stock)}
                        </td>

                        {/* Diễn giải / Ghi chú */}
                        <td style={{ padding: '10px 12px', color: '#334155', fontSize: '12.5px' }}>
                          <div>{item.note || '—'}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Modal */}
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {isManagerOrAdmin ? (
              <span style={{ color: '#15803d', fontWeight: '600' }}>
                ✓ Bạn đang đăng nhập với quyền Quản lý/Admin: Hiển thị đầy đủ mọi phiếu điều chỉnh tổn thất trên thẻ kho.
              </span>
            ) : (
              <span style={{ color: '#64748b' }}>
                • Dữ liệu Thẻ kho theo tiêu chuẩn kế toán kho nội bộ.
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              backgroundColor: '#334155',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Đóng thẻ kho
          </button>
        </div>
      </div>
    </div>
  );
};
