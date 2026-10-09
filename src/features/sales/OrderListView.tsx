// frontend/src/features/sales/OrderListView.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  getFilteredOrdersApi,
  getOrderDetailApi,
  getOrderDealersApi,
  getOrderSalesRepsApi,
  getOrderRegionsApi,
  OrderResponseData,
  OrderDealer,
  SalesRepItem,
  User,
  ProductItem,
} from '../../services/api';
import { OrderCreateModal } from '../../components/OrderCreateModal';
import { RejectOrderModal } from '../../components/RejectOrderModal';
import { ApproveOrderModal } from '../../components/ApproveOrderModal';

export interface OrderListViewProps {
  currentUser: User;
  token: string;
  products?: ProductItem[];
  onBackToHome?: () => void;
  onRefreshProducts?: () => void;
  onNavigateToPriceBooks?: () => void;
}

export const OrderListView: React.FC<OrderListViewProps> = ({
  currentUser,
  token,
  products = [],
  onBackToHome: _onBackToHome,
  onRefreshProducts,
  onNavigateToPriceBooks: _onNavigateToPriceBooks,
}) => {
  // 1. Phân quyền người dùng
  const rawRoles = currentUser.roles && currentUser.roles.length > 0 ? currentUser.roles : [currentUser.role];
  const isAdmin = currentUser.role === 'admin' || rawRoles.includes('admin');
  const isSalesManager = currentUser.role === 'sales_manager' || rawRoles.includes('sales_manager');
  const isSales = (currentUser.role === 'sales' || rawRoles.includes('sales')) && !(isAdmin || isSalesManager);
  const isCustomer = currentUser.role === 'customer' || rawRoles.includes('customer');
  const canApprove = isAdmin || isSalesManager;

  // 2. State dữ liệu danh mục phụ trợ
  const [dealers, setDealers] = useState<OrderDealer[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRepItem[]>([]);
  const [regions, setRegions] = useState<string[]>([]);

  // 3. State Bộ lọc (Filter Inputs)
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dealerFilter, setDealerFilter] = useState<string>('ALL');
  const [salesRepFilter, setSalesRepFilter] = useState<string>('ALL');
  const [regionFilter, setRegionFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 4. State Phân trang & Dữ liệu đơn hàng
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [orders, setOrders] = useState<OrderResponseData[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [filteredTotalAmount, setFilteredTotalAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 5. State cho 4 Thẻ KPI (Tổng số, Chờ duyệt, Đã duyệt, Tổng doanh thu)
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [confirmedOrdersCount, setConfirmedOrdersCount] = useState<number>(0);

  // 6. State Modals & Chi tiết đơn hàng
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [approvingOrder, setApprovingOrder] = useState<OrderResponseData | null>(null);
  const [rejectingOrder, setRejectingOrder] = useState<OrderResponseData | null>(null);

  // Load danh mục đại lý, nhân viên, khu vực khi mount
  useEffect(() => {
    if (!token) return;

    // Đại lý (backend tự áp dụng RLS: sales chỉ thấy đại lý của mình)
    getOrderDealersApi(token)
      .then((data) => setDealers(data || []))
      .catch((err) => console.warn('Lỗi tải danh sách đại lý:', err));

    // Nhân viên kinh doanh (chỉ hiển thị cho sales_manager / admin)
    if (!isSales) {
      getOrderSalesRepsApi(token)
        .then((data) => setSalesReps(data || []))
        .catch((err) => console.warn('Lỗi tải danh sách nhân viên:', err));
    }

    // Khu vực
    getOrderRegionsApi(token)
      .then((data) => setRegions(data || []))
      .catch((err) => console.warn('Lỗi tải danh sách khu vực:', err));
  }, [token, isSales]);

  // Hàm tải dữ liệu 4 thẻ KPI tóm tắt
  const fetchKpiSummary = useCallback(async () => {
    if (!token) return;
    try {
      const [pendingRes, confirmedRes] = await Promise.all([
        getFilteredOrdersApi(token, { status: 'PENDING_APPROVAL', page: 1, page_size: 1 }),
        getFilteredOrdersApi(token, { status: 'CONFIRMED', page: 1, page_size: 1 }),
      ]);
      setPendingOrdersCount(pendingRes.total || 0);
      setConfirmedOrdersCount(confirmedRes.total || 0);
    } catch (err) {
      console.warn('Lỗi tải KPI tóm tắt:', err);
    }
  }, [token]);

  useEffect(() => {
    fetchKpiSummary();
  }, [fetchKpiSummary]);

  // Hàm tải dữ liệu đơn hàng theo bộ lọc & phân trang
  const fetchOrders = useCallback(
    async (currentPage = page, currentPageSize = pageSize) => {
      setLoading(true);
      setError(null);
      try {
        const params: any = {
          page: currentPage,
          page_size: currentPageSize,
        };
        if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
        if (dealerFilter && dealerFilter !== 'ALL') params.dealer_id = Number(dealerFilter);
        if (!isSales && salesRepFilter && salesRepFilter !== 'ALL') params.sales_rep_id = Number(salesRepFilter);
        if (regionFilter && regionFilter !== 'ALL') params.region = regionFilter;
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;

        const res = await getFilteredOrdersApi(token, params);
        setOrders(res.items || []);
        setTotal(res.total || 0);
        setFilteredTotalAmount(res.filtered_total_amount || 0);
      } catch (err: any) {
        setError(err.message || 'Không thể tải danh sách đơn hàng.');
      } finally {
        setLoading(false);
      }
    },
    [token, statusFilter, dealerFilter, salesRepFilter, regionFilter, startDate, endDate, isSales, page, pageSize]
  );

  // Tự động load khi page hoặc pageSize thay đổi
  useEffect(() => {
    fetchOrders(page, pageSize);
  }, [page, pageSize, fetchOrders]);

  // Nút Áp dụng lọc: Quay về trang 1 và fetch
  const handleApplyFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPage(1);
    fetchOrders(1, pageSize);
  };

  // Nút Đặt lại bộ lọc: Reset toàn bộ inputs về mặc định
  const handleResetFilter = () => {
    setStatusFilter('ALL');
    setDealerFilter('ALL');
    setSalesRepFilter('ALL');
    setRegionFilter('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setLoading(true);
    getFilteredOrdersApi(token, { page: 1, page_size: pageSize })
      .then((res) => {
        setOrders(res.items || []);
        setTotal(res.total || 0);
        setFilteredTotalAmount(res.filtered_total_amount || 0);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    fetchKpiSummary();
  };

  // Xem chi tiết đơn hàng
  const handleOpenOrderDetail = async (order: OrderResponseData) => {
    setSelectedOrderDetail(order);
    setIsLoadingDetail(true);
    try {
      const detail = await getOrderDetailApi(token, order.order_code);
      setSelectedOrderDetail(detail);
    } catch (err) {
      console.error('Lỗi tải chi tiết đơn hàng:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Định dạng hiển thị trạng thái đơn hàng
  const renderStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'CONFIRMED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Đã duyệt
        </span>
      );
    }
    if (s === 'PENDING_APPROVAL' || s === 'PENDING') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          Chờ duyệt
        </span>
      );
    }
    if (s === 'SHIPPING') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          Đang giao
        </span>
      );
    }
    if (s === 'COMPLETED' || s === 'PAID') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-200">
          Hoàn thành
        </span>
      );
    }
    if (s === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          Đã hủy
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          Từ chối
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        {status}
      </span>
    );
  };

  // Định dạng ngày giờ hiển thị
  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full max-w-[1680px] mx-auto flex flex-col gap-4 text-slate-900 pb-10">
      {/* 1. Header Tiêu đề & Nút thao tác chính */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <span>Quản Lý Đơn Hàng & Bán Hàng</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Theo dõi trạng thái đơn bán, kiểm soát biên lợi nhuận và phê duyệt đơn hàng.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="btn-refresh-orders"
            onClick={() => {
              fetchOrders(page, pageSize);
              fetchKpiSummary();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Làm mới
          </button>

          {!isCustomer && (
            <button
              type="button"
              id="btn-create-order"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Tạo Đơn Hàng Mới
            </button>
          )}
        </div>
      </div>

      {/* 2. Bố cục 4 Thẻ KPI Tóm Tắt (Theo chuẩn layout quen thuộc của hệ thống) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Thẻ 1: Tổng số đơn hàng */}
        <div
          id="kpi-total-orders"
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Tổng số đơn hàng
            </div>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">
              {total.toLocaleString('vi-VN')} đơn
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Số lượng đơn khớp bộ lọc</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        </div>

        {/* Thẻ 2: Đơn chờ quản lý duyệt */}
        <div
          id="stat-card-pending-orders"
          className="bg-amber-50/80 p-3.5 sm:p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              Đơn chờ quản lý duyệt
            </div>
            <div className="text-2xl font-extrabold text-amber-900 mt-1">
              {pendingOrdersCount.toLocaleString('vi-VN')} đơn
            </div>
            <div className="text-[11px] text-amber-700 mt-0.5">Bán dưới giá sàn cần phê duyệt</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Thẻ 3: Đơn đã xác nhận */}
        <div
          id="kpi-confirmed-orders"
          className="bg-emerald-50/80 p-3.5 sm:p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Đơn đã xác nhận
            </div>
            <div className="text-2xl font-extrabold text-emerald-900 mt-1">
              {confirmedOrdersCount.toLocaleString('vi-VN')} đơn
            </div>
            <div className="text-[11px] text-emerald-700 mt-0.5">Đủ điều kiện xuất kho bán hàng</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Thẻ 4: Tổng doanh thu bán hàng */}
        <div
          id="kpi-total-amount"
          className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
        >
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Tổng doanh thu bán hàng
            </div>
            <div className="text-2xl font-extrabold text-emerald-700 mt-1">
              {filteredTotalAmount.toLocaleString('vi-VN')} đ
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Doanh thu tổng hợp từ database (không phụ thuộc trang)</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. BẢNG DỮ LIỆU & BỘ LỌC HỢP NHẤT (Single Unified Card - Kiến trúc 1 bảng duy nhất) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Thanh công cụ lọc tinh gọn (Inline Compact Filter Bar) - Thu gọn chiều cao tối đa */}
        <div className="p-3 bg-slate-50/80 border-b border-slate-200">
          <form
            onSubmit={handleApplyFilter}
            className="flex !flex-row flex-wrap xl:flex-nowrap items-end gap-2.5 w-full"
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-end' }}
          >
            {/* 1. Trạng thái */}
            <div className="w-full sm:w-[140px] xl:w-[150px] shrink-0">
              <label htmlFor="filter-status" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Trạng thái
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="PENDING">Mới tạo</option>
                <option value="PENDING_APPROVAL">Chờ duyệt</option>
                <option value="CONFIRMED">Đã duyệt</option>
                <option value="SHIPPING">Đang giao</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="CANCELLED">Hủy</option>
                <option value="REJECTED">Từ chối</option>
              </select>
            </div>

            {/* 2. Đại lý */}
            <div className="w-full sm:w-[200px] xl:w-[220px] shrink-0">
              <label htmlFor="filter-dealer" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Đại lý {isSales && <span className="text-emerald-700 font-bold">(Phụ trách)</span>}
              </label>
              <select
                id="filter-dealer"
                value={dealerFilter}
                onChange={(e) => setDealerFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm"
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
            <div className="w-full sm:w-[180px] xl:w-[190px] shrink-0">
              <label htmlFor="filter-sales-rep" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Nhân viên kinh doanh
              </label>
              {isSales ? (
                <input
                  id="filter-sales-rep"
                  type="text"
                  disabled
                  value={`${currentUser.full_name || currentUser.username} (Chính bạn)`}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-100 border border-slate-300 rounded-lg text-slate-500 cursor-not-allowed font-medium shadow-sm"
                  title="Nhân viên kinh doanh chỉ xem các đại lý mình phụ trách"
                />
              ) : (
                <select
                  id="filter-sales-rep"
                  value={salesRepFilter}
                  onChange={(e) => setSalesRepFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm"
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
            <div className="w-full sm:w-[130px] xl:w-[140px] shrink-0">
              <label htmlFor="filter-region" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Khu vực
              </label>
              <select
                id="filter-region"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-700 shadow-sm"
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
            <div className="w-[125px] shrink-0">
              <label htmlFor="filter-start-date" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Từ ngày
              </label>
              <input
                id="filter-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 shadow-sm"
              />
            </div>

            {/* 6. Đến ngày */}
            <div className="w-[125px] shrink-0">
              <label htmlFor="filter-end-date" className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wide mb-1">
                Đến ngày
              </label>
              <input
                id="filter-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700 shadow-sm"
              />
            </div>

            {/* Nút bấm tác vụ lọc */}
            <div className="flex items-center gap-1.5 ml-auto pt-1 sm:pt-0 shrink-0 self-end">
              <button
                type="button"
                id="btn-reset-filter"
                onClick={handleResetFilter}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-colors shadow-sm"
              >
                Đặt lại
              </button>
              <button
                type="submit"
                id="btn-apply-filter"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Áp dụng lọc
              </button>
            </div>
          </form>
        </div>

        {/* Thông báo lỗi nếu có */}
        {error && (
          <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Bảng Dữ Liệu Đơn Hàng (Data Table) */}
        <div className="overflow-x-auto">
          <table id="orders-table" className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600 tracking-wider">
                <th className="py-2.5 px-3.5">Mã đơn hàng</th>
                <th className="py-2.5 px-3.5">Khách hàng / Đại lý</th>
                <th className="py-2.5 px-3.5">Khu vực</th>
                <th className="py-2.5 px-3.5">Người lên đơn / Phụ trách</th>
                <th className="py-2.5 px-3.5">Ngày tạo</th>
                <th className="py-2.5 px-3.5 text-right">Tổng tiền</th>
                <th className="py-2.5 px-3.5 text-center">Trạng thái đơn</th>
                <th className="py-2.5 px-3.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span>Đang tải dữ liệu đơn hàng...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Không tìm thấy đơn hàng nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id || o.order_code}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => handleOpenOrderDetail(o)}
                  >
                    {/* 1. Mã đơn */}
                    <td className="py-2.5 px-3.5 font-bold text-emerald-700 whitespace-nowrap">
                      {o.order_code}
                    </td>

                    {/* 2. Đại lý */}
                    <td className="py-2.5 px-3.5 font-medium text-slate-800">
                      <div>{o.dealer_name || 'Khách vãng lai'}</div>
                      {o.dealer_lock_reason && !isCustomer && (
                        <div className="text-[10px] text-amber-700">Lý do khóa: {o.dealer_lock_reason}</div>
                      )}
                    </td>

                    {/* 3. Khu vực */}
                    <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                      {o.region || '—'}
                    </td>

                    {/* 4. Nhân viên phụ trách */}
                    <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">
                      {o.assigned_sale_name || o.created_by || '—'}
                    </td>

                    {/* 5. Ngày tạo */}
                    <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                      {formatDateTime(o.created_at)}
                    </td>

                    {/* 6. Tổng tiền */}
                    <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {(o.total_amount || 0).toLocaleString('vi-VN')} đ
                    </td>

                    {/* 7. Trạng thái */}
                    <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {renderStatusBadge(o.status)}
                        {o.approval_reason && (
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800"
                            title={o.approval_reason}
                          >
                            Giá sàn
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 8. Thao tác */}
                    <td
                      className="py-2.5 px-3.5 text-center whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenOrderDetail(o)}
                          className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                          Chi tiết
                        </button>
                        {canApprove && (o.status === 'PENDING_APPROVAL' || o.status === 'PENDING') && (
                          <>
                            <button
                              type="button"
                              onClick={() => setApprovingOrder(o)}
                              className="px-2 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded transition-colors"
                            >
                              Duyệt
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingOrder(o)}
                              className="px-2 py-1 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors"
                            >
                              Từ chối
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Thanh Phân Trang ở Đáy Card (Pagination Controls) */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div id="pagination-info" className="pagination-info flex items-center gap-2 font-medium">
            <span>
              Hiển thị <span className="font-bold text-slate-800">{orders.length}</span> /{' '}
              <span className="font-bold text-slate-800">{total}</span> đơn hàng
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Trang <span className="font-bold text-slate-800">{page}</span> /{' '}
              <span className="font-bold text-slate-800">{totalPages}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span>Số dòng/trang:</span>
              <select
                id="select-page-size"
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setPage(1);
                }}
                className="px-2 py-1 bg-white border border-slate-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="inline-flex rounded-lg shadow-sm">
              <button
                type="button"
                id="btn-prev-page"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-l-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trang trước
              </button>
              <button
                type="button"
                id="btn-next-page"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-l-0 border-slate-300 rounded-r-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trang sau
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Chi tiết đơn hàng */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Chi tiết đơn hàng #{selectedOrderDetail.order_code}
                </h3>
                <p className="text-xs text-slate-500">Đại lý: {selectedOrderDetail.dealer_name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {isLoadingDetail ? (
              <div className="py-8 text-center text-slate-400">Đang tải chi tiết đơn hàng...</div>
            ) : (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-500">Trạng thái: </span>
                    {renderStatusBadge(selectedOrderDetail.status)}
                  </div>
                  <div>
                    <span className="text-slate-500">Ngày tạo: </span>
                    <span className="font-medium text-slate-800">{formatDateTime(selectedOrderDetail.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Người tạo: </span>
                    <span className="font-medium text-slate-800">{selectedOrderDetail.created_by}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Nhân viên phụ trách: </span>
                    <span className="font-medium text-slate-800">{selectedOrderDetail.assigned_sale_name || '—'}</span>
                  </div>
                  {selectedOrderDetail.delivery_point && (
                    <div className="col-span-2">
                      <span className="text-slate-500">Điểm giao hàng: </span>
                      <span className="font-medium text-slate-800">{selectedOrderDetail.delivery_point}</span>
                    </div>
                  )}
                  {selectedOrderDetail.approval_reason && (
                    <div className="col-span-2 text-amber-700 bg-amber-50 p-2 rounded">
                      <span className="font-semibold">Lý do duyệt/cảnh báo: </span>
                      {selectedOrderDetail.approval_reason}
                    </div>
                  )}
                </div>

                {/* Danh sách mặt hàng */}
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">Danh sách sản phẩm</h4>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="py-2 px-3 text-left">Sản phẩm</th>
                          <th className="py-2 px-3 text-center">ĐVT</th>
                          <th className="py-2 px-3 text-right">SL</th>
                          <th className="py-2 px-3 text-right">Đơn giá</th>
                          <th className="py-2 px-3 text-right">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedOrderDetail.items || []).map((it: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-medium text-slate-800">{it.product_name || `SP #${it.product_id}`}</td>
                            <td className="py-2 px-3 text-center text-slate-500">{it.unit_name || it.unit || 'Cái'}</td>
                            <td className="py-2 px-3 text-right font-medium">{it.quantity}</td>
                            <td className="py-2 px-3 text-right font-medium">{(it.price || 0).toLocaleString('vi-VN')} đ</td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {((it.quantity || 0) * (it.price || 0)).toLocaleString('vi-VN')} đ
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tổng tiền & Chiết khấu */}
                <div className="border-t border-slate-100 pt-3 flex flex-col items-end gap-1 text-xs">
                  {selectedOrderDetail.subtotal_amount && selectedOrderDetail.subtotal_amount !== selectedOrderDetail.total_amount && (
                    <div className="text-slate-500">
                      Tạm tính: <span className="font-semibold text-slate-800">{selectedOrderDetail.subtotal_amount.toLocaleString('vi-VN')} đ</span>
                    </div>
                  )}
                  {selectedOrderDetail.discount_amount > 0 && (
                    <div className="text-rose-600">
                      Chiết khấu ({selectedOrderDetail.discount_percent || selectedOrderDetail.discount_rate}%): -{selectedOrderDetail.discount_amount.toLocaleString('vi-VN')} đ
                    </div>
                  )}
                  <div className="text-base font-bold text-emerald-700">
                    Tổng thanh toán: {(selectedOrderDetail.total_amount || 0).toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center gap-2 pt-3 border-t border-slate-100">
              <div className="flex gap-2">
                {canApprove && (selectedOrderDetail?.status === 'PENDING_APPROVAL' || selectedOrderDetail?.status === 'PENDING') && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const o = selectedOrderDetail;
                        setSelectedOrderDetail(null);
                        setApprovingOrder(o);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                    >
                      Duyệt đơn
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const o = selectedOrderDetail;
                        setSelectedOrderDetail(null);
                        setRejectingOrder(o);
                      }}
                      className="px-3.5 py-1.5 text-xs font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                    >
                      Từ chối
                    </button>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrderDetail(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Duyệt đơn hàng */}
      {approvingOrder && (
        <ApproveOrderModal
          isOpen={Boolean(approvingOrder)}
          order={approvingOrder}
          token={token}
          onClose={() => setApprovingOrder(null)}
          onSuccess={() => {
            setApprovingOrder(null);
            fetchOrders(page, pageSize);
            fetchKpiSummary();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Từ chối đơn hàng */}
      {rejectingOrder && (
        <RejectOrderModal
          isOpen={Boolean(rejectingOrder)}
          order={rejectingOrder}
          token={token}
          onClose={() => setRejectingOrder(null)}
          onSuccess={() => {
            setRejectingOrder(null);
            fetchOrders(page, pageSize);
            fetchKpiSummary();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}

      {/* Modal Tạo đơn hàng mới */}
      {isCreateModalOpen && (
        <OrderCreateModal
          isOpen={isCreateModalOpen}
          token={token}
          currentUser={currentUser}
          products={products}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchOrders(page, pageSize);
            fetchKpiSummary();
            if (onRefreshProducts) onRefreshProducts();
          }}
        />
      )}
    </div>
  );
};

export default OrderListView;
