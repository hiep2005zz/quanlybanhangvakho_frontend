import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  AuditLogItem,
  AuditLogListResponse,
  getAuditLogsApi,
  getUsersApi,
  UserAccount,
  User,
} from '../services/api';
import { AuditDetailModal, getActionLabel, getEntityLabel, formatEntityIdDisplay } from './AuditDetailModal';
import { formatLocalDateTime } from '../utils/dateUtils';

interface AuditLogViewProps {
  currentUser: User;
  token: string;
  onBackToHome?: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUser: _currentUser, token, onBackToHome }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter Form Inputs (Người dùng đang chọn/gõ trên form)
  const [selectedUserId, setSelectedUserId] = useState<string>('ALL');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('ALL');
  const [entityIdSearch, setEntityIdSearch] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Applied Filters State (Chỉ cập nhật khi bấm 'Lọc' hoặc 'Đặt lại' hoặc Debounce sau 400ms)
  const [appliedFilters, setAppliedFilters] = useState<{
    user_id: string;
    entity_type: string;
    entity_id: string;
    from_date: string;
    to_date: string;
  }>({
    user_id: 'ALL',
    entity_type: 'ALL',
    entity_id: '',
    from_date: '',
    to_date: '',
  });

  // Users list for dropdown filter
  const [usersList, setUsersList] = useState<UserAccount[]>([]);
  const [selectedDetailLog, setSelectedDetailLog] = useState<AuditLogItem | null>(null);

  // Load users list
  useEffect(() => {
    getUsersApi(token)
      .then((data) => {
        setUsersList(data.users);
      })
      .catch((err) => {
        console.error('Failed to load users for filter:', err);
      });
  }, [token]);

  // Ref để lưu debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch audit logs theo appliedFilters
  const executeFetchLogs = useCallback(
    (currentPage: number, filtersToUse = appliedFilters) => {
      setLoading(true);
      setError(null);

      getAuditLogsApi(token, {
        user_id: filtersToUse.user_id !== 'ALL' ? Number(filtersToUse.user_id) : null,
        entity_type: filtersToUse.entity_type !== 'ALL' ? filtersToUse.entity_type : undefined,
        entity_id: filtersToUse.entity_id.trim() || undefined,
        from_date: filtersToUse.from_date || undefined,
        to_date: filtersToUse.to_date || undefined,
        page: currentPage,
        page_size: pageSize,
      })
        .then((res: AuditLogListResponse) => {
          setLogs(res.items);
          setTotal(res.total);
          setPage(res.page);
          setTotalPages(res.total_pages);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Lỗi khi tải nhật ký thao tác.');
          setLoading(false);
        });
    },
    [token, appliedFilters, pageSize]
  );

  useEffect(() => {
    executeFetchLogs(page, appliedFilters);
  }, [appliedFilters, page]);

  // Áp dụng Debounce 400ms: Tự động gom các thao tác gõ mã đối tượng hoặc đổi dropdown sau 400ms mới gọi API 1 lần duy nhất
  useEffect(() => {
    if (
      selectedUserId === appliedFilters.user_id &&
      selectedEntityType === appliedFilters.entity_type &&
      entityIdSearch === appliedFilters.entity_id &&
      fromDate === appliedFilters.from_date &&
      toDate === appliedFilters.to_date
    ) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setAppliedFilters({
        user_id: selectedUserId,
        entity_type: selectedEntityType,
        entity_id: entityIdSearch,
        from_date: fromDate,
        to_date: toDate,
      });
      setPage(1);
    }, 400);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [selectedUserId, selectedEntityType, entityIdSearch, fromDate, toDate, appliedFilters]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const newFilters = {
      user_id: selectedUserId,
      entity_type: selectedEntityType,
      entity_id: entityIdSearch,
      from_date: fromDate,
      to_date: toDate,
    };
    setAppliedFilters(newFilters);
    setPage(1);
    executeFetchLogs(1, newFilters);
  };


  const renderActionBadge = (actionType: string) => {
    let color = '#2563eb';
    let bg = '#eff6ff';
    const text = getActionLabel(actionType);

    switch (actionType) {
      case 'INVENTORY_ADJUST':
        color = '#0284c7';
        bg = '#e0f2fe';
        break;
      case 'PRICE_CHANGE':
        color = '#d97706';
        bg = '#fef3c7';
        break;
      case 'DEBT_LIMIT_CHANGE':
        color = '#7c3aed';
        bg = '#f5f3ff';
        break;
      case 'INVOICE_EDIT':
      case 'INVOICE_CANCEL':
        color = '#dc2626';
        bg = '#fef2f2';
        break;
      case 'STOCK_RECEIPT':
      case 'PRODUCT_BULK_IMPORT':
      case 'USER_BULK_IMPORT':
        color = '#059669';
        bg = '#ecfdf5';
        break;
      case 'STOCK_ISSUE':
        color = '#ea580c';
        bg = '#fff7ed';
        break;
      case 'USER_CREATE':
      case 'USER_UNLOCK':
        color = '#16a34a';
        bg = '#f0fdf4';
        break;
      case 'USER_LOCK':
      case 'USER_DELETE':
        color = '#e11d48';
        bg = '#fff1f2';
        break;
      default:
        break;
    }

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11.5px',
        fontWeight: '700',
        color: color,
        background: bg,
        border: `1px solid ${color}30`,
        whiteSpace: 'nowrap',
      }}>
        {text}
      </span>
    );
  };

  const renderEntityBadge = (entityType: string, entityId: string) => {
    const label = getEntityLabel(entityType);
    const displayId = formatEntityIdDisplay(entityId);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
          {label}
        </span>
        <strong style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          color: '#0f172a',
          fontSize: '12.5px',
        }}>
          {displayId}
        </strong>
      </div>
    );
  };

  const formatSummaryDiff = (log: AuditLogItem) => {
    try {
      const oldObj = log.old_values ? JSON.parse(log.old_values) : null;
      const newObj = log.new_values ? JSON.parse(log.new_values) : null;

      if (log.action_type === 'PRODUCT_BULK_IMPORT' || log.action_type === 'USER_BULK_IMPORT') {
        const parts: string[] = [];
        if (newObj?.created_count !== undefined) parts.push(`Tạo mới: ${newObj.created_count}`);
        if (newObj?.updated_count !== undefined) parts.push(`Cập nhật: ${newObj.updated_count}`);
        if (newObj?.failed_count !== undefined && newObj.failed_count > 0) parts.push(`Lỗi: ${newObj.failed_count}`);
        if (parts.length > 0) {
          return parts.join(' | ');
        }
      }

      if (log.action_type === 'INVENTORY_ADJUST') {
        const oldStock = oldObj?.stock;
        const newStock = newObj?.stock;
        if (typeof oldStock === 'number' && typeof newStock === 'number') {
          const delta = newStock - oldStock;
          const deltaStr = delta > 0 ? ` (+${delta})` : delta < 0 ? ` (${delta})` : '';
          return `Tồn kho: ${oldStock} ➔ ${newStock}${deltaStr}`;
        }
        return `Tồn kho: ${oldStock ?? '—'} ➔ ${newStock ?? '—'}`;
      }
      if (log.action_type === 'PRICE_CHANGE') {
        const parts: string[] = [];
        if (newObj?.sell_price !== undefined) {
          const oldPrice = oldObj?.sell_price !== undefined ? `${Number(oldObj.sell_price).toLocaleString('vi-VN')} đ` : '—';
          const newPrice = `${Number(newObj.sell_price).toLocaleString('vi-VN')} đ`;
          parts.push(`Giá bán: ${oldPrice} ➔ ${newPrice}`);
        }
        if (newObj?.cost_price !== undefined) {
          const oldCost = oldObj?.cost_price !== undefined ? `${Number(oldObj.cost_price).toLocaleString('vi-VN')} đ` : '—';
          const newCost = `${Number(newObj.cost_price).toLocaleString('vi-VN')} đ`;
          parts.push(`Giá vốn: ${oldCost} ➔ ${newCost}`);
        }
        return parts.join(' | ') || 'Cập nhật giá';
      }
      if (log.action_type === 'DEBT_LIMIT_CHANGE') {
        const oldLimit = oldObj?.credit_limit !== undefined ? `${Number(oldObj.credit_limit).toLocaleString('vi-VN')} đ` : '—';
        const newLimit = newObj?.credit_limit !== undefined ? `${Number(newObj.credit_limit).toLocaleString('vi-VN')} đ` : '—';
        return `Hạn mức: ${oldLimit} ➔ ${newLimit}`;
      }
      if (log.action_type === 'INVOICE_EDIT') {
        const rawStatus = newObj?.status;
        const statusMap: Record<string, string> = {
          'CANCELLED': 'Đã hủy',
          'PAID': 'Đã thanh toán',
          'PENDING': 'Chờ xử lý',
          'COMPLETED': 'Hoàn thành',
          'PROCESSING': 'Đang xử lý',
          'DRAFT': 'Bản nháp',
          'CONFIRMED': 'Đã xác nhận',
          'SHIPPED': 'Đã giao hàng',
          'DELIVERED': 'Đã nhận',
          'RETURNED': 'Đã hoàn trả',
        };
        const statusVi = (rawStatus && statusMap[rawStatus.toUpperCase()]) ? statusMap[rawStatus.toUpperCase()] : (rawStatus || 'Đã cập nhật');
        return `Trạng thái: ${statusVi}`;
      }
      if (log.action_type === 'INVOICE_CANCEL') {
        return 'Đã hủy hóa đơn';
      }
    } catch {
      // fallback
    }
    return log.reason || '—';
  };

  return (
    <main style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          color: '#64748b',
          fontWeight: '500',
          marginBottom: '20px',
          padding: '2px 4px',
        }}
      >
        <button
          onClick={onBackToHome}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            color: '#2563eb',
            cursor: 'pointer',
            padding: '5px 14px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.background = '#eff6ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.background = '#ffffff';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Trang chủ</span>
        </button>
        <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>
        <span style={{ color: '#64748b', fontSize: '13.5px' }}>Quản trị hệ thống</span>
        <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>Nhật ký thao tác</span>
      </nav>

      {/* Header Title Banner */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.02em' }}>
              Nhật Ký Thao Tác Hệ Thống
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '6px 14px',
            borderRadius: '999px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            fontSize: '13px',
            fontWeight: '600',
            color: '#334155',
          }}>
            Tổng bản ghi: <strong style={{ color: '#2563eb' }}>{total.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px 24px',
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <form onSubmit={handleApplyFilter} style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          alignItems: 'flex-end',
        }}>
          {/* Người thực hiện */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Người thực hiện:
            </label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                background: '#ffffff',
                color: '#1e293b',
              }}
            >
              <option value="ALL">Tất cả người dùng</option>
              {usersList.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.full_name} ({u.username})
                </option>
              ))}
            </select>
          </div>

          {/* Loại nghiệp vụ */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Loại nghiệp vụ:
            </label>
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                background: '#ffffff',
                color: '#1e293b',
              }}
            >
              <option value="ALL">Tất cả nghiệp vụ</option>
              <option value="Inventory">Tồn kho (Kiểm kê, nhập/xuất kho)</option>
              <option value="ProductPrice">Giá sản phẩm (Giá bán, giá vốn)</option>
              <option value="CustomerDebt">Hạn mức công nợ (Hạn mức nợ đại lý)</option>
              <option value="Invoice">Hóa đơn (Sửa đổi, hủy hóa đơn)</option>
              <option value="Order">Đơn hàng (Sửa đơn, duyệt ngoại lệ)</option>
            </select>
          </div>

          {/* Tìm theo Mã đối tượng */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Mã đối tượng:
            </label>
            <input
              type="text"
              placeholder="VD: SP001, DL001, ORD..."
              value={entityIdSearch}
              onChange={(e) => setEntityIdSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                color: '#1e293b',
              }}
            />
          </div>

          {/* Từ ngày */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Từ ngày:
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                color: '#1e293b',
              }}
            />
          </div>

          {/* Đến ngày */}
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '6px' }}>
              Đến ngày:
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                color: '#1e293b',
              }}
            />
          </div>

          {/* Action buttons */}
          <div>
            <button
              type="submit"
              style={{
                width: '100%',
                padding: '10px 16px',
                borderRadius: '8px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#2563eb';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Lọc</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Data Table */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Đang nạp nhật ký kiểm toán từ hệ thống...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#dc2626' }}>
            <p style={{ margin: 0, fontWeight: '500' }}>{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📑</div>
            <h4 style={{ margin: '0 0 4px', color: '#334155', fontSize: '16px' }}>Không có bản ghi nhật ký nào</h4>
            <p style={{ margin: 0, fontSize: '13.5px' }}>Thử nới lỏng bộ lọc hoặc tìm kiếm theo mã khác.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{
                  color: '#64748b',
                  background: '#f8fafc',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  borderBottom: '1px solid #e2e8f0',
                }}>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: '600' }}>Thời gian</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: '600' }}>Người thực hiện</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: '600' }}>Thao tác</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: '600' }}>Đối tượng</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: '600' }}>Tóm tắt thay đổi</th>
                  <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: '600' }}>Ghi chú / Lý do</th>
                  <th style={{ padding: '14px 18px', textAlign: 'center', fontWeight: '600' }}>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr
                    key={log.id}
                    style={{
                      background: idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    {/* Thời gian */}
                    <td style={{ padding: '14px 18px', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatLocalDateTime(log.created_at)}
                    </td>

                    {/* Người thực hiện */}
                    <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: '#eff6ff',
                          color: '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '12px',
                        }}>
                          {(log.user_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <strong style={{ color: '#0f172a', fontWeight: '600' }}>
                          {log.user_name || 'Hệ thống'}
                        </strong>
                      </div>
                    </td>

                    {/* Thao tác */}
                    <td style={{ padding: '14px 18px' }}>
                      {renderActionBadge(log.action_type)}
                    </td>

                    {/* Đối tượng */}
                    <td style={{ padding: '14px 18px' }}>
                      {renderEntityBadge(log.entity_type, log.entity_id)}
                    </td>

                    {/* Tóm tắt thay đổi */}
                    <td style={{ padding: '14px 18px', color: '#0f172a', fontWeight: '500' }}>
                      {formatSummaryDiff(log)}
                    </td>

                    {/* Ghi chú / Lý do */}
                    <td style={{ padding: '14px 18px', color: '#64748b', maxWidth: '240px' }}>
                      {log.reason ? (
                        <span title={log.reason} style={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          {log.reason}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    {/* Nút Xem chi tiết diff */}
                    <td style={{ padding: '14px 18px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setSelectedDetailLog(log)}
                        style={{
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#dbeafe';
                          e.currentTarget.style.borderColor = '#93c5fd';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#eff6ff';
                          e.currentTarget.style.borderColor = '#bfdbfe';
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Phân trang */}
        {totalPages > 1 && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Trang <strong style={{ color: '#0f172a' }}>{page}</strong> / <strong>{totalPages}</strong>
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: page <= 1 ? '#94a3b8' : '#334155',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                }}
              >
                ← Trang trước
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: page >= totalPages ? '#94a3b8' : '#334155',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                }}
              >
                Trang tiếp →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal chi tiết Diff Before/After */}
      <AuditDetailModal log={selectedDetailLog} onClose={() => setSelectedDetailLog(null)} />
    </main>
  );
};
