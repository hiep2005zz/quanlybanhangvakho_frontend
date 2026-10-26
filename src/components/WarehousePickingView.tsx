import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  EligiblePickingOrder,
  BatchPickingPreviewResponse,
  BatchPickingRouteItem,
  getEligiblePickingOrdersApi,
  previewBatchPickingApi,
  completeBatchPickingApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import WarehousePickingPrintModal from './WarehousePickingPrintModal';

interface WarehousePickingViewProps {
  token: string;
  currentUser: User;
  onBackToHome?: () => void;
  initialSelectedOrderCodes?: string[];
}

export const WarehousePickingView: React.FC<WarehousePickingViewProps> = ({
  token,
  currentUser,
  onBackToHome,
  initialSelectedOrderCodes,
}) => {
  // --- STATE DANH SÁCH ĐƠN HÀNG CHỜ SOẠN ---
  const [orders, setOrders] = useState<EligiblePickingOrder[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);
  const [orderSearch, setOrderSearch] = useState<string>('');
  const orderStatusFilter = 'all';
  const [selectedOrderCodes, setSelectedOrderCodes] = useState<string[]>(
    initialSelectedOrderCodes && initialSelectedOrderCodes.length > 0 ? initialSelectedOrderCodes : []
  );

  // Phân trang đơn hàng chờ soạn (mặc định 10 đơn/trang)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const pageSize = 10;

  // --- STATE PHIẾU SOẠN HÀNG ĐANG THỰC HIỆN ---
  const [activeBatch, setActiveBatch] = useState<BatchPickingPreviewResponse | null>(null);
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // State các dòng soạn thực tế: map từ product_id -> { picked_quantity, shortage_reason, is_done }
  interface ItemState {
    picked_quantity: number | string;
    shortage_reason: string;
    is_done: boolean;
  }
  const [itemsState, setItemsState] = useState<Record<number, ItemState>>({});

  // Bộ lọc trong phiếu soạn (Tất cả / Chưa soạn / Đã soạn / Soạn thiếu)
  const [routeFilter, setRouteFilter] = useState<'all' | 'unpicked' | 'picked' | 'shortage'>('all');
  const [routeSearch, setRouteSearch] = useState<string>('');
  const [expandedBreakdown, setExpandedBreakdown] = useState<Record<number, boolean>>({});

  // Tải danh sách đơn hàng đã duyệt theo trang
  const fetchEligibleOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const res = await getEligiblePickingOrdersApi(
        token,
        orderSearch,
        orderStatusFilter,
        currentPage,
        pageSize
      );
      if (res && 'pagination' in res) {
        setOrders(res.items || res.data || []);
        setTotalPages(res.pagination.total_pages || 1);
        setTotalRecords(res.pagination.total_records || 0);
      } else if (Array.isArray(res)) {
        setOrders(res);
        setTotalPages(Math.max(1, Math.ceil(res.length / pageSize)));
        setTotalRecords(res.length);
      }
    } catch (err: any) {
      emitStatusToast({
        message: err?.message || 'Không thể tải danh sách đơn hàng sẵn sàng soạn.',
        type: 'error',
        title: 'Lỗi tải dữ liệu',
      });
    } finally {
      setIsLoadingOrders(false);
    }
  }, [token, orderSearch, orderStatusFilter, currentPage, pageSize]);

  useEffect(() => {
    fetchEligibleOrders();
  }, [fetchEligibleOrders]);

  // Tự động tạo phiếu nếu có initialSelectedOrderCodes
  useEffect(() => {
    if (initialSelectedOrderCodes && initialSelectedOrderCodes.length > 0 && !activeBatch) {
      handleGenerateBatch(initialSelectedOrderCodes);
    }
  }, [initialSelectedOrderCodes]);

  // Danh sách các trang hiển thị cho thanh phân trang
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Toggle chọn đơn hàng
  const toggleSelectOrder = (code: string) => {
    setSelectedOrderCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // Kiểm tra xem toàn bộ đơn ở trang hiện tại đã được chọn chưa
  const isAllCurrentPageSelected =
    orders.length > 0 && orders.every((o) => selectedOrderCodes.includes(o.order_code));

  // Chọn/bỏ chọn tất cả đơn ở trang hiện tại mà không làm mất các đơn đã chọn ở trang khác
  const selectAllOrders = () => {
    if (isAllCurrentPageSelected) {
      const currentCodes = new Set(orders.map((o) => o.order_code));
      setSelectedOrderCodes((prev) => prev.filter((c) => !currentCodes.has(c)));
    } else {
      const currentCodes = orders.map((o) => o.order_code);
      setSelectedOrderCodes((prev) => Array.from(new Set([...prev, ...currentCodes])));
    }
  };

  // Tạo phiếu soạn hàng gộp nhiều đơn
  const handleGenerateBatch = async (codesToBatch?: string[]) => {
    const codes = codesToBatch || selectedOrderCodes;
    if (codes.length === 0) {
      emitStatusToast({
        message: 'Vui lòng tích chọn ít nhất 1 đơn hàng đã duyệt để tạo phiếu soạn.',
        type: 'error',
        title: 'Chưa chọn đơn hàng',
      });
      return;
    }

    setIsGeneratingBatch(true);
    try {
      const preview = await previewBatchPickingApi(token, codes);
      setActiveBatch(preview);

      // Khởi tạo state mặc định cho từng dòng: mặc định picked_quantity = total_ordered_quantity, is_done = false để thủ kho đi nhặt từng chặng
      const initialMap: Record<number, ItemState> = {};
      preview.route_items.forEach((item) => {
        initialMap[item.product_id] = {
          picked_quantity: item.total_ordered_quantity,
          shortage_reason: '',
          is_done: false,
        };
      });
      setItemsState(initialMap);

      emitStatusToast({
        message: `Đã tạo phiếu soạn hàng ${preview.batch_code} gộp ${preview.total_orders} đơn hàng theo lộ trình kho tối ưu.`,
        type: 'success',
        title: 'Tạo phiếu thành công',
      });
    } catch (err: any) {
      emitStatusToast({
        message: err?.message || 'Không thể tạo phiếu soạn hàng gộp.',
        type: 'error',
        title: 'Lỗi tạo phiếu',
      });
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Thao tác trên từng dòng soạn (chặn số âm và chặn soạn vượt quá số lượng đơn yêu cầu)
  const handleSetPickedQty = (productId: number, qty: number | string, totalOrdered: number) => {
    let safeQty: number | string = qty;
    if (typeof qty === 'number') {
      safeQty = Math.min(Math.max(0, qty), totalOrdered);
    } else if (qty === '') {
      safeQty = '';
    } else {
      const parsed = parseInt(String(qty), 10);
      safeQty = isNaN(parsed) ? '' : Math.min(Math.max(0, parsed), totalOrdered);
    }

    setItemsState((prev) => {
      const cur = prev[productId] || { picked_quantity: totalOrdered, shortage_reason: '', is_done: false };
      const numericQty = typeof safeQty === 'number' ? safeQty : (parseInt(String(safeQty), 10) || 0);
      return {
        ...prev,
        [productId]: {
          ...cur,
          picked_quantity: safeQty,
          // Nếu đã nhặt đủ thì có thể xóa lý do thiếu
          shortage_reason: numericQty >= totalOrdered ? '' : cur.shortage_reason,
        },
      };
    });
  };

  const handleMarkDoneFull = (productId: number, totalOrdered: number) => {
    setItemsState((prev) => ({
      ...prev,
      [productId]: {
        picked_quantity: totalOrdered,
        shortage_reason: '',
        is_done: true,
      },
    }));
  };

  const handleToggleDone = (productId: number, totalOrdered: number) => {
    setItemsState((prev) => {
      const cur = prev[productId] || { picked_quantity: totalOrdered, shortage_reason: '', is_done: false };
      const nextDone = !cur.is_done;
      // Khi đánh dấu hoàn tất, nếu số lượng đang bằng 0 thì tự động gán đủ số lượng cần soạn
      let nextQty = cur.picked_quantity;
      const numQty = typeof nextQty === 'number' ? nextQty : (parseInt(String(nextQty), 10) || 0);
      if (nextDone && numQty === 0) {
        nextQty = totalOrdered;
      }
      const finalNum = typeof nextQty === 'number' ? nextQty : (parseInt(String(nextQty), 10) || 0);
      return {
        ...prev,
        [productId]: {
          ...cur,
          picked_quantity: nextQty,
          shortage_reason: finalNum >= totalOrdered ? '' : cur.shortage_reason,
          is_done: nextDone,
        },
      };
    });
  };

  const handleSetShortageReason = (productId: number, reason: string) => {
    setItemsState((prev) => {
      const cur = prev[productId] || { picked_quantity: 0, shortage_reason: '', is_done: true };
      return {
        ...prev,
        [productId]: {
          ...cur,
          shortage_reason: reason,
        },
      };
    });
  };

  const toggleBreakdown = (productId: number) => {
    setExpandedBreakdown((prev) => ({ ...prev, [productId]: !prev[productId] }));
  };

  // Thống kê tiến độ
  const stats = useMemo(() => {
    if (!activeBatch) return { total: 0, completed: 0, shortages: 0, pct: 0, pickedUnits: 0, totalUnits: 0 };
    const items = activeBatch.route_items;
    let completed = 0;
    let shortages = 0;
    let pickedUnits = 0;
    let totalUnits = 0;

    items.forEach((it) => {
      totalUnits += it.total_ordered_quantity;
      const st = itemsState[it.product_id];
      const pQty = st ? (typeof st.picked_quantity === 'number' ? st.picked_quantity : (parseInt(String(st.picked_quantity), 10) || 0)) : 0;
      pickedUnits += pQty;
      if (st && st.is_done) {
        completed += 1;
      }
      if (pQty < it.total_ordered_quantity) {
        shortages += 1;
      }
    });

    const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
    return {
      total: items.length,
      completed,
      shortages,
      pct,
      pickedUnits,
      totalUnits,
    };
  }, [activeBatch, itemsState]);

  // Lọc danh sách dòng soạn theo bộ lọc
  const filteredRouteItems = useMemo(() => {
    if (!activeBatch) return [];
    return activeBatch.route_items.filter((it) => {
      const st = itemsState[it.product_id];
      const pQty = st ? (typeof st.picked_quantity === 'number' ? st.picked_quantity : (parseInt(String(st.picked_quantity), 10) || 0)) : 0;
      const isShortage = pQty < it.total_ordered_quantity;
      const isDone = st ? st.is_done : false;

      if (routeFilter === 'unpicked' && isDone) return false;
      if (routeFilter === 'picked' && !isDone) return false;
      if (routeFilter === 'shortage' && !isShortage) return false;

      if (routeSearch.trim()) {
        const s = routeSearch.toLowerCase();
        const pMatch =
          it.product_code.toLowerCase().includes(s) ||
          it.product_name.toLowerCase().includes(s) ||
          it.location_code.toLowerCase().includes(s) ||
          (it.zone && it.zone.toLowerCase().includes(s));
        if (!pMatch) return false;
      }
      return true;
    });
  }, [activeBatch, itemsState, routeFilter, routeSearch]);

  // Hoàn tất phiếu soạn hàng
  const handleCompleteBatch = async () => {
    if (!activeBatch) return;

    // KIỂM TRA BẮT BUỘC TIÊU CHÍ 4: Soạn thiếu bắt buộc nhập lý do
    const missingReasonItems: BatchPickingRouteItem[] = [];
    const executionItems = activeBatch.route_items.map((it) => {
      const st = itemsState[it.product_id] || {
        picked_quantity: 0,
        shortage_reason: '',
        is_done: false,
      };
      const pQty = typeof st.picked_quantity === 'number' ? st.picked_quantity : (parseInt(String(st.picked_quantity), 10) || 0);
      if (pQty < it.total_ordered_quantity) {
        if (!st.shortage_reason || st.shortage_reason.trim().length < 3) {
          missingReasonItems.push(it);
        }
      }
      return {
        product_id: it.product_id,
        product_code: it.product_code,
        ordered_quantity: it.total_ordered_quantity,
        picked_quantity: pQty,
        shortage_reason: st.shortage_reason.trim() || undefined,
        location_code: it.location_code,
      };
    });

    if (missingReasonItems.length > 0) {
      const first = missingReasonItems[0];
      const firstQty = typeof itemsState[first.product_id]?.picked_quantity === 'number' ? itemsState[first.product_id]?.picked_quantity : (parseInt(String(itemsState[first.product_id]?.picked_quantity), 10) || 0);
      emitStatusToast({
        message: `Sản phẩm ${first.product_code} (${first.product_name}) soạn thiếu (${firstQty}/${first.total_ordered_quantity})! BẮT BUỘC PHẢI NHẬP LÝ DO THIẾU HÀNG.`,
        type: 'error',
        title: 'Soạn thiếu chưa có lý do',
      });
      // Tự động chuyển filter sang 'shortage' để thủ kho nhìn thấy ngay
      setRouteFilter('shortage');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      const pickerName = currentUser.full_name || currentUser.username;
      const res = await completeBatchPickingApi(token, {
        batch_code: activeBatch.batch_code,
        order_codes: activeBatch.selected_order_codes,
        items: executionItems,
        picker_name: pickerName,
        notes: `Thủ kho ${pickerName} hoàn tất soạn hàng đợt ${activeBatch.batch_code}`,
      });

      emitStatusToast({
        message: res.message || 'Đã hoàn tất phiếu soạn hàng thành công!',
        type: 'success',
        title: 'Hoàn tất soạn hàng',
      });

      try {
        const timestamp = Date.now().toString();
        localStorage.setItem('inventory_last_updated', timestamp);
        localStorage.setItem('orders_last_updated', timestamp);
        window.dispatchEvent(new CustomEvent('INVENTORY_STOCK_UPDATED'));
        window.dispatchEvent(new CustomEvent('ORDERS_UPDATED'));
      } catch { }

      // Reset phiếu đang mở và tải lại danh sách đơn
      setActiveBatch(null);
      setSelectedOrderCodes([]);
      fetchEligibleOrders();
    } catch (err: any) {
      emitStatusToast({
        message: err?.message || 'Không thể hoàn tất phiếu soạn hàng.',
        type: 'error',
        title: 'Lỗi hoàn tất',
      });
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Preset lý do thiếu hàng
  const SHORTAGE_REASONS = [
    'Hàng hỏng / rách vỏ hộp',
    'Lệch tồn kho thực tế',
    'Không tìm thấy tại vị trí kệ',
    'Hàng cận date / quá hạn',
  ];

  return (
    <div className={`w-full max-w-7xl mx-auto px-2 sm:px-4 py-2.5 sm:py-6 ${selectedOrderCodes.length > 0 && !activeBatch ? 'pb-24 sm:pb-6' : ''}`}>
      {/* ======================================================== */}
      {/* VIEW 1: KHI ĐANG MỞ PHIẾU SOẠN HÀNG (ACTIVE PICKING SHEET) */}
      {/* ======================================================== */}
      {activeBatch ? (
        <div className="pb-28 sm:pb-24">
          {/* KHUNG BẢNG SOẠN HÀNG HOÀN CHỈNH THỐNG NHẤT (1 CARD LIỀN MẠCH, KHÔNG TÁCH RỜI) */}
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
            {/* PHẦN 1: HEADER PHIẾU SOẠN HÀNG, TIẾN ĐỘ & HƯỚNG DẪN LỘ TRÌNH */}
            <div className="p-3.5 sm:p-5 bg-gradient-to-b from-gray-50/80 to-white border-b border-gray-200">
              {/* Hàng 1: Nút quay lại + Tiêu đề phiếu & Mã phiếu + Nút in phiếu (Responsive chống đè chữ) */}
              <div className="pb-3 border-b border-gray-100">
                {/* Giao diện trên Mobile (sm:hidden): Chia 2 hàng riêng biệt, 100% không đè nhau */}
                <div className="sm:hidden space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveBatch(null)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs touch-manipulation"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                      <span>Quay lại</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPrintModalOpen(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors touch-manipulation"
                      title="In phiếu A4"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                      <span>In phiếu</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-base font-bold text-gray-900 m-0 leading-tight">
                      Phiếu Soạn Hàng
                    </h1>
                    <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {activeBatch.batch_code}
                    </span>
                  </div>
                </div>

                {/* Giao diện Desktop / Màn hình rộng (hidden sm:flex) */}
                <div className="hidden sm:flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setActiveBatch(null)}
                      className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white hover:bg-gray-100 active:bg-gray-200 border border-gray-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                      </svg>
                      <span>Quay lại</span>
                    </button>

                    <div className="flex items-center gap-2.5 min-w-0">
                      <h1 className="text-xl font-bold text-gray-900 m-0 leading-tight whitespace-nowrap">
                        Phiếu Soạn Hàng
                      </h1>
                      <span className="px-2.5 py-0.5 rounded text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {activeBatch.batch_code}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPrintModalOpen(true)}
                    className="px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 active:bg-gray-100 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                    title="In phiếu A4"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9" />
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                      <rect x="6" y="14" width="12" height="8" />
                    </svg>
                    <span>In phiếu</span>
                  </button>
                </div>
              </div>

              {/* Hàng 2: Tóm tắt đơn gộp & Thanh tiến độ soạn hàng */}
              <div className="pt-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <p className="text-xs text-gray-600 m-0">
                  Gộp <strong className="text-gray-900 font-bold">{activeBatch.total_orders} đơn</strong>: <span className="font-mono text-emerald-800 font-semibold break-words">{activeBatch.selected_order_codes.join(', ')}</span>
                </p>
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <span className="font-semibold text-gray-700">
                    Tiến độ: <strong className="text-emerald-700 font-bold">{stats.completed}</strong>/{stats.total} dòng ({stats.pct}%)
                  </span>
                  <div className="w-24 sm:w-36 h-2 bg-gray-200 rounded-full overflow-hidden inline-block shrink-0">
                    <div
                      className="h-full bg-emerald-700 transition-all duration-300 rounded-full"
                      style={{ width: `${stats.pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Hàng 3: Lộ trình nhặt hàng hướng dẫn (liền mạch, tinh tế) */}
              <div className="mt-2.5 px-3 py-2 bg-emerald-50/70 border border-emerald-100/90 rounded-lg text-xs text-emerald-950 flex items-center gap-1.5 font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-600">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>
                  <strong>Lộ trình tối ưu:</strong> Tự động sắp xếp theo thứ tự đường đi kho: <strong>Khu vực &rarr; Dãy &rarr; Kệ &rarr; Ô chứa</strong>.
                </span>
              </div>
            </div>

            {/* PHẦN 2: TABLE TOOLBAR (TÍCH HỢP TRỰC TIẾP TRÊN ĐỈNH BẢNG - KHÔNG TÁCH RỜI) */}
            <div className="p-2.5 sm:p-3 bg-gray-50/75 border-b border-gray-200 flex flex-col sm:flex-row gap-2.5 sm:gap-3 justify-start items-stretch sm:items-center">
              {/* Quick Search - Đưa lên đầu toolbar */}
              <div className="relative w-full sm:w-auto sm:min-w-[280px]">
                <div
                  style={{
                    position: 'absolute',
                    left: '11px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    zIndex: 2,
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Tìm mã SP, tên, vị trí kệ..."
                  value={routeSearch}
                  onChange={(e) => setRouteSearch(e.target.value)}
                  style={{ paddingLeft: '34px', paddingRight: routeSearch ? '32px' : '12px' }}
                  className="w-full py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 shadow-2xs"
                />
                {routeSearch && (
                  <button
                    type="button"
                    onClick={() => setRouteSearch('')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      zIndex: 2,
                    }}
                    className="flex items-center text-gray-400 hover:text-gray-600 border-0 bg-transparent cursor-pointer p-0.5"
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter buttons dạng cuộn ngang nằm cạnh nút tìm kiếm */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none snap-x pr-2">
                <button
                  type="button"
                  onClick={() => setRouteFilter('all')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors border-0 cursor-pointer whitespace-nowrap touch-manipulation shrink-0 snap-start ${
                    routeFilter === 'all'
                      ? 'bg-gray-900 text-white shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200 border border-gray-200'
                  }`}
                >
                  Tất cả: {activeBatch.route_items.length}
                </button>
                <button
                  type="button"
                  onClick={() => setRouteFilter('unpicked')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors border-0 cursor-pointer whitespace-nowrap touch-manipulation shrink-0 snap-start ${
                    routeFilter === 'unpicked'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200 border border-gray-200'
                  }`}
                >
                  Chưa soạn: {stats.total - stats.completed}
                </button>
                <button
                  type="button"
                  onClick={() => setRouteFilter('picked')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors border-0 cursor-pointer whitespace-nowrap touch-manipulation shrink-0 snap-start ${
                    routeFilter === 'picked'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200 border border-gray-200'
                  }`}
                >
                  Đã soạn: {stats.completed}
                </button>
                <button
                  type="button"
                  onClick={() => setRouteFilter('shortage')}
                  className={`px-3 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-colors border-0 cursor-pointer whitespace-nowrap touch-manipulation shrink-0 snap-start ${
                    routeFilter === 'shortage'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-white text-gray-700 hover:bg-gray-100 active:bg-gray-200 border border-gray-200'
                  }`}
                >
                  Soạn thiếu: {stats.shortages}
                </button>
              </div>
            </div>

            {/* PHẦN 3: BẢNG DỮ LIỆU DÒNG HÀNG (LIỀN MẠCH, KHÔNG TÁCH RỜI) */}
            {/* Thanh thông báo gợi ý vuốt ngang trên mobile */}
            <div className="sm:hidden px-3 py-1.5 bg-emerald-50/50 border-b border-gray-100 flex items-center justify-between text-[11px] text-gray-500 font-medium">
              <span>Lộ trình nhặt hàng:</span>
              <span className="inline-flex items-center gap-1 text-emerald-800 font-semibold">
                <span>Vuốt ngang để soạn &amp; xác nhận</span>
                &rarr;
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead>
                  <tr className="bg-gray-50/90 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="py-3 px-3 text-center w-14">Chặng</th>
                    <th className="py-3 px-3 w-48">Vị trí kệ & Tồn</th>
                    <th className="py-3 px-4 min-w-[200px]">Sản phẩm</th>
                    <th className="py-3 px-3 text-center w-24">Cần soạn</th>
                    <th className="py-3 px-4 text-center w-56">Thực soạn</th>
                    <th className="py-3 px-4 text-center w-36">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {filteredRouteItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500 text-sm">
                        Không có dòng hàng nào khớp với bộ lọc hiện tại.
                      </td>
                    </tr>
                  ) : (
                    filteredRouteItems.map((item) => {
                      const curState = itemsState[item.product_id] || {
                        picked_quantity: item.total_ordered_quantity,
                        shortage_reason: '',
                        is_done: false,
                      };
                      const pQty = typeof curState.picked_quantity === 'number'
                        ? curState.picked_quantity
                        : (parseInt(String(curState.picked_quantity), 10) || 0);
                      const isShortage = pQty < item.total_ordered_quantity;
                      const isDone = curState.is_done;
                      const isExpanded = !!expandedBreakdown[item.product_id];

                      return (
                        <React.Fragment key={item.product_id}>
                          <tr
                            className={`transition-colors duration-150 ${
                              isShortage
                                ? 'bg-amber-50/30 hover:bg-amber-50/50'
                                : isDone
                                ? 'bg-emerald-50/20 hover:bg-emerald-50/40'
                                : 'hover:bg-gray-50/70'
                            }`}
                          >
                            {/* Chặng */}
                            <td className="py-3.5 px-3 text-center align-middle">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gray-900 text-white font-bold text-xs shadow-xs">
                                #{item.step_number}
                              </span>
                            </td>

                            {/* Vị trí kệ & Tồn */}
                            <td className="py-3.5 px-3 align-middle">
                              <div className="font-bold text-xs sm:text-sm text-gray-900">
                                {item.zone && item.zone !== 'Chưa phân bổ' ? (
                                  <>
                                    {item.zone} &bull; {item.aisle} &bull; {item.rack} &bull; {item.bin}
                                  </>
                                ) : (
                                  item.location_name
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                                  {item.location_code}
                                </span>
                                <span className="text-[11px] text-gray-500">
                                  Tồn: <strong className="text-gray-700 font-semibold">{item.available_stock} {item.unit_name}</strong>
                                </span>
                              </div>
                            </td>

                            {/* Sản phẩm & Chi tiết đơn gộp */}
                            <td className="py-3.5 px-4 align-middle">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded shrink-0">
                                  {item.product_code}
                                </span>
                                <span className="font-bold text-gray-900 text-sm">
                                  {item.product_name}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleBreakdown(item.product_id)}
                                className="mt-1 text-xs text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 touch-manipulation"
                              >
                                <span>Gộp {item.order_breakdown.length} đơn</span>
                                <span className="underline">({isExpanded ? 'Thu gọn' : 'Chi tiết'})</span>
                              </button>
                            </td>

                            {/* Cần soạn */}
                            <td className="py-3.5 px-3 text-center align-middle">
                              <span className="font-bold text-base text-gray-900">
                                {item.total_ordered_quantity}
                              </span>
                              <span className="text-xs text-gray-500 block">
                                {item.unit_name}
                              </span>
                            </td>

                            {/* Thực soạn (Stepper + Đủ) */}
                            <td className="py-3.5 px-4 text-center align-middle">
                              <div className="inline-flex items-center gap-1.5">
                                <div className="flex items-center border border-gray-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    disabled={pQty <= 0}
                                    onClick={() => handleSetPickedQty(item.product_id, Math.max(0, pQty - 1), item.total_ordered_quantity)}
                                    className="w-8 h-8 flex items-center justify-center text-base font-bold text-gray-700 hover:bg-gray-100 active:bg-gray-200 border-0 bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation select-none"
                                    title="Giảm 1"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={curState.picked_quantity !== undefined ? curState.picked_quantity : item.total_ordered_quantity}
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                    onKeyDown={(e) => {
                                      if (
                                        !/^[0-9]$/.test(e.key) &&
                                        !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) &&
                                        !e.ctrlKey &&
                                        !e.metaKey
                                      ) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onChange={(e) => {
                                      const clean = e.target.value.replace(/[^0-9]/g, '');
                                      if (clean === '') {
                                        handleSetPickedQty(item.product_id, '', item.total_ordered_quantity);
                                        return;
                                      }
                                      const stripped = clean.replace(/^0+(?=\d)/, '');
                                      const num = parseInt(stripped || '0', 10);
                                      const safe = Math.min(num, item.total_ordered_quantity);
                                      handleSetPickedQty(item.product_id, safe, item.total_ordered_quantity);
                                    }}
                                    onBlur={() => {
                                      if (curState.picked_quantity === '' || isNaN(Number(curState.picked_quantity))) {
                                        handleSetPickedQty(item.product_id, 0, item.total_ordered_quantity);
                                      }
                                    }}
                                    className="w-12 h-8 text-center font-bold text-sm text-gray-900 border-0 focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    disabled={pQty >= item.total_ordered_quantity}
                                    onClick={() => handleSetPickedQty(item.product_id, Math.min(item.total_ordered_quantity, pQty + 1), item.total_ordered_quantity)}
                                    className="w-8 h-8 flex items-center justify-center text-base font-bold text-gray-700 hover:bg-gray-100 active:bg-gray-200 border-0 bg-transparent cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed touch-manipulation select-none"
                                    title="Tăng 1"
                                  >
                                    +
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleMarkDoneFull(item.product_id, item.total_ordered_quantity)}
                                  className="px-2 py-1.5 h-8 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 rounded-lg border border-emerald-200 cursor-pointer whitespace-nowrap touch-manipulation"
                                  title="Đặt đủ số lượng cần soạn"
                                >
                                  Đủ: {item.total_ordered_quantity}
                                </button>
                              </div>
                            </td>

                            {/* Trạng thái / Nút đánh dấu đã soạn */}
                            <td className="py-3.5 px-4 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => handleToggleDone(item.product_id, item.total_ordered_quantity)}
                                className={`px-3 py-1.5 h-8 rounded-lg text-xs font-bold border-0 cursor-pointer transition-colors shadow-2xs whitespace-nowrap touch-manipulation ${
                                  isDone
                                    ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {isDone ? 'Đã soạn' : 'Đánh dấu'}
                              </button>
                            </td>
                          </tr>

                          {/* Dòng chi tiết phân bổ đơn hàng khi bấm Chi tiết */}
                          {isExpanded && (
                            <tr className="bg-gray-50/80">
                              <td colSpan={6} className="py-2.5 px-6">
                                <div className="p-3 bg-white rounded-lg border border-gray-200 space-y-1.5 text-xs text-gray-700">
                                  <p className="font-bold text-gray-900 m-0 mb-1">Chi tiết phân bổ theo đơn hàng:</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {item.order_breakdown.map((b, idx) => (
                                      <div key={idx} className="flex justify-between items-center py-1 px-2 bg-gray-50 rounded border border-gray-100">
                                        <span className="font-semibold text-gray-800 truncate mr-2">
                                          {b.order_code}{b.dealer_name ? ` - ${b.dealer_name}` : ''}:
                                        </span>
                                        <span className="font-mono font-bold text-gray-900 shrink-0">
                                          {b.quantity} {item.unit_name}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}

                          {/* Dòng cảnh báo & nhập lý do soạn thiếu khi pQty < total_ordered_quantity */}
                          {isShortage && (
                            <tr className="bg-amber-50/60">
                              <td colSpan={6} className="py-2.5 px-6">
                                <div className="p-3 bg-amber-50 rounded-lg border-2 border-amber-400 space-y-2">
                                  <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-amber-900">
                                    <span>
                                      Soạn thiếu {item.total_ordered_quantity - pQty} {item.unit_name} - Bắt buộc nhập lý do:
                                    </span>
                                    <span className="text-rose-600 font-bold">*</span>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                    {SHORTAGE_REASONS.map((r, rIdx) => (
                                      <button
                                        key={rIdx}
                                        type="button"
                                        onClick={() => handleSetShortageReason(item.product_id, r)}
                                        className={`px-2.5 py-1 text-xs rounded-full border cursor-pointer font-medium transition-colors touch-manipulation ${
                                          curState.shortage_reason === r
                                            ? 'bg-amber-600 text-white border-amber-600 font-bold shadow-xs'
                                            : 'bg-white text-amber-900 border-amber-300 hover:bg-amber-100 active:bg-amber-200'
                                        }`}
                                      >
                                        {r}
                                      </button>
                                    ))}
                                  </div>

                                  <input
                                    type="text"
                                    placeholder="Nhập lý do thiếu hàng..."
                                    value={curState.shortage_reason}
                                    onChange={(e) => handleSetShortageReason(item.product_id, e.target.value)}
                                    className={`w-full px-3 py-1.5 text-xs sm:text-sm rounded-lg border bg-white text-gray-900 focus:outline-hidden ${
                                      !curState.shortage_reason || curState.shortage_reason.trim().length < 3
                                        ? 'border-rose-400 focus:ring-2 focus:ring-rose-400'
                                        : 'border-amber-400 focus:ring-2 focus:ring-amber-500'
                                    }`}
                                  />
                                  {(!curState.shortage_reason || curState.shortage_reason.trim().length < 3) && (
                                    <p className="text-xs text-rose-600 m-0 font-medium">
                                      * Vui lòng nhập lý do thiếu hàng để hoàn tất phiếu soạn.
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* STICKY BOTTOM ACTION BAR (CỐ ĐỊNH CHÂN MÀN HÌNH ĐIỆN THOẠI) */}
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-40 shadow-xl">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
              <div className="text-xs sm:text-sm text-gray-800 flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 sm:gap-4">
                <span>
                  Đã soạn: <strong className="text-emerald-700 font-bold">{stats.completed}</strong>/{stats.total} dòng
                </span>
                <span>
                  Tổng lượng: <strong className="text-gray-900 font-bold">{stats.pickedUnits}</strong>/{stats.totalUnits} SP
                </span>
                {stats.shortages > 0 && (
                  <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Thiếu {stats.shortages} dòng
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveBatch(null)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 h-11 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg border-0 cursor-pointer touch-manipulation"
                >
                  Đóng phiếu
                </button>
                <button
                  type="button"
                  disabled={isSubmittingBatch}
                  onClick={handleCompleteBatch}
                  className="flex-2 sm:flex-initial px-6 py-2.5 h-11 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-[#0fad89] to-[#0F8A5F] hover:from-[#0c734f] hover:to-[#065f46] rounded-lg shadow-sm border-0 cursor-pointer transition-all disabled:opacity-50 touch-manipulation"
                >
                  {isSubmittingBatch ? 'Đang hoàn tất...' : 'Hoàn tất soạn hàng'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ======================================================== */
        /* VIEW 2: DANH SÁCH ĐƠN HÀNG ĐÃ DUYỆT & GỘP ĐƠN SOẠN HÀNG */
        /* ======================================================== */
        <div className="space-y-3 sm:space-y-4">
          {/* Header & Bộ lọc tinh gọn */}
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-3 sm:p-5">
            {/* Hàng 1: Tiêu đề + Về trang chủ (trên mobile cùng hàng để tiết kiệm chiều cao) */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-base sm:text-xl font-bold text-gray-900 m-0">
                  Lập Phiếu Soạn Hàng
                </h1>
                <p className="hidden sm:block text-xs sm:text-sm text-gray-600 m-0 mt-0.5">
                  Chọn các đơn hàng đã duyệt để tạo đợt soạn hàng.
                </p>
              </div>

              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  className="px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg border-0 cursor-pointer touch-manipulation shrink-0"
                >
                  Về trang chủ
                </button>
              )}
            </div>

            {/* Hàng 2: Thanh tìm kiếm + Nút làm mới */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
              <input
                type="text"
                placeholder="Tìm theo mã đơn, tên đại lý..."
                value={orderSearch}
                onChange={(e) => {
                  setOrderSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />

              <button
                type="button"
                onClick={fetchEligibleOrders}
                className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg border-0 cursor-pointer touch-manipulation shrink-0 whitespace-nowrap"
                title="Tải lại danh sách"
              >
                Làm mới
              </button>
            </div>

            {/* Hàng 3: Chọn tất cả + Đếm số lượng + Nút gộp đơn */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs sm:text-sm font-semibold text-gray-700 touch-manipulation py-0.5">
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    onChange={selectAllOrders}
                    className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                  />
                  <span>Chọn tất cả</span>
                </label>

                <span className="text-xs text-gray-500">
                  Đã chọn: <strong className="text-emerald-700 font-bold">{selectedOrderCodes.length}</strong> đơn
                  {totalRecords > 0 && (
                    <span className="hidden sm:inline text-gray-400"> (Tổng {totalRecords} đơn)</span>
                  )}
                </span>
              </div>

              <button
                type="button"
                disabled={selectedOrderCodes.length === 0 || isGeneratingBatch}
                onClick={() => handleGenerateBatch()}
                className={`px-3.5 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white rounded-lg shadow-xs border-0 cursor-pointer transition-all touch-manipulation flex items-center justify-center gap-1.5 shrink-0 ${
                  selectedOrderCodes.length > 0
                    ? 'bg-gradient-to-r from-[#0fad89] to-[#0F8A5F] hover:from-[#0c734f] hover:to-[#065f46] shadow-sm hover:shadow-md'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-60 hidden sm:flex'
                }`}
              >
                <span>
                  {isGeneratingBatch
                    ? 'Đang tạo lộ trình...'
                    : selectedOrderCodes.length > 0
                    ? `Tạo phiếu soạn (${selectedOrderCodes.length})`
                    : 'Tạo phiếu soạn hàng'}
                </span>
              </button>
            </div>
          </div>

          {/* Danh sách đơn hàng sẵn sàng soạn */}
          {isLoadingOrders ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
              <p className="m-0 text-sm">Đang tải danh sách đơn hàng đã duyệt...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
              <p className="m-0 text-sm font-semibold text-gray-700">
                Không có đơn hàng nào ở trạng thái chờ soạn hàng.
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Các đơn hàng cần được phê duyệt trước khi soạn.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {orders.map((ord) => {
                const isSelected = selectedOrderCodes.includes(ord.order_code);
                return (
                  <div
                    key={ord.order_code}
                    onClick={() => toggleSelectOrder(ord.order_code)}
                    className={`bg-white rounded-xl border p-3.5 sm:p-4 transition-all duration-150 cursor-pointer shadow-xs active:scale-[0.99] touch-manipulation select-none ${
                      isSelected
                        ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/30'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // Handle by parent div
                          className="w-5 h-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 pointer-events-none accent-emerald-600"
                        />
                        <span className="font-mono font-bold text-sm text-gray-900">
                          {ord.order_code}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Đã duyệt
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-gray-600 space-y-1">
                      <p className="m-0 font-medium text-gray-800">
                        Đại lý: <strong className="text-gray-900">{ord.dealer_name || 'Khách lẻ'}</strong>
                      </p>
                      {ord.desired_delivery_date && (
                        <p className="m-0 text-gray-500">
                          Giao dự kiến: <span className="text-gray-700">{ord.desired_delivery_date}</span>
                        </p>
                      )}
                      {ord.delivery_point && (
                        <p className="m-0 text-gray-500 truncate" title={ord.delivery_point}>
                          Địa điểm: {ord.delivery_point}
                        </p>
                      )}
                    </div>

                    {/* Tóm tắt sản phẩm trong đơn */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 text-xs">
                      <div className="flex justify-between items-center text-gray-700 font-semibold mb-1">
                        <span>{ord.total_items} mặt hàng</span>
                        <span>Tổng: {ord.total_quantity} SP</span>
                      </div>
                      <div className="space-y-0.5 text-gray-500 text-[11px]">
                        {ord.items_summary.map((sm, sIdx) => (
                          <div key={sIdx} className="truncate">{sm}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PHÂN TRANG CHUẨN ERP (Mặc định 10 đơn/trang) */}
          {!isLoadingOrders && totalRecords > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between flex-wrap gap-3 shadow-xs">
              <div className="text-xs text-gray-600">
                Hiển thị <strong className="text-gray-900">{orders.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> -{' '}
                <strong className="text-gray-900">{Math.min(currentPage * pageSize, totalRecords)}</strong> /{' '}
                <strong className="text-gray-900">{totalRecords}</strong> đơn hàng | Trang{' '}
                <strong className="text-gray-900">{currentPage}</strong> / {totalPages}
              </div>

              {totalPages > 1 && (
                <div className="inline-flex items-stretch border border-gray-300 rounded-lg overflow-hidden bg-white h-8 shadow-xs">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(1)}
                    className="px-2.5 h-full border-0 border-r border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer flex items-center justify-center text-xs font-medium transition-colors"
                    title="Trang đầu"
                  >
                    «
                  </button>

                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="px-2.5 h-full border-0 border-r border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer flex items-center justify-center text-xs font-medium transition-colors"
                    title="Trang trước"
                  >
                    ‹
                  </button>

                  {getPageNumbers().map((p, idx) => {
                    if (p === '...') {
                      return (
                        <span
                          key={`ellipsis-${idx}`}
                          className="px-2.5 h-full flex items-center justify-center text-xs text-gray-400 border-r border-gray-200 bg-white select-none"
                        >
                          ...
                        </span>
                      );
                    }
                    const pageNum = p as number;
                    const isActive = pageNum === currentPage;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[32px] px-2 h-full border-0 border-r border-gray-200 text-xs font-semibold cursor-pointer flex items-center justify-center transition-colors ${
                          isActive
                            ? 'bg-gray-900 text-white font-bold'
                            : 'bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="px-2.5 h-full border-0 border-r border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer flex items-center justify-center text-xs font-medium transition-colors"
                    title="Trang sau"
                  >
                    ›
                  </button>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                    className="px-2.5 h-full border-0 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed cursor-pointer flex items-center justify-center text-xs font-medium transition-colors"
                    title="Trang cuối"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          )}

          {/* FLOATING ACTION BAR DÀNH RIÊNG CHO DI ĐỘNG KHI ĐÃ CHỌN ĐƠN */}
          {selectedOrderCodes.length > 0 && (
            <div className="fixed sm:hidden bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 p-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] z-40 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
              <div className="text-xs text-gray-700 font-medium pl-1">
                Đã chọn: <strong className="text-emerald-700 font-bold text-sm">{selectedOrderCodes.length}</strong> đơn
              </div>
              <button
                type="button"
                disabled={isGeneratingBatch}
                onClick={() => handleGenerateBatch()}
                className="px-4 py-2.5 h-11 text-xs font-bold text-white bg-gradient-to-r from-[#0fad89] to-[#0F8A5F] hover:from-[#0c734f] hover:to-[#065f46] rounded-lg shadow-sm border-0 cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 touch-manipulation"
              >
                <span>
                  {isGeneratingBatch
                    ? 'Đang tạo lộ trình...'
                    : `Tạo phiếu soạn (${selectedOrderCodes.length} đơn)`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL XEM TRƯỚC VÀ IN PHIẾU SOẠN HÀNG (A4) */}
      {isPrintModalOpen && activeBatch && (
        <WarehousePickingPrintModal
          batch={activeBatch}
          itemsState={itemsState}
          currentUser={currentUser}
          onClose={() => setIsPrintModalOpen(false)}
        />
      )}
    </div>
  );
};

export default WarehousePickingView;
