import React, { useState, useEffect, useCallback } from 'react';
import {
  ReturnOrderData,
  getReturnOrdersApi,
  confirmReturnReceiptApi,
  User,
} from '../services/api';
import { CreateReturnOrderPage } from './CreateReturnOrderPage';
import { ReturnOrderDetailModal } from './ReturnOrderDetailModal';
import { emitStatusToast } from './StatusToast';

interface ReturnOrdersManagementViewProps {
  currentUser: User;
  token: string;
  onBackToHome?: () => void;
}

export const ReturnOrdersManagementView: React.FC<ReturnOrdersManagementViewProps> = ({
  currentUser,
  token,
  onBackToHome,
}) => {
  const [returnOrders, setReturnOrders] = useState<ReturnOrderData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // View mode: 'list' | 'create'
  const isCreateUrl = typeof window !== 'undefined' && window.location.pathname.startsWith('/return-orders/create');
  const [viewMode, setViewMode] = useState<'list' | 'create'>(isCreateUrl ? 'create' : 'list');

  useEffect(() => {
    const handlePopState = () => {
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/return-orders/create')) {
        setViewMode('create');
      } else {
        setViewMode('list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // Selected order for detail modal
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<ReturnOrderData | null>(null);

  // Phân quyền
  const userRoles = currentUser.roles || [currentUser.role];
  const isWarehouseOrAdmin =
    userRoles.includes('admin') ||
    userRoles.includes('warehouse') ||
    userRoles.includes('warehouse_manager') ||
    Boolean(currentUser.can_write_inventory);

  const canCreateReturnOrder =
    userRoles.includes('admin') ||
    userRoles.includes('sales') ||
    userRoles.includes('sales_manager') ||
    isWarehouseOrAdmin;

  // Nạp danh sách phiếu trả hàng
  const fetchReturnOrders = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await getReturnOrdersApi(token, {
        status: statusFilter,
        search: searchTerm,
        page: currentPage,
        page_size: pageSize,
      });
      setReturnOrders(res.items || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tải danh sách phiếu trả hàng.');
    } finally {
      setIsLoading(false);
    }
  }, [token, statusFilter, searchTerm, currentPage]);

  useEffect(() => {
    fetchReturnOrders();
  }, [fetchReturnOrders]);

  // Xác nhận nhập kho trực tiếp từ bảng
  const handleQuickConfirm = async (ro: ReturnOrderData) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xác nhận nhận hàng và cộng tồn kho cho phiếu ${ro.code}?`)) {
      return;
    }
    try {
      const updated = await confirmReturnReceiptApi(token, ro.id);
      emitStatusToast({
        title: 'Nhập kho thành công',
        message: `Phiếu trả hàng ${updated.code} đã hoàn tất và đã cộng tồn kho!`,
      });
      fetchReturnOrders();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xác nhận nhận hàng.');
    }
  };

  // Tính thống kê nhanh KPI từ danh sách
  const pendingCount = returnOrders.filter((r) => r.status === 'PENDING_WAREHOUSE').length;
  const completedCount = returnOrders.filter((r) => r.status === 'COMPLETED').length;
  const totalRefundSum = returnOrders.reduce((sum, r) => sum + (r.total_refund_amount || 0), 0);

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  if (viewMode === 'create') {
    return (
      <CreateReturnOrderPage
        token={token}
        currentUser={currentUser}
        onBack={() => {
          setViewMode('list');
          try { window.history.pushState({}, '', '/return-orders'); } catch { }
        }}
        onSuccess={() => {
          setViewMode('list');
          try { window.history.pushState({}, '', '/return-orders'); } catch { }
          fetchReturnOrders();
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#f8fafc',
        overflow: 'hidden',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '16px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12.5px',
                color: '#475569',
              }}
              title="Quay lại danh sách hàng hóa"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              <span>Về Kho</span>
            </button>
          )}

          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
              Quản Lý Phiếu Trả Hàng & Nhập Lại Kho (RMA)
            </h1>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Quy trình 2 bước: Nhân viên kinh doanh lập phiếu &rarr; Thủ kho kiểm đếm và xác thực cộng tồn kho
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={fetchReturnOrders}
            disabled={isLoading}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Tải lại
          </button>

          {canCreateReturnOrder && (
            <button
              type="button"
              id="btn-create-return-order"
              onClick={() => {
                setViewMode('create');
                try { window.history.pushState({}, '', '/return-orders/create'); } catch { }
              }}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.25)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              + Lập Phiếu Trả Hàng
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          padding: '16px 24px 0 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Tổng phiếu */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
            Tổng số phiếu trả
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {totalCount}
          </div>
        </div>

        {/* Chờ kho xác nhận */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbeb, #ffffff)',
            border: '1.5px solid #fde68a',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
            Chờ kho xác nhận nhận hàng
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#b45309', fontVariantNumeric: 'tabular-nums' }}>
            {pendingCount} phiếu
          </div>
        </div>

        {/* Đã nhập kho */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4, #ffffff)',
            border: '1.5px solid #bbf7d0',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#166534', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            Đã nhập kho (Hoàn thành)
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#166534', fontVariantNumeric: 'tabular-nums' }}>
            {completedCount} phiếu
          </div>
        </div>

        {/* Tổng giá trị hoàn trả */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
            Tổng tiền hoàn trả
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
            {totalRefundSum.toLocaleString('vi-VN')} đ
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        style={{
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Status Filter Tabs */}
        <div
          style={{
            display: 'inline-flex',
            background: '#e2e8f0',
            padding: '3px',
            borderRadius: '8px',
            gap: '2px',
          }}
        >
          {[
            { key: 'ALL', label: 'Tất cả' },
            { key: 'PENDING_WAREHOUSE', label: 'Chờ kho xác nhận' },
            { key: 'COMPLETED', label: 'Đã nhập kho' },
            { key: 'CANCELLED', label: 'Đã hủy' },
          ].map((tab) => {
            const isActive = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.key);
                  setCurrentPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: isActive ? '700' : '500',
                  background: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            placeholder="Tìm mã phiếu, mã đơn, đại lý..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '8px 12px 8px 34px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              background: '#ffffff',
              outline: 'none',
            }}
          />
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ position: 'absolute', left: '10px', top: '10px' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* Main Table Area */}
      <div
        style={{
          flex: 1,
          padding: '0 24px',
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {errorMsg && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '14px',
            }}
          >
            {errorMsg}
          </div>
        )}

        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600' }}>
                <th style={{ padding: '12px 14px' }}>Mã phiếu</th>
                <th style={{ padding: '12px 14px' }}>Đơn hàng gốc</th>
                <th style={{ padding: '12px 14px' }}>Đại lý</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>SL Trả</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Tổng tiền hoàn</th>
                <th style={{ padding: '12px 14px' }}>Người lập / Ngày lập</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Trạng thái</th>
                <th style={{ padding: '12px 14px', textAlign: 'center', width: '180px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Đang nạp danh sách phiếu trả hàng...
                  </td>
                </tr>
              ) : returnOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '50px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Chưa có phiếu trả hàng nào
                    </div>
                    <div style={{ fontSize: '12.5px' }}>
                      Bấm vào nút "+ Lập Phiếu Trả Hàng" để bắt đầu tạo yêu cầu trả hàng từ đơn gốc.
                    </div>
                  </td>
                </tr>
              ) : (
                returnOrders.map((ro) => (
                  <tr
                    key={ro.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      transition: 'background 0.15s ease',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedOrderForDetail(ro)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    {/* Mã phiếu */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontWeight: '700', color: '#2563eb' }}>{ro.code}</span>
                    </td>

                    {/* Đơn hàng gốc */}
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontWeight: '600', color: '#0f172a' }}>{ro.order_code}</span>
                    </td>

                    {/* Đại lý */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>{ro.dealer_name}</div>
                    </td>

                    {/* SL Trả */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>{ro.total_quantity}</span>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>({ro.total_items} SP)</span>
                    </td>

                    {/* Tổng tiền hoàn */}
                    <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
                      {ro.total_refund_amount.toLocaleString('vi-VN')} đ
                    </td>

                    {/* Người lập */}
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ color: '#0f172a', fontWeight: '500' }}>{ro.created_by}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{ro.created_at}</div>
                    </td>

                    {/* Trạng thái */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {ro.status === 'PENDING_WAREHOUSE' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#fef3c7', color: '#b45309', fontWeight: '700', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span>
                          Chờ kho xác nhận
                        </span>
                      )}
                      {ro.status === 'COMPLETED' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#dcfce7', color: '#166534', fontWeight: '700', fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e' }}></span>
                          Đã nhập kho
                        </span>
                      )}
                      {ro.status === 'CANCELLED' && (
                        <span style={{ padding: '3px 10px', borderRadius: '12px', background: '#f1f5f9', color: '#64748b', fontWeight: '600', fontSize: '11.5px' }}>
                          Đã hủy
                        </span>
                      )}
                    </td>

                    {/* Thao tác */}
                    <td
                      style={{ padding: '12px 14px', textAlign: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedOrderForDetail(ro)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          title="Xem chi tiết phiếu trả hàng"
                        >
                          Chi tiết
                        </button>

                        {/* Nút Nhập kho nhanh cho Thủ kho / Quản lý kho (Quy tắc 4) */}
                        {ro.status === 'PENDING_WAREHOUSE' && isWarehouseOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleQuickConfirm(ro)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#16a34a',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                            title="Xác nhận nhận hàng & cộng tồn kho"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Nhập kho
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {totalCount > 0 && (
        <div
          style={{
            padding: '12px 24px',
            backgroundColor: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12.5px',
            color: '#64748b',
          }}
        >
          <div>
            Hiển thị <strong>{returnOrders.length}</strong> / <strong>{totalCount}</strong> phiếu trả hàng
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: currentPage <= 1 ? '#94a3b8' : '#334155',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
              }}
            >
              Trang trước
            </button>
            <span style={{ padding: '0 6px', fontWeight: '600', color: '#0f172a' }}>
              Trang {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: currentPage >= totalPages ? '#94a3b8' : '#334155',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: '12px',
              }}
            >
              Trang sau
            </button>
          </div>
        </div>
      )}


      {/* Modal Chi tiết & Xác nhận kho */}
      <ReturnOrderDetailModal
        isOpen={Boolean(selectedOrderForDetail)}
        order={selectedOrderForDetail}
        token={token}
        canConfirmWarehouse={isWarehouseOrAdmin}
        canCancel={canCreateReturnOrder}
        onClose={() => setSelectedOrderForDetail(null)}
        onSuccess={() => {
          fetchReturnOrders();
        }}
      />
    </div>
  );
};

export default ReturnOrdersManagementView;
