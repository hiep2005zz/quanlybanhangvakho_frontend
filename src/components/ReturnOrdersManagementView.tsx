import React, { useState, useEffect, useCallback } from 'react';
import {
  ReturnOrderData,
  getReturnOrdersApi,
  confirmReturnReceiptApi,
  User,
} from '../services/api';
import { CreateReturnOrderPage } from './CreateReturnOrderPage';
import { ReturnOrderDetailModal } from './ReturnOrderDetailModal';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';

interface ReturnOrdersManagementViewProps {
  currentUser: User;
  token: string;
  onBackToHome?: () => void;
}

export const ReturnOrdersManagementView: React.FC<ReturnOrdersManagementViewProps> = ({
  currentUser,
  token,
  onBackToHome: _onBackToHome,
}) => {
  const [returnOrders, setReturnOrders] = useState<ReturnOrderData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal xác nhận nhập kho trực tiếp trên giao diện web (không dùng window.confirm/alert hệ thống)
  const [confirmingOrder, setConfirmingOrder] = useState<ReturnOrderData | null>(null);
  const [isSubmittingConfirm, setIsSubmittingConfirm] = useState<boolean>(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

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
  const [pageSize] = useState<number>(10);

  // Selected order for detail modal
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<ReturnOrderData | null>(null);

  // 3-dot Action Dropdown Menu state
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-menu-dropdown-container')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Phân quyền
  const userRoles = currentUser.roles || [currentUser.role];
  const isWarehouseManagerOrAdmin =
    userRoles.includes('admin') ||
    userRoles.includes('warehouse_manager');

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
  }, [token, statusFilter, searchTerm, currentPage, pageSize]);

  useEffect(() => {
    fetchReturnOrders();
  }, [fetchReturnOrders]);

  // Mở popup xác nhận nhập kho trực tiếp trên trang web
  const handleQuickConfirm = (ro: ReturnOrderData) => {
    setConfirmingOrder(ro);
    setConfirmError(null);
  };

  // Thực hiện xác nhận nhận hàng và cập nhật tồn kho
  const handleExecuteQuickConfirm = async () => {
    if (!confirmingOrder) return;
    setIsSubmittingConfirm(true);
    setConfirmError(null);
    try {
      const updated = await confirmReturnReceiptApi(token, confirmingOrder.id);
      emitStatusToast({
        type: 'success',
        title: 'Nhập kho thành công',
        message: `Phiếu trả hàng ${updated.code} đã hoàn tất và đã cộng tồn kho!`,
      });
      setConfirmingOrder(null);
      fetchReturnOrders();
    } catch (err: any) {
      const msg = err.message || 'Lỗi khi xác nhận nhận hàng.';
      setConfirmError(msg);
      emitStatusToast({
        type: 'error',
        title: 'Lỗi xác nhận nhận hàng',
        message: msg,
      });
    } finally {
      setIsSubmittingConfirm(false);
    }
  };

  // Tính thống kê nhanh KPI từ danh sách
  const pendingCount = returnOrders.filter((r) => r.status === 'PENDING_WAREHOUSE').length;
  const completedCount = returnOrders.filter((r) => r.status === 'COMPLETED').length;
  const totalRefundSum = returnOrders.reduce((sum, r) => sum + (r.total_refund_amount || 0), 0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Danh sách các số trang theo phong cách segmented pill: 1, 2, ... totalPages
  const paginationItems = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : Array.from({ length: totalPages }, (_, index) => index + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
        .reduce<(number | string)[]>((acc, p, idx, arr) => {
          if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
            acc.push('...');
          }
          acc.push(p);
          return acc;
        }, []);

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
          padding: '12px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
          Quản Lý Phiếu Trả Hàng & Nhập Lại Kho
        </h1>
      </div>

      {/* KPI Cards Row */}
      <div
        style={{
          padding: '12px 24px 0 24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Tổng phiếu */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
            Tổng số phiếu trả
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
            {totalCount}
          </div>
        </div>

        {/* Chờ kho xác nhận */}
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbeb, #ffffff)',
            border: '1.5px solid #fde68a',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#b45309', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
            Chờ kho xác nhận nhận hàng
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#b45309', fontVariantNumeric: 'tabular-nums' }}>
            {pendingCount} phiếu
          </div>
        </div>

        {/* Đã nhập kho */}
        <div
          style={{
            background: 'linear-gradient(135deg, #f0fdf4, #ffffff)',
            border: '1.5px solid #bbf7d0',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#166534', fontWeight: '700', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
            Đã nhập kho (Hoàn thành)
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#166534', fontVariantNumeric: 'tabular-nums' }}>
            {completedCount} phiếu
          </div>
        </div>

        {/* Tổng giá trị hoàn trả */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600', marginBottom: '2px' }}>
            Tổng tiền hoàn trả
          </div>
          <div style={{ fontSize: '19px', fontWeight: '800', color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
            {totalRefundSum.toLocaleString('vi-VN')} đ
          </div>
        </div>
      </div>

      {/* Main Content Area: Toàn bộ phần ảnh 5 gom gọn trong cùng 1 trang/khung */}
      <div
        style={{
          flex: 1,
          padding: '12px 24px',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              marginBottom: '10px',
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
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            overflow: 'hidden',
          }}
        >
          {/* Thanh công cụ: Tìm kiếm lên trước -> Bộ lọc Tất cả/Chờ kho/Đã nhập/Đã hủy -> Nút Tải lại & + Lập phiếu ở bên phải */}
          <div
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            {/* Nhóm trái: Tìm kiếm lên trước chỗ Tất cả */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Search Input */}
              <div style={{ position: 'relative', width: '260px' }}>
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
                    padding: '7px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: '#ffffff',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Status Filter Tabs */}
              <div
                style={{
                  display: 'inline-flex',
                  background: '#f1f5f9',
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
                        padding: '5px 12px',
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
            </div>

            {/* Nhóm phải: Nút ảnh 3 (Tải lại, + Lập Phiếu Trả Hàng) xuống bên phải chỗ Đã hủy */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={fetchReturnOrders}
                disabled={isLoading}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
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
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #0fad89 0%, #0F8A5F 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(15, 138, 95, 0.25)',
                    transition: 'all 0.18s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #0c734f 0%, #065f46 100%)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #0fad89 0%, #0F8A5F 100%)';
                  }}
                >
                  + Lập Phiếu Trả Hàng
                </button>
              )}
            </div>
          </div>

          {/* Table Container */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '600', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px 14px' }}>Mã phiếu</th>
                  <th style={{ padding: '10px 14px' }}>Đơn hàng gốc</th>
                  <th style={{ padding: '10px 14px' }}>Đại lý</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>SL Trả</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Tổng tiền hoàn</th>
                  <th style={{ padding: '10px 14px' }}>Người lập / Ngày lập</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', width: '80px' }}>Thao tác</th>
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
                  returnOrders.map((ro, idx) => (
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
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: '700', color: '#0F8A5F' }}>{ro.code}</span>
                      </td>

                      {/* Đơn hàng gốc */}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: '600', color: '#0f172a' }}>{ro.order_code}</span>
                      </td>

                      {/* Đại lý */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>{ro.dealer_name}</div>
                      </td>

                      {/* SL Trả */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ fontWeight: '700', color: '#0f172a' }}>{ro.total_quantity}</span>
                        <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>({ro.total_items} SP)</span>
                      </td>

                      {/* Tổng tiền hoàn */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
                        {ro.total_refund_amount.toLocaleString('vi-VN')} đ
                      </td>

                      {/* Người lập */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ color: '#0f172a', fontWeight: '500' }}>{ro.created_by}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{ro.created_at}</div>
                      </td>

                      {/* Trạng thái */}
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
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

                      {/* Thao tác: Dấu 3 chấm */}
                      <td
                        style={{ padding: '8px 14px', textAlign: 'center', position: 'relative' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="action-menu-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId((prev) => (prev === ro.id ? null : ro.id));
                            }}
                            title="Thao tác"
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: openActionMenuId === ro.id ? '1px solid #0fad89' : '1px solid #e2e8f0',
                              background: openActionMenuId === ro.id ? '#f0fdf4' : '#ffffff',
                              color: openActionMenuId === ro.id ? '#0F8A5F' : '#64748b',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s ease',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            }}
                            onMouseEnter={(e) => {
                              if (openActionMenuId !== ro.id) {
                                e.currentTarget.style.background = '#f8fafc';
                                e.currentTarget.style.borderColor = '#cbd5e1';
                                e.currentTarget.style.color = '#0f172a';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (openActionMenuId !== ro.id) {
                                e.currentTarget.style.background = '#ffffff';
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.color = '#64748b';
                              }
                            }}
                          >
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', pointerEvents: 'none' }}>
                              <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                              <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                              <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                            </span>
                          </button>

                          {openActionMenuId === ro.id && (() => {
                            const openUpward = returnOrders.length > 2 && idx >= returnOrders.length - 2;
                            return (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  ...(openUpward
                                    ? { bottom: 'calc(100% + 4px)' }
                                    : { top: 'calc(100% + 4px)' }),
                                  background: '#ffffff',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.06)',
                                  minWidth: '150px',
                                  zIndex: 9999,
                                  padding: '6px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                }}
                              >
                                {isWarehouseManagerOrAdmin && ro.status === 'PENDING_WAREHOUSE' && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleQuickConfirm(ro);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '8px 12px',
                                      borderRadius: '6px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#16a34a',
                                      fontSize: '12.5px',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                      <polyline points="7 10 12 15 17 10" />
                                      <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    <span>Nhập kho</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    setSelectedOrderForDetail(ro);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'transparent',
                                    color: '#334155',
                                    fontSize: '12.5px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f8fafc';
                                    e.currentTarget.style.color = '#0f172a';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.color = '#334155';
                                  }}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>Chi tiết</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang dạng số: 1, 2, 3... đến hết */}
          {totalCount > 0 && (
            <div
              style={{
                padding: '10px 16px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                fontSize: '12.5px',
                color: '#64748b',
                background: '#ffffff',
              }}
            >
              <div className="inline-flex items-stretch border border-gray-300 rounded-[5px] overflow-hidden bg-white shadow-2xs divide-x divide-gray-200 h-7 text-xs">
                {/* Nút lùi trang (<) - Chỉ hiện khi currentPage > 1 */}
                {currentPage > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    title="Trang trước"
                    className="px-2.5 min-w-[28px] bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer border-0 font-medium text-xs select-none"
                  >
                    &lt;
                  </button>
                )}

                {/* Danh sách các số trang */}
                {paginationItems.map((page, index) => {
                  if (typeof page === 'string') {
                    return (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-2 min-w-[26px] bg-white text-gray-500 flex items-center justify-center text-xs select-none"
                      >
                        ...
                      </span>
                    );
                  }

                  const isActive = page === currentPage;
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`px-2.5 min-w-[28px] flex items-center justify-center transition-colors border-0 text-xs ${
                        isActive
                          ? 'bg-[#0fad89] text-white font-bold cursor-default'
                          : 'bg-white text-gray-800 hover:bg-gray-50 hover:text-gray-900 font-medium cursor-pointer'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                {/* Nút tiến trang (>) - Chỉ hiện khi currentPage < totalPages */}
                {currentPage < totalPages && (
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    title="Trang sau"
                    className="px-2.5 min-w-[28px] bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer border-0 font-medium text-xs select-none"
                  >
                    &gt;
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Modal Chi tiết & Xác nhận kho */}
      <ReturnOrderDetailModal
        isOpen={Boolean(selectedOrderForDetail)}
        order={selectedOrderForDetail}
        token={token}
        canConfirmWarehouse={isWarehouseManagerOrAdmin}
        canCancel={canCreateReturnOrder}
        onClose={() => setSelectedOrderForDetail(null)}
        onSuccess={() => {
          fetchReturnOrders();
        }}
      />

      {/* Modal Xác nhận Nhập kho trực tiếp trên giao diện web */}
      {confirmingOrder && (
        <ModalPortal>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(3px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !isSubmittingConfirm) {
                setConfirmingOrder(null);
              }
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '460px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
                  Xác nhận nhận hàng & Nhập kho
                </h3>
                <p style={{ margin: '8px 0 0 0', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
                  Bạn có chắc chắn muốn xác nhận nhận hàng và cộng tồn kho cho phiếu <strong>{confirmingOrder.code}</strong>?
                </p>
              </div>

              <div
                style={{
                  padding: '16px 24px',
                  backgroundColor: '#f8fafc',
                  fontSize: '13px',
                  color: '#334155',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Đơn hàng gốc:</span>
                  <strong>{confirmingOrder.order_code || `ORD#${confirmingOrder.order_id}`}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Đại lý:</span>
                  <span>{confirmingOrder.dealer_name || 'Đại lý'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Số lượng sản phẩm trả:</span>
                  <span>{confirmingOrder.total_quantity || confirmingOrder.items?.length || 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Tổng tiền hoàn trả:</span>
                  <strong style={{ color: '#059669' }}>
                    {(confirmingOrder.total_refund_amount || 0).toLocaleString('vi-VN')} đ
                  </strong>
                </div>

                {confirmError && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '10px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#fee2e2',
                      border: '1px solid #fca5a5',
                      color: '#b91c1c',
                      fontSize: '12.5px',
                      fontWeight: '600',
                    }}
                  >
                    {confirmError}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: '14px 24px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: '#ffffff',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  disabled={isSubmittingConfirm}
                  onClick={() => setConfirmingOrder(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: isSubmittingConfirm ? 'not-allowed' : 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isSubmittingConfirm}
                  onClick={handleExecuteQuickConfirm}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: isSubmittingConfirm ? '#94a3b8' : '#15803d',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: isSubmittingConfirm ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmittingConfirm ? 'Đang cập nhật tồn kho...' : 'Xác nhận nhập kho'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default ReturnOrdersManagementView;
