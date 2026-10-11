import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getOrdersApi,
  getOrderDetailApi,
  getOrderDealersApi,
  cancelOrderApi,
  getCloneOrderDataApi,
  OrderResponseData,
  User,
  ProductItem,
} from '../services/api';
import { OrderCreateModal } from './OrderCreateModal';
import { RejectOrderModal } from './RejectOrderModal';
import { ApproveOrderModal } from './ApproveOrderModal';
import { OrderLifecycleTimeline } from './OrderLifecycleTimeline';
import { OrderCancelModal } from './OrderCancelModal';
import { getOrderPermissionTier, isOrderPastExported, isOrderCancelable } from '../utils/orderPermissions';
import OrderPrintModal from './OrderPrintModal';
import { emitStatusToast } from './StatusToast';

interface OrderManagementViewProps {
  onCloneOrder?: (data: any) => void;
  currentUser: User;
  token: string;
  products: ProductItem[];
  onBackToHome?: () => void;
  onRefreshProducts?: () => void;
  onNavigateToPriceBooks?: () => void;
}

export const OrderManagementView: React.FC<OrderManagementViewProps> = ({
  currentUser,
  token,
  products,
  onBackToHome: _onBackToHome,
  onRefreshProducts,
  onNavigateToPriceBooks: _onNavigateToPriceBooks,
  onCloneOrder,
}) => {
  const [orders, setOrders] = useState<OrderResponseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState<OrderResponseData | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<OrderResponseData | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderResponseData | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<OrderResponseData | any | null>(null);

  const permTier = getOrderPermissionTier(currentUser);
  const isFullAccess = permTier === 'FULL_ACCESS';
  const isNoAccess = permTier === 'NO_ACCESS';

  const rawRoles = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
  const isAdmin = currentUser.role === 'admin' || rawRoles.includes('admin');
  const isSalesManager = currentUser.role === 'sales_manager' || rawRoles.includes('sales_manager');
  const isSales = currentUser.role === 'sales' || rawRoles.includes('sales');
  const isAccountant = currentUser.role === 'accountant' || rawRoles.includes('accountant');
  const canCreateOrders = !isAccountant && (isAdmin || isSalesManager || isSales);
  const canApproveOrder = (ord: any) => {
    if (!ord) return false;
    if (isAdmin || isSalesManager) return true;
    if (isSales) {
      // 1. Tuyệt đối không cho nhân viên bán hàng duyệt đơn do Admin hoặc Quản lý cấp trên tạo
      const createdByLower = (ord.created_by || '').toLowerCase();
      if (
        createdByLower === 'admin' ||
        createdByLower === 'sales_manager' ||
        createdByLower.includes('admin') ||
        createdByLower.includes('manager')
      ) {
        return false;
      }

      // 2. Nhân viên bán hàng CHỈ ĐƯỢC DUYỆT đại lý do mình phụ trách
      const isAssigned =
        (ord.assigned_sale_id && ord.assigned_sale_id === currentUser.id) ||
        (ord.assigned_sale_name &&
          (ord.assigned_sale_name === currentUser.full_name ||
            ord.assigned_sale_name === currentUser.username));
      if (!isAssigned) return false;

      // 3. Không cho tự duyệt đơn bán dưới giá sàn do chính sales tạo ra
      const isFloorOrder = ord.approval_reason && ord.approval_reason.toLowerCase().includes('giá sàn');
      const isSelfCreated = ord.created_by === currentUser.username;
      if (isFloorOrder && isSelfCreated) return false;

      return true;
    }
    return false;
  };
  const isCustomer = currentUser.role === 'customer' || Boolean(currentUser.roles && currentUser.roles.includes('customer'));
  const [customerDealer, setCustomerDealer] = useState<any | null>(null);

  const handleExecuteCancel = async (reason: string) => {
    if (!cancellingOrder) return;
    setIsSubmittingCancel(true);
    try {
      await cancelOrderApi(token, cancellingOrder.order_code, reason);
      const targetCode = cancellingOrder.order_code;
      setCancellingOrder(null);
      emitStatusToast({
        type: 'success',
        title: 'Hủy đơn hàng thành công',
        message: `Đã hủy đơn hàng ${targetCode}. Lượng tồn giữ chỗ đã được giải phóng lại kho.`,
      });
      if (selectedOrderDetail && selectedOrderDetail.order_code === targetCode) {
        setSelectedOrderDetail({
          ...selectedOrderDetail,
          status: 'CANCELLED',
          cancel_reason: reason,
          cancelled_by: currentUser.username || currentUser.full_name,
          cancelled_at: new Date().toISOString(),
        });
      }
      await fetchOrders();
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi khi hủy đơn hàng',
        message: err.message || 'Không thể hủy đơn hàng.',
      });
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const isCustomerLocked = isCustomer && Boolean(
    customerDealer?.status &&
    (customerDealer.status.toLowerCase().includes('khóa') ||
     customerDealer.status.toLowerCase().includes('lock'))
  );

  const handleCloneOrder = async (orderCode: string) => {
    try {
      const cloneData = await getCloneOrderDataApi(token, orderCode);
      if (onCloneOrder) {
        onCloneOrder(cloneData);
      }
    } catch (e: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi sao chép đơn hàng',
        message: e.message || 'Lỗi khi sao chép đơn hàng',
      });
    }
  };
  const fetchCustomerDealer = async () => {
    if (!isCustomer || !token) return;
    try {
      const dealersList = await getOrderDealersApi(token);
      if (dealersList && dealersList.length > 0) {
        setCustomerDealer(dealersList[0]);
      } else {
        setCustomerDealer(null);
      }
    } catch (e) {
      console.warn('Lỗi lấy thông tin đại lý:', e);
    }
  };

  const handleOpenOrderDetail = async (order: OrderResponseData) => {
    setSelectedOrderDetail(order);
    setIsLoadingDetail(true);
    try {
      const detail = await getOrderDetailApi(token, order.order_code);
      setSelectedOrderDetail(detail);
    } catch (err: any) {
      console.error('Không thể tải chi tiết đơn hàng:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOrdersApi(token);
      setOrders(data);
      if (isCustomer) {
        await fetchCustomerDealer();
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    if (isCustomer) {
      fetchCustomerDealer();
    }
  }, [token, isCustomer]);

  // Tính toán số liệu thống kê
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING_APPROVAL').length;
  const confirmedOrdersCount = orders.filter((o) => o.status === 'CONFIRMED').length;
  const rejectedOrdersCount = orders.filter((o) => o.status === 'REJECTED').length;
  const cancelledOrdersCount = orders.filter((o) => o.status === 'CANCELLED').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Bộ lọc và sắp xếp đơn hàng: Ưu tiên đơn chưa duyệt (PENDING_APPROVAL) lên đầu trang
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        const q = searchTerm.trim().toLowerCase();
        const matchSearch =
          !q ||
          o.order_code.toLowerCase().includes(q) ||
          o.dealer_name.toLowerCase().includes(q) ||
          o.created_by.toLowerCase().includes(q) ||
          (Boolean(o.assigned_sale_name) && String(o.assigned_sale_name).toLowerCase().includes(q));

        const matchStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'PENDING_APPROVAL' && (o.status === 'PENDING_APPROVAL' || o.status === 'PENDING')) ||
          (statusFilter === 'CONFIRMED' && o.status === 'CONFIRMED') ||
          (statusFilter === 'REJECTED' && o.status === 'REJECTED') ||
          (statusFilter === 'CANCELLED' && o.status === 'CANCELLED');

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        const isAPending = a.status === 'PENDING_APPROVAL' || a.status === 'PENDING';
        const isBPending = b.status === 'PENDING_APPROVAL' || b.status === 'PENDING';
        if (isAPending !== isBPending) {
          return isBPending ? 1 : -1; // Đơn chờ duyệt luôn luôn lên đầu danh sách
        }
        return (b.id || 0) - (a.id || 0); // Cùng trạng thái thì đơn mới nhất xếp trước
      });
  }, [orders, searchTerm, statusFilter]);

  // Phân trang danh sách đơn hàng
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 7;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (isNoAccess) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          margin: '40px auto',
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #fecaca',
          padding: '32px 28px',
          textAlign: 'center',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            background: '#fee2e2',
            color: '#dc2626',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '12px',
          }}
        >
          TRUY CẬP BỊ TỪ CHỐI
        </span>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
          Không có quyền truy cập Đơn hàng bán
        </h3>
        <p style={{ margin: 0, fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>
          Tài khoản của bạn ({currentUser.username || currentUser.role}) thuộc bộ phận Mua hàng, chỉ được quyền thao tác với Hóa đơn mua vào và Nhà cung cấp.
        </p>
      </div>
    );
  }

  const renderStatusBadge = (status: string) => {
    if (status === 'PENDING_APPROVAL') {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Chờ quản lý duyệt
        </span>
      );
    }
    if (status === 'CONFIRMED') {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#dcfce7',
            color: '#15803d',
            border: '1px solid #bbf7d0',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Đã xác nhận
        </span>
      );
    }
    if (status === 'REJECTED') {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#fee2e2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Bị từ chối
        </span>
      );
    }
    if (status === 'CANCELLED') {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #cbd5e1',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Đã hủy
        </span>
      );
    }
    if (['EXPORTED', 'SHIPPED', 'DISPATCHED', 'ĐÃ XUẤT'].includes((status || '').toUpperCase())) {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #bae6fd',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Đã xuất kho
        </span>
      );
    }
    if (['PICKING', 'PREPARING', 'PACKING', 'ĐANG SOẠN HÀNG'].includes((status || '').toUpperCase())) {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#fef3c7',
            color: '#b45309',
            border: '1px solid #fde68a',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Đang soạn hàng
        </span>
      );
    }
    if (['DELIVERED', 'ĐÃ GIAO'].includes((status || '').toUpperCase())) {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#dcfce7',
            color: '#15803d',
            border: '1px solid #bbf7d0',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Đã giao hàng
        </span>
      );
    }
    if (['CLOSED', 'COMPLETED', 'ĐÓNG'].includes((status || '').toUpperCase())) {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#f8fafc',
            color: '#475569',
            border: '1px solid #cbd5e1',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Đóng đơn
        </span>
      );
    }
    return (
      <span
        style={{
          background: '#f1f5f9',
          color: '#64748b',
          borderRadius: '999px',
          padding: '2.5px 10px',
          fontSize: '11.5px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
        }}
      >
        {status}
      </span>
    );
  };

  const renderOrderActions = (order: OrderResponseData) => {
    const isPending = order.status === 'PENDING_APPROVAL';
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', whiteSpace: 'nowrap' }}>
        {/* Menu Dropdown Trạng thái dành cho Admin/Sales/Quản lý */}
        {!isCustomer && ((isPending && canApproveOrder(order)) || (isFullAccess && order.status !== 'CANCELLED' && order.status !== 'REJECTED')) && (
          <details
            className="order-status-dropdown-details group relative inline-block text-left [&::-webkit-details-marker]:hidden"
            style={{ position: 'relative', display: 'inline-block' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDetailsElement).open = true;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDetailsElement).open = false;
            }}
          >
            <summary
              id={`btn-status-dropdown-${order.order_code}`}
              style={{
                listStyle: 'none',
                padding: '5px 10px',
                background: '#16a34a',
                border: 'none',
                borderRadius: '6px',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                height: '28px',
                boxSizing: 'border-box',
                userSelect: 'none',
                outline: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#15803d';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#16a34a';
              }}
              title="Thao tác xử lý trạng thái đơn hàng"
            >
              Trạng thái ▾
            </summary>

            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 4px)',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                padding: '4px',
                minWidth: '130px',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {/* Duyệt đơn */}
              {isPending && canApproveOrder(order) && (
                <button
                  type="button"
                  id={`btn-approve-order-${order.order_code}`}
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    setApprovingOrder(order);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#16a34a',
                    fontSize: '12px',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f0fdf4';
                    e.currentTarget.style.color = '#15803d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#16a34a';
                  }}
                  title="Phê duyệt đơn hàng của đại lý"
                >
                  Duyệt đơn
                </button>
              )}

              {/* Từ chối */}
              {isPending && canApproveOrder(order) && (
                <button
                  type="button"
                  id={`btn-reject-order-${order.order_code}`}
                  onClick={(e) => {
                    e.currentTarget.closest('details')?.removeAttribute('open');
                    setRejectingOrder(order);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.color = '#b91c1c';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#dc2626';
                  }}
                  title="Từ chối đơn hàng bán dưới giá sàn"
                >
                  Từ chối
                </button>
              )}

              {/* Hủy đơn */}
              {isFullAccess && order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (
                <button
                  type="button"
                  id={`btn-cancel-order-${order.order_code}`}
                  disabled={isOrderPastExported(order.status) || !isOrderCancelable(order.status)}
                  onClick={(e) => {
                    if (!isOrderPastExported(order.status) && isOrderCancelable(order.status)) {
                      e.currentTarget.closest('details')?.removeAttribute('open');
                      setCancellingOrder(order);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    padding: '7px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: isOrderPastExported(order.status) ? '#94a3b8' : '#ea580c',
                    fontSize: '12px',
                    fontWeight: '600',
                    textAlign: 'left',
                    cursor: isOrderPastExported(order.status) ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isOrderPastExported(order.status)) {
                      e.currentTarget.style.background = '#fff7ed';
                      e.currentTarget.style.color = '#c2410c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isOrderPastExported(order.status)) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#ea580c';
                    }
                  }}
                  title={
                    isOrderPastExported(order.status)
                      ? 'Đơn hàng đã xuất kho, không thể hủy. Vui lòng đi đường trả hàng.'
                      : !isOrderCancelable(order.status)
                      ? 'Đơn hàng không ở trạng thái được phép hủy'
                      : 'Hủy đơn hàng'
                  }
                >
                  Hủy đơn
                </button>
              )}
            </div>
          </details>
        )}

        {/* Tiêu chí cho Khách hàng/Đại lý: Chỉ hủy đơn khi chưa duyệt */}
        {isCustomer && (order.status === 'PENDING_APPROVAL' || order.status === 'PENDING' || order.status === 'DRAFT') && (
          <button
            type="button"
            id={`btn-customer-cancel-order-${order.order_code}`}
            onClick={() => setCancellingOrder(order)}
            style={{
              padding: '5px 10px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '6px',
              color: '#e11d48',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '28px',
              boxSizing: 'border-box',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffe4e6';
              e.currentTarget.style.color = '#be123c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#fff1f2';
              e.currentTarget.style.color = '#e11d48';
            }}
            title="Hủy đơn hàng chưa duyệt của đại lý"
          >
            Hủy đơn
          </button>
        )}

        <button
          type="button"
          onClick={() => handleOpenOrderDetail(order)}
          style={{
            padding: '5px 10px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            color: '#334155',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px',
            boxSizing: 'border-box',
            transition: 'all 0.15s ease',
          }}
          title="Xem chi tiết các mặt hàng"
        >
          Chi tiết
        </button>
      </div>
    );
  };

  return (
    <div
      className="w-full max-w-[1680px] mx-auto p-2.5 sm:p-4 md:p-0 flex flex-col flex-1 min-h-0 md:h-full overflow-y-auto md:overflow-hidden"
    >
      {/* Thanh tiêu đề */}
      <div className="flex justify-between items-start sm:items-center mb-3 sm:mb-4 flex-wrap gap-2.5 sm:gap-4 shrink-0">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {isCustomer ? 'Đơn Hàng Của Tôi' : 'Quản Lý Đơn Hàng & Bán Hàng'}
          </h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-[13.5px] text-slate-500">
            {isCustomer
              ? 'Theo dõi trạng thái đơn đặt hàng, tiến độ duyệt và giao hàng của đại lý'
              : 'Theo dõi trạng thái đơn bán, kiểm soát biên lợi nhuận và phê duyệt đơn hàng'}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={fetchOrders}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
            title="Tải lại danh sách đơn hàng"
          >
            Làm mới
          </button>

          {!isCustomer && canCreateOrders && (
            <button
              type="button"
              id="btn-create-order-view"
              onClick={() => !isCustomerLocked && setIsCreateModalOpen(true)}
              disabled={isCustomerLocked}
              style={{
                padding: '8px 18px',
                background: isCustomerLocked ? '#94a3b8' : 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: isCustomerLocked ? 'not-allowed' : 'pointer',
                boxShadow: isCustomerLocked ? 'none' : '0 2px 8px rgba(15, 186, 144, 0.35)',
                transition: 'all 0.18s ease',
              }}
              title={isCustomerLocked ? 'Đại lý hiện đang bị khóa giao dịch, không thể tạo đơn hàng mới' : undefined}
            >
              {isCustomerLocked ? 'Tạo Đơn Hàng Mới (Đã khóa)' : 'Tạo Đơn Hàng Mới'}
            </button>
          )}
        </div>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs">
          <div className="text-xs sm:text-[13px] text-slate-500 font-semibold truncate">Tổng số đơn hàng</div>
          <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 mt-0.5 sm:mt-1">{totalOrdersCount} đơn</div>
          <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">Toàn bộ đơn hàng trên hệ thống</div>
        </div>

        <div id="stat-card-pending-orders" className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs">
          <div className="text-xs sm:text-[13px] text-amber-700 font-bold truncate">Đơn chờ quản lý duyệt</div>
          <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-amber-700 mt-0.5 sm:mt-1">{pendingOrdersCount} đơn</div>
          <div className="text-[11px] sm:text-xs text-amber-600 mt-0.5 truncate hidden sm:block">Bán dưới giá sàn cần phê duyệt</div>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs">
          <div className="text-xs sm:text-[13px] text-emerald-700 font-bold truncate">Đơn đã xác nhận</div>
          <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-emerald-700 mt-0.5 sm:mt-1">{confirmedOrdersCount} đơn</div>
          <div className="text-[11px] sm:text-xs text-emerald-600 mt-0.5 truncate hidden sm:block">Đủ điều kiện xuất kho bán hàng</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs">
          <div className="text-xs sm:text-[13px] text-slate-500 font-semibold truncate">Tổng doanh thu bán hàng</div>
          <div className="text-base sm:text-lg md:text-2xl font-extrabold text-blue-600 mt-0.5 sm:mt-1 truncate">{totalRevenue.toLocaleString('vi-VN')} đ</div>
          <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">Giá trị lũy kế các đơn hàng</div>
        </div>
      </div>

      {cancelNotice && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '14px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{cancelNotice}</span>
          <button
            type="button"
            onClick={() => setCancelNotice(null)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#065f46',
              fontWeight: '700',
              fontSize: '14px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Bảng dữ liệu chính */}
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-xs flex-1 min-h-0 flex flex-col overflow-hidden"
      >
        {/* Bộ lọc và tìm kiếm */}
        <div className="p-2.5 sm:p-3.5 md:px-5 md:py-3 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2.5 sm:gap-3 bg-slate-50 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách hàng, người tạo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-72 px-3 py-1.5 sm:py-2 rounded-lg border border-slate-300 text-xs sm:text-[13.5px] bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 box-border"
            />

            <div className="flex overflow-x-auto max-w-full pb-1 sm:pb-0 gap-1 bg-slate-200/80 p-0.5 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                  statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({totalOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('PENDING_APPROVAL')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                  statusFilter === 'PENDING_APPROVAL' ? 'bg-white text-amber-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-amber-700'
                }`}
              >
                Chờ duyệt ({pendingOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('CONFIRMED')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                  statusFilter === 'CONFIRMED' ? 'bg-white text-emerald-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-emerald-700'
                }`}
              >
                Đã xác nhận ({confirmedOrdersCount})
              </button>
              {rejectedOrdersCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('REJECTED')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                    statusFilter === 'REJECTED' ? 'bg-white text-red-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-red-700'
                  }`}
                >
                  Bị từ chối ({rejectedOrdersCount})
                </button>
              )}
              {cancelledOrdersCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('CANCELLED')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                    statusFilter === 'CANCELLED' ? 'bg-white text-slate-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Đã hủy ({cancelledOrdersCount})
                </button>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 whitespace-nowrap self-end md:self-center">
            Hiển thị <strong>{paginatedOrders.length}</strong> / {filteredOrders.length} đơn
          </div>
        </div>

        {/* Nội dung danh sách đơn hàng */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang tải danh sách đơn hàng...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#dc2626', fontWeight: '600' }}>
            {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155' }}>Không có đơn hàng nào phù hợp</div>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', marginTop: '6px' }}>
              Hãy nhấn nút "Tạo Đơn Hàng Mới" để lên đơn bán hàng cho khách hàng.
            </p>
          </div>
        ) : (
          <>
            {/* Chế độ xem Mobile (< md): Dạng danh sách thẻ (Card view) thuận tiện trên điện thoại */}
            <div className="block md:hidden p-2.5 space-y-2.5 overflow-y-auto flex-1 min-h-0">
              {paginatedOrders.map((order, idx) => {
                const isPending = order.status === 'PENDING_APPROVAL';
                return (
                  <div
                    key={`mobile-order-${order.id || idx}`}
                    className="bg-white border rounded-xl p-3 shadow-xs space-y-2 transition-all"
                    style={{
                      borderColor: isPending ? '#fde68a' : order.status === 'CONFIRMED' ? '#bbf7d0' : '#e2e8f0',
                      background: isPending ? '#fffdf7' : '#ffffff',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {order.order_code}
                        </span>
                        {renderStatusBadge(order.status)}
                      </div>
                      <span className="font-extrabold text-slate-900 text-sm whitespace-nowrap">
                        {order.total_amount.toLocaleString('vi-VN')} đ
                      </span>
                    </div>

                    <div className="text-xs text-slate-600">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5 flex-wrap">
                        <span>{order.dealer_name}</span>
                        {Boolean(
                          order.dealer_status &&
                          (order.dealer_status.toLowerCase().includes('khóa') ||
                           order.dealer_status.toLowerCase().includes('lock') ||
                           order.dealer_status.toLowerCase().includes('ngừng'))
                        ) && (
                          <span className="bg-red-100 text-red-700 border border-red-200 rounded px-1.5 py-0.5 text-[10px] font-bold">
                            Đã khóa
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Mã KH: #{order.dealer_id} • Người tạo: {order.created_by}
                      </div>
                    </div>

                    {/* Cảnh báo hoặc lý do phê duyệt nếu có */}
                    {(order.approval_reason || Boolean(
                      order.dealer_status &&
                      (order.dealer_status.toLowerCase().includes('khóa') ||
                       order.dealer_status.toLowerCase().includes('lock'))
                    )) && (
                      <div className="text-[11.5px] p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 leading-tight">
                        {Boolean(
                          order.dealer_status &&
                          (order.dealer_status.toLowerCase().includes('khóa') ||
                           order.dealer_status.toLowerCase().includes('lock'))
                        ) && (
                          <div className="font-bold text-red-600 mb-0.5">
                            Đại lý bị khóa giao dịch (Cần kiểm tra công nợ)
                          </div>
                        )}
                        {order.approval_reason && <div>{order.approval_reason}</div>}
                      </div>
                    )}

                    {/* Nút bấm thao tác */}
                    <div className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100">
                      {renderOrderActions(order)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chế độ xem Desktop (>= md): Bảng dữ liệu chuẩn */}
            <div
              className="hidden md:block roles-grid-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                  <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc', whiteSpace: 'nowrap' }}>Mã Đơn</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc' }}>Khách Hàng / Đại Lý</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc', whiteSpace: 'nowrap' }}>Người Lên Đơn</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', textAlign: 'right', background: '#f8fafc', whiteSpace: 'nowrap' }}>Tổng Giá Trị</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', textAlign: 'center', background: '#f8fafc', whiteSpace: 'nowrap', minWidth: '155px' }}>Trạng Thái Duyệt</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc' }}>Lý Do Cảnh Báo</th>
                    <th style={{ padding: '9px 14px', fontWeight: '700', textAlign: 'right', background: '#f8fafc', whiteSpace: 'nowrap', minWidth: '220px' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, idx) => {
                    const isPending = order.status === 'PENDING_APPROVAL';
                    const isRejected = order.status === 'REJECTED';

                    return (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isPending ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: '700', color: '#1e293b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {order.order_code}
                        </td>

                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '12.5px', lineHeight: '1.3' }}>{order.dealer_name}</span>
                            {Boolean(
                              order.dealer_status &&
                              (order.dealer_status.toLowerCase().includes('khóa') ||
                               order.dealer_status.toLowerCase().includes('lock') ||
                               order.dealer_status.toLowerCase().includes('ngừng'))
                            ) && (
                              <span
                                style={{
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fca5a5',
                                  borderRadius: '4px',
                                  padding: '1px 6px',
                                  fontSize: '11px',
                                  fontWeight: 750,
                                }}
                                title={order.dealer_lock_reason ? `Lý do: ${order.dealer_lock_reason}` : 'Đại lý bị khóa giao dịch'}
                              >
                                Đã khóa
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                            Mã khách hàng: #{order.dealer_id}
                          </div>
                        </td>

                        <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '12px' }}>
                            {order.created_by}
                          </div>
                        </td>

                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                          {order.total_amount.toLocaleString('vi-VN')} đồng
                        </td>

                        <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {renderStatusBadge(order.status)}
                        </td>

                        <td style={{ padding: '9px 12px', maxWidth: '240px' }}>
                          {Boolean(
                            order.dealer_status &&
                            (order.dealer_status.toLowerCase().includes('khóa') ||
                             order.dealer_status.toLowerCase().includes('lock'))
                          ) && (
                            <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: '600', marginBottom: order.approval_reason ? '3px' : '0' }}>
                              Đại lý bị khóa giao dịch (Cần kiểm tra công nợ)
                            </div>
                          )}
                          {order.approval_reason ? (
                            <div style={{ fontSize: '11.5px', color: isRejected ? '#dc2626' : '#b45309', fontWeight: '500', lineHeight: '1.35' }}>
                              {order.approval_reason}
                            </div>
                          ) : order.approved_by ? (
                            <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: '500' }}>
                              Duyệt bởi @{order.approved_by}
                            </div>
                          ) : isPending ? (
                            <div style={{ fontSize: '11.5px', color: '#b45309', fontWeight: '500' }}>
                              {order.discount_rate && order.discount_rate > 0
                                ? `Chiết khấu (${order.discount_rate}%) vượt hạn mức cần duyệt`
                                : 'Bán dưới giá sàn cần quản lý duyệt'}
                            </div>
                          ) : !Boolean(
                            order.dealer_status &&
                            (order.dealer_status.toLowerCase().includes('khóa') ||
                             order.dealer_status.toLowerCase().includes('lock'))
                          ) ? (
                            <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Đơn giá chuẩn bảng giá</span>
                          ) : null}
                        </td>

                        <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {renderOrderActions(order)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* FOOTER PHÂN TRANG (Hình 2) */}
        {!loading && !error && filteredOrders.length > 0 && (
          <div
            style={{
              padding: '8px 18px',
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '12px',
              color: '#64748b',
              flexShrink: 0,
            }}
          >
            {/* Khối phân trang liền thanh chuẩn theo thiết kế (Hình 2) */}
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
              {/* Nút trang trước (<) - hiển thị khi trang > 1 */}
              {safePage > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    minWidth: '24px',
                    height: '100%',
                    padding: '0 6px',
                    border: 'none',
                    borderRight: '1px solid #e5e7eb',
                    background: '#ffffff',
                    color: '#4b5563',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  title="Trang trước"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              )}

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
                  const hasNext = safePage < totalPages;
                  const isLastItem = idx === arr.length - 1 && !hasNext;
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

              {/* Nút trang sau (>) - hiển thị khi chưa tới trang cuối */}
              {safePage < totalPages && (
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{
                    minWidth: '24px',
                    height: '100%',
                    padding: '0 6px',
                    border: 'none',
                    background: '#ffffff',
                    color: '#4b5563',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  title="Trang sau"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Xem Chi Tiết Đơn Hàng */}
      {selectedOrderDetail && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOrderDetail(null);
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '740px',
              width: '100%',
              maxHeight: 'calc(100vh - 32px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal Cố Định */}
            <div
              className="flex justify-between items-start sm:items-center p-3.5 sm:px-6 sm:py-4 border-b border-slate-100 shrink-0 bg-white gap-2.5 flex-wrap"
            >
              <div>
                <h3 className="m-0 text-base sm:text-lg font-extrabold text-slate-900">
                  Chi Tiết Đơn Hàng #{selectedOrderDetail.order_code}
                </h3>
                <p className="m-0 mt-1 text-xs sm:text-[13px] text-slate-500">
                  Khách hàng: <strong>{selectedOrderDetail.dealer_name}</strong> (Mã: #{selectedOrderDetail.dealer_id})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const orderToPrint = selectedOrderDetail;
                    setSelectedOrderDetail(null);
                    setPrintingOrder(orderToPrint);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="In phiếu hoặc xuất file PDF đơn hàng cho đại lý xem và ký xác nhận"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  In / Xuất PDF
                </button>
                {!isCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      const code = selectedOrderDetail.order_code;
                      setSelectedOrderDetail(null);
                      handleCloneOrder(code);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      color: '#166534',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title="Sao chép đơn hàng này thành đơn mới (giữ lại đại lý, sản phẩm và tính lại đơn giá/chiết khấu hiện hành)"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Sao chép đơn này
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedOrderDetail(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '22px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    lineHeight: 1,
                    borderRadius: '6px',
                    flexShrink: 0,
                  }}
                  title="Đóng"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Thân Modal Cuộn Mượt Mà */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Stepper / Timeline Vòng đời đơn hàng (Không dùng icon) */}
              <OrderLifecycleTimeline
                status={selectedOrderDetail.status}
                cancelReason={selectedOrderDetail.cancel_reason}
                cancelledBy={selectedOrderDetail.cancelled_by}
                cancelledAt={selectedOrderDetail.cancelled_at}
                approvalReason={selectedOrderDetail.approval_reason}
                approvedBy={selectedOrderDetail.approved_by}
              />
              {Boolean(
                selectedOrderDetail?.dealer_status &&
                (selectedOrderDetail.dealer_status.toLowerCase().includes('khóa') ||
                 selectedOrderDetail.dealer_status.toLowerCase().includes('lock') ||
                 selectedOrderDetail.dealer_status.toLowerCase().includes('ngừng'))
              ) && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1.5px solid #ef4444',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#991b1b',
                    fontSize: '13.5px',
                    lineHeight: '1.5',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.08)',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block', marginBottom: '2px', color: '#b91c1c' }}>
                      CẢNH BÁO CÔNG NỢ: Đại lý &apos;{selectedOrderDetail.dealer_name}&apos; hiện đang bị KHÓA giao dịch
                      {selectedOrderDetail.dealer_lock_reason ? ` (Lý do: ${selectedOrderDetail.dealer_lock_reason})` : ''}.
                    </strong>
                    <span>Đơn dở dang này vẫn được phép xử lý nhưng vui lòng kiểm tra kỹ công nợ trước khi xuất hàng!</span>
                  </div>
                </div>
              )}
            {selectedOrderDetail.approval_reason && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '13px', color: '#b45309' }}>
                <strong>Lý do yêu cầu phê duyệt:</strong> {selectedOrderDetail.approval_reason}
              </div>
            )}

            {/* Thông tin giao hàng & người lên đơn */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Điểm giao hàng:</span>
                  <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {selectedOrderDetail.delivery_point || 'Địa chỉ đại lý'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Ngày giao mong muốn:</span>
                  <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {selectedOrderDetail.desired_delivery_date
                      ? new Date(selectedOrderDetail.desired_delivery_date).toLocaleDateString('vi-VN')
                      : 'Tiêu chuẩn'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Người lên đơn:</span>
                  <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {selectedOrderDetail.created_by || selectedOrderDetail.assigned_sale_name || '—'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Thời gian tạo:</span>
                  <div style={{ fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                    {selectedOrderDetail.created_at
                      ? new Date(selectedOrderDetail.created_at).toLocaleString('vi-VN')
                      : '—'}
                  </div>
                </div>
              </div>
              {selectedOrderDetail.note && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '13px', color: '#334155' }}>
                  <span style={{ color: '#64748b' }}>Ghi chú:</span> <em>{selectedOrderDetail.note}</em>
                </div>
              )}
            </div>

            {/* Bảng sản phẩm chi tiết */}
            <div
              style={{
                flexShrink: 0,
                maxHeight: '360px',
                overflowY: 'auto',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#ffffff',
              }}
            >
              {isLoadingDetail ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang tải thông tin chi tiết các mặt hàng...</div>
                </div>
              ) : (!selectedOrderDetail.items || selectedOrderDetail.items.length === 0) ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
                  Chưa có thông tin danh sách sản phẩm.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Sản phẩm</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>ĐVT</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số lượng</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderDetail.items.map((item: any, idx: number) => {
                      const unitName = item.unit || item.unit_name || 'Cái';
                      const qty = item.quantity || 1;
                      const price = item.price || 0;
                      const lineTotal = qty * price;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '500', color: '#0f172a' }}>
                            {item.product_name || `Sản phẩm #${item.product_id}`}
                            {item.product_code && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                                Mã: {item.product_code}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center', color: '#334155' }}>
                            {unitName}
                            {item.conversion_rate && item.conversion_rate > 1 && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>
                                (x{item.conversion_rate})
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                            {qty.toLocaleString('vi-VN')}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                            {price.toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                            {lineTotal.toLocaleString('vi-VN')} đ
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bảng tổng kết tiền */}
            {(() => {
              const subtotal = selectedOrderDetail.subtotal_amount ??
                (selectedOrderDetail.items || []).reduce((acc: number, it: any) => acc + (it.quantity || 0) * (it.price || 0), 0);
              const discountPercent = selectedOrderDetail.discount_percent || 0;
              const discountAmount = selectedOrderDetail.discount_amount ?? Math.round(subtotal * discountPercent / 100);
              return (
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#64748b' }}>
                    <span>Tổng tiền hàng:</span>
                    <span style={{ fontWeight: '600', color: '#0f172a' }}>{subtotal.toLocaleString('vi-VN')} đ</span>
                  </div>
                  {discountPercent > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#dc2626' }}>
                      <span>Chiết khấu ({discountPercent}%):</span>
                      <span style={{ fontWeight: '600' }}>-{discountAmount.toLocaleString('vi-VN')} đ</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '15px' }}>
                    <strong style={{ color: '#0f172a' }}>Tổng thanh toán:</strong>
                    <strong style={{ color: '#16a34a', fontSize: '16px' }}>{selectedOrderDetail.total_amount.toLocaleString('vi-VN')} đ</strong>
                  </div>
                </div>
              );
            })()}

            </div>

            {/* Footer Modal Cố Định ở Đáy */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                flexShrink: 0,
                boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.03)',
              }}
            >
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Trạng thái:{' '}
                <strong
                  style={{
                    color:
                      selectedOrderDetail.status === 'CONFIRMED'
                        ? '#16a34a'
                        : selectedOrderDetail.status === 'REJECTED'
                        ? '#dc2626'
                        : selectedOrderDetail.status === 'EXPORTED'
                        ? '#0284c7'
                        : selectedOrderDetail.status === 'DELIVERED'
                        ? '#16a34a'
                        : selectedOrderDetail.status === 'CLOSED'
                        ? '#64748b'
                        : '#d97706',
                  }}
                >
                  {selectedOrderDetail.status === 'PENDING_APPROVAL'
                    ? 'Chờ quản lý duyệt'
                    : selectedOrderDetail.status === 'CONFIRMED'
                    ? 'Đã xác nhận'
                    : selectedOrderDetail.status === 'EXPORTED'
                    ? 'Đã xuất kho'
                    : selectedOrderDetail.status === 'PICKING'
                    ? 'Đang soạn hàng'
                    : selectedOrderDetail.status === 'DELIVERED'
                    ? 'Đã giao hàng'
                    : selectedOrderDetail.status === 'CLOSED'
                    ? 'Đóng đơn'
                    : selectedOrderDetail.status === 'REJECTED'
                    ? 'Bị từ chối'
                    : selectedOrderDetail.status === 'CANCELLED'
                    ? 'Đã hủy'
                    : selectedOrderDetail.status}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                {/* Nút Hủy đơn hàng này ở Footer: CHỈ khả dụng khi status thuộc nhóm ['Nháp', 'Chờ duyệt', 'Đã duyệt', 'Đang soạn hàng'] */}
                {/* NẾU trạng thái thuộc nhóm ['Đã xuất', 'Đã giao', 'Đóng']: BẮT BUỘC ẩn nút này đi */}
                {((isCustomer && ['PENDING_APPROVAL', 'PENDING', 'DRAFT', 'NHÁP', 'CHỜ DUYỆT'].includes((selectedOrderDetail.status || '').toUpperCase().trim())) ||
                  (isFullAccess && isOrderCancelable(selectedOrderDetail.status))) && !isOrderPastExported(selectedOrderDetail.status) && (
                  <button
                    type="button"
                    id={`btn-modal-cancel-order-${selectedOrderDetail.order_code}`}
                    onClick={() => {
                      const ord = selectedOrderDetail;
                      setSelectedOrderDetail(null);
                      setCancellingOrder(ord);
                    }}
                    style={{
                      padding: '8px 16px',
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      color: '#e11d48',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Hủy đơn hàng này
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedOrderDetail(null)}
                  style={{
                    padding: '8px 18px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#334155',
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
        </div>,
        document.body
      )}

      {/* Modal Tạo Đơn Hàng */}
      {isCreateModalOpen && (
        <OrderCreateModal
          isOpen={isCreateModalOpen}
          token={token}
          currentUser={currentUser}
          products={products}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Phê Duyệt Đơn Hàng (Không dùng window.confirm) */}
      {approvingOrder && (
        <ApproveOrderModal
          isOpen={Boolean(approvingOrder)}
          order={approvingOrder}
          token={token}
          onClose={() => setApprovingOrder(null)}
          onSuccess={() => {
            setApprovingOrder(null);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Từ Chối Đơn Hàng (Không dùng window.prompt) */}
      {rejectingOrder && (
        <RejectOrderModal
          isOpen={Boolean(rejectingOrder)}
          order={rejectingOrder}
          token={token}
          onClose={() => setRejectingOrder(null)}
          onSuccess={() => {
            setRejectingOrder(null);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Hủy Đơn Hàng (Bắt buộc nhập lý do & Nhả tồn kho qua DB Transaction) */}
      {cancellingOrder && (
        <OrderCancelModal
          isOpen={Boolean(cancellingOrder)}
          orderCode={cancellingOrder.order_code}
          dealerName={cancellingOrder.dealer_name}
          totalAmount={cancellingOrder.total_amount}
          isSubmitting={isSubmittingCancel}
          onClose={() => {
            if (!isSubmittingCancel) setCancellingOrder(null);
          }}
          onConfirm={handleExecuteCancel}
        />
      )}

      {/* Modal In & Xuất PDF Đơn Hàng */}
      {printingOrder && createPortal(
        <OrderPrintModal
          token={token}
          orderCode={printingOrder.order_code}
          initialOrder={printingOrder.items && printingOrder.items.length > 0 ? printingOrder : undefined}
          onClose={() => setPrintingOrder(null)}
        />,
        document.body
      )}
    </div>
  );
};
export default OrderManagementView;

