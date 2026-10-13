import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getOrdersApi,
  getOrderDetailApi,
  getOrderDealersApi,
  getOrderSalesRepsApi,
  getOrderRegionsApi,
  cancelOrderApi,
  supplementaryDeliveryApi,
  reorderOrderApi,
  getCloneOrderDataApi,
  getWarehousePickingSummaryApi,
  OrderPickingSummary,
  OrderPickingItem,
  ProductPickingLocationItem,
  OrderResponseData,
  OrderDealer,
  SalesRepItem,
  User,
  ProductItem,
} from '../services/api';
import { OrderCreateModal } from './OrderCreateModal';
import { RejectOrderModal } from './RejectOrderModal';
import { ApproveOrderModal } from './ApproveOrderModal';
import { ReturnOrderModal } from './ReturnOrderModal';
import { OrderApprovalHistory } from './OrderApprovalHistory';
import { emitStatusToast } from './StatusToast';
import { OrderLifecycleTimeline } from './OrderLifecycleTimeline';
import { OrderCancelModal } from './OrderCancelModal';
import { getOrderPermissionTier, isOrderPastExported, isOrderCancelable } from '../utils/orderPermissions';
import OrderPrintModal from './OrderPrintModal';
import { Link } from '../hooks/useLocation';
import './dashboard.css';



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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'REVISION_REQUIRED' | 'CONFIRMED' | 'DELIVERED' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [dealerFilter, setDealerFilter] = useState<string>('ALL');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState<{
    status: 'ALL' | 'PENDING_APPROVAL' | 'REVISION_REQUIRED' | 'CONFIRMED' | 'DELIVERED' | 'REJECTED' | 'CANCELLED';
    dealer: string;
    salesRep: string;
    region: string;
    startDate: string;
    endDate: string;
  }>({
    status: 'ALL',
    dealer: 'ALL',
    salesRep: 'ALL',
    region: 'ALL',
    startDate: '',
    endDate: '',
  });
  const [dealers, setDealers] = useState<OrderDealer[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRepItem[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [pickingSummary, setPickingSummary] = useState<OrderPickingSummary | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState<OrderResponseData | null>(null);
  const [returningOrder, setReturningOrder] = useState<OrderResponseData | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<OrderResponseData | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderResponseData | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<OrderResponseData | any | null>(null);
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
      const updated = await supplementaryDeliveryApi(token, supplementaryOrder.order_code, {
        note: supplementaryNote.trim() || 'Giao bổ sung đợt 2 - hoàn tất đơn hàng',
      });
      setSelectedOrderDetail((prev: any) => ({
        ...prev,
        ...updated,
        status: updated.status || 'DELIVERED',
        items: updated.items || prev?.items,
      }));
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

  // Trạng thái cho luồng Đặt lại đơn hàng (Reorder)
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderResultModal, setReorderResultModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    excludedItems: Array<{ product_id: number; product_name: string; reason: string }>;
    onContinue?: () => void;
  } | null>(null);

  const [reorderInitialData, setReorderInitialData] = useState<{
    dealerId: number;
    items: any[];
    note?: string;
    deliveryPointId?: number | null;
  } | null>(null);

  const permTier = getOrderPermissionTier(currentUser);
  const isFullAccess = permTier === 'FULL_ACCESS';
  const isNoAccess = permTier === 'NO_ACCESS';

  const rawRoles = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
  const isAdmin = currentUser.role === 'admin' || rawRoles.includes('admin');
  const isSalesManager = currentUser.role === 'sales_manager' || rawRoles.includes('sales_manager');
  const isSales = currentUser.role === 'sales' || rawRoles.includes('sales');
  const isOnlySales = isSales && !isAdmin && !isSalesManager;
  const isAccountant = currentUser.role === 'accountant' || rawRoles.includes('accountant');
  const canCreateOrders = !isAccountant && (isAdmin || isSalesManager || isSales);
  const canApproveOrder = (_ord?: any) => {
    // CHỈ ADMIN HOẶC SALES MANAGER MỚI CÓ QUYỀN/VAI TRÒ DUYỆT ĐƠN VÀ TỪ CHỐI ĐƠN
    return isAdmin || isSalesManager;
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

  const handleReorderOrder = async (orderCode: string, productId?: number) => {
    if (isCustomerLocked) {
      emitStatusToast({
        title: 'Tài khoản đại lý bị khóa',
        message: 'Tài khoản đại lý hiện đang bị khóa giao dịch. Không thể đặt lại đơn hàng.',
        type: 'error',
      });
      return;
    }

    setReorderLoading(true);
    try {
      const res = await reorderOrderApi(token, orderCode, productId ? { product_id: productId } : {});

      // Ánh xạ valid_items sang SelectedOrderItem
      const mappedOrderItems = res.valid_items.map((it) => ({
        productId: it.product_id,
        productCode: it.product_code,
        productName: it.product_name,
        stock: it.stock,
        baseUnit: it.base_unit || 'Cái',
        unitName: it.unit || it.base_unit || 'Cái',
        conversionRate: it.conversion_rate || 1.0,
        availableUnits: it.available_units || [{ unit_name: it.base_unit || 'Cái', conversion_rate: 1.0, is_base: true }],
        quantity: it.quantity,
        sellPrice: it.price,
        floorPrice: it.price,
        priceNote: it.price_note,
      }));

      // Nếu không có sản phẩm nào hợp lệ (Case 3, Case 5, Case 9)
      if (!res.can_reorder || res.total_valid === 0) {
        if (productId) {
          const excName = res.excluded_items?.[0]?.product_name || `SP #${productId}`;
          setReorderResultModal({
            isOpen: true,
            title: 'Không thể đặt lại sản phẩm',
            message: `Sản phẩm ${excName} hiện đã ngừng kinh doanh và không thể đặt lại.`,
            excludedItems: res.excluded_items || [],
          });
        } else {
          setReorderResultModal({
            isOpen: true,
            title: 'Không thể đặt lại đơn',
            message: 'Tất cả sản phẩm trong đơn hàng này hiện đã ngừng kinh doanh. Không thể đặt lại đơn.',
            excludedItems: res.excluded_items || [],
          });
        }
        return;
      }

      const continueToNewOrder = () => {
        setReorderResultModal(null);
        setSelectedOrderDetail(null);
    setPickingSummary(null); // Đóng modal chi tiết đơn
        setReorderInitialData({
          dealerId: res.dealer_id,
          items: mappedOrderItems,
          note: productId ? `Đặt lại sản phẩm từ đơn #${res.order_code}` : `Đặt lại từ đơn #${res.order_code}`,
          deliveryPointId: selectedOrderDetail?.delivery_point_id || null,
        });
        setIsCreateModalOpen(true); // Đưa Đại lý đến đơn mới / giỏ hàng theo flow hiện tại
      };

      // Case 2: Một số sản phẩm bị loại
      if (res.total_excluded > 0) {
        setReorderResultModal({
          isOpen: true,
          title: 'Đặt lại đơn thành công',
          message: 'Đặt lại đơn thành công. Tuy nhiên, một số sản phẩm đã bị loại khỏi đơn mới:',
          excludedItems: res.excluded_items,
          onContinue: continueToNewOrder,
        });
      } else {
        // Case 1 & Case 4: Toàn bộ thành công
        emitStatusToast({
          title: 'Đặt lại đơn thành công',
          message: productId
            ? `Đã thêm sản phẩm "${mappedOrderItems[0]?.productName}" vào đơn mới theo giá hiện hành.`
            : `Đã đưa ${res.total_valid} sản phẩm vào đơn mới theo giá hiện hành.`,
          type: 'success',
        });
        continueToNewOrder();
      }
    } catch (err: any) {
      console.error('Lỗi khi đặt lại đơn hàng:', err);
      emitStatusToast({
        title: 'Lỗi đặt lại đơn',
        message: err.message || 'Không thể đặt lại đơn hàng. Vui lòng thử lại.',
        type: 'error',
      });
    } finally {
      setReorderLoading(false);
    }
  };

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
      getWarehousePickingSummaryApi(token, order.order_code)
        .then((res: OrderPickingSummary) => setPickingSummary(res))
        .catch(() => setPickingSummary(null));
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

  useEffect(() => {
    if (!token) return;
    getOrderDealersApi(token)
      .then((data) => setDealers(data || []))
      .catch((err) => console.warn('Lỗi tải danh sách đại lý:', err));

    if (!isOnlySales) {
      getOrderSalesRepsApi(token)
        .then((data) => setSalesReps(data || []))
        .catch((err) => console.warn('Lỗi tải danh sách nhân viên:', err));
    }

    getOrderRegionsApi(token)
      .then((data) => setRegions(data || []))
      .catch((err) => console.warn('Lỗi tải danh sách khu vực:', err));
  }, [token, isOnlySales]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      status: statusFilter,
      dealer: dealerFilter,
      salesRep: salesRepFilter,
      region: regionFilter,
      startDate: startDate,
      endDate: endDate,
    });
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setDealerFilter('ALL');
    setSalesRepFilter('ALL');
    setRegionFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setAppliedFilters({
      status: 'ALL',
      dealer: 'ALL',
      salesRep: 'ALL',
      region: 'ALL',
      startDate: '',
      endDate: '',
    });
    setCurrentPage(1);
  };

  const handleQuickStatusChange = (status: 'ALL' | 'PENDING_APPROVAL' | 'REVISION_REQUIRED' | 'CONFIRMED' | 'DELIVERED' | 'REJECTED' | 'CANCELLED') => {
    setStatusFilter(status);
    setAppliedFilters((prev) => ({ ...prev, status }));
    setCurrentPage(1);
  };

  // Tính toán số liệu thống kê
  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING_APPROVAL' || o.status === 'PENDING' || o.status === 'REVISION_REQUIRED').length;
  const revisionOrdersCount = orders.filter((o) => o.status === 'REVISION_REQUIRED').length;
  const confirmedOrdersCount = orders.filter((o) => ['CONFIRMED', 'APPROVED', 'PICKING', 'PREPARING', 'PACKING', 'EXPORTED', 'SHIPPED', 'DISPATCHED'].includes(o.status)).length;
  const deliveredOrdersCount = orders.filter((o) => ['DELIVERED', 'CLOSED', 'COMPLETED'].includes(o.status)).length;
  const rejectedOrdersCount = orders.filter((o) => o.status === 'REJECTED').length;
  const cancelledOrdersCount = orders.filter((o) => o.status === 'CANCELLED').length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

  // Bộ lọc và sắp xếp đơn hàng: Ưu tiên đơn chờ duyệt hoặc cần sửa lên đầu trang
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
          appliedFilters.status === 'ALL' ||
          (appliedFilters.status === 'PENDING_APPROVAL' && (o.status === 'PENDING_APPROVAL' || o.status === 'PENDING' || o.status === 'REVISION_REQUIRED')) ||
          (appliedFilters.status === 'REVISION_REQUIRED' && o.status === 'REVISION_REQUIRED') ||
          (appliedFilters.status === 'CONFIRMED' && ['CONFIRMED', 'APPROVED', 'PICKING', 'PREPARING', 'PACKING', 'EXPORTED', 'SHIPPED', 'DISPATCHED'].includes(o.status)) ||
          (appliedFilters.status === 'DELIVERED' && ['DELIVERED', 'CLOSED', 'COMPLETED'].includes(o.status)) ||
          (appliedFilters.status === 'REJECTED' && o.status === 'REJECTED') ||
          (appliedFilters.status === 'CANCELLED' && o.status === 'CANCELLED');

        // Lọc theo Đại lý
        const matchDealer =
          appliedFilters.dealer === 'ALL' ||
          String(o.dealer_id) === String(appliedFilters.dealer);

        // Lọc theo Nhân viên kinh doanh
        const matchSalesRep =
          appliedFilters.salesRep === 'ALL' ||
          String(o.assigned_sale_id) === String(appliedFilters.salesRep) ||
          salesReps.find((sr) => String(sr.id) === String(appliedFilters.salesRep))?.username.toLowerCase() === o.created_by.toLowerCase();

        // Lọc theo Khu vực
        const matchRegion =
          appliedFilters.region === 'ALL' ||
          (() => {
            const dealer = dealers.find((d) => String(d.id) === String(o.dealer_id));
            const regionLower = appliedFilters.region.toLowerCase();
            return (
              (dealer?.address && dealer.address.toLowerCase().includes(regionLower)) ||
              ((dealer as any)?.region && String((dealer as any).region).toLowerCase().includes(regionLower)) ||
              ((o as any).region && String((o as any).region).toLowerCase().includes(regionLower))
            );
          })();

        // Lọc theo Khoảng thời gian
        let matchDate = true;
        if (appliedFilters.startDate || appliedFilters.endDate) {
          const orderTime = o.created_at ? new Date(o.created_at).getTime() : 0;
          if (appliedFilters.startDate) {
            const startObj = new Date(appliedFilters.startDate);
            startObj.setHours(0, 0, 0, 0);
            if (orderTime < startObj.getTime()) matchDate = false;
          }
          if (appliedFilters.endDate) {
            const endObj = new Date(appliedFilters.endDate);
            endObj.setHours(23, 59, 59, 999);
            if (orderTime > endObj.getTime()) matchDate = false;
          }
        }

        return matchSearch && matchStatus && matchDealer && matchSalesRep && matchRegion && matchDate;
      })
      .sort((a, b) => {
        const isAPending = a.status === 'PENDING_APPROVAL' || a.status === 'PENDING' || a.status === 'REVISION_REQUIRED';
        const isBPending = b.status === 'PENDING_APPROVAL' || b.status === 'PENDING' || b.status === 'REVISION_REQUIRED';
        if (isAPending !== isBPending) {
          return isBPending ? 1 : -1; // Đơn chờ duyệt và yêu cầu sửa luôn luôn lên đầu danh sách
        }
        return (b.id || 0) - (a.id || 0); // Cùng trạng thái thì đơn mới nhất xếp trước
      });
  }, [orders, searchTerm, appliedFilters, dealers, salesReps]);

  // Tổng tiền của tập kết quả đang lọc
  const filteredTotalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  }, [filteredOrders]);

  // Phân trang danh sách đơn hàng
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 7;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, appliedFilters]);

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
    if (status === 'REVISION_REQUIRED') {
      return (
        <span
          style={{
            display: 'inline-block',
            background: '#ffedd5',
            color: '#c2410c',
            border: '1px solid #fed7aa',
            borderRadius: '999px',
            padding: '2.5px 10px',
            fontSize: '11.5px',
            fontWeight: '600',
            whiteSpace: 'nowrap',
          }}
        >
          Yêu cầu sửa
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
    const isPending = order.status === 'PENDING_APPROVAL' || order.status === 'PENDING' || order.status === 'REVISION_REQUIRED';
    const isDropdownOpen = openActionDropdownCode === order.order_code;
    const canApprove = isPending && canApproveOrder(order);

    const canCancel =
      order.status !== 'CANCELLED' &&
      order.status !== 'REJECTED' &&
      !isOrderPastExported(order.status) &&
      isOrderCancelable(order.status) &&
      (isCustomer ? ['PENDING_APPROVAL', 'PENDING', 'DRAFT', 'REVISION_REQUIRED'].includes(order.status) : isFullAccess);

    const hasDropdownActions = !isCustomer;

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', whiteSpace: 'nowrap' }}>
        {/* Menu Thao tác Dropdown dành cho Nhân viên / Quản lý / Admin */}
        {hasDropdownActions && (
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
                background: canApprove ? (isDropdownOpen ? '#15803d' : '#16a34a') : (isDropdownOpen ? '#e2e8f0' : '#f8fafc'),
                border: canApprove ? 'none' : '1px solid #cbd5e1',
                borderRadius: '6px',
                color: canApprove ? '#ffffff' : '#334155',
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
                boxShadow: canApprove && isDropdownOpen ? '0 0 0 2px rgba(22, 163, 74, 0.35)' : 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = canApprove ? '#15803d' : '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                if (!isDropdownOpen) {
                  e.currentTarget.style.background = canApprove ? '#16a34a' : '#f8fafc';
                }
              }}
            >
              <span>{canApprove ? 'Thao tác duyệt' : 'Thao tác'}</span>
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

            {/* Menu Dropdown */}
            {isDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  paddingTop: '4px',
                  zIndex: 100,
                  minWidth: '150px',
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
                  {/* 1. Duyệt đơn (khi đơn chờ duyệt và có quyền duyệt) */}
                  {canApprove && (
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
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
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
                      <span>Duyệt đơn</span>
                    </button>
                  )}

                  {/* 2. Trả lại sửa */}
                  {canApprove && (
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
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
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
                      <span>Trả lại sửa</span>
                    </button>
                  )}

                  {/* 3. Từ chối */}
                  {canApprove && (
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
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
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
                      <span>Từ chối</span>
                    </button>
                  )}

                  {/* 4. Sao chép đơn */}
                  {!isCustomer && (
                    <button
                      type="button"
                      id={`btn-dropdown-clone-order-${order.order_code}`}
                      onClick={() => {
                        setOpenActionDropdownCode(null);
                        handleCloneOrder(order.order_code);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
                        border: 'none',
                        background: 'transparent',
                        color: '#059669',
                        fontSize: '12.5px',
                        fontWeight: '600',
                        textAlign: 'left',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ecfdf5';
                        e.currentTarget.style.color = '#047857';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#059669';
                      }}
                      title="Sao chép đơn hàng này thành đơn mới"
                    >
                      <span>Sao chép đơn</span>
                    </button>
                  )}

                  {/* 5. Hủy đơn trong dropdown */}
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
                        width: '100%',
                        padding: '6px 10px',
                        borderRadius: '5px',
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
                      <span>Hủy đơn</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Nút Hủy đơn trực tiếp dành cho Khách hàng khi có quyền hủy */}
        {isCustomer && canCancel && (
          <button
            type="button"
            id={`btn-customer-cancel-order-${order.order_code}`}
            onClick={() => setCancellingOrder(order)}
            style={{
              padding: '4px 9px',
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

        {/* Nút Chi tiết */}
        <button
          type="button"
          id={`btn-detail-order-${order.order_code}`}
          onClick={() => handleOpenOrderDetail(order)}
          style={{
            padding: '4px 9px',
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
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e2e8f0';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
          }}
          title="Xem chi tiết các mặt hàng"
        >
          Chi tiết
        </button>
      </div>
    );
  };

  // SCRUM: Chuyển Tạo Đơn Hàng Mới thành 1 trang riêng biệt thay vì popup modal
  if (isCreateModalOpen) {
    return (
      <div className="w-full max-w-[1680px] mx-auto p-2.5 sm:p-4 md:p-6 flex flex-col flex-1 min-h-0 overflow-y-auto">
        <OrderCreateModal
          isOpen={true}
          isPageMode={true}
          token={token}
          currentUser={currentUser}
          products={products}
          initialDealerId={reorderInitialData?.dealerId}
          initialOrderItems={reorderInitialData?.items}
          initialNote={reorderInitialData?.note}
          initialDeliveryPointId={reorderInitialData?.deliveryPointId}
          onClose={() => {
            setIsCreateModalOpen(false);
            setReorderInitialData(null);
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setReorderInitialData(null);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="w-full max-w-[1680px] mx-auto p-2.5 sm:p-4 md:p-0 flex flex-col flex-1 min-h-0 md:h-full overflow-y-auto md:overflow-hidden"
    >
      {/* Thanh tiêu đề */}
      <div className="flex justify-between items-start sm:items-center mb-2.5 sm:mb-3 flex-wrap gap-2 sm:gap-3 shrink-0">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            {isCustomer ? 'Đơn Hàng Của Tôi' : 'Quản Lý Đơn Hàng & Bán Hàng'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isCustomer
              ? 'Theo dõi trạng thái đơn đặt hàng, tiến độ duyệt và giao hàng của đại lý'
              : 'Theo dõi trạng thái đơn bán, kiểm soát biên lợi nhuận và phê duyệt đơn hàng'}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={fetchOrders}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-xs transition-colors"
            title="Tải lại danh sách đơn hàng"
          >
            Làm mới
          </button>

          {canCreateOrders && (
            isCustomerLocked ? (
              <button
                type="button"
                id="btn-create-order-view-disabled"
                disabled
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-300 text-slate-500 font-bold text-xs rounded-lg cursor-not-allowed shadow-none"
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tạo Đơn Hàng Mới
              </Link>
            )
          )}
        </div>
      </div>

      {/* 4 Thẻ KPI Thống kê (Thu gọn bé gọn đồng bộ) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '10px',
        marginBottom: '10px',
        flexShrink: 0,
      }}>
        {/* Thẻ 1: Tổng số đơn */}
        <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>
              {isCustomer ? 'Đơn hàng của tôi' : 'Tổng số đơn hàng'}
            </span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {isCustomer ? 'Tất cả đơn' : 'Hiển thị theo tập lọc'}
            </span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: '#0f172a',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}>
            {filteredOrders.length} / {totalOrdersCount} đơn
          </div>
        </div>

        {/* Thẻ 2: Chờ duyệt */}
        <div
          id="stat-card-pending-orders"
          className="kpi-stat-card"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: pendingOrdersCount > 0 ? '1.5px solid #fde68a' : '1px solid #e2e8f0',
            background: pendingOrdersCount > 0 ? 'linear-gradient(135deg, #fffdf0, #ffffff)' : '#ffffff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '11.5px', color: pendingOrdersCount > 0 ? '#b45309' : '#64748b', fontWeight: '700' }}>
              {isCustomer ? 'Đang chờ xử lý' : 'Đơn chờ quản lý duyệt'}
            </span>
            <span style={{ fontSize: '10.5px', color: pendingOrdersCount > 0 ? '#d97706' : '#94a3b8' }}>
              {isCustomer ? 'Chờ duyệt' : 'Cần phê duyệt'}
            </span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: pendingOrdersCount > 0 ? '#b45309' : '#0f172a',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}>
            {pendingOrdersCount} đơn
          </div>
        </div>

        {/* Thẻ 3: Đã xác nhận */}
        <div
          className="kpi-stat-card"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: confirmedOrdersCount > 0 ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
            background: confirmedOrdersCount > 0 ? 'linear-gradient(135deg, #f0fdf4, #ffffff)' : '#ffffff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '11.5px', color: confirmedOrdersCount > 0 ? '#047857' : '#64748b', fontWeight: '700' }}>
              {isCustomer ? 'Đang giao & Vận chuyển' : 'Đơn đã xác nhận'}
            </span>
            <span style={{ fontSize: '10.5px', color: confirmedOrdersCount > 0 ? '#059669' : '#94a3b8' }}>
              {isCustomer ? 'Đang giao' : 'Đủ đk xuất kho'}
            </span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: confirmedOrdersCount > 0 ? '#047857' : '#0f172a',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}>
            {confirmedOrdersCount} đơn
          </div>
        </div>

        {/* Thẻ 4: Tổng tiền tập lọc */}
        <div
          id="kpi-total-amount"
          className="kpi-stat-card"
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            border: isCustomer ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
            background: isCustomer ? 'linear-gradient(135deg, #eff6ff, #ffffff)' : '#ffffff',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', color: isCustomer ? '#1d4ed8' : '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>
              {isCustomer ? 'Đã giao thành công' : 'Tổng tiền tập lọc'}
            </span>
            <span style={{ fontSize: '10.5px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {isCustomer ? `Tổng tiền: ${filteredTotalRevenue.toLocaleString('vi-VN')} đ` : `Toàn cty: ${totalRevenue.toLocaleString('vi-VN')} đ`}
            </span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: isCustomer ? '#1d4ed8' : '#047857',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {isCustomer ? `${deliveredOrdersCount} đơn` : `${filteredTotalRevenue.toLocaleString('vi-VN')} đ`}
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
        {/* Bộ lọc và tìm kiếm */}
        <div className="p-2 sm:px-4 sm:py-2 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-2 sm:gap-2.5 bg-slate-50 shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách hàng, người tạo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-72 px-3 py-1.5 rounded-lg border border-slate-300 text-xs sm:text-[13px] bg-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 box-border"
              style={{ height: '32px' }}
            />

            <div className="flex overflow-x-auto max-w-full pb-0.5 sm:pb-0 gap-1 bg-slate-200/80 p-0.5 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => handleQuickStatusChange('ALL')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                  appliedFilters.status === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({totalOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => handleQuickStatusChange('PENDING_APPROVAL')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                  appliedFilters.status === 'PENDING_APPROVAL' ? 'bg-white text-amber-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-amber-700'
                }`}
              >
                {isCustomer ? 'Chờ xử lý' : 'Chờ duyệt'} ({pendingOrdersCount})
              </button>
              {revisionOrdersCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('REVISION_REQUIRED')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                    appliedFilters.status === 'REVISION_REQUIRED' ? 'bg-white text-orange-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-orange-700'
                  }`}
                >
                  Yêu cầu sửa ({revisionOrdersCount})
                </button>
              )}
              <button
                type="button"
                onClick={() => handleQuickStatusChange('CONFIRMED')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                  appliedFilters.status === 'CONFIRMED' ? 'bg-white text-emerald-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-emerald-700'
                }`}
              >
                {isCustomer ? 'Đang giao' : 'Đã xác nhận'} ({confirmedOrdersCount})
              </button>
              <button
                type="button"
                onClick={() => handleQuickStatusChange('DELIVERED')}
                className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                  appliedFilters.status === 'DELIVERED' ? 'bg-white text-emerald-800 shadow-xs font-bold' : 'bg-transparent text-slate-600 hover:text-emerald-700'
                }`}
              >
                Đã giao ({deliveredOrdersCount})
              </button>
              {rejectedOrdersCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('REJECTED')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                    appliedFilters.status === 'REJECTED' ? 'bg-white text-red-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-red-700'
                  }`}
                >
                  Bị từ chối ({rejectedOrdersCount})
                </button>
              )}
              {cancelledOrdersCount > 0 && (
                <button
                  type="button"
                  onClick={() => handleQuickStatusChange('CANCELLED')}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-[12.5px] font-semibold whitespace-nowrap cursor-pointer transition-all border-0 ${
                    appliedFilters.status === 'CANCELLED' ? 'bg-white text-slate-700 shadow-xs' : 'bg-transparent text-slate-600 hover:text-slate-900'
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

        {/* Thanh công cụ lọc đa tiêu chí: Trạng thái, Đại lý, Nhân viên, Khu vực, Khoảng thời gian */}
        <div className="p-2 sm:px-4 sm:py-2 bg-white border-b border-slate-200 overflow-x-auto">
          <div className="flex flex-wrap items-end gap-2 w-full">
            {/* 1. Trạng thái */}
            <div className="flex-1 min-w-[125px]">
              <label htmlFor="filter-status" className="block text-[10.5px] font-bold text-[#065f46] uppercase tracking-wider mb-1 whitespace-nowrap">
                TRẠNG THÁI
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm transition-all cursor-pointer"
                style={{ borderRadius: '9999px', height: '32px', borderColor: '#e2e8f0' }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PENDING_APPROVAL">Chờ duyệt</option>
                <option value="REVISION_REQUIRED">Yêu cầu sửa ({revisionOrdersCount})</option>
                <option value="CONFIRMED">Đã duyệt / Xác nhận</option>
                <option value="DELIVERED">Đã giao</option>
                <option value="REJECTED">Bị từ chối</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>

            {/* 2. Đại lý */}
            <div className="flex-[1.2] min-w-[140px]">
              <label htmlFor="filter-dealer" className="block text-[10.5px] font-bold text-[#065f46] uppercase tracking-wider mb-1 whitespace-nowrap">
                ĐẠI LÝ {isOnlySales && <span className="text-emerald-700 font-bold">(Phụ trách)</span>}
              </label>
              <select
                id="filter-dealer"
                value={dealerFilter}
                onChange={(e) => setDealerFilter(e.target.value)}
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm transition-all cursor-pointer"
                style={{ borderRadius: '9999px', height: '32px', borderColor: '#e2e8f0' }}
              >
                <option value="ALL">Tất cả đại lý</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Nhân viên kinh doanh */}
            <div className="flex-[1.4] min-w-[160px]">
              <label htmlFor="filter-sales-rep" className="block text-[10.5px] font-bold text-[#065f46] uppercase tracking-wider mb-1 whitespace-nowrap">
                NHÂN VIÊN KINH DOANH
              </label>
              {isOnlySales ? (
                <input
                  id="filter-sales-rep"
                  type="text"
                  disabled
                  value={`${currentUser.full_name || currentUser.username} (Chính bạn)`}
                  className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-full text-slate-500 cursor-not-allowed font-medium shadow-sm"
                  style={{ borderRadius: '9999px', height: '32px', borderColor: '#e2e8f0' }}
                  title="Nhân viên kinh doanh chỉ xem các đại lý mình phụ trách"
                />
              ) : (
                <select
                  id="filter-sales-rep"
                  value={salesRepFilter}
                  onChange={(e) => setSalesRepFilter(e.target.value)}
                  className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm transition-all cursor-pointer"
                  style={{ borderRadius: '9999px', height: '32px', borderColor: '#e2e8f0' }}
                >
                  <option value="ALL">Tất cả nhân viên</option>
                  {salesReps.map((sr) => (
                    <option key={sr.id} value={sr.id}>
                      {sr.full_name || sr.username}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 4. Khu vực */}
            <div className="flex-1 min-w-[120px]">
              <label htmlFor="filter-region" className="block text-[10.5px] font-bold text-[#065f46] uppercase tracking-wider mb-1 whitespace-nowrap">
                KHU VỰC
              </label>
              <select
                id="filter-region"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm transition-all cursor-pointer"
                style={{ borderRadius: '9999px', height: '32px', borderColor: '#e2e8f0' }}
              >
                <option value="ALL">Tất cả khu vực</option>
                {regions.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Từ ngày */}
            <div className="flex-[0.8] min-w-[125px]">
              <label htmlFor="filter-start-date" className="block text-[10.5px] font-bold text-[#065f46] uppercase tracking-wider mb-1 whitespace-nowrap">
                TỪ NGÀY
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 shadow-sm transition-all"
                style={{ borderRadius: '12px', height: '32px', borderColor: '#e2e8f0' }}
              />
            </div>

            {/* 6. Đến ngày */}
            <div className="flex-[0.8] min-w-[125px]">
              <label htmlFor="filter-end-date" className="block text-[10.5px] font-bold text-[#065f46] uppercase tracking-wider mb-1 whitespace-nowrap">
                ĐẾN NGÀY
              </label>
              <input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilters(); }}
                className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 shadow-sm transition-all"
                style={{ borderRadius: '12px', height: '32px', borderColor: '#e2e8f0' }}
              />
            </div>

            {/* Cụm nút: Lọc & Đặt lại */}
            <div className="flex items-center gap-1.5 shrink-0 self-end">
              <button
                type="button"
                id="btn-apply-filters"
                onClick={handleApplyFilters}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs focus:outline-none transition-all cursor-pointer"
                style={{ height: '32px' }}
                title="Áp dụng các điều kiện lọc đã chọn"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                Lọc
              </button>
              <button
                type="button"
                id="btn-reset-filters"
                onClick={handleResetFilters}
                className="inline-flex items-center justify-center gap-1 px-3 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg shadow-xs focus:outline-none transition-colors cursor-pointer"
                style={{ height: '32px' }}
                title="Xóa tất cả các điều kiện lọc và quay về mặc định"
              >
                Đặt lại
              </button>
            </div>
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
                const isPending = order.status === 'PENDING_APPROVAL' || order.status === 'PENDING';
                const isRevision = order.status === 'REVISION_REQUIRED';
                return (
                  <div
                    key={`mobile-order-${order.id || idx}`}
                    className="bg-white border rounded-xl p-3 shadow-xs space-y-2 transition-all"
                    style={{
                      borderColor: isRevision ? '#fed7aa' : isPending ? '#fde68a' : order.status === 'CONFIRMED' ? '#bbf7d0' : '#e2e8f0',
                      background: isRevision ? '#fffaf5' : isPending ? '#fffdf7' : '#ffffff',
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
                        {order.approval_reason && (
                          <div className="space-y-1">
                            {order.approval_reason.split(' | ').map((subReason: string, sIdx: number) => (
                              <div key={sIdx} className="leading-snug">
                                &bull; {subReason}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

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
                    <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc' }}>Lý Do Cần Duyệt & Mức Vi Phạm</th>
                    <th style={{ padding: '9px 14px', fontWeight: '700', textAlign: 'right', background: '#f8fafc', whiteSpace: 'nowrap', minWidth: '150px' }}>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, idx) => {
                    const isPending = order.status === 'PENDING_APPROVAL' || order.status === 'PENDING';
                    const isRevision = order.status === 'REVISION_REQUIRED';
                    const isRejected = order.status === 'REJECTED';

                    return (
                      <tr
                        key={order.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          background: isRevision ? '#fffaf5' : isPending ? '#fffbeb' : idx % 2 === 0 ? '#ffffff' : '#fcfdfd',
                          transition: 'background 0.15s ease',
                          position: 'relative',
                          zIndex: openActionDropdownCode === order.order_code ? 30 : 1,
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

                        <td style={{ padding: '9px 12px', maxWidth: '280px' }}>
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
                            <div style={{ fontSize: '11.5px', color: isRejected ? '#dc2626' : isRevision ? '#c2410c' : '#b45309', lineHeight: '1.4' }}>
                              {order.approval_reason.split(' | ').map((subReason: string, sIdx: number) => {
                                const isFloor = subReason.toLowerCase().includes('giá sàn') || subReason.toLowerCase().includes('giá niêm yết');
                                const isDebt = subReason.toLowerCase().includes('hạn mức công nợ') || subReason.toLowerCase().includes('tổng nợ');
                                const isDiscount = subReason.toLowerCase().includes('chiết khấu');
                                const isReturn = subReason.toLowerCase().includes('yêu cầu sửa');
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
                                    {isReturn && (
                                      <span style={{ display: 'inline-block', background: '#ffedd5', color: '#c2410c', border: '1px solid #fed7aa', borderRadius: '3px', padding: '0 4px', fontSize: '10.5px', fontWeight: '700', marginRight: '4px' }}>
                                        Cần sửa
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
                  {isCustomer ? (
                    <>Đại lý đặt hàng: <strong>{selectedOrderDetail.dealer_name || currentUser.full_name || currentUser.username}</strong></>
                  ) : (
                    <>Khách hàng: <strong>{selectedOrderDetail.dealer_name}</strong> (Mã: #{selectedOrderDetail.dealer_id})</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintingOrder(selectedOrderDetail)}
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
                  onClick={() => { setSelectedOrderDetail(null); setPickingSummary(null); }}
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
                        {/* Thông tin kho xuất hàng phục vụ */}
            {pickingSummary && (
              <div
                style={{
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#0284c7',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 21V9l9-7 9 7v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '600', textTransform: 'uppercase' }}>
                      Kho xuất hàng mặc định (Đại lý {selectedOrderDetail.dealer_name})
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: '700', color: '#0c4a6e' }}>
                      {pickingSummary.warehouse_name} ({pickingSummary.warehouse_code})
                    </div>
                  </div>
                </div>
                {pickingSummary.warehouse_address && (
                  <div style={{ fontSize: '12.5px', color: '#0369a1', background: '#e0f2fe', padding: '4px 10px', borderRadius: '6px' }}>
                    Địa chỉ: {pickingSummary.warehouse_address}
                  </div>
                )}
              </div>
            )}

            {selectedOrderDetail.approval_reason && (
              <div
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12.5px',
                  color: '#92400e',
                  lineHeight: '1.45',
                }}
              >
                <div style={{ fontWeight: '700', marginBottom: '4px', color: '#b45309' }}>
                  Lý do yêu cầu phê duyệt & Chi tiết mức vi phạm:
                </div>
                {selectedOrderDetail.approval_reason.split(' | ').map((r: string, rIdx: number) => (
                  <div key={rIdx} style={{ marginTop: rIdx > 0 ? '3px' : '0' }}>
                    &bull; {r}
                  </div>
                ))}
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

            {/* Banner Cảnh báo Giao thiếu nếu có bất kỳ mặt hàng nào thực giao < đặt */}
            {(() => {
              const isCompletedDelivery = ['DELIVERED', 'CLOSED', 'COMPLETED', 'SHIPPED', 'EXPORTED'].includes(selectedOrderDetail.status);
              if (!isCompletedDelivery) return null;

              const shortageItems = (selectedOrderDetail.items || []).filter((it: any) => {
                const qty = Number(it.quantity) || 0;
                if (it.shortage_quantity !== undefined && it.shortage_quantity !== null) {
                  return Number(it.shortage_quantity) > 0;
                }
                if (it.delivered_quantity !== undefined && it.delivered_quantity !== null) {
                  return Number(it.delivered_quantity) < qty;
                }
                return false;
              });

              if (shortageItems.length === 0) return null;

              return (
                <div
                  style={{
                    background: '#fff1f2',
                    border: '1.5px solid #f43f5e',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    boxShadow: '0 1px 3px rgba(244, 63, 94, 0.1)',
                  }}
                >
                  <div style={{ flex: 1, fontSize: '13px', color: '#9f1239', lineHeight: '1.5' }}>
                    <strong style={{ display: 'block', color: '#881337', marginBottom: '2px', fontSize: '13.5px' }}>
                      CẢNH BÁO: ĐƠN HÀNG GIAO THIẾU ({shortageItems.length} mặt hàng)
                    </strong>
                    Đơn hàng có {shortageItems.length} sản phẩm thực nhận ít hơn số lượng đặt. Quý khách vui lòng kiểm tra cột <strong>SL Thực giao</strong> và số lượng thiếu tương ứng trên từng dòng sản phẩm bên dưới.
                  </div>
                  {!isCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setSupplementaryOrder(selectedOrderDetail);
                        setSupplementaryNote('Giao bổ sung đợt 2 - hoàn tất đơn hàng');
                        setSupplementaryError(null);
                      }}
                      style={{
                        background: '#be123c',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '7px 14px',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                        flexShrink: 0,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#9f1239')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#be123c')}
                      title="Tạo đợt xuất giao phần hàng còn thiếu"
                    >
                      Giao bổ sung ngay
                    </button>
                  )}
                </div>
              );
            })()}

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
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>SL Đặt</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>SL Thực giao</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vị trí kệ & Khả dụng</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Thành tiền</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrderDetail.items.map((item: any, idx: number) => {
                      const unitName = item.unit || item.unit_name || 'Cái';
                      const qty = Number(item.quantity) || 1;
                      const isCompletedDelivery = ['DELIVERED', 'CLOSED', 'COMPLETED', 'SHIPPED', 'EXPORTED'].includes(selectedOrderDetail.status);
                      const deliveredQty = isCompletedDelivery
                        ? (item.delivered_quantity !== undefined && item.delivered_quantity !== null ? Number(item.delivered_quantity) : qty)
                        : null;
                      const shortage = isCompletedDelivery && deliveredQty !== null ? Math.max(0, qty - deliveredQty) : 0;
                      const pickingItem = pickingSummary?.items.find((p: OrderPickingItem) => p.product_id === item.product_id);
                      const totalAvailable = (pickingItem?.locations || []).reduce(
                        (acc: number, l: ProductPickingLocationItem) => acc + (l.available_quantity || 0),
                        0
                      );
                      const isSufficient = totalAvailable >= qty;
                      const price = item.price || 0;
                      const lineTotal = qty * price;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: shortage > 0 ? '#fff5f5' : 'transparent' }}>
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
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                            {deliveredQty !== null ? (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                <span>{deliveredQty.toLocaleString('vi-VN')}</span>
                                {shortage > 0 ? (
                                  <span
                                    style={{
                                      background: '#fee2e2',
                                      color: '#b91c1c',
                                      border: '1px solid #fecaca',
                                      borderRadius: '4px',
                                      padding: '1px 5px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                    }}
                                    title={`Giao thiếu ${shortage} ${unitName.toLowerCase()}`}
                                  >
                                    Thiếu {shortage}
                                  </span>
                                ) : (
                                  <span style={{ color: '#16a34a', fontSize: '11px', fontWeight: '600' }}>Đủ</span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {pickingItem && pickingItem.locations.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {pickingItem.locations.map((loc: ProductPickingLocationItem) => (
                                  <div
                                    key={loc.location_id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      background: '#f1f5f9',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '6px',
                                      padding: '2px 8px',
                                      fontSize: '12px',
                                    }}
                                  >
                                    <span style={{ fontWeight: '700', color: '#1e293b' }}>
                                      {loc.location_code}
                                    </span>
                                    <span style={{ color: '#64748b', fontSize: '11px' }}>
                                      (Khả dụng: {loc.available_quantity})
                                    </span>
                                  </div>
                                ))}
                                {!isSufficient && (
                                  <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '600' }}>
                                    ⚠️ Thiếu hàng khả dụng (Cần: {qty}, Có: {totalAvailable})
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                                Chưa phân bổ vị trí
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                            {price.toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                            {lineTotal.toLocaleString('vi-VN')} đ
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              title="Đặt lại riêng sản phẩm này theo giá hiện hành"
                              disabled={reorderLoading || isCustomerLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReorderOrder(selectedOrderDetail.order_code, item.product_id);
                              }}
                              style={{
                                padding: '5px 12px',
                                background: '#f0fdf4',
                                border: '1px solid #86efac',
                                borderRadius: '6px',
                                color: '#15803d',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: (reorderLoading || isCustomerLocked) ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!reorderLoading && !isCustomerLocked) {
                                  e.currentTarget.style.background = '#16a34a';
                                  e.currentTarget.style.color = '#ffffff';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!reorderLoading && !isCustomerLocked) {
                                  e.currentTarget.style.background = '#f0fdf4';
                                  e.currentTarget.style.color = '#15803d';
                                }
                              }}
                            >
                              Đặt lại
                            </button>
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

            {/* Lịch sử phê duyệt & xử lý đơn hàng (Bất biến) */}
            <OrderApprovalHistory
              orderCode={selectedOrderDetail.order_code}
              token={token}
            />

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
                    color: ['CONFIRMED', 'APPROVED', 'DELIVERED', 'COMPLETED', 'CLOSED'].includes(selectedOrderDetail.status)
                      ? '#16a34a'
                      : ['EXPORTED', 'SHIPPED', 'DISPATCHED'].includes(selectedOrderDetail.status)
                      ? '#0284c7'
                      : ['REJECTED', 'CANCELLED'].includes(selectedOrderDetail.status)
                      ? '#dc2626'
                      : selectedOrderDetail.status === 'REVISION_REQUIRED'
                      ? '#c2410c'
                      : '#d97706',
                  }}
                >
                  {(() => {
                    const st = selectedOrderDetail.status;
                    if (st === 'DELIVERED') return 'Đã giao hàng';
                    if (st === 'COMPLETED') return 'Đã hoàn tất';
                    if (st === 'CLOSED') return 'Đã đóng';
                    if (st === 'EXPORTED') return 'Đã xuất kho';
                    if (st === 'SHIPPED' || st === 'DISPATCHED') return 'Đang vận chuyển';
                    if (st === 'PICKING' || st === 'PREPARING' || st === 'PACKING') return isCustomer ? 'Đang chuẩn bị hàng' : 'Đang soạn hàng';
                    if (st === 'PENDING_APPROVAL' || st === 'PENDING') return isCustomer ? 'Đang chờ xử lý' : 'Chờ quản lý duyệt';
                    if (st === 'REVISION_REQUIRED') return 'Yêu cầu sửa';
                    if (st === 'CONFIRMED' || st === 'APPROVED') return 'Đã xác nhận';
                    if (st === 'REJECTED') return 'Bị từ chối';
                    if (st === 'CANCELLED') return 'Đã hủy';
                    return st;
                  })()}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* 3 hành động dành cho Quản lý kinh doanh / Admin khi đơn đang chờ duyệt hoặc yêu cầu sửa */}
                {!isCustomer && canApproveOrder(selectedOrderDetail) && ['PENDING_APPROVAL', 'PENDING', 'REVISION_REQUIRED'].includes(selectedOrderDetail.status) && (
                  <>
                    <button
                      type="button"
                      id={`btn-modal-approve-order-${selectedOrderDetail.order_code}`}
                      onClick={() => {
                        const ord = selectedOrderDetail;
                        setApprovingOrder(ord);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#16a34a',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#15803d'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#16a34a'; }}
                    >
                      Duyệt đơn
                    </button>

                    <button
                      type="button"
                      id={`btn-modal-return-order-${selectedOrderDetail.order_code}`}
                      onClick={() => {
                        const ord = selectedOrderDetail;
                        setReturningOrder(ord);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#ea580c',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#c2410c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#ea580c'; }}
                    >
                      Trả lại sửa
                    </button>

                    <button
                      type="button"
                      id={`btn-modal-reject-order-${selectedOrderDetail.order_code}`}
                      onClick={() => {
                        const ord = selectedOrderDetail;
                        setRejectingOrder(ord);
                      }}
                      style={{
                        padding: '8px 16px',
                        background: '#dc2626',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#b91c1c'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#dc2626'; }}
                    >
                      Từ chối
                    </button>
                  </>
                )}
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
                  id="btn-reorder-entire-order"
                  disabled={reorderLoading || isCustomerLocked}
                  onClick={() => handleReorderOrder(selectedOrderDetail.order_code)}
                  style={{
                    padding: '8px 18px',
                    background: (reorderLoading || isCustomerLocked) ? '#94a3b8' : '#16a34a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: (reorderLoading || isCustomerLocked) ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!reorderLoading && !isCustomerLocked) e.currentTarget.style.background = '#15803d';
                  }}
                  onMouseLeave={(e) => {
                    if (!reorderLoading && !isCustomerLocked) e.currentTarget.style.background = '#16a34a';
                  }}
                  title="Đặt lại toàn bộ đơn hàng này theo giá hiện hành"
                >
                  {reorderLoading ? 'Đang kiểm tra...' : 'Đặt lại đơn'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedOrderDetail(null); setPickingSummary(null); }}
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

      {/* Modal Thông báo chi tiết kết quả Đặt lại đơn */}
      {reorderResultModal && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100005,
            padding: '16px',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                {reorderResultModal.title}
              </h3>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ margin: '0 0 14px 0', fontSize: '14px', color: '#334155', lineHeight: 1.5 }}>
                {reorderResultModal.message}
              </p>

              {reorderResultModal.excludedItems.length > 0 && (
                <div style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '14px'
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b', marginBottom: '8px' }}>
                    Sản phẩm không thể đặt lại:
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {reorderResultModal.excludedItems.map((item, idx) => (
                      <div key={idx} style={{ fontSize: '13px', color: '#7f1d1d', padding: '5px 0', borderBottom: idx < reorderResultModal.excludedItems.length - 1 ? '1px dashed #fca5a5' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600 }}>• {item.product_name}</span>
                        <span style={{ color: '#b91c1c', fontSize: '12px' }}>{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              {reorderResultModal.onContinue ? (
                <>
                  <button
                    type="button"
                    onClick={() => setReorderResultModal(null)}
                    style={{
                      padding: '8px 16px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      color: '#475569',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={reorderResultModal.onContinue}
                    style={{
                      padding: '8px 20px',
                      background: '#16a34a',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(22, 163, 74, 0.25)',
                    }}
                  >
                    Tiếp tục lên đơn
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setReorderResultModal(null)}
                  style={{
                    padding: '8px 20px',
                    background: '#0f172a',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Đã hiểu
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
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
            setSelectedOrderDetail(null);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Trả Lại Sửa Đơn Hàng (Bắt buộc ý kiến >= 5 ký tự) */}
      {returningOrder && (
        <ReturnOrderModal
          isOpen={Boolean(returningOrder)}
          order={returningOrder}
          token={token}
          onClose={() => setReturningOrder(null)}
          onSuccess={() => {
            setReturningOrder(null);
            setSelectedOrderDetail(null);
            fetchOrders();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Từ Chối Đơn Hàng (Bắt buộc ý kiến >= 5 ký tự) */}
      {rejectingOrder && (
        <RejectOrderModal
          isOpen={Boolean(rejectingOrder)}
          order={rejectingOrder}
          token={token}
          onClose={() => setRejectingOrder(null)}
          onSuccess={() => {
            setRejectingOrder(null);
            setSelectedOrderDetail(null);
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
      {printingOrder && (
        <OrderPrintModal
          token={token}
          orderCode={printingOrder.order_code}
          initialOrder={printingOrder.items && printingOrder.items.length > 0 ? printingOrder : undefined}
          onClose={() => setPrintingOrder(null)}
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
    </div>
  );
};
export default OrderManagementView;

