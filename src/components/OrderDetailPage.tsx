import React, { useEffect, useState, useCallback } from 'react';
import {
  getOrderDetailApi,
  getWarehousePickingSummaryApi,
  supplementaryDeliveryApi,
  reorderOrderApi,
  getCloneOrderDataApi,
  OrderPickingSummary,
  OrderPickingItem,
  ProductPickingLocationItem,
  User,
} from '../services/api';
import { useParams, useNavigate } from '../hooks/useLocation';
import { OrderLifecycleTimeline } from './OrderLifecycleTimeline';
import OrderPrintModal from './OrderPrintModal';
import { emitStatusToast } from './StatusToast';
import { OrderApprovalHistory } from './OrderApprovalHistory';

interface OrderDetailPageProps {
  currentUser: User;
  token: string;
  orderId?: string;
  onBack?: () => void;
  onCloneOrder?: (data: any) => void;
  onRefreshProducts?: () => void;
}

export const OrderDetailPage: React.FC<OrderDetailPageProps> = ({
  currentUser,
  token,
  orderId: propOrderId,
  onBack,
  onCloneOrder,
  onRefreshProducts,
}) => {
  const { id: paramOrderId } = useParams<{ id: string }>();
  const orderCode = propOrderId || paramOrderId || '';
  const navigate = useNavigate();

  const [order, setOrder] = useState<any | null>(null);
  const [pickingSummary, setPickingSummary] = useState<OrderPickingSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [printingOrder, setPrintingOrder] = useState<any | null>(null);

  // Supplementary delivery
  const [supplementaryOrder, setSupplementaryOrder] = useState<any | null>(null);
  const [isSubmittingSupplementary, setIsSubmittingSupplementary] = useState(false);
  const [supplementaryNote, setSupplementaryNote] = useState('Giao bổ sung đợt 2 - hoàn tất đơn hàng');
  const [supplementaryError, setSupplementaryError] = useState<string | null>(null);

  // Reorder state
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderResultModal, setReorderResultModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    excludedItems: Array<{ product_id: number; product_name: string; reason: string }>;
    onContinue?: () => void;
  } | null>(null);

  const isCustomer = currentUser.role === 'customer' || Boolean(currentUser.roles && currentUser.roles.includes('customer'));

  const fetchOrderDetail = useCallback(async () => {
    if (!orderCode) {
      setError('Mã đơn hàng không hợp lệ.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const detail = await getOrderDetailApi(token, orderCode);
      setOrder(detail);
      getWarehousePickingSummaryApi(token, orderCode)
        .then((res: OrderPickingSummary) => setPickingSummary(res))
        .catch(() => setPickingSummary(null));
    } catch (err: any) {
      console.error('Không thể tải chi tiết đơn hàng:', err);
      setError(err.message || 'Không thể tải thông tin chi tiết đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [orderCode, token]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/orders');
    }
  };


  const handleConfirmSupplementary = async () => {
    if (!supplementaryOrder) return;
    setIsSubmittingSupplementary(true);
    setSupplementaryError(null);
    try {
      const updated = await supplementaryDeliveryApi(token, supplementaryOrder.order_code, {
        note: supplementaryNote.trim() || undefined,
      });
      setSupplementaryOrder(null);
      setOrder(updated);
      emitStatusToast({
        type: 'success',
        title: 'Tạo đợt giao bổ sung thành công',
        message: `Đã cập nhật đơn hàng ${updated.order_code}. Tồn kho đã được xuất trừ và trạng thái cập nhật ĐÃ XUẤT KHO.`,
      });
      fetchOrderDetail();
      if (onRefreshProducts) onRefreshProducts();
    } catch (err: any) {
      setSupplementaryError(err.message || 'Lỗi khi xác nhận giao bổ sung hàng.');
    } finally {
      setIsSubmittingSupplementary(false);
    }
  };

  const handleCloneOrder = async (code: string) => {
    try {
      const cloneData = await getCloneOrderDataApi(token, code);
      if (onCloneOrder) {
        onCloneOrder(cloneData);
      } else {
        sessionStorage.setItem('clone_order_draft', JSON.stringify(cloneData));
        navigate('/orders/create');
      }
    } catch (e: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi sao chép đơn hàng',
        message: e.message || 'Lỗi khi sao chép đơn hàng',
      });
    }
  };

  const handleReorderOrder = async (code: string, productId?: number) => {
    setReorderLoading(true);
    try {
      const res = await reorderOrderApi(token, code, productId ? { product_id: productId } : undefined);
      const mappedOrderItems = res.valid_items.map((item) => ({
        productId: item.product_id,
        productName: item.product_name,
        productCode: item.product_code || `SP${item.product_id}`,
        unit: item.unit,
        conversionRate: 1,
        quantity: item.quantity,
        rawQuantity: String(item.quantity),
        price: item.current_price ?? item.price,
        rawPrice: String(item.current_price ?? item.price),
        floorPrice: item.current_price ?? item.price,
        discountRate: 0,
        discountAmount: 0,
        lineTotal: item.subtotal ?? (item.price * item.quantity),
      }));

      if (res.total_valid === 0) {
        if (productId) {
          const excName = res.excluded_items[0]?.product_name || `ID #${productId}`;
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
        try {
          sessionStorage.setItem(
            'reorder_draft',
            JSON.stringify({
              dealerId: res.dealer_id,
              items: mappedOrderItems,
              note: productId ? `Đặt lại sản phẩm từ đơn #${res.order_code}` : `Đặt lại từ đơn #${res.order_code}`,
              deliveryPointId: order?.delivery_point_id || null,
            })
          );
        } catch {
          // ignore
        }
        navigate('/orders/create');
      };

      if (res.total_excluded > 0) {
        setReorderResultModal({
          isOpen: true,
          title: 'Đặt lại đơn thành công',
          message: 'Đặt lại đơn thành công. Tuy nhiên, một số sản phẩm đã bị loại khỏi đơn mới:',
          excludedItems: res.excluded_items,
          onContinue: continueToNewOrder,
        });
      } else {
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

  const getCleanApprovalReason = (ord: any): string | null => {
    if (!ord || !ord.approval_reason) return null;
    const s = (ord.status || '').toUpperCase();
    const isApproved =
      ['CONFIRMED', 'APPROVED', 'PICKING', 'PREPARING', 'PACKING', 'EXPORTED', 'SHIPPED', 'DELIVERED', 'CLOSED', 'COMPLETED'].includes(s) ||
      !ord.requires_approval;
    if (isApproved) {
      const parts = ord.approval_reason.split('|').map((p: string) => p.trim()).filter(Boolean);
      const remaining = parts.filter((p: string) => {
        const lower = p.toLowerCase().normalize('NFC');
        return (
          !lower.includes('đại lý tự đặt') &&
          !lower.includes('cổng đại lý') &&
          !lower.includes('nhân viên phụ trách xác nhận')
        );
      });
      return remaining.join(' | ') || null;
    }
    return ord.approval_reason;
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-slate-500">
        <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-base font-semibold text-slate-700">Đang tải chi tiết đơn hàng #{orderCode}...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          !
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Không tìm thấy đơn hàng</h3>
        <p className="text-sm text-slate-600 mb-6">{error || 'Không thể hiển thị thông tin đơn hàng này.'}</p>
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-medium text-sm hover:bg-slate-800 transition-colors cursor-pointer"
        >
          ← Quay lại danh sách đơn hàng
        </button>
      </div>
    );
  }

  const isCustomerLocked = Boolean(
    order?.dealer_status &&
    (order.dealer_status.toLowerCase().includes('khóa') ||
      order.dealer_status.toLowerCase().includes('lock') ||
      order.dealer_status.toLowerCase().includes('ngừng'))
  );

  const cleanModalReason = getCleanApprovalReason(order);

  // Shortage calculation
  const isCompletedDelivery = ['DELIVERED', 'CLOSED', 'COMPLETED', 'SHIPPED', 'EXPORTED'].includes(order.status);
  const shortageItems = (order.items || []).filter((it: any) => {
    const qty = Number(it.quantity) || 0;
    if (it.shortage_quantity !== undefined && it.shortage_quantity !== null) {
      return Number(it.shortage_quantity) > 0;
    }
    if (it.delivered_quantity !== undefined && it.delivered_quantity !== null) {
      return Number(it.delivered_quantity) < qty;
    }
    return false;
  });

  const subtotal =
    order.subtotal_amount ??
    (order.items || []).reduce((acc: number, it: any) => acc + (it.quantity || 0) * (it.price || 0), 0);
  const discountPercent = order.discount_percent || 0;
  const discountAmount = order.discount_amount ?? Math.round((subtotal * discountPercent) / 100);

  const getStatusBadge = (st: string) => {
    let label = st;
    let badgeClass = 'bg-amber-50 text-amber-700 border-amber-200';

    if (st === 'DELIVERED') { label = 'Đã giao hàng'; badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    else if (st === 'COMPLETED') { label = 'Đã hoàn tất'; badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    else if (st === 'CLOSED') { label = 'Đã đóng'; badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    else if (st === 'EXPORTED') { label = 'Đã xuất kho'; badgeClass = 'bg-sky-50 text-sky-700 border-sky-200'; }
    else if (st === 'SHIPPED' || st === 'DISPATCHED') { label = 'Đang vận chuyển'; badgeClass = 'bg-sky-50 text-sky-700 border-sky-200'; }
    else if (st === 'PICKING' || st === 'PREPARING' || st === 'PACKING') { label = isCustomer ? 'Đang chuẩn bị hàng' : 'Đang soạn hàng'; badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200'; }
    else if (st === 'PENDING_APPROVAL' || st === 'PENDING') { label = isCustomer ? 'Đang chờ xử lý' : 'Chờ quản lý duyệt'; badgeClass = 'bg-amber-50 text-amber-700 border-amber-200'; }
    else if (st === 'CONFIRMED' || st === 'APPROVED') { label = 'Đã xác nhận'; badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'; }
    else if (st === 'REJECTED') { label = 'Bị từ chối'; badgeClass = 'bg-rose-50 text-rose-700 border-rose-200'; }
    else if (st === 'CANCELLED') { label = 'Đã hủy'; badgeClass = 'bg-rose-50 text-rose-700 border-rose-200'; }

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${badgeClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="w-full flex-1 flex flex-col min-h-full bg-slate-50">
      {/* Top Header Card */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer shrink-0"
                title="Quay lại danh sách đơn hàng"
              >
                Quay lại
              </button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    Chi Tiết Đơn Hàng #{order.order_code}
                  </h1>
                  {getStatusBadge(order.status)}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  {isCustomer ? (
                    <>Đại lý đặt hàng: <strong className="text-slate-800">{order.dealer_name || currentUser.full_name || currentUser.username}</strong></>
                  ) : (
                    <>Khách hàng: <strong className="text-slate-800">{order.dealer_name}</strong> (Mã: #{order.dealer_id})</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setPrintingOrder(order)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
                title="In phiếu hoặc xuất file PDF đơn hàng"
              >
                In / Xuất PDF
              </button>

              {!isCustomer && (
                <button
                  type="button"
                  onClick={() => handleCloneOrder(order.order_code)}
                  className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 font-semibold text-xs sm:text-sm shadow-2xs transition-all cursor-pointer"
                  title="Sao chép đơn hàng này thành đơn mới"
                >
                  Sao chép đơn này
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stepper / Timeline Vòng đời đơn hàng */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs">
          <OrderLifecycleTimeline
            status={order.status}
            cancelReason={order.cancel_reason}
            cancelledBy={order.cancelled_by}
            cancelledAt={order.cancelled_at}
            approvalReason={order.approval_reason}
            approvedBy={order.approved_by}
          />
        </div>

        {/* Cảnh báo công nợ nếu đại lý bị khóa */}
        {isCustomerLocked && (
          <div className="bg-rose-50 border-1.5 border-rose-500 rounded-2xl p-4 sm:p-5 text-rose-900 shadow-xs">
            <strong className="block text-rose-800 font-bold mb-1">
              CẢNH BÁO CÔNG NỢ: Đại lý &apos;{order.dealer_name}&apos; hiện đang bị KHÓA giao dịch
              {order.dealer_lock_reason ? ` (Lý do: ${order.dealer_lock_reason})` : ''}.
            </strong>
            <p className="text-sm text-rose-700">
              Đơn dở dang này vẫn được phép xử lý nhưng vui lòng kiểm tra kỹ công nợ trước khi xuất hàng!
            </p>
          </div>
        )}

        {/* Thông tin kho xuất hàng */}
        {pickingSummary && (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                Kho xuất hàng mặc định (Đại lý {order.dealer_name})
              </div>
              <div className="text-base font-extrabold text-sky-950 mt-0.5">
                {pickingSummary.warehouse_name} ({pickingSummary.warehouse_code})
              </div>
            </div>
            {pickingSummary.warehouse_address && (
              <div className="text-xs sm:text-sm text-sky-800 bg-sky-100/80 px-3.5 py-1.5 rounded-lg border border-sky-200 font-medium self-start sm:self-auto">
                Địa chỉ: {pickingSummary.warehouse_address}
              </div>
            )}
          </div>
        )}

        {/* Lý do yêu cầu phê duyệt */}
        {cleanModalReason && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 text-amber-900 text-sm shadow-xs">
            <strong className="font-bold text-amber-900">Lý do yêu cầu phê duyệt:</strong> {cleanModalReason}
          </div>
        )}

        {/* Thông tin giao hàng & người lên đơn */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Thông tin vận chuyển & tạo đơn</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Điểm giao hàng</span>
              <div className="font-semibold text-slate-900 mt-1">
                {order.delivery_point || 'Địa chỉ đại lý'}
              </div>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Ngày giao mong muốn</span>
              <div className="font-semibold text-slate-900 mt-1">
                {order.desired_delivery_date
                  ? new Date(order.desired_delivery_date).toLocaleDateString('vi-VN')
                  : 'Tiêu chuẩn'}
              </div>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Người lên đơn</span>
              <div className="font-semibold text-slate-900 mt-1">
                {order.created_by || order.assigned_sale_name || '—'}
              </div>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs text-slate-500 font-medium block">Thời gian tạo</span>
              <div className="font-semibold text-slate-900 mt-1">
                {order.created_at ? new Date(order.created_at).toLocaleString('vi-VN') : '—'}
              </div>
            </div>
          </div>
          {order.note && (
            <div className="mt-4 pt-3.5 border-t border-dashed border-slate-200 text-sm text-slate-700 bg-amber-50/50 p-3 rounded-xl">
              <span className="font-semibold text-slate-900">Ghi chú đơn hàng:</span> <em>{order.note}</em>
            </div>
          )}
        </div>

        {/* Banner Cảnh báo Giao thiếu */}
        {isCompletedDelivery && shortageItems.length > 0 && (
          <div className="bg-rose-50 border-1.5 border-rose-400 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
            <div className="text-sm text-rose-950">
              <strong className="block text-rose-900 font-bold text-base mb-1">
                CẢNH BÁO: ĐƠN HÀNG GIAO THIẾU ({shortageItems.length} mặt hàng)
              </strong>
              Đơn hàng có {shortageItems.length} sản phẩm thực nhận ít hơn số lượng đặt. Quý khách vui lòng kiểm tra cột <strong>SL Thực giao</strong> và số lượng thiếu tương ứng trên từng dòng sản phẩm bên dưới.
            </div>
            {!isCustomer && (
              <button
                type="button"
                onClick={() => {
                  setSupplementaryOrder(order);
                  setSupplementaryNote('Giao bổ sung đợt 2 - hoàn tất đơn hàng');
                  setSupplementaryError(null);
                }}
                className="px-4 py-2.5 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
                title="Tạo đợt xuất giao phần hàng còn thiếu"
              >
                Giao bổ sung ngay
              </button>
            )}
          </div>
        )}

        {/* Danh sách sản phẩm chi tiết */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Danh sách sản phẩm trong đơn ({order.items?.length || 0} sản phẩm)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-xs uppercase font-semibold">
                  <th className="py-3 px-4">Sản phẩm</th>
                  <th className="py-3 px-3 text-center">ĐVT</th>
                  <th className="py-3 px-4 text-right">SL Đặt</th>
                  <th className="py-3 px-4 text-right">SL Thực giao</th>
                  <th className="py-3 px-4">Vị trí kệ & Khả dụng</th>
                  <th className="py-3 px-4 text-right">Đơn giá</th>
                  <th className="py-3 px-4 text-right">Thành tiền</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(!order.items || order.items.length === 0) ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Chưa có thông tin danh sách sản phẩm.
                    </td>
                  </tr>
                ) : (
                  order.items.map((item: any, idx: number) => {
                    const unitName = item.unit || item.unit_name || 'Cái';
                    const qty = Number(item.quantity) || 1;
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
                      <tr key={idx} className={shortage > 0 ? 'bg-rose-50/50' : 'hover:bg-slate-50/70 transition-colors'}>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {item.product_name || `Sản phẩm #${item.product_id}`}
                          {item.product_code && (
                            <span className="block text-xs font-normal text-slate-400 mt-0.5">
                              Mã: {item.product_code}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-center text-slate-600">
                          {unitName}
                          {item.conversion_rate && item.conversion_rate > 1 && (
                            <span className="block text-xs text-slate-400 font-normal">
                              (x{item.conversion_rate})
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {qty.toLocaleString('vi-VN')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {deliveredQty !== null ? (
                            <div className="inline-flex items-center gap-1.5 justify-end">
                              <span>{deliveredQty.toLocaleString('vi-VN')}</span>
                              {shortage > 0 ? (
                                <span className="bg-rose-100 text-rose-700 border border-rose-200 rounded px-1.5 py-0.5 text-[11px] font-bold">
                                  Thiếu {shortage}
                                </span>
                              ) : (
                                <span className="text-emerald-600 text-xs font-semibold">Đủ</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {pickingItem && pickingItem.locations.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {pickingItem.locations.map((loc: ProductPickingLocationItem) => (
                                <div
                                  key={loc.location_id}
                                  className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5 text-xs"
                                >
                                  <span className="font-bold text-slate-800">{loc.location_code}</span>
                                  <span className="text-slate-500 text-[11px]">(Khả dụng: {loc.available_quantity})</span>
                                </div>
                              ))}
                              {!isSufficient && (
                                <span className="text-rose-600 text-xs font-medium mt-0.5">
                                  Thiếu hàng khả dụng (Cần: {qty}, Có: {totalAvailable})
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Chưa phân bổ vị trí</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-700">
                          {price.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {lineTotal.toLocaleString('vi-VN')} đ
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            title="Đặt lại riêng sản phẩm này theo giá hiện hành"
                            disabled={reorderLoading || isCustomerLocked}
                            onClick={() => handleReorderOrder(order.order_code, item.product_id)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Đặt lại
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Bảng tổng kết tiền */}
          <div className="p-5 bg-slate-50/80 border-t border-slate-200">
            <div className="max-w-md ml-auto space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Tổng tiền hàng:</span>
                <span className="font-bold text-slate-900">{subtotal.toLocaleString('vi-VN')} đ</span>
              </div>
              {discountPercent > 0 && (
                <div className="flex justify-between text-rose-600 font-medium">
                  <span>Chiết khấu ({discountPercent}%):</span>
                  <span>-{discountAmount.toLocaleString('vi-VN')} đ</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t border-slate-200 text-base">
                <strong className="text-slate-900">Tổng thanh toán:</strong>
                <strong className="text-emerald-700 text-xl font-extrabold">
                  {order.total_amount?.toLocaleString('vi-VN')} đ
                </strong>
              </div>
            </div>
          </div>

          {/* Lịch sử phê duyệt & xử lý đơn hàng */}
          <div className="p-5 border-t border-slate-200 bg-white">
            <OrderApprovalHistory orderCode={order.order_code} token={token} />
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 shadow-md w-full mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xs sm:text-sm font-semibold text-slate-500 uppercase tracking-wider">Trạng thái:</span>
            {getStatusBadge(order.status)}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap justify-end">
            {/* Nút Đặt lại toàn bộ đơn */}
            <button
              type="button"
              id="btn-reorder-entire-order"
              disabled={reorderLoading || isCustomerLocked}
              onClick={() => handleReorderOrder(order.order_code)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-xs disabled:cursor-not-allowed"
              title="Đặt lại toàn bộ đơn hàng này theo giá hiện hành"
            >
              {reorderLoading ? 'Đang kiểm tra...' : 'Đặt lại đơn'}
            </button>

            {/* Nút Quay lại */}
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-all cursor-pointer"
            >
              Quay lại
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      {printingOrder && (
        <OrderPrintModal
          orderCode={printingOrder.order_code}
          token={token}
          onClose={() => setPrintingOrder(null)}
        />
      )}

      {/* Modal Giao Bổ Sung */}
      {supplementaryOrder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Xác nhận Giao bổ sung cho đơn #{supplementaryOrder.order_code}
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Hệ thống sẽ cập nhật trạng thái đơn sang <strong>ĐÃ XUẤT KHO</strong> và xuất trừ số lượng hàng còn thiếu trong kho tương ứng.
            </p>
            {supplementaryError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg mb-4">
                {supplementaryError}
              </div>
            )}
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú đợt giao bổ sung:
            </label>
            <textarea
              value={supplementaryNote}
              onChange={(e) => setSupplementaryNote(e.target.value)}
              className="w-full h-20 p-2.5 text-sm border border-slate-300 rounded-lg focus:outline-emerald-500 mb-4"
              placeholder="Nhập ghi chú xuất giao bổ sung..."
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSupplementaryOrder(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isSubmittingSupplementary}
                onClick={handleConfirmSupplementary}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmittingSupplementary ? 'Đang xuất hàng...' : 'Xác nhận xuất hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Kết quả đặt lại đơn */}
      {reorderResultModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{reorderResultModal.title}</h3>
            <p className="text-sm text-slate-600 mb-4">{reorderResultModal.message}</p>
            {reorderResultModal.excludedItems.length > 0 && (
              <div className="max-h-48 overflow-y-auto bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4 space-y-2 text-xs">
                {reorderResultModal.excludedItems.map((ex, i) => (
                  <div key={i} className="flex justify-between text-slate-700">
                    <span className="font-semibold">{ex.product_name}</span>
                    <span className="text-rose-600">{ex.reason}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setReorderResultModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
              {reorderResultModal.onContinue && (
                <button
                  type="button"
                  onClick={reorderResultModal.onContinue}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer"
                >
                  Tiếp tục tạo đơn
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetailPage;
