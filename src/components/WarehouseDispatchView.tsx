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

  // Tổng hợp chỉ số thống kê
  const totalPendingDispatchCount = dispatchPendingOrders.length;
  const totalSupplementaryCount = supplementaryOrders.length;
  const totalShortageItemUnits = supplementaryOrders.reduce(
    (sum, o) => sum + (o.total_shortage_quantity || 0),
    0
  );

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
  const handleQuantityChange = (productId: number, val: number, maxAllowed: number) => {
    const safeVal = Math.max(0, Math.min(Number.isNaN(val) ? 0 : val, maxAllowed));
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
  const handleSuppQuantityChange = (productId: number, val: number, maxAllowed: number) => {
    const safeVal = Math.max(0, Math.min(Number.isNaN(val) ? 0 : val, maxAllowed));
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
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
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
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '130px', whiteSpace: 'nowrap' }}>Thực xuất đợt này</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', width: '140px', whiteSpace: 'nowrap' }}>Còn thiếu sau xuất</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrderForDispatch.items || []).map((it, idx) => {
                  const remaining = it.remaining_quantity !== undefined ? it.remaining_quantity : it.quantity;
                  const outQty = dispatchQuantities[String(it.product_id)] || 0;
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
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={outQty}
                          onChange={(e) => handleQuantityChange(it.product_id, parseInt(e.target.value, 10), remaining)}
                          style={{
                            width: '90px',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: isOverStock ? '2px solid #dc2626' : '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            textAlign: 'center',
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
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
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
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
                  <th style={{ padding: '7px 10px', textAlign: 'center', width: '140px', whiteSpace: 'nowrap' }}>Giao bổ sung đợt này</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', width: '130px', whiteSpace: 'nowrap' }}>Nợ lại sau đợt này</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrderForSupp.items || []).map((it, idx) => {
                  const shortage = it.shortage_quantity !== undefined ? it.shortage_quantity : 0;
                  const delivered = it.delivered_quantity || 0;
                  const suppQty = suppQuantities[String(it.product_id)] || 0;
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
                        <input
                          type="number"
                          min={0}
                          max={shortage}
                          value={suppQty}
                          onChange={(e) => handleSuppQuantityChange(it.product_id, parseInt(e.target.value, 10), shortage)}
                          style={{
                            width: '90px',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            border: isOverStock ? '2px solid #dc2626' : '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: '700',
                            textAlign: 'center',
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
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
            <div>
              <h1 style={{ margin: 0, fontSize: '15.5px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
                Lịch Sử Phiếu Xuất Kho Đơn Hàng {historyOrderCode}
              </h1>
              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
                Phiếu xuất kho đã xác nhận là chứng từ bất biến, không thể sửa hoặc xóa.
              </span>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  padding: '5px 14px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Đóng
              </button>
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
        <div
          style={{
            padding: '8px 14px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            gap: '12px',
            flexWrap: 'nowrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
              Xác Nhận Xuất Kho & Xử Lý Giao Thiếu
            </h1>
            <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>
              Chuyển tồn giữ chỗ thành xuất thực tế, tự động theo dõi nợ hàng và lưu trữ phiếu xuất bất biến
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* 3 Huy hiệu tóm tắt nhanh nằm ngay trên thanh tiêu đề, không tạo 3 ô rời rạc */}
            <span
              onClick={() => switchTab('dispatch')}
              style={{
                padding: '4px 10px',
                background: activeTab === 'dispatch' ? '#e0f2fe' : '#f1f5f9',
                color: activeTab === 'dispatch' ? '#0369a1' : '#475569',
                border: activeTab === 'dispatch' ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Chờ xuất: <strong>{totalPendingDispatchCount}</strong> đơn
            </span>

            <span
              onClick={() => switchTab('supplementary')}
              style={{
                padding: '4px 10px',
                background: activeTab === 'supplementary' ? '#fef3c7' : '#f1f5f9',
                color: activeTab === 'supplementary' ? '#b45309' : '#475569',
                border: activeTab === 'supplementary' ? '1px solid #fde68a' : '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Chờ bổ sung: <strong>{totalSupplementaryCount}</strong> đơn (thiếu {totalShortageItemUnits} SP)
            </span>

            <span
              onClick={() => switchTab('history')}
              style={{
                padding: '4px 10px',
                background: activeTab === 'history' ? '#dcfce7' : '#f1f5f9',
                color: activeTab === 'history' ? '#15803d' : '#475569',
                border: activeTab === 'history' ? '1px solid #86efac' : '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Lịch sử: <strong>{allDispatches.length}</strong> phiếu
            </span>

            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              style={{
                padding: '5px 12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
                color: '#334155',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        {/* Thanh Tabs & Ô tìm kiếm (Nằm ngang trong cùng 1 khung) */}
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

          <div style={{ padding: '6px 0' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm theo mã đơn, mã phiếu, khách hàng..."
              style={{
                width: '300px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '12px',
                outline: 'none',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* BẢNG TAB 1: CHỜ XÁC NHẬN XUẤT KHO - ĐÃ XÓA NÚT LỊCH SỬ Ở CỘT THAO TÁC, KHÔNG XUỐNG DÒNG */}
        {activeTab === 'dispatch' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '120px' }}>Mã đơn hàng</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap' }}>Khách hàng / Đại lý</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '160px' }}>Kho phụ trách</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px' }}>Ngày đặt</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '90px', textAlign: 'center' }}>Số loại SP</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '110px' }}>Trạng thái</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '140px', textAlign: 'right' }}>Thao tác</th>
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
                  filteredDispatchOrders.map((ord) => (
                    <tr key={ord.order_code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 12px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap' }}>
                        {ord.order_code}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {ord.dealer_name}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {ord.warehouse_name || 'Kho Tổng Hà Nội'}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {ord.created_at ? new Date(ord.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: '700', color: '#334155', whiteSpace: 'nowrap' }}>
                        {ord.items?.length || 0}
                      </td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#dcfce7', color: '#166534', whiteSpace: 'nowrap' }}>
                          ĐÃ DUYỆT
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDispatchPage(ord)}
                          style={{
                            padding: '5px 14px',
                            background: '#0284c7',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            color: '#ffffff',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(2,132,199,0.2)',
                          }}
                        >
                          Xác nhận xuất kho
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG TAB 2: CHỜ GIAO BỔ SUNG - ĐÃ XÓA NÚT LỊCH SỬ Ở CỘT THAO TÁC, KHÔNG XUỐNG DÒNG */}
        {activeTab === 'supplementary' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '120px' }}>Mã đơn hàng</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap' }}>Khách hàng / Đại lý</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '160px' }}>Kho phụ trách</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px', textAlign: 'center' }}>SP còn thiếu</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px', textAlign: 'center' }}>Tổng SL thiếu</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '130px' }}>Lần xuất gần nhất</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '130px' }}>Trạng thái</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '130px', textAlign: 'right' }}>Thao tác</th>
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
                  filteredSuppOrders.map((ord) => (
                    <tr key={ord.order_code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 12px', fontWeight: '700', color: '#d97706', whiteSpace: 'nowrap' }}>
                        {ord.order_code}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {ord.dealer_name}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {ord.warehouse_name || 'Kho Tổng Hà Nội'}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: '700', color: '#b45309', whiteSpace: 'nowrap' }}>
                        {ord.shortage_items_count || ord.items?.length || 0} loại
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: '800', color: '#dc2626', whiteSpace: 'nowrap' }}>
                        {ord.total_shortage_quantity || 0}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {ord.last_dispatch_date ? new Date(ord.last_dispatch_date).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#fef3c7', color: '#b45309', whiteSpace: 'nowrap' }}>
                          Giao thiếu đợt {ord.dispatch_count || 1}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenSupplementaryPage(ord)}
                          style={{
                            padding: '5px 14px',
                            background: '#d97706',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            color: '#ffffff',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(217,119,6,0.2)',
                          }}
                        >
                          Giao bổ sung
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG TAB 3: LỊCH SỬ PHIẾU XUẤT KHO - KHÔNG XUỐNG DÒNG */}
        {activeTab === 'history' && (
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '140px' }}>Mã phiếu xuất</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '120px' }}>Mã đơn hàng</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap' }}>Khách hàng / Đại lý</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '150px' }}>Kho xuất</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '90px', textAlign: 'center' }}>Đợt xuất</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px', textAlign: 'center' }}>SL xuất</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '130px' }}>Người thực hiện</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '140px' }}>Thời gian</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '110px' }}>Trạng thái đơn</th>
                  <th style={{ padding: '7px 12px', fontWeight: '700', whiteSpace: 'nowrap', width: '100px', textAlign: 'right' }}>Thao tác</th>
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
                  filteredAllDispatches.map((dp) => (
                    <tr key={dp.dispatch_code || dp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 12px', fontWeight: '700', color: '#0284c7', whiteSpace: 'nowrap' }}>
                        {dp.dispatch_code}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {dp.order_code}
                      </td>
                      <td style={{ padding: '6px 12px', fontWeight: '600', color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {dp.dealer_name || 'Khách Mua Hàng'}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#475569', whiteSpace: 'nowrap' }}>
                        {dp.warehouse_name || 'Kho Tổng'}
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
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
                      <td style={{ padding: '6px 12px', textAlign: 'center', fontWeight: '700', color: '#16a34a', whiteSpace: 'nowrap' }}>
                        +{dp.total_dispatched_qty} sp
                      </td>
                      <td style={{ padding: '6px 12px', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {dp.performed_by}
                      </td>
                      <td style={{ padding: '6px 12px', color: '#64748b', fontSize: '11.5px', whiteSpace: 'nowrap' }}>
                        {dp.created_at ? new Date(dp.created_at).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '6px 12px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '700',
                            background: dp.order_status === 'DELIVERED' ? '#dcfce7' : dp.order_status === 'PARTIALLY_DELIVERED' ? '#fef3c7' : '#e0f2fe',
                            color: dp.order_status === 'DELIVERED' ? '#166534' : dp.order_status === 'PARTIALLY_DELIVERED' ? '#b45309' : '#0369a1',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dp.order_status === 'DELIVERED' ? 'HOÀN THÀNH' : dp.order_status === 'PARTIALLY_DELIVERED' ? 'GIAO THIẾU' : (dp.order_status || 'ĐÃ XUẤT')}
                        </span>
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleViewDispatchHistoryPage(dp.order_code)}
                          style={{
                            padding: '5px 12px',
                            background: '#059669',
                            border: 'none',
                            borderRadius: '5px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            color: '#ffffff',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 2px rgba(5,150,105,0.2)',
                          }}
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
