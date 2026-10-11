import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getOrdersFilteredApi,
  getOrderDetailApi,
  getOrderDealersApi,
  getUsersApi,
  cancelOrderApi,
  supplementaryDeliveryApi,
  reorderOrderApi,
  getCloneOrderDataApi,
  getWarehousePickingSummaryApi,
  OrderPickingSummary,
  OrderPickingItem,
  ProductPickingLocationItem,
  OrderResponseData,
  User,
  ProductItem,
} from '../services/api';
import { OrderCreateModal } from './OrderCreateModal';
import { RejectOrderModal } from './RejectOrderModal';
import { ApproveOrderModal } from './ApproveOrderModal';
import { emitStatusToast } from './StatusToast';
import { OrderLifecycleTimeline } from './OrderLifecycleTimeline';
import { OrderCancelModal } from './OrderCancelModal';
import { getOrderPermissionTier, isOrderPastExported } from '../utils/orderPermissions';
import OrderPrintModal from './OrderPrintModal';


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
  const [kpiStats, setKpiStats] = useState<{
    total: number;
    pendingCount: number;
    confirmedCount: number;
    filteredTotalAmount: number;
  }>({
    total: 0,
    pendingCount: 0,
    confirmedCount: 0,
    filteredTotalAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Danh mục dữ liệu cho dropdown lọc
  const [dealersList, setDealersList] = useState<any[]>([]);
  const [salesRepsList, setSalesRepsList] = useState<any[]>([]);

  // State tạm thời (Draft filters) - Thay đổi chỉ lưu tạm, KHÔNG tự động gửi API
  const [draftSearch, setDraftSearch] = useState('');
  const [draftStatus, setDraftStatus] = useState<string>('ALL');
  const [draftDealerId, setDraftDealerId] = useState<string>('');
  const [draftSalesRepId, setDraftSalesRepId] = useState<string>('');
  const [draftRegion, setDraftRegion] = useState<string>('');
  const [draftStartDate, setDraftStartDate] = useState<string>('');
  const [draftEndDate, setDraftEndDate] = useState<string>('');

  // State bộ lọc đã áp dụng (Applied filters)
  const [appliedFilters, setAppliedFilters] = useState<{
    search: string;
    status: string;
    dealerId: string;
    salesRepId: string;
    region: string;
    startDate: string;
    endDate: string;
  }>({
    search: '',
    status: 'ALL',
    dealerId: '',
    salesRepId: '',
    region: '',
    startDate: '',
    endDate: '',
  });

  // Phân trang danh sách đơn hàng
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [pickingSummary, setPickingSummary] = useState<OrderPickingSummary | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState<OrderResponseData | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<OrderResponseData | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<OrderResponseData | null>(null);
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);
  const [printingOrder, setPrintingOrder] = useState<OrderResponseData | any | null>(null);
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
  const isAccountant = currentUser.role === 'accountant' || rawRoles.includes('accountant');
  const canCreateOrders = !isAccountant && (isAdmin || isSalesManager || isSales);
  const canApprove = isAdmin || isSalesManager;
  const isCustomer = currentUser.role === 'customer' || Boolean(currentUser.roles && currentUser.roles.includes('customer'));
  const [customerDealer, setCustomerDealer] = useState<any | null>(null);

  const handleExecuteCancel = async (reason: string) => {
    if (!cancellingOrder) return;
    setIsSubmittingCancel(true);
    try {
      await cancelOrderApi(token, cancellingOrder.order_code, reason);
      const targetCode = cancellingOrder.order_code;
      setCancellingOrder(null);
      setCancelNotice(`Đã hủy thành công đơn hàng ${targetCode}. Lượng tồn đang giữ chỗ đã được giải phóng lại kho.`);
      setTimeout(() => setCancelNotice(null), 5000);
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
      alert(err.message || 'Không thể hủy đơn hàng.');
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
      alert(e.message || 'Lỗi khi sao chép đơn hàng');
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

  const fetchOrders = async (pageToFetch: number = currentPage, filtersToApply = appliedFilters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getOrdersFilteredApi(token, {
        search: filtersToApply.search || undefined,
        status: filtersToApply.status !== 'ALL' ? filtersToApply.status : undefined,
        dealer_id: filtersToApply.dealerId ? Number(filtersToApply.dealerId) : undefined,
        sales_rep_id: (!isSales && filtersToApply.salesRepId) ? Number(filtersToApply.salesRepId) : undefined,
        region: filtersToApply.region !== 'ALL' && filtersToApply.region ? filtersToApply.region : undefined,
        start_date: filtersToApply.startDate || undefined,
        end_date: filtersToApply.endDate || undefined,
        page: pageToFetch,
        page_size: pageSize,
      });

      setOrders(res.items || []);
      setKpiStats({
        total: res.total ?? res.items?.length ?? 0,
        pendingCount: res.pending_count ?? 0,
        confirmedCount: res.confirmed_count ?? 0,
        filteredTotalAmount: res.filtered_total_amount ?? 0,
      });
      setCurrentPage(pageToFetch);
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
    // Tải danh sách đại lý phục vụ lọc
    getOrderDealersApi(token)
      .then((dealers) => {
        if (dealers && Array.isArray(dealers)) {
          setDealersList(dealers);
          if (isCustomer && dealers.length > 0) {
            setCustomerDealer(dealers[0]);
          }
        }
      })
      .catch((e) => console.warn('Lỗi tải danh sách đại lý:', e));

    // Nếu không phải sales/customer: tải danh sách nhân viên để chọn lọc
    if (!isSales && !isCustomer) {
      getUsersApi(token)
        .then((res) => {
          if (res && res.users) {
            const reps = res.users.filter((u: any) => {
              const r = (u.role || '').toLowerCase();
              const rs = Array.isArray(u.roles) ? u.roles.map((x: string) => x.toLowerCase()) : [];
              return r === 'sales' || r === 'sales_manager' || rs.includes('sales') || rs.includes('sales_manager');
            });
            setSalesRepsList(reps.length > 0 ? reps : res.users);
          }
        })
        .catch((e) => console.warn('Lỗi tải danh sách nhân viên:', e));
    }
  }, [token, isSales, isCustomer]);

  useEffect(() => {
    fetchOrders(1, appliedFilters);
  }, [token]);

  const handleApplyFilter = () => {
    const nextFilters = {
      search: draftSearch,
      status: draftStatus,
      dealerId: draftDealerId,
      salesRepId: draftSalesRepId,
      region: draftRegion,
      startDate: draftStartDate,
      endDate: draftEndDate,
    };
    setAppliedFilters(nextFilters);
    fetchOrders(1, nextFilters);
  };

  const handleResetFilter = () => {
    setDraftSearch('');
    setDraftStatus('ALL');
    setDraftDealerId('');
    setDraftSalesRepId('');
    setDraftRegion('');
    setDraftStartDate('');
    setDraftEndDate('');

    const emptyFilters = {
      search: '',
      status: 'ALL',
      dealerId: '',
      salesRepId: '',
      region: '',
      startDate: '',
      endDate: '',
    };
    setAppliedFilters(emptyFilters);
    fetchOrders(1, emptyFilters);
  };

  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    dealersList.forEach((d) => {
      if (d.region && typeof d.region === 'string' && d.region.trim()) {
        set.add(d.region.trim());
      }
    });
    ['Hà Nội', 'TP. HCM', 'Miền Bắc', 'Miền Trung', 'Miền Nam'].forEach((r) => set.add(r));
    return Array.from(set);
  }, [dealersList]);

  const totalPages = Math.max(1, Math.ceil(kpiStats.total / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

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
          Chức năng quản lý đơn hàng bán chỉ dành cho Quản trị viên, Quản lý kinh doanh và Nhân viên kinh doanh.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1680px',
        margin: '0 auto',
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Thanh tiêu đề */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px', flexShrink: 0 }}>
        <div>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              {isCustomer ? 'Đơn Hàng Của Tôi' : 'Quản Lý Đơn Hàng & Bán Hàng'}
            </h2>
            {!isCustomer && (
              <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748b' }}>
                Theo dõi trạng thái đơn bán, kiểm soát biên lợi nhuận và phê duyệt đơn hàng
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => fetchOrders(currentPage, appliedFilters)}
            style={{
              padding: '9px 16px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13.5px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
            title="Tải lại danh sách đơn hàng"
          >
            Làm mới
          </button>

          {canCreateOrders && (
            <button
              type="button"
              id="btn-create-order-view"
              onClick={() => !isCustomerLocked && setIsCreateModalOpen(true)}
              disabled={isCustomerLocked}
              style={{
                padding: '9px 20px',
                background: isCustomerLocked ? '#94a3b8' : '#10B981',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: isCustomerLocked ? 'not-allowed' : 'pointer',
                boxShadow: isCustomerLocked ? 'none' : '0 2px 8px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                if (!isCustomerLocked) {
                  e.currentTarget.style.background = '#059669';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.45)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isCustomerLocked) {
                  e.currentTarget.style.background = '#10B981';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.35)';
                }
              }}
              title={isCustomerLocked ? 'Đại lý hiện đang bị khóa giao dịch, không thể tạo đơn hàng mới' : undefined}
            >
              {isCustomerLocked ? 'Tạo Đơn Hàng Mới (Đã khóa)' : 'Tạo Đơn Hàng Mới'}
            </button>
          )}
        </div>
      </div>
      {/* 4 Thẻ KPI thu nhỏ y hệt Quản lý kho hàng (Ảnh 3) & Bỏ toàn bộ chữ bé */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '10px',
        marginBottom: '10px',
        flexShrink: 0,
      }}>
        {/* Thẻ 1: Tổng số đơn hàng */}
        <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Tổng số đơn hàng</span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: '#0f172a',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}>
            {kpiStats.total} đơn
          </div>
        </div>

        {/* Thẻ 2: Đơn chờ quản lý duyệt (bên phải cùng hàng có chữ: Cần duyệt) */}
        <div id="stat-card-pending-orders" className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px', background: '#fffbeb', border: '1px solid #fde68a', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '11.5px', color: '#b45309', fontWeight: '700' }}>Đơn chờ quản lý duyệt</span>
            <span style={{ fontSize: '10.5px', color: '#b45309', fontWeight: '600' }}>Cần duyệt</span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: '#b45309',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}>
            {kpiStats.pendingCount} đơn
          </div>
        </div>

        {/* Thẻ 3: Đơn đã xác nhận (bên phải cùng hàng có chữ: Đã duyệt) */}
        <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '11.5px', color: '#15803d', fontWeight: '700' }}>Đơn đã xác nhận</span>
            <span style={{ fontSize: '10.5px', color: '#15803d', fontWeight: '600' }}>Đã duyệt</span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: '#15803d',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}>
            {kpiStats.confirmedCount} đơn
          </div>
        </div>

        {/* Thẻ 4: Tổng doanh thu bán hàng (bên phải cùng hàng có chữ: Đã gồm VAT) */}
        <div className="kpi-stat-card" style={{ padding: '10px 14px', borderRadius: '10px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '600' }}>Tổng doanh thu bán hàng</span>
            <span style={{ fontSize: '10.5px', color: '#64748b' }}>Đã gồm VAT</span>
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            color: '#0f172a',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.2,
          }}>
            {kpiStats.filteredTotalAmount.toLocaleString('vi-VN')} đ
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
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Thanh công cụ lọc ngang tinh gọn (Compact Horizontal Bar <55px) */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '8px',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        >
          {/* Tìm kiếm từ khóa */}
          <input
            type="text"
            placeholder="Tìm kiếm từ khóa..."
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApplyFilter(); }}
            style={{
              flex: '1 1 180px',
              minWidth: '150px',
              maxWidth: '220px',
              height: '34px',
              padding: '0 10px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              background: '#ffffff',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {/* Trạng thái */}
          <select
            value={draftStatus}
            onChange={(e) => setDraftStatus(e.target.value)}
            style={{
              flex: '0 1 135px',
              minWidth: '120px',
              height: '34px',
              padding: '0 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              background: '#ffffff',
              color: '#334155',
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="PENDING_APPROVAL">Chờ duyệt</option>
            <option value="CONFIRMED">Đã xác nhận</option>
            <option value="COMPLETED">Hoàn thành</option>
            <option value="REJECTED">Bị từ chối</option>
            <option value="CANCELLED">Đã hủy</option>
          </select>

          {/* Đại lý */}
          <select
            value={draftDealerId}
            onChange={(e) => setDraftDealerId(e.target.value)}
            style={{
              flex: '0 1 150px',
              minWidth: '125px',
              height: '34px',
              padding: '0 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              background: '#ffffff',
              color: '#334155',
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <option value="">Tất cả đại lý</option>
            {dealersList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code ? `[${d.code}] ` : ''}{d.name}
              </option>
            ))}
          </select>

          {/* Nhân viên kinh doanh (Ẩn với sales, chỉ hiển thị cho admin / sales_manager) */}
          {!isSales && (
            <select
              value={draftSalesRepId}
              onChange={(e) => setDraftSalesRepId(e.target.value)}
              style={{
                flex: '0 1 140px',
                minWidth: '120px',
                height: '34px',
                padding: '0 8px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                background: '#ffffff',
                color: '#334155',
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Tất cả nhân viên</option>
              {salesRepsList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name || u.username}
                </option>
              ))}
            </select>
          )}

          {/* Khu vực */}
          <select
            value={draftRegion}
            onChange={(e) => setDraftRegion(e.target.value)}
            style={{
              flex: '0 1 120px',
              minWidth: '105px',
              height: '34px',
              padding: '0 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              background: '#ffffff',
              color: '#334155',
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            <option value="">Tất cả khu vực</option>
            {availableRegions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          {/* Khoảng thời gian: Từ ngày */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Từ:</span>
            <input
              type="date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
              style={{
                height: '34px',
                padding: '0 6px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                background: '#ffffff',
                color: '#334155',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Khoảng thời gian: Đến ngày */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>Đến:</span>
            <input
              type="date"
              value={draftEndDate}
              onChange={(e) => setDraftEndDate(e.target.value)}
              style={{
                height: '34px',
                padding: '0 6px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                background: '#ffffff',
                color: '#334155',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Nút Đặt lại */}
          <button
            type="button"
            onClick={handleResetFilter}
            style={{
              height: '34px',
              padding: '0 12px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
            title="Đặt lại bộ lọc về mặc định"
          >
            Đặt lại
          </button>

          {/* Nút Áp dụng lọc */}
          <button
            type="button"
            id="btn-apply-order-filters"
            onClick={handleApplyFilter}
            style={{
              height: '34px',
              padding: '0 16px',
              background: '#10B981',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: '700',
              color: '#ffffff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#059669'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#10B981'; }}
            title="Bắt đầu áp dụng lọc danh sách đơn"
          >
            Áp dụng lọc
          </button>
        </div>

        {/* Nội dung bảng */}
        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '14px', fontWeight: '600' }}>Đang tải danh sách đơn hàng...</div>
          </div>
        ) : error ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#dc2626', fontWeight: '600' }}>
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155' }}>Không có đơn hàng nào phù hợp</div>
            <p style={{ fontSize: '13.5px', color: '#94a3b8', marginTop: '6px' }}>
              Hãy nhấn nút "Tạo Đơn Hàng Mới" để lên đơn bán hàng cho khách hàng hoặc bấm "Đặt lại" bộ lọc.
            </p>
          </div>
        ) : (
          <div
            className="roles-grid-scroll"
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
                  {isCustomer ? (
                    <>
                      <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc', whiteSpace: 'nowrap' }}>Ngày Đặt Hàng</th>
                      <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc', whiteSpace: 'nowrap' }}>Ngày Giao Dự Kiến</th>
                      <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc' }}>Điểm Giao Hàng</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc' }}>Khách Hàng / Đại Lý</th>
                      <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc', whiteSpace: 'nowrap' }}>Người Lên Đơn</th>
                    </>
                  )}
                  <th style={{ padding: '9px 12px', fontWeight: '700', textAlign: 'right', background: '#f8fafc', whiteSpace: 'nowrap' }}>Tổng Giá Trị</th>
                  <th style={{ padding: '9px 12px', fontWeight: '700', textAlign: 'center', background: '#f8fafc', whiteSpace: 'nowrap', minWidth: '155px' }}>
                    {isCustomer ? 'Trạng Thái Đơn Hàng' : 'Trạng Thái Duyệt'}
                  </th>
                  {!isCustomer && (
                    <th style={{ padding: '9px 12px', fontWeight: '700', background: '#f8fafc' }}>Lý Do Cảnh Báo</th>
                  )}
                  <th style={{ padding: '9px 14px', fontWeight: '700', textAlign: 'right', background: '#f8fafc', whiteSpace: 'nowrap', minWidth: isCustomer ? '150px' : '220px' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => {
                  const isPending = order.status === 'PENDING_APPROVAL' || order.status === 'PENDING';
                  const isRejected = order.status === 'REJECTED';
                  const isDelivered = ['DELIVERED', 'CLOSED', 'COMPLETED'].includes(order.status);
                  const isShipping = ['EXPORTED', 'SHIPPED', 'DISPATCHED'].includes(order.status);
                  const isPicking = ['PICKING', 'PREPARING', 'PACKING'].includes(order.status);
                  const isConfirmed = order.status === 'CONFIRMED' || order.status === 'APPROVED';
                  const isCancelled = order.status === 'CANCELLED';

                  const isCompletedDelivery = ['DELIVERED', 'CLOSED', 'COMPLETED', 'SHIPPED', 'EXPORTED'].includes(order.status);
                  const hasShortage = isCompletedDelivery && (order.items || []).some((it: any) => {
                    const qty = Number(it.quantity) || 0;
                    if (it.shortage_quantity !== undefined && it.shortage_quantity !== null) {
                      return Number(it.shortage_quantity) > 0;
                    }
                    if (it.delivered_quantity !== undefined && it.delivered_quantity !== null) {
                      return Number(it.delivered_quantity) < qty;
                    }
                    return false;
                  });

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

                      {isCustomer ? (
                        <>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#475569', fontSize: '12px' }}>
                            {order.created_at ? new Date(order.created_at).toLocaleDateString('vi-VN') : '—'}
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: '#0f172a', fontWeight: '600', fontSize: '12.5px' }}>
                            {order.desired_delivery_date
                              ? new Date(order.desired_delivery_date).toLocaleDateString('vi-VN')
                              : 'Tiêu chuẩn'}
                          </td>
                          <td style={{ padding: '9px 12px', color: '#334155', fontSize: '12px', maxWidth: '240px' }}>
                            <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={order.delivery_point || 'Địa chỉ đại lý'}>
                              {order.delivery_point || 'Địa chỉ đại lý'}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}

                      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a', fontSize: '12.5px', whiteSpace: 'nowrap' }}>
                        {order.total_amount.toLocaleString('vi-VN')} đồng
                      </td>

                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flexWrap: 'wrap' }}>
                          {isPending ? (
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
                              {isCustomer ? 'Đang chờ xử lý' : 'Chờ quản lý duyệt'}
                            </span>
                          ) : isPicking ? (
                            <span
                              style={{
                                display: 'inline-block',
                                background: '#ede9fe',
                                color: '#6d28d9',
                                border: '1px solid #ddd6fe',
                                borderRadius: '999px',
                                padding: '2.5px 10px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isCustomer ? 'Đang chuẩn bị hàng' : 'Đang soạn hàng'}
                            </span>
                          ) : isShipping ? (
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
                              Đang vận chuyển
                            </span>
                          ) : isDelivered ? (
                            <span
                              style={{
                                display: 'inline-block',
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #a7f3d0',
                                borderRadius: '999px',
                                padding: '2.5px 10px',
                                fontSize: '11.5px',
                                fontWeight: '600',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Đã giao hàng
                            </span>
                          ) : isConfirmed ? (
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
                              {isCustomer ? 'Đã xác nhận' : 'Đã xác nhận'}
                            </span>
                          ) : isRejected ? (
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
                          ) : isCancelled ? (
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
                          ) : (
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
                              {order.status === 'CANCELLED' ? 'Đã hủy' : order.status}
                            </span>
                          )}
                          {hasShortage && (
                            <span
                              style={{
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                borderRadius: '4px',
                                padding: '1px 6px',
                                fontSize: '11px',
                                fontWeight: '700',
                                whiteSpace: 'nowrap',
                              }}
                              title="Đơn hàng có mặt hàng giao thiếu so với số lượng đặt"
                            >
                              Giao thiếu
                            </span>
                          )}
                        </div>
                      </td>

                      {!isCustomer && (
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
                      )}

                      <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', whiteSpace: 'nowrap' }}>
                          {/* Menu Dropdown Trạng thái (như Ảnh 1): Gộp Duyệt đơn, Từ chối, Hủy đơn, In đơn */}
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
                              {/* 1. Duyệt đơn: Chữ màu xanh lá */}
                              {isPending && canApprove && (
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
                                  title="Phê duyệt đơn hàng bán dưới giá sàn"
                                >
                                  Duyệt đơn
                                </button>
                              )}

                              {/* 2. Từ chối: Chữ màu đỏ */}
                              {isPending && canApprove && (
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
                                  title="Từ chối đơn hàng"
                                >
                                  Từ chối
                                </button>
                              )}

                              {/* 3. Hủy đơn: Chữ màu cam */}
                              {isFullAccess && order.status !== 'CANCELLED' && order.status !== 'REJECTED' && (
                                <button
                                  type="button"
                                  id={`btn-cancel-order-${order.order_code}`}
                                  disabled={isOrderPastExported(order.status)}
                                  onClick={(e) => {
                                    if (!isOrderPastExported(order.status)) {
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
                                      ? 'Đơn đã xuất kho, không thể hủy'
                                      : 'Hủy đơn hàng'
                                  }
                                >
                                  Hủy đơn
                                </button>
                              )}

                              {/* 4. In đơn: Chữ màu xanh dương */}
                              <button
                                type="button"
                                id={`btn-print-order-${order.order_code}`}
                                onClick={(e) => {
                                  e.currentTarget.closest('details')?.removeAttribute('open');
                                  setPrintingOrder(order);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  width: '100%',
                                  padding: '7px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#0284c7',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  textAlign: 'left',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#f0f9ff';
                                  e.currentTarget.style.color = '#0369a1';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#0284c7';
                                }}
                                title="In phiếu đơn hàng (PDF)"
                              >
                                In đơn
                              </button>
                            </div>
                          </details>

                          {/* Nút Chi tiết */}
                          <button
                            type="button"
                            id={`btn-detail-order-${order.order_code}`}
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
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                            title="Xem chi tiết các mặt hàng"
                          >
                            Chi tiết
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* FOOTER PHÂN TRANG */}
        {!loading && !error && orders.length > 0 && (
          <div
            style={{
              padding: '8px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '12px',
              color: '#64748b',
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: '12.5px', color: '#64748b', fontWeight: '500' }}>
              Trang <span style={{ fontWeight: '700', color: '#0f172a' }}>{safePage}</span> / <span style={{ fontWeight: '700', color: '#0f172a' }}>{totalPages}</span> (Tổng số <span style={{ fontWeight: '700', color: '#0f172a' }}>{kpiStats.total}</span> đơn hàng)
            </div>

            {/* Khối phân trang */}
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
                  onClick={() => fetchOrders(Math.max(1, safePage - 1), appliedFilters)}
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
                      onClick={() => fetchOrders(p, appliedFilters)}
                      style={{
                        minWidth: '24px',
                        height: '100%',
                        padding: '0 7px',
                        border: 'none',
                        borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                        background: isActive ? '#10B981' : '#ffffff',
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
                  onClick={() => fetchOrders(Math.min(totalPages, safePage + 1), appliedFilters)}
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
    setPickingSummary(null);
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
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px 16px 24px',
                borderBottom: '1px solid #f1f5f9',
                flexShrink: 0,
                background: '#ffffff',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Chi Tiết Đơn Hàng #{selectedOrderDetail.order_code}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                  {isCustomer ? (
                    <>Đại lý đặt hàng: <strong>{selectedOrderDetail.dealer_name || currentUser.full_name || currentUser.username}</strong></>
                  ) : (
                    <>Khách hàng: <strong>{selectedOrderDetail.dealer_name}</strong> (Mã: #{selectedOrderDetail.dealer_id})</>
                  )}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                <button
                  type="button"
                  onClick={() => {
                    const code = selectedOrderDetail.order_code;
                    setSelectedOrderDetail(null);
    setPickingSummary(null);
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
                      <th style={{ padding: '8px 12px', textAlign: 'left' }}>Vị trí kệ & Tồn khả dụng</th>
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
                                      (Tồn: {loc.actual_quantity} | Khả dụng: {loc.available_quantity})
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
                    if (st === 'CONFIRMED' || st === 'APPROVED') return 'Đã xác nhận';
                    if (st === 'REJECTED') return 'Bị từ chối';
                    if (st === 'CANCELLED') return 'Đã hủy';
                    return st;
                  })()}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
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

      {/* Modal Tạo Đơn Hàng */}
      {isCreateModalOpen && (
        <OrderCreateModal
          isOpen={isCreateModalOpen}
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

