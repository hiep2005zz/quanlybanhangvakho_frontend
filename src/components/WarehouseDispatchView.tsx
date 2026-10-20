import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  WarehouseDispatchOrder,
  OrderDispatchHistoryItem,
  WarehouseDispatchRecord,
  getWarehouseDispatchPendingApi,
  getWarehouseSupplementaryPendingApi,
  confirmOrderDispatchApi,
  supplementaryDeliveryApi,
  getOrderDispatchHistoryApi,
  getWarehouseAllDispatchesApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import './warehouse-management.css';

interface WarehouseDispatchViewProps {
  token: string;
  currentUser: User;
  initialTab?: 'dispatch' | 'supplementary' | 'history';
  onNavigateTab?: (tab: 'dispatch' | 'supplementary' | 'history') => void;
  onBackToHome?: () => void;
}

export const WarehouseDispatchView: React.FC<WarehouseDispatchViewProps> = ({
  token,
  currentUser,
  initialTab = 'dispatch',
  onNavigateTab,
}) => {
  // Chế độ trang: 'list' (danh sách), 'dispatch' (trang xuất kho), 'supplementary' (trang giao bổ sung), 'history' (trang lịch sử)
  const [viewMode, setViewMode] = useState<'list' | 'dispatch' | 'supplementary' | 'history'>('list');

  // Tab hiện tại trong danh sách
  const [activeTab, setActiveTab] = useState<'dispatch' | 'supplementary' | 'history'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Danh sách dữ liệu từ Backend
  const [dispatchPendingOrders, setDispatchPendingOrders] = useState<WarehouseDispatchOrder[]>([]);
  const [supplementaryOrders, setSupplementaryOrders] = useState<WarehouseDispatchOrder[]>([]);
  const [allDispatches, setAllDispatches] = useState<WarehouseDispatchRecord[]>([]);

  // State Trang Xác nhận xuất kho
  const [selectedOrderForDispatch, setSelectedOrderForDispatch] = useState<WarehouseDispatchOrder | null>(null);
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<string, number>>({});
  const [dispatchNote, setDispatchNote] = useState('');
  const [isSubmittingDispatch, setIsSubmittingDispatch] = useState(false);

  // State Trang Giao bổ sung
  const [selectedOrderForSupp, setSelectedOrderForSupp] = useState<WarehouseDispatchOrder | null>(null);
  const [suppQuantities, setSuppQuantities] = useState<Record<string, number>>({});
  const [suppNote, setSuppNote] = useState('');
  const [isSubmittingSupp, setIsSubmittingSupp] = useState(false);

  // State Trang Xem lịch sử phiếu xuất kho
  const [historyOrderCode, setHistoryOrderCode] = useState<string | null>(null);
  const [dispatchHistoryList, setDispatchHistoryList] = useState<OrderDispatchHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Đồng bộ tab từ props bên ngoài
  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const switchTab = (tab: 'dispatch' | 'supplementary' | 'history') => {
    setActiveTab(tab);
    onNavigateTab?.(tab);
  };

  // Tải danh sách đơn hàng từ Backend
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [dispatchRes, suppRes, historyRes] = await Promise.all([
        getWarehouseDispatchPendingApi(token).catch((err) => {
          console.warn('Lỗi lấy đơn chờ xuất:', err);
          return [] as WarehouseDispatchOrder[];
        }),
        getWarehouseSupplementaryPendingApi(token).catch((err) => {
          console.warn('Lỗi lấy đơn chờ giao bổ sung:', err);
          return [] as WarehouseDispatchOrder[];
        }),
        getWarehouseAllDispatchesApi(token).catch((err) => {
          console.warn('Lỗi lấy danh sách toàn bộ phiếu xuất kho:', err);
          return [] as WarehouseDispatchRecord[];
        }),
      ]);
      setDispatchPendingOrders(dispatchRes);
      setSupplementaryOrders(suppRes);
      setAllDispatches(historyRes);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi nạp dữ liệu',
        message: err.message || 'Không thể tải danh sách đơn xuất kho.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Bộ lọc tìm kiếm
  const filteredDispatchOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return dispatchPendingOrders;
    return dispatchPendingOrders.filter(
      (o) =>
        o.order_code.toLowerCase().includes(q) ||
        (o.dealer_name && o.dealer_name.toLowerCase().includes(q))
    );
  }, [dispatchPendingOrders, searchTerm]);

  const filteredSuppOrders = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return supplementaryOrders;
    return supplementaryOrders.filter(
      (o) =>
        o.order_code.toLowerCase().includes(q) ||
        (o.dealer_name && o.dealer_name.toLowerCase().includes(q))
    );
  }, [supplementaryOrders, searchTerm]);

  const filteredAllDispatches = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allDispatches;
    return allDispatches.filter(
      (d) =>
        d.dispatch_code.toLowerCase().includes(q) ||
        d.order_code.toLowerCase().includes(q) ||
        (d.dealer_name && d.dealer_name.toLowerCase().includes(q)) ||
        (d.performed_by && d.performed_by.toLowerCase().includes(q)) ||
        (d.warehouse_name && d.warehouse_name.toLowerCase().includes(q))
    );
  }, [allDispatches, searchTerm]);

  // Phân trang danh sách (10 bản ghi / trang)
  const [dispatchPage, setDispatchPage] = useState(1);
  const [suppPage, setSuppPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setDispatchPage(1);
    setSuppPage(1);
    setHistoryPage(1);
  }, [searchTerm, activeTab]);

  const dispatchTotalPages = Math.max(1, Math.ceil(filteredDispatchOrders.length / pageSize));
  const paginatedDispatchOrders = useMemo(() => {
    return filteredDispatchOrders.slice((dispatchPage - 1) * pageSize, dispatchPage * pageSize);
  }, [filteredDispatchOrders, dispatchPage, pageSize]);

  const suppTotalPages = Math.max(1, Math.ceil(filteredSuppOrders.length / pageSize));
  const paginatedSuppOrders = useMemo(() => {
    return filteredSuppOrders.slice((suppPage - 1) * pageSize, suppPage * pageSize);
  }, [filteredSuppOrders, suppPage, pageSize]);

  const historyTotalPages = Math.max(1, Math.ceil(filteredAllDispatches.length / pageSize));
  const paginatedAllDispatches = useMemo(() => {
    return filteredAllDispatches.slice((historyPage - 1) * pageSize, historyPage * pageSize);
  }, [filteredAllDispatches, historyPage, pageSize]);

  // State menu 3 chấm thao tác từng dòng
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.wh-action-dropdown-container')) {
        setActiveDropdownId(null);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Thanh phân trang chuẩn UI đồng bộ toàn hệ thống
  const renderPaginationBar = (
    currentPage: number,
    totalPages: number,
    totalItems: number,
    onPageChange: (p: number) => void
  ) => {
    if (totalItems <= pageSize && totalPages <= 1) return null;

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

    const pageList = getPageNumbers();

    return (
      <div
        style={{
          padding: '8px 14px',
          borderTop: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: '12px', color: '#64748b' }}>
          Tổng số: <strong style={{ color: '#0f172a' }}>{totalItems}</strong> bản ghi | Trang <strong style={{ color: '#0f172a' }}>{currentPage}</strong> / {totalPages}
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'stretch',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            height: '30px',
            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          }}
        >
          {currentPage > 1 && (
            <button
              type="button"
              onClick={() => onPageChange(currentPage - 1)}
              style={{
                width: '30px',
                height: '100%',
                border: 'none',
                borderRight: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
              title="Trang trước"
            >
              ‹
            </button>
          )}

          {pageList.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  style={{
                    padding: '0 8px',
                    height: '100%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '12px',
                    borderRight: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    userSelect: 'none',
                  }}
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
                onClick={() => onPageChange(pageNum)}
                style={{
                  minWidth: '30px',
                  padding: '0 6px',
                  height: '100%',
                  border: 'none',
                  borderRight: idx === pageList.length - 1 && currentPage === totalPages ? 'none' : '1px solid #e2e8f0',
                  backgroundColor: isActive ? '#0284c7' : '#ffffff',
                  color: isActive ? '#ffffff' : '#374151',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                {pageNum}
              </button>
            );
          })}

          {currentPage < totalPages && (
            <button
              type="button"
              onClick={() => onPageChange(currentPage + 1)}
              style={{
                width: '30px',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
                color: '#374151',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
              }}
              title="Trang tiếp"
            >
              ›
            </button>
          )}
        </div>
      </div>
    );
  };

  // Chuyển sang Trang Xác nhận xuất kho
  const handleOpenDispatchPage = (order: WarehouseDispatchOrder) => {
    setSelectedOrderForDispatch(order);
    const initialMap: Record<string, number> = {};
    (order.items || []).forEach((it) => {
      const remaining = it.remaining_quantity !== undefined ? it.remaining_quantity : it.quantity;
      const maxPossible = Math.min(remaining, it.available_stock || 0);
      initialMap[String(it.product_id)] = maxPossible;
    });
    setDispatchQuantities(initialMap);
    setDispatchNote('Xuất kho đợt 1');
    setViewMode('dispatch');
  };

  // Cập nhật số lượng xuất trong trang xuất kho
  const handleQuantityChange = (productId: number, val: number | string, maxAllowed: number) => {
    let numVal: number;
    if (typeof val === 'string') {
      const clean = val.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      numVal = clean === '' ? 0 : parseInt(clean, 10);
    } else {
      numVal = Number.isNaN(val) ? 0 : val;
    }
    const safeVal = Math.max(0, Math.min(numVal, maxAllowed));
    setDispatchQuantities((prev) => ({
      ...prev,
      [String(productId)]: safeVal,
    }));
  };

  // Gửi xác nhận xuất kho
  const handleSubmitDispatch = async () => {
    if (!selectedOrderForDispatch) return;
    setIsSubmittingDispatch(true);
    try {
      const res = await confirmOrderDispatchApi(token, selectedOrderForDispatch.order_code, {
        delivered_quantities: dispatchQuantities,
        note: dispatchNote.trim() || 'Xác nhận xuất kho',
      });

      emitStatusToast({
        type: 'success',
        title: 'Xuất kho thành công',
        message: res.message || `Đã xuất kho đơn hàng ${selectedOrderForDispatch.order_code}`,
      });

      setSelectedOrderForDispatch(null);
      setViewMode('list');
      await loadData();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi xuất kho',
        message: err.message || 'Không thể thực hiện xuất kho.',
      });
    } finally {
      setIsSubmittingDispatch(false);
    }
  };

  // Chuyển sang Trang Giao bổ sung
  const handleOpenSupplementaryPage = (order: WarehouseDispatchOrder) => {
    setSelectedOrderForSupp(order);
    const initialMap: Record<string, number> = {};
    (order.items || []).forEach((it) => {
      const shortage = it.shortage_quantity !== undefined ? it.shortage_quantity : 0;
      const maxPossible = Math.min(shortage, it.available_stock || 0);
      initialMap[String(it.product_id)] = maxPossible;
    });
    setSuppQuantities(initialMap);
    setSuppNote('Giao bổ sung hàng nợ đợt tiếp theo');
    setViewMode('supplementary');
  };

  // Cập nhật số lượng giao bổ sung trong trang bổ sung
  const handleSuppQuantityChange = (productId: number, val: number | string, maxAllowed: number) => {
    let numVal: number;
    if (typeof val === 'string') {
      const clean = val.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
      numVal = clean === '' ? 0 : parseInt(clean, 10);
    } else {
      numVal = Number.isNaN(val) ? 0 : val;
    }
    const safeVal = Math.max(0, Math.min(numVal, maxAllowed));
    setSuppQuantities((prev) => ({
      ...prev,
      [String(productId)]: safeVal,
    }));
  };

  // Gửi xác nhận giao bổ sung
  const handleSubmitSupplementary = async () => {
    if (!selectedOrderForSupp) return;
    setIsSubmittingSupp(true);
    try {
      const res = await supplementaryDeliveryApi(token, selectedOrderForSupp.order_code, {
        delivered_quantities: suppQuantities,
        note: suppNote.trim() || 'Giao bổ sung hàng nợ',
      });

      emitStatusToast({
        type: 'success',
        title: 'Giao bổ sung thành công',
        message: res.message || `Đã ghi nhận giao bổ sung cho đơn ${selectedOrderForSupp.order_code}`,
      });

      setSelectedOrderForSupp(null);
      setViewMode('list');
      await loadData();
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi giao bổ sung',
        message: err.message || 'Không thể thực hiện giao bổ sung.',
      });
    } finally {
      setIsSubmittingSupp(false);
    }
  };

  // Chuyển sang Trang Xem lịch sử phiếu xuất kho
  const handleViewDispatchHistoryPage = async (orderCode: string) => {
    setHistoryOrderCode(orderCode);
    setIsLoadingHistory(true);
    setViewMode('history');
    try {
      const history = await getOrderDispatchHistoryApi(token, orderCode);
      setDispatchHistoryList(history);
    } catch (err: any) {
      emitStatusToast({
        type: 'error',
        title: 'Lỗi tải lịch sử',
        message: err.message || 'Không thể tải lịch sử phiếu xuất.',
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Tính toán kiểm tra xuất thiếu trong trang xuất kho
  const dispatchShortageAnalysis = useMemo(() => {
    if (!selectedOrderForDispatch) return { hasShortage: false, totalOut: 0, totalRemainingShortage: 0, totalOrdered: 0 };
    let totalOut = 0;
    let totalRemainingShortage = 0;
    let totalOrdered = 0;
    let hasShortage = false;

    (selectedOrderForDispatch.items || []).forEach((it) => {
      const outQty = dispatchQuantities[String(it.product_id)] || 0;
      const rem = it.remaining_quantity !== undefined ? it.remaining_quantity : it.quantity;
      const shortage = Math.max(0, rem - outQty);
      totalOrdered += it.quantity;
      totalOut += outQty;
      totalRemainingShortage += shortage;
      if (shortage > 0) {
        hasShortage = true;
      }
    });

    return { hasShortage, totalOut, totalRemainingShortage, totalOrdered };
  }, [selectedOrderForDispatch, dispatchQuantities]);

  // Phân tích số lượng trong trang giao bổ sung
  const suppShortageAnalysis = useMemo(() => {
    if (!selectedOrderForSupp) return { hasRemaining: false, totalOut: 0, remainingAfter: 0 };
    let totalOut = 0;
    let remainingAfter = 0;
    let hasRemaining = false;

    (selectedOrderForSupp.items || []).forEach((it) => {
      const outQty = suppQuantities[String(it.product_id)] || 0;
      const shortage = it.shortage_quantity || 0;
      const rem = Math.max(0, shortage - outQty);
      totalOut += outQty;
      remainingAfter += rem;
      if (rem > 0) {
        hasRemaining = true;
      }
    });

    return { hasRemaining, totalOut, remainingAfter };
  }, [selectedOrderForSupp, suppQuantities]);

  // =========================================================================
  // VIEW 1: TRANG XÁC NHẬN XUẤT KHO (ĐÓNG GÓI TRONG 1 KHUNG DUY NHẤT)
  // =========================================================================
  if (viewMode === 'dispatch' && selectedOrderForDispatch) {
    return (
      <div
        style={{
          padding: '8px 14px',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Thanh tiêu đề & Nút thao tác */}
          <div
            style={{
              padding: '8px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              gap: '12px',
              background: '#ffffff',
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                Xác Nhận Xuất Kho Đơn Hàng {selectedOrderForDispatch.order_code}
              </h1>
              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                Người thực hiện: <strong style={{ color: '#0f172a' }}>{currentUser.full_name || currentUser.username}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                disabled={isSubmittingDispatch}
                style={{
                  padding: '6px 14px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmitDispatch}
                disabled={isSubmittingDispatch || dispatchShortageAnalysis.totalOut <= 0}
                style={{
                  padding: '6px 18px',
                  background: '#0284c7',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: isSubmittingDispatch || dispatchShortageAnalysis.totalOut <= 0 ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingDispatch || dispatchShortageAnalysis.totalOut <= 0 ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(2, 132, 199, 0.2)',
                }}
              >
                {isSubmittingDispatch ? 'Đang xuất kho...' : `Xác nhận xuất kho (${dispatchShortageAnalysis.totalOut} SP)`}
              </button>
            </div>
          </div>

          {/* Dòng tóm tắt thông tin đơn hàng (1 dòng không xuống dòng) */}
          <div
            style={{
              padding: '7px 14px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              gap: '24px',
              fontSize: '12px',
              color: '#475569',
              alignItems: 'center',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflowX: 'auto',
            }}
          >
            <div>Khách hàng: <strong style={{ color: '#0f172a' }}>{selectedOrderForDispatch.dealer_name}</strong></div>
            <div>Kho xuất: <strong style={{ color: '#0f172a' }}>{selectedOrderForDispatch.warehouse_name || 'Kho Tổng Hà Nội'}</strong></div>
            <div>Ngày tạo: <strong style={{ color: '#0f172a' }}>{selectedOrderForDispatch.created_at ? new Date(selectedOrderForDispatch.created_at).toLocaleDateString('vi-VN') : '—'}</strong></div>
            <div>Tổng số loại SP: <strong style={{ color: '#0284c7' }}>{selectedOrderForDispatch.items?.length || 0} sản phẩm</strong></div>
          </div>

          {/* Bảng danh sách sản phẩm xuất kho - Chiếm trọn không gian, cuộn nội bộ */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '7px 10px', width: '40px', textAlign: 'center', whiteSpace: 'nowrap' }}>STT</th>
                  <th style={{ padding: '7px 10px', width: '120px', whiteSpace: 'nowrap' }}>Mã sản phẩm</th>
                  <th style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>Tên sản phẩm</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '80px', whiteSpace: 'nowrap' }}>Đơn vị tính</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '80px', whiteSpace: 'nowrap' }}>SL đặt</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '100px', whiteSpace: 'nowrap' }}>Còn phải giao</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '100px', color: '#0284c7', whiteSpace: 'nowrap' }}>Tồn khả dụng</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '190px', whiteSpace: 'nowrap' }}>Thực xuất đợt này</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', width: '140px', whiteSpace: 'nowrap' }}>Còn thiếu sau xuất</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrderForDispatch.items || []).map((it, idx) => {
                  const remaining = it.remaining_quantity !== undefined ? it.remaining_quantity : it.quantity;
                  const outQty = dispatchQuantities[String(it.product_id)] !== undefined ? dispatchQuantities[String(it.product_id)] : 0;
                  const shortageAfter = Math.max(0, remaining - outQty);
                  const isOverStock = outQty > (it.available_stock || 0);

                  return (
                    <tr key={it.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 10px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap' }}>{it.sku_id}</td>
                      <td style={{ padding: '6px 10px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>{it.product_name}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>{it.unit || 'Cái'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>{it.quantity}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>{remaining}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '700', color: (it.available_stock || 0) < remaining ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}>
                        {it.available_stock || 0}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            type="button"
                            title="Giảm 1"
                            onClick={() => handleQuantityChange(it.product_id, Math.max(0, outQty - 1), remaining)}
                            disabled={outQty <= 0}
                            style={{
                              width: '24px',
                              height: '26px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: '#334155',
                              cursor: outQty <= 0 ? 'not-allowed' : 'pointer',
                              opacity: outQty <= 0 ? 0.4 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            -
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={outQty}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleQuantityChange(it.product_id, e.target.value, remaining)}
                            style={{
                              width: '56px',
                              padding: '4px 6px',
                              borderRadius: '5px',
                              border: isOverStock ? '2px solid #dc2626' : '1px solid #cbd5e1',
                              fontSize: '13px',
                              fontWeight: '700',
                              textAlign: 'center',
                              color: '#0f172a',
                              outline: 'none',
                              backgroundColor: '#ffffff',
                            }}
                          />
                          <button
                            type="button"
                            title="Tăng 1"
                            onClick={() => handleQuantityChange(it.product_id, Math.min(remaining, outQty + 1), remaining)}
                            disabled={outQty >= remaining}
                            style={{
                              width: '24px',
                              height: '26px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: '#334155',
                              cursor: outQty >= remaining ? 'not-allowed' : 'pointer',
                              opacity: outQty >= remaining ? 0.4 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            title="Xuất tối đa theo tồn khả dụng"
                            onClick={() => handleQuantityChange(it.product_id, Math.min(remaining, it.available_stock || 0), remaining)}
                            style={{
                              padding: '3px 6px',
                              background: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              color: '#0284c7',
                              cursor: 'pointer',
                              marginLeft: '2px',
                            }}
                          >
                            Max
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: shortageAfter > 0 ? '#d97706' : '#16a34a', whiteSpace: 'nowrap' }}>
                        {shortageAfter > 0 ? `Thiếu ${shortageAfter} ${it.unit || 'Cái'}` : 'Đủ'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>


        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: TRANG GIAO BỔ SUNG (ĐÓNG GÓI TRONG 1 KHUNG DUY NHẤT)
  // =========================================================================
  if (viewMode === 'supplementary' && selectedOrderForSupp) {
    return (
      <div
        style={{
          padding: '8px 14px',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Thanh tiêu đề & Nút thao tác */}
          <div
            style={{
              padding: '8px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              gap: '12px',
              background: '#ffffff',
            }}
          >
            <div>
              <h1 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                Giao Bổ Sung Đơn Hàng {selectedOrderForSupp.order_code}
              </h1>
              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                Người thực hiện: <strong style={{ color: '#0f172a' }}>{currentUser.full_name || currentUser.username}</strong>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                disabled={isSubmittingSupp}
                style={{
                  padding: '6px 14px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#475569',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmitSupplementary}
                disabled={isSubmittingSupp || suppShortageAnalysis.totalOut <= 0}
                style={{
                  padding: '6px 18px',
                  background: '#16a34a',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#ffffff',
                  cursor: isSubmittingSupp || suppShortageAnalysis.totalOut <= 0 ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingSupp || suppShortageAnalysis.totalOut <= 0 ? 0.6 : 1,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 1px 2px rgba(22, 163, 74, 0.2)',
                }}
              >
                {isSubmittingSupp ? 'Đang ghi nhận...' : `Xác nhận giao bổ sung (${suppShortageAnalysis.totalOut} SP)`}
              </button>
            </div>
          </div>

          {/* Dòng tóm tắt thông tin đơn hàng nợ */}
          <div
            style={{
              padding: '7px 14px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              gap: '24px',
              fontSize: '12px',
              color: '#475569',
              alignItems: 'center',
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflowX: 'auto',
            }}
          >
            <div>Khách hàng: <strong style={{ color: '#0f172a' }}>{selectedOrderForSupp.dealer_name}</strong></div>
            <div>Kho xuất: <strong style={{ color: '#0f172a' }}>{selectedOrderForSupp.warehouse_name || 'Kho Tổng Hà Nội'}</strong></div>
            <div>Đợt giao tiếp theo: <strong style={{ color: '#d97706' }}>Đợt {(selectedOrderForSupp.dispatch_count || 1) + 1}</strong></div>
            <div>Mặt hàng nợ: <strong style={{ color: '#dc2626' }}>{selectedOrderForSupp.shortage_items_count || selectedOrderForSupp.items?.length || 0} sản phẩm</strong></div>
          </div>

          {/* Bảng danh sách mặt hàng còn nợ */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '7px 10px', width: '40px', textAlign: 'center', whiteSpace: 'nowrap' }}>STT</th>
                  <th style={{ padding: '7px 10px', width: '120px', whiteSpace: 'nowrap' }}>Mã sản phẩm</th>
                  <th style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>Tên sản phẩm</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '80px', whiteSpace: 'nowrap' }}>Đơn vị tính</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '90px', whiteSpace: 'nowrap' }}>Đã giao lũy kế</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '90px', color: '#d97706', whiteSpace: 'nowrap' }}>Số lượng nợ</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '100px', color: '#0284c7', whiteSpace: 'nowrap' }}>Tồn khả dụng</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '190px', whiteSpace: 'nowrap' }}>Giao bổ sung đợt này</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', width: '130px', whiteSpace: 'nowrap' }}>Nợ lại sau đợt này</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrderForSupp.items || []).map((it, idx) => {
                  const shortage = it.shortage_quantity !== undefined ? it.shortage_quantity : 0;
                  const delivered = it.delivered_quantity || 0;
                  const suppQty = suppQuantities[String(it.product_id)] !== undefined ? suppQuantities[String(it.product_id)] : 0;
                  const remainingShortage = Math.max(0, shortage - suppQty);
                  const isOverStock = suppQty > (it.available_stock || 0);

                  return (
                    <tr key={it.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', whiteSpace: 'nowrap' }}>{idx + 1}</td>
                      <td style={{ padding: '6px 10px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap' }}>{it.sku_id}</td>
                      <td style={{ padding: '6px 10px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>{it.product_name}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569', whiteSpace: 'nowrap' }}>{it.unit || 'Cái'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', fontWeight: '600', whiteSpace: 'nowrap' }}>{delivered}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '800', color: '#d97706', whiteSpace: 'nowrap' }}>{shortage}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '700', color: (it.available_stock || 0) < shortage ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}>
                        {it.available_stock || 0}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <button
                            type="button"
                            title="Giảm 1"
                            onClick={() => handleSuppQuantityChange(it.product_id, Math.max(0, suppQty - 1), shortage)}
                            disabled={suppQty <= 0}
                            style={{
                              width: '24px',
                              height: '26px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: '#334155',
                              cursor: suppQty <= 0 ? 'not-allowed' : 'pointer',
                              opacity: suppQty <= 0 ? 0.4 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            -
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={suppQty}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleSuppQuantityChange(it.product_id, e.target.value, shortage)}
                            style={{
                              width: '56px',
                              padding: '4px 6px',
                              borderRadius: '5px',
                              border: isOverStock ? '2px solid #dc2626' : '1px solid #cbd5e1',
                              fontSize: '13px',
                              fontWeight: '700',
                              textAlign: 'center',
                              color: '#0f172a',
                              outline: 'none',
                              backgroundColor: '#ffffff',
                            }}
                          />
                          <button
                            type="button"
                            title="Tăng 1"
                            onClick={() => handleSuppQuantityChange(it.product_id, Math.min(shortage, suppQty + 1), shortage)}
                            disabled={suppQty >= shortage}
                            style={{
                              width: '24px',
                              height: '26px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontWeight: 'bold',
                              color: '#334155',
                              cursor: suppQty >= shortage ? 'not-allowed' : 'pointer',
                              opacity: suppQty >= shortage ? 0.4 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            title="Giao tối đa theo tồn khả dụng"
                            onClick={() => handleSuppQuantityChange(it.product_id, Math.min(shortage, it.available_stock || 0), shortage)}
                            style={{
                              padding: '3px 6px',
                              background: '#e0f2fe',
                              border: '1px solid #bae6fd',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              color: '#0284c7',
                              cursor: 'pointer',
                              marginLeft: '2px',
                            }}
                          >
                            Max
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: remainingShortage > 0 ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap' }}>
                        {remainingShortage > 0 ? `Còn nợ ${remainingShortage} ${it.unit || 'Cái'}` : 'Đã giao đủ 100%'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Dải ghi chú ở đáy khung */}
          <div
            style={{
              padding: '8px 14px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexShrink: 0,
            }}
          >
            {suppShortageAnalysis.hasRemaining ? (
              <span style={{ fontSize: '11.5px', color: '#b45309', background: '#fef3c7', padding: '4px 10px', borderRadius: '5px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                ⚠️ Vẫn còn nợ {suppShortageAnalysis.remainingAfter} SP (đơn tiếp tục giữ trạng thái Giao thiếu)
              </span>
            ) : (
              <span style={{ fontSize: '11.5px', color: '#15803d', background: '#dcfce7', padding: '4px 10px', borderRadius: '5px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                ✅ Đủ 100% (sau khi xác nhận đơn hàng sẽ hoàn tất giao hàng)
              </span>
            )}
            <input
              type="text"
              value={suppNote}
              onChange={(e) => setSuppNote(e.target.value)}
              placeholder="Ghi chú giao bổ sung (tùy chọn)..."
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: TRANG XEM LỊCH SỬ PHIẾU XUẤT KHO (ĐÓNG GÓI TRONG 1 KHUNG DUY NHẤT)
  // =========================================================================
  if (viewMode === 'history') {
    return (
      <div
        style={{
          padding: '8px 14px',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Thanh tiêu đề */}
          <div
            style={{
              padding: '8px 14px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              gap: '12px',
              background: '#ffffff',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 16px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                }}
                title="Đóng và quay lại danh sách"
              >
                Đóng
              </button>
              <div>
                <h1 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                  Lịch Sử Phiếu Xuất Kho Đơn Hàng {historyOrderCode}
                </h1>
                <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                  Phiếu xuất kho đã xác nhận là chứng từ bất biến, không thể sửa hoặc xóa.
                </span>
              </div>
            </div>

            <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>
              Chứng từ lưu trữ vĩnh viễn
            </span>
          </div>

          {/* Danh sách các phiếu xuất */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isLoadingHistory ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '12.5px' }}>Đang nạp lịch sử phiếu xuất kho...</div>
            ) : dispatchHistoryList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontSize: '12.5px' }}>
                Chưa có phiếu xuất kho nào được tạo cho đơn hàng này.
              </div>
            ) : (
              dispatchHistoryList.map((ph, idx) => (
                <div
                  key={ph.dispatch_code || idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: '800', color: '#0284c7', whiteSpace: 'nowrap' }}>
                        {ph.dispatch_code}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: ph.dispatch_type === 'INITIAL' ? '#e0f2fe' : '#fef3c7',
                          color: ph.dispatch_type === 'INITIAL' ? '#0369a1' : '#b45309',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ph.dispatch_type === 'INITIAL' ? 'Xuất lần đầu' : `Giao bổ sung đợt ${ph.round_number}`}
                      </span>
                    </div>
                    <span style={{ fontSize: '11.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {ph.created_at ? new Date(ph.created_at).toLocaleString('vi-VN') : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: '#475569', marginBottom: '8px', display: 'flex', gap: '20px', flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
                    <div>Người xuất: <strong style={{ color: '#0f172a' }}>{ph.performed_by}</strong></div>
                    {ph.warehouse_name && <div>Kho xuất: <strong style={{ color: '#0f172a' }}>{ph.warehouse_name}</strong></div>}
                    {ph.note && <div>Ghi chú: <em style={{ color: '#334155' }}>{ph.note}</em></div>}
                  </div>

                  {/* Bảng chi tiết sản phẩm của phiếu */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>Sản phẩm</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '110px', whiteSpace: 'nowrap' }}>SL đặt ban đầu</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '110px', color: '#16a34a', fontWeight: '700', whiteSpace: 'nowrap' }}>Xuất đợt này</th>
                          <th style={{ padding: '6px 10px', textAlign: 'center', width: '110px', whiteSpace: 'nowrap' }}>Lũy kế đã giao</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right', width: '120px', color: '#d97706', whiteSpace: 'nowrap' }}>Còn nợ lại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ph.items || []).map((it, itemIdx) => (
                          <tr key={itemIdx} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '6px 10px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>{it.product_name}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', color: '#64748b', whiteSpace: 'nowrap' }}>{it.ordered_quantity}</td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>
                              +{it.dispatched_this_round} {it.unit}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>
                              {it.total_delivered}
                            </td>
                            <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '600', color: it.remaining_shortage > 0 ? '#d97706' : '#16a34a', whiteSpace: 'nowrap' }}>
                              {it.remaining_shortage > 0 ? `Thiếu ${it.remaining_shortage}` : 'Đủ'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW MAIN: TRANG DANH SÁCH ĐƠN HÀNG XUẤT KHO (ĐÓNG GÓI TRONG 1 KHUNG DUY NHẤT)
  // =========================================================================
  return (
    <div
      style={{
        padding: '8px 14px',
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header tích hợp: Tiêu đề + Chỉ số nhanh + Nút Làm mới */}
        {/* Tiêu đề */}
        <div
          style={{
            padding: '10px 16px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
            Xác Nhận Xuất Kho & Xử Lý Giao Thiếu
          </h1>
          <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
            Chuyển tồn giữ chỗ thành xuất thực tế, tự động theo dõi nợ hàng và lưu trữ phiếu xuất bất biến
          </span>
        </div>

        {/* Thanh Tabs & Ô tìm kiếm + Làm mới (Nằm ngang cạnh nhau bên dưới tiêu đề) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            padding: '0 14px',
            flexShrink: 0,
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex' }}>
            <button
              type="button"
              onClick={() => switchTab('dispatch')}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: '700',
                color: activeTab === 'dispatch' ? '#0284c7' : '#64748b',
                borderBottom: activeTab === 'dispatch' ? '2px solid #0284c7' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Chờ xác nhận xuất kho ({dispatchPendingOrders.length})
            </button>

            <button
              type="button"
              onClick={() => switchTab('supplementary')}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: '700',
                color: activeTab === 'supplementary' ? '#d97706' : '#64748b',
                borderBottom: activeTab === 'supplementary' ? '2px solid #d97706' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Chờ giao bổ sung ({supplementaryOrders.length})
            </button>

            <button
              type="button"
              onClick={() => switchTab('history')}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'transparent',
                fontSize: '13px',
                fontWeight: '700',
                color: activeTab === 'history' ? '#059669' : '#64748b',
                borderBottom: activeTab === 'history' ? '2px solid #059669' : '2px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Lịch sử xuất kho ({allDispatches.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', flexShrink: 0 }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã đơn, mã phiếu, khách hàng..."
              style={{
                width: '300px',
                height: '32px',
                padding: '0 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                color: '#0f172a',
                boxSizing: 'border-box',
                background: '#ffffff',
              }}
            />
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              style={{
                height: '32px',
                padding: '0 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#334155',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
              }}
            >
              {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        {/* BẢNG TAB 1: CHỜ XÁC NHẬN XUẤT KHO - ĐÃ CĂN CHỈNH TIÊU ĐỀ THẲNG HÀNG & CÂN ĐỐI */}
        {activeTab === 'dispatch' && (
          <>
            <div style={{ flex: 1, minHeight: '280px', overflowY: 'auto', overflowX: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '9px 12px 9px 16px', fontWeight: '700', whiteSpace: 'nowrap', width: '16%' }}>Mã đơn hàng</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '23%' }}>Khách hàng / Đại lý</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '16%' }}>Kho phụ trách</th>
                    <th style={{ padding: '9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '11%', textAlign: 'center' }}>Ngày đặt</th>
                    <th style={{ padding: '9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '10%', textAlign: 'center' }}>Số loại SP</th>
                    <th style={{ padding: '9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '11%', textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ padding: '9px 16px 9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '13%', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDispatchOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>Không có đơn hàng nào chờ xuất kho</div>
                        <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Các đơn hàng mới được duyệt sẽ xuất hiện tại đây.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedDispatchOrders.map((ord, idx) => (
                      <tr key={ord.order_code} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease', position: 'relative', zIndex: activeDropdownId === ord.order_code ? 50 : 1 }}>
                        <td style={{ padding: '8px 12px 8px 16px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ord.order_code}
                        </td>
                        <td title={ord.dealer_name} style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ord.dealer_name}
                        </td>
                        <td title={ord.warehouse_name || 'Kho Tổng Hà Nội'} style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ord.warehouse_name || 'Kho Tổng Hà Nội'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {ord.created_at ? new Date(ord.created_at).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>
                          {ord.items?.length || 0}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', padding: '2.5px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#166534', whiteSpace: 'nowrap' }}>
                            ĐÃ DUYỆT
                          </span>
                        </td>
                        <td style={{ padding: '6px 16px 6px 10px', textAlign: 'center', whiteSpace: 'nowrap', position: 'relative', zIndex: activeDropdownId === ord.order_code ? 60 : 1 }}>
                          <div className="wh-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className={`wh-action-dots-btn ${activeDropdownId === ord.order_code ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId((prev) => (prev === ord.order_code ? null : ord.order_code));
                              }}
                              title="Tùy chọn thao tác"
                            >
                              <span className="wh-action-dots-icon">
                                <span />
                                <span />
                                <span />
                              </span>
                            </button>

                            {activeDropdownId === ord.order_code && (() => {
                              const openUpward = idx > 0 && (idx >= paginatedDispatchOrders.length - 1 || (paginatedDispatchOrders.length >= 4 && idx >= paginatedDispatchOrders.length - 2));
                              return (
                                <div className={`wh-dropdown-menu ${openUpward ? 'open-up' : 'open-down'}`} style={{ minWidth: '135px' }}>
                                  <button
                                    type="button"
                                    className="wh-dropdown-item wh-dropdown-item-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownId(null);
                                      handleOpenDispatchPage(ord);
                                    }}
                                  >
                                    <span>Xác nhận xuất kho</span>
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
            {renderPaginationBar(dispatchPage, dispatchTotalPages, filteredDispatchOrders.length, setDispatchPage)}
          </>
        )}

        {/* BẢNG TAB 2: CHỜ GIAO BỔ SUNG - ĐÃ CĂN CHỈNH TIÊU ĐỀ THẲNG HÀNG & CÂN ĐỐI */}
        {activeTab === 'supplementary' && (
          <>
            <div style={{ flex: 1, minHeight: '280px', overflowY: 'auto', overflowX: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '9px 12px 9px 16px', fontWeight: '700', whiteSpace: 'nowrap', width: '15%' }}>Mã đơn hàng</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '21%' }}>Khách hàng / Đại lý</th>
                    <th style={{ padding: '9px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '15%' }}>Kho phụ trách</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '9%', textAlign: 'center' }}>SP còn thiếu</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '9%', textAlign: 'center' }}>Tổng SL thiếu</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '10%', textAlign: 'center' }}>Lần xuất trước</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '10%', textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ padding: '9px 16px 9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '11%', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>Không có đơn hàng nào còn nợ hàng</div>
                        <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Tất cả các đơn đã xuất đều đã được giao đủ 100%.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedSuppOrders.map((ord, idx) => (
                      <tr key={ord.order_code} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease', position: 'relative', zIndex: activeDropdownId === ord.order_code ? 50 : 1 }}>
                        <td style={{ padding: '8px 12px 8px 16px', fontWeight: '700', color: '#d97706', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ord.order_code}
                        </td>
                        <td title={ord.dealer_name} style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ord.dealer_name}
                        </td>
                        <td title={ord.warehouse_name || 'Kho Tổng Hà Nội'} style={{ padding: '8px 12px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ord.warehouse_name || 'Kho Tổng Hà Nội'}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '700', color: '#b45309', whiteSpace: 'nowrap' }}>
                          {ord.shortage_items_count || ord.items?.length || 0} loại
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '800', color: '#dc2626', whiteSpace: 'nowrap' }}>
                          {ord.total_shortage_quantity || 0}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ord.last_dispatch_date ? new Date(ord.last_dispatch_date).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-block', padding: '2.5px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#fef3c7', color: '#b45309', whiteSpace: 'nowrap' }}>
                            Thiếu đợt {ord.dispatch_count || 1}
                          </span>
                        </td>
                        <td style={{ padding: '6px 16px 6px 8px', textAlign: 'center', whiteSpace: 'nowrap', position: 'relative', zIndex: activeDropdownId === ord.order_code ? 60 : 1 }}>
                          <div className="wh-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className={`wh-action-dots-btn ${activeDropdownId === ord.order_code ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId((prev) => (prev === ord.order_code ? null : ord.order_code));
                              }}
                              title="Tùy chọn thao tác"
                            >
                              <span className="wh-action-dots-icon">
                                <span />
                                <span />
                                <span />
                              </span>
                            </button>

                            {activeDropdownId === ord.order_code && (() => {
                              const openUpward = idx > 0 && (idx >= paginatedSuppOrders.length - 1 || (paginatedSuppOrders.length >= 4 && idx >= paginatedSuppOrders.length - 2));
                              return (
                                <div className={`wh-dropdown-menu ${openUpward ? 'open-up' : 'open-down'}`} style={{ minWidth: '130px' }}>
                                  <button
                                    type="button"
                                    className="wh-dropdown-item"
                                    style={{ color: '#d97706', fontWeight: 600 }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownId(null);
                                      handleOpenSupplementaryPage(ord);
                                    }}
                                  >
                                    <span>Giao bổ sung</span>
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
            {renderPaginationBar(suppPage, suppTotalPages, filteredSuppOrders.length, setSuppPage)}
          </>
        )}

        {/* BẢNG TAB 3: LỊCH SỬ PHIẾU XUẤT KHO - ĐÃ CĂN CHỈNH TIÊU ĐỀ THẲNG HÀNG & CÂN ĐỐI */}
        {activeTab === 'history' && (
          <>
            <div style={{ flex: 1, minHeight: '280px', overflowY: 'auto', overflowX: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px', tableLayout: 'fixed' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                  <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '9px 10px 9px 16px', fontWeight: '700', whiteSpace: 'nowrap', width: '14%' }}>Mã phiếu xuất</th>
                    <th style={{ padding: '9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '11%' }}>Mã đơn hàng</th>
                    <th style={{ padding: '9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '17%' }}>Khách hàng / Đại lý</th>
                    <th style={{ padding: '9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '12%' }}>Kho xuất</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '8%', textAlign: 'center' }}>Đợt xuất</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '7%', textAlign: 'center' }}>SL xuất</th>
                    <th style={{ padding: '9px 10px', fontWeight: '700', whiteSpace: 'nowrap', width: '10%' }}>Người thực hiện</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '11%', textAlign: 'center' }}>Thời gian</th>
                    <th style={{ padding: '9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '8%', textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ padding: '9px 16px 9px 8px', fontWeight: '700', whiteSpace: 'nowrap', width: '7%', textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAllDispatches.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a' }}>Chưa có phiếu xuất kho nào</div>
                        <div style={{ fontSize: '11.5px', marginTop: '4px' }}>Mọi phiếu xuất kho sau khi xác nhận sẽ được lưu trữ vĩnh viễn tại đây mà không bị ẩn đi.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedAllDispatches.map((dp, idx) => (
                      <tr key={dp.dispatch_code || dp.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s ease' }}>
                        <td style={{ padding: '8px 10px 8px 16px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dp.dispatch_code}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dp.order_code}
                        </td>
                        <td title={dp.dealer_name} style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dp.dealer_name || 'Khách Mua Hàng'}
                        </td>
                        <td title={dp.warehouse_name || 'Kho Tổng'} style={{ padding: '8px 10px', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dp.warehouse_name || 'Kho Tổng'}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2.5px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: dp.round_number === 1 ? '#e0f2fe' : '#fef3c7',
                              color: dp.round_number === 1 ? '#0369a1' : '#b45309',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {dp.round_number === 1 ? 'Lần đầu' : `Đợt ${dp.round_number}`}
                          </span>
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>
                          +{dp.total_dispatched_qty} sp
                        </td>
                        <td title={dp.performed_by} style={{ padding: '8px 10px', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dp.performed_by}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                          {dp.created_at ? new Date(dp.created_at).toLocaleDateString('vi-VN') + ' ' + new Date(dp.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2.5px 6px',
                              borderRadius: '4px',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              background: dp.order_status === 'DELIVERED' ? '#dcfce7' : dp.order_status === 'PARTIALLY_DELIVERED' ? '#fef3c7' : '#e0f2fe',
                              color: dp.order_status === 'DELIVERED' ? '#166534' : dp.order_status === 'PARTIALLY_DELIVERED' ? '#b45309' : '#0369a1',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {dp.order_status === 'DELIVERED' ? 'HOÀN THÀNH' : dp.order_status === 'PARTIALLY_DELIVERED' ? 'GIAO THIẾU' : (dp.order_status || 'ĐÃ XUẤT')}
                          </span>
                        </td>
                        <td style={{ padding: '6px 16px 6px 8px', textAlign: 'center', whiteSpace: 'nowrap', position: 'relative', zIndex: activeDropdownId === (dp.dispatch_code || String(dp.id)) ? 60 : 1 }}>
                          <div className="wh-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              className={`wh-action-dots-btn ${activeDropdownId === (dp.dispatch_code || String(dp.id)) ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId((prev) => (prev === (dp.dispatch_code || String(dp.id)) ? null : (dp.dispatch_code || String(dp.id))));
                              }}
                              title="Tùy chọn thao tác"
                            >
                              <span className="wh-action-dots-icon">
                                <span />
                                <span />
                                <span />
                              </span>
                            </button>

                            {activeDropdownId === (dp.dispatch_code || String(dp.id)) && (() => {
                              const openUpward = idx > 0 && (idx >= paginatedAllDispatches.length - 1 || (paginatedAllDispatches.length >= 4 && idx >= paginatedAllDispatches.length - 2));
                              return (
                                <div className={`wh-dropdown-menu ${openUpward ? 'open-up' : 'open-down'}`} style={{ minWidth: '110px' }}>
                                  <button
                                    type="button"
                                    className="wh-dropdown-item wh-dropdown-item-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveDropdownId(null);
                                      handleViewDispatchHistoryPage(dp.order_code);
                                    }}
                                  >
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
            {renderPaginationBar(historyPage, historyTotalPages, filteredAllDispatches.length, setHistoryPage)}
          </>
        )}
      </div>
    </div>
  );
};
