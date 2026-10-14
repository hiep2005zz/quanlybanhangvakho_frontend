import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getOrdersApi,
  getOrderDealersApi,
  getOrderSalesRepsApi,
  getOrderRegionsApi,
  cancelOrderApi,
  supplementaryDeliveryApi,
  OrderResponseData,
  OrderDealer,
  SalesRepItem,
  User,
  ProductItem,
} from '../services/api';
import { Link } from '../hooks/useLocation';
import { RejectOrderModal } from './RejectOrderModal';
import { ApproveOrderModal } from './ApproveOrderModal';
import { ReturnOrderModal } from './ReturnOrderModal';
import { emitStatusToast } from './StatusToast';
import { OrderCancelModal } from './OrderCancelModal';
import { getOrderPermissionTier, isOrderPastExported, isOrderCancelable } from '../utils/orderPermissions';


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
  products: _products,
  onBackToHome: _onBackToHome,
  onRefreshProducts,
  onNavigateToPriceBooks: _onNavigateToPriceBooks,
  onCloneOrder: _onCloneOrder,
}) => {
  const [orders, setOrders] = useState<OrderResponseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'PICKING' | 'EXPORTED' | 'DELIVERED' | 'REJECTED' | 'CANCELLED'
  >('ALL');
  const [dealerFilter, setDealerFilter] = useState<string>('ALL');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Bộ lọc dự thảo (chờ bấm nút "Áp dụng")
  const [draftStatusFilter, setDraftStatusFilter] = useState<
    'ALL' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'PICKING' | 'EXPORTED' | 'DELIVERED' | 'REJECTED' | 'CANCELLED'
  >('ALL');
  const [draftDealerFilter, setDraftDealerFilter] = useState<string>('ALL');
  const [draftSalesRepFilter, setDraftSalesRepFilter] = useState<string>('ALL');
  const [draftRegionFilter, setDraftRegionFilter] = useState<string>('ALL');
  const [draftStartDate, setDraftStartDate] = useState<string>('');
  const [draftEndDate, setDraftEndDate] = useState<string>('');

  const handleApplyFilter = () => {
    setStatusFilter(draftStatusFilter);
    setDealerFilter(draftDealerFilter);
    setSalesRepFilter(draftSalesRepFilter);
    setRegionFilter(draftRegionFilter);
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setCurrentPage(1);
  };

  const handleResetFilter = () => {
    setDraftStatusFilter('ALL');
    setDraftDealerFilter('ALL');
    setDraftSalesRepFilter('ALL');
    setDraftRegionFilter('ALL');
    setDraftStartDate('');
    setDraftEndDate('');

    setStatusFilter('ALL');
    setDealerFilter('ALL');
    setSalesRepFilter('ALL');
    setRegionFilter('ALL');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };
  const [dealers, setDealers] = useState<OrderDealer[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRepItem[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [approvingOrder, setApprovingOrder] = useState<OrderResponseData | null>(null);
  const [returningOrder, setReturningOrder] = useState<OrderResponseData | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<OrderResponseData | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderResponseData | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [openActionDropdownCode, setOpenActionDropdownCode] = useState<string | null>(null);
  const dropdownCloseTimerRef = useRef<any>(null);

  // Tự động đóng menu trạng thái khi nhấn chuột ra ngoài
  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.order-action-dropdown-container')) {
        setOpenActionDropdownCode(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      if (dropdownCloseTimerRef.current) {
        clearTimeout(dropdownCloseTimerRef.current);
      }
    };
  }, []);

  const handleDropdownOpen = (orderCode: string) => {
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
    setOpenActionDropdownCode(orderCode);
  };

  const handleDropdownCloseWithDelay = () => {
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
    }
    dropdownCloseTimerRef.current = setTimeout(() => {
      setOpenActionDropdownCode(null);
    }, 280);
  };

  const handleDropdownToggle = (e: React.MouseEvent, orderCode: string) => {
    e.stopPropagation();
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }
    setOpenActionDropdownCode((prev) => (prev === orderCode ? null : orderCode));
  };

  const [supplementaryOrder, setSupplementaryOrder] = useState<any | null>(null);
  const [isSubmittingSupplementary, setIsSubmittingSupplementary] = useState(false);
  const [supplementaryNote, setSupplementaryNote] = useState('Giao bổ sung đợt 2 - hoàn tất đơn hàng');
  const [supplementaryError, setSupplementaryError] = useState<string | null>(null);
  const [supplementarySuccessMsg, setSupplementarySuccessMsg] = useState<string | null>(null);

  const handleConfirmSupplementary = async () => {
    if (!supplementaryOrder) return;
    setIsSubmittingSupplementary(true);
    setSupplementaryError(null);
    try {
      await supplementaryDeliveryApi(token, supplementaryOrder.order_code, {
        note: supplementaryNote.trim() || 'Giao bổ sung đợt 2 - hoàn tất đơn hàng',
      });
      setSupplementaryOrder(null);
      setSupplementarySuccessMsg(`Đã ghi nhận giao bổ sung thành công cho đơn hàng ${supplementaryOrder.order_code}!`);
      setTimeout(() => setSupplementarySuccessMsg(null), 4000);
      fetchOrders();
    } catch (err: any) {
      setSupplementaryError(err?.message || 'Không thể thực hiện giao bổ sung.');
    } finally {
      setIsSubmittingSupplementary(false);
    }
  };


  const permTier = getOrderPermissionTier(currentUser);
  const isFullAccess = permTier === 'FULL_ACCESS';
  const isNoAccess = permTier === 'NO_ACCESS';

  const rawRoles = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
  const isAdmin = currentUser.role === 'admin' || rawRoles.includes('admin');
  const isSalesManager = currentUser.role === 'sales_manager' || rawRoles.includes('sales_manager');
  const isSales = currentUser.role === 'sales' || rawRoles.includes('sales');
  const isAccountant = currentUser.role === 'accountant' || rawRoles.includes('accountant');
  const canCreateOrders = (isFullAccess || isAdmin || isSalesManager || isSales) && !isAccountant;
  const canApproveOrder = (ord?: any) => {
    // Admin và Sales Manager được phép duyệt MỌI đơn hàng
    if (isAdmin || isSalesManager) return true;
    // Sales chỉ được duyệt đơn hàng của Đại lý do mình phụ trách
    if (isSales && ord) {
      const assignedId = ord.assigned_to ?? ord.assigned_sale_id;
      return assignedId === currentUser.id;
    }
    return false;
  };
  const isCustomer = currentUser.role === 'customer' || Boolean(currentUser.roles && currentUser.roles.includes('customer'));
  const [customerDealer, setCustomerDealer] = useState<any | null>(null);

  // Hàm làm sạch lý do cảnh báo: Khi nhân viên/quản lý/admin duyệt thành công, không hiện cảnh báo đại lý tự đặt
  const getCleanApprovalReason = (ord: any): string | null => {
    if (!ord || !ord.approval_reason) return null;
    const s = (ord.status || '').toUpperCase();
    const isApprovedOrPast =
      ['CONFIRMED', 'APPROVED', 'PICKING', 'PREPARING', 'PACKING', 'EXPORTED', 'SHIPPED', 'DELIVERED', 'CLOSED', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(s) ||
      !ord.requires_approval;
    if (isApprovedOrPast) {
      const parts = ord.approval_reason.split('|').map((p: string) => p.trim()).filter(Boolean);
      const remaining = parts.filter((p: string) => {
        const lower = p.toLowerCase().normalize('NFC');
        return (
          !lower.includes('đại lý tự đặt') &&
          !lower.includes('cổng đại lý') &&
          !lower.includes('nhân viên phụ trách xác nhận') &&
          !lower.includes('chờ nhân viên')
        );
      });
      return remaining.join(' | ') || null;
    }
    return ord.approval_reason;
  };

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

  useEffect(() => {
    if (!token) return;
    getOrderDealersApi(token)
      .then((data) => setDealers(data || []))
      .catch((err) => console.warn('Lỗi tải danh sách đại lý:', err));

    if (!isSales || isAdmin || isSalesManager) {
      getOrderSalesRepsApi(token)
        .then((data) => setSalesReps(data || []))
        .catch((err) => console.warn('Lỗi tải danh sách nhân viên:', err));
    }

    getOrderRegionsApi(token)
      .then((data) => setRegions(data || []))
      .catch((err) => console.warn('Lỗi tải danh sách khu vực:', err));
  }, [token, isSales, isAdmin, isSalesManager]);

  // Tính toán số liệu thống kê
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING_APPROVAL' || o.status === 'PENDING').length;
  const confirmedOrdersCount = orders.filter((o) => ['CONFIRMED', 'APPROVED'].includes(o.status)).length;
  const pickingOrdersCount = orders.filter((o) => ['PICKING', 'PREPARING', 'PACKING', 'ĐANG SOẠN HÀNG'].includes((o.status || '').toUpperCase())).length;
  const exportedOrdersCount = orders.filter((o) => ['EXPORTED', 'SHIPPED', 'DISPATCHED', 'ĐÃ XUẤT'].includes((o.status || '').toUpperCase())).length;
  const deliveredOrdersCount = orders.filter((o) => ['DELIVERED', 'CLOSED', 'COMPLETED', 'ĐÃ GIAO'].includes((o.status || '').toUpperCase())).length;
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
          (Boolean(o.dealer_name) && String(o.dealer_name).toLowerCase().includes(q)) ||
          (Boolean(o.delivery_point) && String(o.delivery_point).toLowerCase().includes(q)) ||
          o.created_by.toLowerCase().includes(q) ||
          (Boolean(o.assigned_sale_name) && String(o.assigned_sale_name).toLowerCase().includes(q));

        const matchStatus =
          statusFilter === 'ALL' ||
          (statusFilter === 'PENDING_APPROVAL' && (o.status === 'PENDING_APPROVAL' || o.status === 'PENDING')) ||
          (statusFilter === 'CONFIRMED' && (o.status === 'CONFIRMED' || o.status === 'APPROVED')) ||
          (statusFilter === 'PICKING' && ['PICKING', 'PREPARING', 'PACKING', 'ĐANG SOẠN HÀNG'].includes((o.status || '').toUpperCase())) ||
          (statusFilter === 'EXPORTED' && ['EXPORTED', 'SHIPPED', 'DISPATCHED', 'ĐÃ XUẤT'].includes((o.status || '').toUpperCase())) ||
          (statusFilter === 'DELIVERED' && ['DELIVERED', 'CLOSED', 'COMPLETED', 'ĐÃ GIAO'].includes((o.status || '').toUpperCase())) ||
          (statusFilter === 'REJECTED' && o.status === 'REJECTED') ||
          (statusFilter === 'CANCELLED' && o.status === 'CANCELLED');

        const matchDealer =
          dealerFilter === 'ALL' ||
          String(o.dealer_id) === String(dealerFilter) ||
          (Boolean(o.dealer_name) && String(o.dealer_name).toLowerCase().includes(dealerFilter.toLowerCase()));

        const matchSalesRep =
          salesRepFilter === 'ALL' ||
          String(o.assigned_sale_id ?? (o as any).assigned_to) === String(salesRepFilter) ||
          (Boolean(o.assigned_sale_name) && String(o.assigned_sale_name).toLowerCase().includes(salesRepFilter.toLowerCase()));

        const matchRegion =
          regionFilter === 'ALL' ||
          (Boolean((o as any).region) && String((o as any).region).toLowerCase().includes(regionFilter.toLowerCase())) ||
          (Boolean(o.delivery_point) && String(o.delivery_point).toLowerCase().includes(regionFilter.toLowerCase())) ||
          (Boolean(o.dealer_name) && String(o.dealer_name).toLowerCase().includes(regionFilter.toLowerCase()));

        let matchDate = true;
        if (startDate) {
          matchDate = matchDate && Boolean(o.created_at && o.created_at.slice(0, 10) >= startDate);
        }
        if (endDate) {
          matchDate = matchDate && Boolean(o.created_at && o.created_at.slice(0, 10) <= endDate);
        }

        return matchSearch && matchStatus && matchDealer && matchSalesRep && matchRegion && matchDate;
      })
      .sort((a, b) => {
        const isAPending = a.status === 'PENDING_APPROVAL' || a.status === 'PENDING';
        const isBPending = b.status === 'PENDING_APPROVAL' || b.status === 'PENDING';
        if (isAPending !== isBPending) {
          return isBPending ? 1 : -1; // Đơn chờ duyệt luôn luôn lên đầu danh sách
        }
        return (b.id || 0) - (a.id || 0); // Cùng trạng thái thì đơn mới nhất xếp trước
      });
  }, [orders, searchTerm, statusFilter, dealerFilter, salesRepFilter, regionFilter, startDate, endDate]);

  const filteredTotalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  }, [filteredOrders]);

  // Phân trang danh sách đơn hàng
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 7;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, dealerFilter, salesRepFilter, regionFilter, startDate, endDate]);

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
    const isApprovedOrConfirmed = ['CONFIRMED', 'APPROVED'].includes(order.status);
    const isDropdownOpen = openActionDropdownCode === order.order_code;
    const canApprove = isPending && canApproveOrder(order);

    const canCancel =
      order.status !== 'CANCELLED' &&
      order.status !== 'REJECTED' &&
      !isOrderPastExported(order.status) &&
      isOrderCancelable(order.status) &&
      (isCustomer ? ['PENDING_APPROVAL', 'PENDING', 'DRAFT'].includes(order.status) : isFullAccess);

    // Dropdown thao tác duyệt chỉ hiển thị khi đơn chờ duyệt và có quyền duyệt (Duyệt, Từ chối)
    // Khi đơn đã duyệt: Bỏ menu Thao tác, thay bằng nút Hủy trực tiếp
    const showApprovalDropdown = !isCustomer && !isApprovedOrConfirmed && canApprove;

    // Hiển thị nút Hủy trực tiếp khi có quyền hủy và:
    // 1. Đơn đã duyệt (isApprovedOrConfirmed)
    // 2. Hoặc đơn không có menu dropdown duyệt (isCustomer hoặc nhân viên không có quyền duyệt)
    const showDirectCancel = canCancel && (!showApprovalDropdown || isApprovedOrConfirmed);

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', whiteSpace: 'nowrap' }}>
        {/* Menu Thao tác Duyệt Dropdown khi đơn chờ duyệt và có quyền duyệt */}
        {showApprovalDropdown && (
          <div
            className="order-action-dropdown-container order-status-dropdown-details relative inline-block text-left"
            style={{ position: 'relative', display: 'inline-block' }}
            onMouseEnter={() => handleDropdownOpen(order.order_code)}
            onMouseLeave={handleDropdownCloseWithDelay}
          >
            <button
              type="button"
              id={`btn-status-dropdown-${order.order_code}`}
              onClick={(e) => handleDropdownToggle(e, order.order_code)}
              style={{
                listStyle: 'none',
                padding: '4px 8px',
                background: isDropdownOpen ? '#15803d' : '#16a34a',
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
                gap: '4px',
                height: '28px',
                boxSizing: 'border-box',
                userSelect: 'none',
                outline: 'none',
                transition: 'all 0.15s ease',
                boxShadow: isDropdownOpen ? '0 0 0 2px rgba(22, 163, 74, 0.35)' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#15803d';
              }}
              onMouseLeave={(e) => {
                if (!isDropdownOpen) {
                  e.currentTarget.style.background = '#16a34a';
                }
              }}
            >
              <span>Thao tác duyệt</span>
              <span
                style={{
                  fontSize: '9px',
                  display: 'inline-block',
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              >
                ▼
              </span>
            </button>

            {/* Menu Dropdown mượt mà */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  paddingTop: '4px',
                  zIndex: 100,
                  minWidth: '140px',
                }}
                onMouseEnter={() => handleDropdownOpen(order.order_code)}
                onMouseLeave={handleDropdownCloseWithDelay}
              >
                <div
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -3px rgba(0, 0, 0, 0.15), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                    padding: '5px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px',
                  }}
                >
                  {/* Duyệt đơn */}
                  <button
                    type="button"
                    id={`btn-approve-order-${order.order_code}`}
                    onClick={() => {
                      setOpenActionDropdownCode(null);
                      setApprovingOrder(order);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#16a34a',
                      fontSize: '12.5px',
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
                  >
                    <span style={{ fontSize: '13px', lineHeight: 1 }}>✓</span>
                    <span>Duyệt đơn</span>
                  </button>

                  {/* Từ chối */}
                  <button
                    type="button"
                    id={`btn-reject-order-${order.order_code}`}
                    onClick={() => {
                      setOpenActionDropdownCode(null);
                      setRejectingOrder(order);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#dc2626',
                      fontSize: '12.5px',
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
                  >
                    <span style={{ fontSize: '12px', lineHeight: 1 }}>✕</span>
                    <span>Từ chối</span>
                  </button>

                  {/* Trả lại sửa */}
                  <button
                    type="button"
                    id={`btn-return-order-${order.order_code}`}
                    onClick={() => {
                      setOpenActionDropdownCode(null);
                      setReturningOrder(order);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      width: '100%',
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      color: '#d97706',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      textAlign: 'left',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#fffbeb';
                      e.currentTarget.style.color = '#b45309';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#d97706';
                    }}
                  >
                    <span style={{ fontSize: '13px', lineHeight: 1 }}>↩</span>
                    <span>Trả lại sửa</span>
                  </button>


                  {/* Hủy đơn trong dropdown */}
                  {canCancel && (
                    <button
                      type="button"
                      id={`btn-dropdown-cancel-order-${order.order_code}`}
                      onClick={() => {
                        setOpenActionDropdownCode(null);
                        setCancellingOrder(order);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        width: '100%',
                        padding: '7px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        color: '#ea580c',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        textAlign: 'left',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fff7ed';
                        e.currentTarget.style.color = '#c2410c';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#ea580c';
                      }}
                    >
                      <span style={{ fontSize: '12px', lineHeight: 1 }}>⊘</span>
                      <span>Hủy đơn</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nút Hủy hiển thị trực tiếp khi đã duyệt (hoặc khi không có menu duyệt mà có quyền hủy) */}
        {showDirectCancel && (
          <button
            type="button"
            id={`btn-cancel-order-${order.order_code}`}
            onClick={() => setCancellingOrder(order)}
            style={{
              padding: '4px 10px',
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
              gap: '4px',
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
            title="Hủy đơn hàng này"
          >
            Hủy
          </button>
        )}

        <Link
          to={`/orders/${order.order_code}`}
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
            textDecoration: 'none',
          }}
          title="Xem trang chi tiết đơn hàng"
        >
          Chi tiết
        </Link>
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
            isCustomerLocked ? (
              <button
                type="button"
                id="btn-create-order-view"
                disabled
                className="px-4 py-2 bg-slate-400 text-white font-bold text-xs sm:text-sm rounded-lg cursor-not-allowed opacity-75 shadow-none"
                title="Đại lý hiện đang bị khóa giao dịch, không thể tạo đơn hàng mới"
              >
                Tạo Đơn Hàng Mới (Đã khóa)
              </button>
            ) : (
              <Link
                to="/orders/create"
                id="btn-create-order-view"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer no-underline"
                title="Tạo đơn hàng mới trên trang chuyên biệt"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                </svg>
                Tạo Đơn Hàng Mới
              </Link>
            )
          )}
        </div>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 md:gap-4 mb-3 sm:mb-4 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs">
          <div className="text-xs sm:text-[13px] text-slate-500 font-semibold truncate">
            {isCustomer ? 'Đơn hàng của tôi' : 'Tổng số đơn hàng'}
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-slate-900 mt-0.5 sm:mt-1">{totalOrdersCount} đơn</div>
          <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">
            {isCustomer ? 'Toàn bộ đơn đặt hàng của đại lý' : 'Toàn bộ đơn hàng trên hệ thống'}
          </div>
        </div>

        <div id="stat-card-pending-orders" className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs">
          <div className="text-xs sm:text-[13px] text-amber-700 font-bold truncate">
            {isCustomer ? 'Đang chờ xử lý' : 'Đơn chờ quản lý duyệt'}
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-amber-700 mt-0.5 sm:mt-1">{pendingOrdersCount} đơn</div>
          <div className="text-[11px] sm:text-xs text-amber-600 mt-0.5 truncate hidden sm:block">
            {isCustomer ? 'Đơn đặt hàng đang chờ duyệt' : 'Bán dưới giá sàn cần phê duyệt'}
          </div>
        </div>

        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs">
          <div className="text-xs sm:text-[13px] text-emerald-700 font-bold truncate">
            {isCustomer ? 'Đang giao & Vận chuyển' : 'Đơn đã xác nhận'}
          </div>
          <div className="text-lg sm:text-xl md:text-2xl font-extrabold text-emerald-700 mt-0.5 sm:mt-1">{confirmedOrdersCount} đơn</div>
          <div className="text-[11px] sm:text-xs text-emerald-600 mt-0.5 truncate hidden sm:block">
            {isCustomer ? 'Đang chuẩn bị hàng và vận chuyển' : 'Đủ điều kiện xuất kho bán hàng'}
          </div>
        </div>

        <div className={`border rounded-xl p-2.5 sm:p-3.5 md:p-4 shadow-xs ${isCustomer ? 'bg-blue-50/80 border-blue-200' : 'bg-white border-slate-200'}`}>
          <div className={`text-xs sm:text-[13px] truncate ${isCustomer ? 'text-blue-700 font-bold' : 'text-slate-500 font-semibold'}`}>
            {isCustomer ? 'Đã giao thành công' : 'Tổng doanh thu bán hàng'}
          </div>
          <div className={`text-base sm:text-lg md:text-2xl font-extrabold mt-0.5 sm:mt-1 truncate ${isCustomer ? 'text-blue-700' : 'text-blue-600'}`}>
            {isCustomer ? `${deliveredOrdersCount} đơn` : `${totalRevenue.toLocaleString('vi-VN')} đ`}
          </div>
          <div className="text-[11px] sm:text-xs text-slate-400 mt-0.5 truncate hidden sm:block">
            {isCustomer ? `Tổng tiền mua: ${totalRevenue.toLocaleString('vi-VN')} đ` : 'Giá trị lũy kế các đơn hàng'}
          </div>
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

      {supplementarySuccessMsg && (
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
          <span>✓ {supplementarySuccessMsg}</span>
          <button
            type="button"
            onClick={() => setSupplementarySuccessMsg(null)}
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
        {/* Tìm kiếm và thống kê */}
        <div className="p-2.5 sm:p-3.5 md:px-5 md:py-3 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 bg-slate-50 shrink-0">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách hàng, người tạo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 sm:py-2 rounded-lg border border-slate-300 text-xs sm:text-[13.5px] bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 box-border"
            />
          </div>

          <div className="text-xs text-slate-500 whitespace-nowrap self-end sm:self-center">
            Hiển thị <strong>{paginatedOrders.length}</strong> / {filteredOrders.length} đơn &bull; Tổng tiền lọc: <strong className="text-emerald-700 font-bold">{filteredTotalRevenue.toLocaleString('vi-VN')} đ</strong>
          </div>
        </div>

        {/* Thanh lọc đa tiêu chí - tích hợp nhãn trong ô, không bị tràn cuộn, hiển thị đầy đủ nút Áp dụng & Đặt lại */}
        <div className="px-2.5 sm:px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center gap-1.5 sm:gap-2 text-xs shrink-0 w-full overflow-x-auto box-border">
          <span className="text-slate-500 shrink-0 flex items-center" title="Bộ lọc tìm kiếm">
            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
          </span>

          {/* Ô 1: Trạng thái */}
          <select
            id="filter-status"
            value={draftStatusFilter}
            onChange={(e) => setDraftStatusFilter(e.target.value as any)}
            className="h-[32px] px-2 bg-white border border-slate-300 rounded-md text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer box-border flex-1 min-w-[110px] max-w-[145px] shrink-0 truncate"
            title="Lọc theo trạng thái đơn"
          >
            <option value="ALL">Trạng thái: Tất cả ({totalOrdersCount})</option>
            <option value="PENDING_APPROVAL">Trạng thái: {isCustomer ? 'Chờ xử lý' : 'Chờ duyệt'} ({pendingOrdersCount})</option>
            <option value="CONFIRMED">Trạng thái: {isCustomer ? 'Đang giao' : 'Đã xác nhận'} ({confirmedOrdersCount})</option>
            <option value="PICKING">Trạng thái: Đang soạn ({pickingOrdersCount})</option>
            <option value="EXPORTED">Trạng thái: Đã xuất ({exportedOrdersCount})</option>
            <option value="DELIVERED">Trạng thái: Đã giao ({deliveredOrdersCount})</option>
            <option value="CANCELLED">Trạng thái: Đã hủy ({cancelledOrdersCount})</option>
            <option value="REJECTED">Trạng thái: Từ chối ({rejectedOrdersCount})</option>
          </select>

          {/* Ô 2: Đại lý */}
          {!isCustomer && (
            <select
              id="filter-dealer"
              value={draftDealerFilter}
              onChange={(e) => setDraftDealerFilter(e.target.value)}
              className="h-[32px] px-2 bg-white border border-slate-300 rounded-md text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer box-border flex-1 min-w-[110px] max-w-[145px] shrink-0 truncate"
              title="Lọc theo đại lý"
            >
              <option value="ALL">Đại lý: Tất cả</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  Đại lý: {d.name || d.code}
                </option>
              ))}
            </select>
          )}

          {/* Ô 3: Nhân viên (chỉ dành cho QLKD và Admin) */}
          {!isCustomer && (!isSales || isAdmin || isSalesManager) && (
            <select
              id="filter-sales-rep"
              value={draftSalesRepFilter}
              onChange={(e) => setDraftSalesRepFilter(e.target.value)}
              className="h-[32px] px-2 bg-white border border-slate-300 rounded-md text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer box-border flex-1 min-w-[110px] max-w-[145px] shrink-0 truncate"
              title="Lọc theo nhân viên kinh doanh"
            >
              <option value="ALL">Nhân viên: Tất cả</option>
              {salesReps.map((sr) => (
                <option key={sr.id} value={sr.id}>
                  NV: {sr.full_name || sr.username}
                </option>
              ))}
            </select>
          )}

          {/* Ô 4: Khu vực */}
          {!isCustomer && (
            <select
              id="filter-region"
              value={draftRegionFilter}
              onChange={(e) => setDraftRegionFilter(e.target.value)}
              className="h-[32px] px-2 bg-white border border-slate-300 rounded-md text-xs text-slate-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer box-border flex-1 min-w-[110px] max-w-[145px] shrink-0 truncate"
              title="Lọc theo khu vực"
            >
              <option value="ALL">Khu vực: Tất cả</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  KV: {reg}
                </option>
              ))}
            </select>
          )}

          {/* Ô 5: Từ ngày */}
          <div
            className="flex items-center h-[32px] bg-white border border-slate-300 rounded-md px-2 flex-1 min-w-[115px] max-w-[145px] focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 box-border shrink-0"
            title="Lọc từ ngày"
          >
            <span className="text-slate-500 text-xs font-medium shrink-0 mr-1 select-none">Từ:</span>
            <input
              type="date"
              id="filter-start-date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilter(); }}
              className="w-full text-xs text-slate-700 bg-transparent outline-none cursor-pointer p-0 min-w-0"
            />
          </div>

          {/* Ô 6: Đến ngày */}
          <div
            className="flex items-center h-[32px] bg-white border border-slate-300 rounded-md px-2 flex-1 min-w-[115px] max-w-[145px] focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 box-border shrink-0"
            title="Lọc đến ngày"
          >
            <span className="text-slate-500 text-xs font-medium shrink-0 mr-1 select-none">Đến:</span>
            <input
              type="date"
              id="filter-end-date"
              value={draftEndDate}
              onChange={(e) => setDraftEndDate(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilter(); }}
              className="w-full text-xs text-slate-700 bg-transparent outline-none cursor-pointer p-0 min-w-0"
            />
          </div>

          {/* Nút Áp dụng lọc */}
          <button
            type="button"
            id="btn-apply-order-filter"
            onClick={handleApplyFilter}
            className="h-[32px] px-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 shadow-xs"
            title="Nhấn để áp dụng các tiêu chí lọc đã chọn"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
            </svg>
            Áp dụng
          </button>

          {/* Nút Đặt lại */}
          <button
            type="button"
            id="btn-reset-order-filter"
            onClick={handleResetFilter}
            className="h-[32px] px-2 bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-700 font-semibold rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap shrink-0 flex items-center gap-1"
            title="Đặt lại các tiêu chí lọc về mặc định"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Đặt lại
          </button>
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
                        <Link
                          to={`/orders/${order.order_code}`}
                          className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline text-xs"
                          title="Xem trang chi tiết đơn hàng"
                        >
                          {order.order_code}
                        </Link>
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
                    {(() => {
                      const cleanReason = getCleanApprovalReason(order);
                      const hasLocked = Boolean(
                        order.dealer_status &&
                        (order.dealer_status.toLowerCase().includes('khóa') ||
                         order.dealer_status.toLowerCase().includes('lock'))
                      );
                      if (!cleanReason && !hasLocked) return null;
                      return (
                        <div className="text-[11.5px] p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 leading-tight">
                          {hasLocked && (
                            <div className="font-bold text-red-600 mb-0.5">
                              Đại lý bị khóa giao dịch (Cần kiểm tra công nợ)
                            </div>
                          )}
                          {cleanReason && (
                            <div className="space-y-1">
                              {cleanReason.split(' | ').map((subReason: string, sIdx: number) => (
                                <div key={sIdx} className="leading-snug">
                                  &bull; {subReason}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Nút bấm thao tác */}
                    <div
                      className="flex items-center justify-end gap-2 pt-1.5 border-t border-slate-100"
                      style={{ position: 'relative', zIndex: openActionDropdownCode === order.order_code ? 35 : 'auto' }}
                    >
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
                          position: 'relative',
                          zIndex: openActionDropdownCode === order.order_code ? 30 : 1,
                        }}
                      >
                        <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: '700', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          <Link
                            to={`/orders/${order.order_code}`}
                            style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '700' }}
                            title="Xem trang chi tiết đơn hàng"
                          >
                            {order.order_code}
                          </Link>
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

                        <td style={{ padding: '9px 12px', maxWidth: '280px' }}>
                          {(() => {
                            const cleanReason = getCleanApprovalReason(order);
                            const hasLocked = Boolean(
                              order.dealer_status &&
                              (order.dealer_status.toLowerCase().includes('khóa') ||
                               order.dealer_status.toLowerCase().includes('lock'))
                            );
                            const s = (order.status || '').toUpperCase();
                            const isApprovedOrConfirmed =
                              ['CONFIRMED', 'APPROVED', 'PICKING', 'PREPARING', 'PACKING', 'EXPORTED', 'SHIPPED', 'DELIVERED', 'CLOSED', 'COMPLETED'].includes(s) ||
                              !order.requires_approval;

                            return (
                              <>
                                {hasLocked && (
                                  <div style={{ fontSize: '11.5px', color: '#dc2626', fontWeight: '600', marginBottom: cleanReason ? '3px' : '0' }}>
                                    Đại lý bị khóa giao dịch (Cần kiểm tra công nợ)
                                  </div>
                                )}
                                {cleanReason ? (
                                  <div style={{ fontSize: '11.5px', color: isRejected ? '#dc2626' : '#b45309', lineHeight: '1.4' }}>
                                    {cleanReason.split(' | ').map((subReason: string, sIdx: number) => {
                                      const isFloor = subReason.toLowerCase().includes('giá sàn') || subReason.toLowerCase().includes('giá niêm yết');
                                      const isDebt = subReason.toLowerCase().includes('hạn mức công nợ') || subReason.toLowerCase().includes('tổng nợ');
                                      const isDiscount = subReason.toLowerCase().includes('chiết khấu');
                                      const isReject = subReason.toLowerCase().includes('bị từ chối');

                                      return (
                                        <div key={sIdx} style={{ marginTop: sIdx > 0 ? '3px' : '0' }}>
                                          {isFloor && (
                                            <span style={{ display: 'inline-block', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '3px', padding: '0 4px', fontSize: '10.5px', fontWeight: '700', marginRight: '4px' }}>
                                              Dưới giá sàn
                                            </span>
                                          )}
                                          {isDebt && (
                                            <span style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '3px', padding: '0 4px', fontSize: '10.5px', fontWeight: '700', marginRight: '4px' }}>
                                              Vượt hạn mức
                                            </span>
                                          )}
                                          {isDiscount && (
                                            <span style={{ display: 'inline-block', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', borderRadius: '3px', padding: '0 4px', fontSize: '10.5px', fontWeight: '700', marginRight: '4px' }}>
                                              Vượt CK
                                            </span>
                                          )}
                                          {isReject && (
                                            <span style={{ display: 'inline-block', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '3px', padding: '0 4px', fontSize: '10.5px', fontWeight: '700', marginRight: '4px' }}>
                                              Từ chối
                                            </span>
                                          )}
                                          <span>{subReason}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : isApprovedOrConfirmed ? (
                                  order.approved_by ? (
                                    <div style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: '500' }}>
                                      Duyệt bởi @{order.approved_by}
                                    </div>
                                  ) : !hasLocked ? (
                                    <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Đơn giá chuẩn bảng giá</span>
                                  ) : null
                                ) : isPending ? (
                                  <div style={{ fontSize: '11.5px', color: '#b45309', fontWeight: '500' }}>
                                    {order.discount_rate && order.discount_rate > 0
                                      ? `Chiết khấu (${order.discount_rate}%) vượt hạn mức cần duyệt`
                                      : 'Bán dưới giá sàn cần quản lý duyệt'}
                                  </div>
                                ) : !hasLocked ? (
                                  <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Đơn giá chuẩn bảng giá</span>
                                ) : null}
                              </>
                            );
                          })()}
                        </td>

                        <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap', position: 'relative', zIndex: openActionDropdownCode === order.order_code ? 40 : 'auto' }}>
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




      {/* Modal Xác Nhận Giao Hàng Bổ Sung (Đợt 2) */}
      {supplementaryOrder && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 100005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmittingSupplementary) {
              setSupplementaryOrder(null);
            }
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Xác Nhận Giao Hàng Bổ Sung (Đợt 2)
                </h3>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
                  Đơn hàng: <strong style={{ color: '#0284c7' }}>{supplementaryOrder.order_code}</strong> — Khách hàng: <strong>{supplementaryOrder.dealer_name}</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupplementaryOrder(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '20px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  lineHeight: 1,
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Nội dung danh sách thiếu */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {supplementaryError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontSize: '13px', marginBottom: '14px' }}>
                  {supplementaryError}
                </div>
              )}

              <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>
                Hệ thống sẽ ghi nhận đợt xuất giao bổ sung toàn bộ số lượng còn thiếu cho đại lý, hoàn tất đơn hàng và tự động gỡ nhãn cảnh báo giao thiếu:
              </p>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                      <th style={{ padding: '8px 12px' }}>Sản phẩm</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>SL Đặt</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Đã giao</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a' }}>Giao bổ sung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(supplementaryOrder.items || [])
                      .filter((it: any) => {
                        const qty = Number(it.quantity) || 0;
                        const del = it.delivered_quantity !== undefined && it.delivered_quantity !== null ? Number(it.delivered_quantity) : qty;
                        return del < qty;
                      })
                      .map((it: any, idx: number) => {
                        const qty = Number(it.quantity) || 0;
                        const del = Number(it.delivered_quantity) || 0;
                        const shortage = Math.max(0, qty - del);
                        return (
                          <tr key={idx} style={{ borderTop: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>
                              {it.product_name || `SP #${it.product_id}`}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{qty}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b' }}>{del}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                              +{shortage} {it.unit || 'cái'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  Ghi chú xuất giao bổ sung:
                </label>
                <input
                  type="text"
                  value={supplementaryNote}
                  onChange={(e) => setSupplementaryNote(e.target.value)}
                  placeholder="Giao bổ sung đợt 2 - hoàn tất đơn hàng"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Footer Modal */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={() => setSupplementaryOrder(null)}
                disabled={isSubmittingSupplementary}
                style={{
                  padding: '8px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmSupplementary}
                disabled={isSubmittingSupplementary}
                style={{
                  padding: '8px 18px',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: isSubmittingSupplementary ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingSupplementary ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.3)',
                }}
              >
                {isSubmittingSupplementary ? 'Đang xử lý...' : '✓ Xác nhận xuất giao'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Modal Phê Duyệt Đơn Hàng */}
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

      {/* Modal Từ Chối Đơn Hàng (Bắt buộc lý do) */}
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

      {/* Modal Trả Lại Yêu Cầu Sửa (Bắt buộc ý kiến chỉ đạo) */}
      {returningOrder && (
        <ReturnOrderModal
          isOpen={Boolean(returningOrder)}
          order={returningOrder}
          token={token}
          onClose={() => setReturningOrder(null)}
          onSuccess={() => {
            setReturningOrder(null);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Hủy Đơn Hàng */}
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

    </div>
  );
};
export default OrderManagementView;

