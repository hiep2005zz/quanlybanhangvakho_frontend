import React, { useState, useEffect, useCallback } from 'react';
import {
  getStockCardApi,
  StockCardResponse,
  StockCardFilterParams,
  StockCardVoucherInfo,
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
  productId,
  productName: initialProductName,
  productCode: initialProductCode,
  token,
  onBack,
  onNavigateToTab,
}) => {
  const [data, setData] = useState<StockCardResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc theo kho và khoảng thời gian (Tiêu chí 3)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [activeVoucher, setActiveVoucher] = useState<{ code: string; type: string; url?: string | null } | null>(null);

  const fetchStockCard = useCallback(async () => {
    if (!productId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params: StockCardFilterParams = {
        product_id: productId,
        warehouse_id: selectedWarehouse !== 'all' ? selectedWarehouse : undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      };
      const res = await getStockCardApi(token, params);
      setData(res);
    } catch (err: any) {
      console.error('Lỗi khi tải thẻ kho:', err);
      setError(err?.message || 'Không thể tải dữ liệu thẻ kho sản phẩm.');
    } finally {
      setIsLoading(false);
    }
  }, [productId, selectedWarehouse, fromDate, toDate, token]);

  useEffect(() => {
    if (productId) {
      fetchStockCard();
    }
  }, [productId, fetchStockCard]);

  const summary = data?.summary;
  const entries = data?.entries || [];
  const warehouses = data?.warehouses || [];

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

  // Huy hiệu loại phát sinh (Đồng bộ không dùng icon, dùng badge màu trang nhã)
  const renderTransactionTypeBadge = (type: string, label: string) => {
    switch (type) {
      case 'RECEIPT':
        return (
          <span
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: '9999px',
              fontSize: '12px',
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
              fontSize: '12px',
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
              fontSize: '12px',
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
              fontSize: '12px',
              fontWeight: '600',
              backgroundColor: '#f3e8ff',
              color: '#7e22ce',
              border: '1px solid #e9d5ff',
              whiteSpace: 'nowrap',
            }}
          >
            {label || 'Điều chỉnh / Kiểm kê'}
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

  const displayProductName = summary?.product_name || initialProductName || `Sản phẩm #${productId}`;
  const displayProductCode = summary?.product_code || initialProductCode || '';

  return (
    <div
      style={{
        padding: '20px 28px',
        backgroundColor: '#f8fafc',
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        boxSizing: 'border-box',
      }}
    >
      {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG: NÚT QUAY LẠI VÀ TIÊU ĐỀ TRANG */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          backgroundColor: '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            ← Quay lại
          </button>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '20px',
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
                    borderRadius: '6px',
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  SKU: {displayProductCode}
                </span>
              )}
              {summary?.base_unit && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  ĐVT: {summary.base_unit}
                </span>
              )}
              {summary?.category && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    backgroundColor: '#ffffff',
                    color: '#64748b',
                    fontSize: '12px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {summary.category}
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: '12.5px',
                color: '#64748b',
                margin: '3px 0 0 0',
              }}
            >
              Nhật ký truy nguyên toàn bộ phát sinh nhập, xuất, chuyển kho và điều chỉnh để xác định chính xác số tồn bị lệch.
            </p>
          </div>
        </div>
      </div>

      {/* 5 THẺ THỐNG KÊ (ĐỒNG BỘ NỀN TRẮNG HOÀN TOÀN, XÓA HẾT HÌNH ICON) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        {/* 1. TỒN ĐẦU KỲ */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Tồn đầu kỳ
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b' }}>
            {formatNumber(summary?.opening_stock)}
          </div>
        </div>

        {/* 2. TỔNG NHẬP TRONG KỲ */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Tổng nhập trong kỳ
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#15803d' }}>
            +{formatNumber(summary?.total_receipt)}
          </div>
        </div>

        {/* 3. TỔNG XUẤT TRONG KỲ */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Tổng xuất trong kỳ
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#b91c1c' }}>
            -{formatNumber(summary?.total_issue)}
          </div>
        </div>

        {/* 4. TỒN CUỐI KỲ */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Tồn cuối kỳ
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8' }}>
            {formatNumber(summary?.closing_stock)}
          </div>
        </div>

        {/* 5. TỒN THỰC TẾ HIỆN TẠI TRÊN HỆ THỐNG */}
        <div
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>
            Tồn thực tế hiện tại
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
            {formatNumber(summary?.current_actual_stock)}
          </div>
        </div>
      </div>

      {/* THANH BỘ LỌC THEO KHO VÀ KHOẢNG THỜI GIAN (TIÊU CHÍ 3) */}
      <div
        style={{
          padding: '14px 20px',
          borderRadius: '12px',
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Lọc theo kho */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
              Kho hàng:
            </label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              style={{
                height: '36px',
                padding: '0 12px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                fontWeight: '500',
                outline: 'none',
                cursor: 'pointer',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
              Từ ngày:
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                height: '36px',
                padding: '0 10px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                outline: 'none',
              }}
            />
          </div>

          {/* Lọc khoảng thời gian: Đến ngày */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>
              Đến ngày:
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                height: '36px',
                padding: '0 10px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#1e293b',
                outline: 'none',
              }}
            />
          </div>

          {/* Nút Xóa lọc */}
          {(selectedWarehouse !== 'all' || fromDate || toDate) && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                height: '36px',
                padding: '0 14px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
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

        <div style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
          Tìm thấy <strong style={{ color: '#0f172a' }}>{entries.length}</strong> phát sinh trong kỳ
        </div>
      </div>

      {/* THÔNG BÁO LỖI NẾU CÓ */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: '13.5px',
          }}
        >
          {error}
        </div>
      )}

      {/* BẢNG DỮ LIỆU THẺ KHO CHI TIẾT (TIÊU CHÍ 1 & TIÊU CHÍ 2) */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead
              style={{
                backgroundColor: '#f8fafc',
                borderBottom: '2px solid #e2e8f0',
              }}
            >
              <tr>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', width: '50px', textAlign: 'center' }}>
                  #
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', width: '150px', whiteSpace: 'nowrap' }}>
                  Thời gian
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', width: '150px' }}>
                  Loại nghiệp vụ
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', width: '160px' }}>
                  Chứng từ gốc
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', width: '160px' }}>
                  Kho hàng
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#15803d', textAlign: 'right', width: '100px' }}>
                  Nhập (+)
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#b91c1c', textAlign: 'right', width: '100px' }}>
                  Xuất (-)
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    fontWeight: '800',
                    color: '#1d4ed8',
                    textAlign: 'right',
                    width: '130px',
                    backgroundColor: '#eff6ff',
                    borderLeft: '1px solid #dbeafe',
                    borderRight: '1px solid #dbeafe',
                  }}
                >
                  Tồn sau phát sinh
                </th>
                <th style={{ padding: '12px 14px', fontWeight: '700', color: '#475569', width: '130px' }}>
                  Người thực hiện
                </th>
                <th style={{ padding: '12px 16px', fontWeight: '700', color: '#475569', minWidth: '200px' }}>
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
                entries.map((entry, idx) => {
                  const isReceipt = entry.quantity > 0;
                  const isIssue = entry.quantity < 0;

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
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                        {idx + 1}
                      </td>

                      {/* Thời gian */}
                      <td style={{ padding: '12px 14px', color: '#334155', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {formatDateTime(entry.created_at)}
                      </td>

                      {/* Loại nghiệp vụ (Không có icon) */}
                      <td style={{ padding: '12px 14px' }}>
                        {renderTransactionTypeBadge(entry.transaction_type, entry.transaction_label)}
                      </td>

                      {/* Liên kết chứng từ gốc (Không có icon, dạng link bấm) */}
                      <td style={{ padding: '12px 14px' }}>
                        <button
                          type="button"
                          onClick={() => handleVoucherClick(entry.voucher_info, entry.reference_code)}
                          title={`Bấm để truy nguyên chứng từ gốc ${entry.reference_code}`}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            color: '#0284c7',
                            fontWeight: '700',
                            fontSize: '12.5px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f1f5f9';
                            e.currentTarget.style.borderColor = '#94a3b8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#ffffff';
                            e.currentTarget.style.borderColor = '#cbd5e1';
                          }}
                        >
                          {entry.reference_code}
                        </button>
                      </td>

                      {/* Kho hàng */}
                      <td style={{ padding: '12px 14px', color: '#475569' }}>
                        <div style={{ fontWeight: '600' }}>{entry.warehouse_name}</div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>{entry.warehouse_id}</div>
                      </td>

                      {/* Số lượng nhập (+) */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          fontWeight: '700',
                          color: isReceipt ? '#15803d' : '#94a3b8',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {isReceipt ? `+${formatNumber(entry.receipt_quantity || entry.quantity)}` : '—'}
                      </td>

                      {/* Số lượng xuất (-) */}
                      <td
                        style={{
                          padding: '12px 14px',
                          textAlign: 'right',
                          fontWeight: '700',
                          color: isIssue ? '#b91c1c' : '#94a3b8',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {isIssue ? `-${formatNumber(entry.issue_quantity || Math.abs(entry.quantity))}` : '—'}
                      </td>

                      {/* TỒN SAU PHÁT SINH (TIÊU CHÍ 2 - NỔI BẬT) */}
                      <td
                        style={{
                          padding: '12px 16px',
                          textAlign: 'right',
                          fontWeight: '800',
                          fontSize: '14px',
                          color: '#1d4ed8',
                          backgroundColor: '#eff6ff',
                          borderLeft: '1px solid #dbeafe',
                          borderRight: '1px solid #dbeafe',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatNumber(entry.balance_stock)}
                      </td>

                      {/* Người thực hiện */}
                      <td style={{ padding: '12px 14px', color: '#475569', fontSize: '12.5px' }}>
                        {entry.performed_by || '—'}
                      </td>

                      {/* Diễn giải / Ghi chú */}
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12.5px', lineHeight: 1.4 }}>
                        {entry.note || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POPUP CHI TIẾT CHỨNG TỪ GỐC */}
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
