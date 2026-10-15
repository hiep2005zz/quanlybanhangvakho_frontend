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
  // VIEW 1: TRANG XÁC NHẬN XUẤT KHO (SUB-PAGE)
  // =========================================================================
  if (viewMode === 'dispatch' && selectedOrderForDispatch) {
    return (
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
        {/* Thanh điều hướng quay lại */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            disabled={isSubmittingDispatch}
            style={{
              padding: '8px 16px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Quay lại danh sách
          </button>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Người thực hiện: <strong style={{ color: '#0f172a' }}>{currentUser.full_name || currentUser.username}</strong>
          </span>
        </div>

        {/* Thông tin đơn hàng */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                Xác Nhận Xuất Kho Đơn Hàng {selectedOrderForDispatch.order_code}
              </h1>
              <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '13px', color: '#475569', flexWrap: 'wrap' }}>
                <div>Khách hàng: <strong style={{ color: '#0f172a' }}>{selectedOrderForDispatch.dealer_name}</strong></div>
                <div>Kho xuất: <strong style={{ color: '#0f172a' }}>{selectedOrderForDispatch.warehouse_name || 'Kho Tổng Hà Nội'}</strong></div>
                <div>Ngày tạo: <strong style={{ color: '#0f172a' }}>{selectedOrderForDispatch.created_at ? new Date(selectedOrderForDispatch.created_at).toLocaleDateString('vi-VN') : '—'}</strong></div>
                <div>Tổng số loại mặt hàng: <strong style={{ color: '#0284c7' }}>{selectedOrderForDispatch.items?.length || 0} sản phẩm</strong></div>
              </div>
            </div>
          </div>
        </div>

        {/* Bảng danh sách sản phẩm xuất kho - Hàng tiêu đề đứng yên */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
              Danh sách mặt hàng cần xuất
            </span>
            <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>
              Kiểm tra tồn khả dụng và nhập số lượng thực tế giao đợt này.
            </span>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', width: '50px', textAlign: 'center' }}>STT</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px' }}>Mã sản phẩm</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px' }}>Tên sản phẩm</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center' }}>Đơn vị tính</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center' }}>SL đặt</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center' }}>Còn phải giao</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center', color: '#0284c7' }}>Tồn khả dụng</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center', width: '140px' }}>
                    Thực xuất đợt này
                  </th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'right' }}>Còn thiếu sau xuất</th>
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
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0284c7' }}>{it.sku_id}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0f172a' }}>{it.product_name}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#475569' }}>{it.unit || 'Cái'}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>{it.quantity}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#0f172a' }}>{remaining}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: (it.available_stock || 0) < remaining ? '#dc2626' : '#16a34a' }}>
                        {it.available_stock || 0}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={outQty}
                          onChange={(e) => handleQuantityChange(it.product_id, parseInt(e.target.value, 10), remaining)}
                          style={{
                            width: '100px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: isOverStock ? '2px solid #dc2626' : '1px solid #cbd5e1',
                            fontSize: '13px',
                            fontWeight: '700',
                            textAlign: 'center',
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: shortageAfter > 0 ? '#d97706' : '#16a34a' }}>
                        {shortageAfter > 0 ? `Thiếu ${shortageAfter} ${it.unit || 'Cái'}` : 'Đủ'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tóm tắt cảnh báo & ghi chú */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
          {dispatchShortageAnalysis.hasShortage && (
            <div style={{ marginBottom: '16px', padding: '14px 18px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px' }}>
              <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#92400e' }}>
                Đơn hàng xuất thiếu
              </div>
              <div style={{ fontSize: '13px', color: '#b45309', marginTop: '4px' }}>
                Tổng số lượng xuất đợt này là <strong>{dispatchShortageAnalysis.totalOut}</strong>. Số lượng còn thiếu là <strong>{dispatchShortageAnalysis.totalRemainingShortage}</strong> sản phẩm. Phần thiếu này sẽ được hệ thống tự động ghi nhận là còn nợ hàng và chuyển sang danh sách Chờ giao bổ sung để xử lý ở lượt sau.
              </div>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Ghi chú xuất kho
            </label>
            <input
              type="text"
              value={dispatchNote}
              onChange={(e) => setDispatchNote(e.target.value)}
              placeholder="Nhập ghi chú cho phiếu xuất kho đợt này..."
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              disabled={isSubmittingDispatch}
              style={{
                padding: '9px 20px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmitDispatch}
              disabled={isSubmittingDispatch || dispatchShortageAnalysis.totalOut <= 0}
              style={{
                padding: '9px 26px',
                background: '#0284c7',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: isSubmittingDispatch || dispatchShortageAnalysis.totalOut <= 0 ? 'not-allowed' : 'pointer',
                opacity: isSubmittingDispatch || dispatchShortageAnalysis.totalOut <= 0 ? 0.6 : 1,
              }}
            >
              {isSubmittingDispatch ? 'Đang thực hiện xuất kho...' : 'Xác nhận xuất kho'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: TRANG GIAO BỔ SUNG (SUB-PAGE)
  // =========================================================================
  if (viewMode === 'supplementary' && selectedOrderForSupp) {
    return (
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
        {/* Thanh điều hướng quay lại */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            disabled={isSubmittingSupp}
            style={{
              padding: '8px 16px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Quay lại danh sách
          </button>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Người thực hiện: <strong style={{ color: '#0f172a' }}>{currentUser.full_name || currentUser.username}</strong>
          </span>
        </div>

        {/* Thông tin đơn hàng nợ */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
            Giao Bổ Sung Đơn Hàng {selectedOrderForSupp.order_code}
          </h1>
          <div style={{ display: 'flex', gap: '24px', marginTop: '12px', fontSize: '13px', color: '#475569', flexWrap: 'wrap' }}>
            <div>Khách hàng: <strong style={{ color: '#0f172a' }}>{selectedOrderForSupp.dealer_name}</strong></div>
            <div>Kho xuất: <strong style={{ color: '#0f172a' }}>{selectedOrderForSupp.warehouse_name || 'Kho Tổng Hà Nội'}</strong></div>
            <div>Đợt giao tiếp theo: <strong style={{ color: '#d97706' }}>Đợt {(selectedOrderForSupp.dispatch_count || 1) + 1}</strong></div>
            <div>Mặt hàng nợ: <strong style={{ color: '#dc2626' }}>{selectedOrderForSupp.shortage_items_count || selectedOrderForSupp.items?.length || 0} sản phẩm</strong></div>
          </div>
        </div>

        {/* Bảng sản phẩm còn nợ - Hàng tiêu đề đứng yên */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', background: '#ffffff' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
              Danh sách sản phẩm còn nợ
            </span>
            <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '12px' }}>
              Nhập số lượng giao bổ sung cho các mặt hàng còn thiếu.
            </span>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 380px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', width: '50px', textAlign: 'center' }}>STT</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px' }}>Mã sản phẩm</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px' }}>Tên sản phẩm</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center' }}>SL đặt</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center', color: '#16a34a' }}>Đã giao</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center', color: '#dc2626' }}>Còn thiếu</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center', color: '#0284c7' }}>Tồn khả dụng</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'center', width: '140px' }}>
                    Giao đợt này
                  </th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 14px', textAlign: 'right' }}>Nợ còn lại</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrderForSupp.items || []).map((it, idx) => {
                  const shortage = it.shortage_quantity || 0;
                  const outQty = suppQuantities[String(it.product_id)] || 0;
                  const remAfter = Math.max(0, shortage - outQty);

                  return (
                    <tr key={it.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '700', color: '#d97706' }}>{it.sku_id}</td>
                      <td style={{ padding: '12px 14px', fontWeight: '600', color: '#0f172a' }}>{it.product_name}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{it.quantity}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#16a34a', fontWeight: '600' }}>{it.delivered_quantity}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '700', color: '#dc2626' }}>{shortage}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: '600', color: '#0284c7' }}>{it.available_stock || 0}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <input
                          type="number"
                          min={0}
                          max={shortage}
                          value={outQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const safeVal = Math.max(0, Math.min(Number.isNaN(val) ? 0 : val, shortage));
                            setSuppQuantities((prev) => ({
                              ...prev,
                              [String(it.product_id)]: safeVal,
                            }));
                          }}
                          style={{
                            width: '100px',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '13px',
                            fontWeight: '700',
                            textAlign: 'center',
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: '700', color: remAfter > 0 ? '#d97706' : '#16a34a' }}>
                        {remAfter > 0 ? `Còn thiếu ${remAfter}` : 'Giao đủ'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Thông báo kết quả dự kiến & Ghi chú */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
          <div
            style={{
              marginBottom: '16px',
              padding: '14px 18px',
              background: suppShortageAnalysis.hasRemaining ? '#fffbeb' : '#f0fdf4',
              border: suppShortageAnalysis.hasRemaining ? '1px solid #fef3c7' : '1px solid #bbf7d0',
              borderRadius: '8px',
              fontSize: '13px',
              color: suppShortageAnalysis.hasRemaining ? '#92400e' : '#166534',
            }}
          >
            {suppShortageAnalysis.hasRemaining ? (
              <span>
                Sau đợt giao này, đơn hàng vẫn còn nợ <strong>{suppShortageAnalysis.remainingAfter}</strong> sản phẩm và sẽ tiếp tục được theo dõi ở danh sách Chờ giao bổ sung.
              </span>
            ) : (
              <span>
                Đơn hàng sẽ được giao đủ tất cả các sản phẩm và tự động hoàn tất chuyển sang trạng thái Đã giao hàng.
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              Ghi chú giao bổ sung
            </label>
            <input
              type="text"
              value={suppNote}
              onChange={(e) => setSuppNote(e.target.value)}
              placeholder="Nhập ghi chú cho đợt giao bổ sung này..."
              style={{
                width: '100%',
                padding: '9px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                color: '#0f172a',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              disabled={isSubmittingSupp}
              style={{
                padding: '9px 20px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSubmitSupplementary}
              disabled={isSubmittingSupp || suppShortageAnalysis.totalOut <= 0}
              style={{
                padding: '9px 26px',
                background: '#16a34a',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '700',
                color: '#ffffff',
                cursor: isSubmittingSupp || suppShortageAnalysis.totalOut <= 0 ? 'not-allowed' : 'pointer',
                opacity: isSubmittingSupp || suppShortageAnalysis.totalOut <= 0 ? 0.6 : 1,
              }}
            >
              {isSubmittingSupp ? 'Đang ghi nhận...' : 'Xác nhận giao bổ sung'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 3: TRANG XEM LỊCH SỬ PHIẾU XUẤT KHO (SUB-PAGE)
  // =========================================================================
  if (viewMode === 'history') {
    return (
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
        {/* Thanh điều hướng quay lại */}
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            style={{
              padding: '8px 16px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Quay lại danh sách
          </button>
        </div>

        {/* Thông tin đơn */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px', marginBottom: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
            Lịch Sử Phiếu Xuất Kho Đơn Hàng {historyOrderCode}
          </h1>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '6px' }}>
            Phiếu xuất kho đã xác nhận là chứng từ bất biến, không thể sửa hoặc xóa.
          </div>
        </div>

        {/* Danh sách các phiếu xuất */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px 24px' }}>
          {isLoadingHistory ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Đang nạp lịch sử phiếu xuất kho...</div>
          ) : dispatchHistoryList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              Chưa có phiếu xuất kho nào được tạo cho đơn hàng này.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {dispatchHistoryList.map((ph, idx) => (
                <div
                  key={ph.dispatch_code || idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '18px 20px',
                    background: '#ffffff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        Mã phiếu: <span style={{ color: '#0284c7' }}>{ph.dispatch_code}</span>
                      </span>
                      <span
                        style={{
                          marginLeft: '12px',
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '700',
                          background: ph.dispatch_type === 'INITIAL' ? '#e0f2fe' : '#fef3c7',
                          color: ph.dispatch_type === 'INITIAL' ? '#0369a1' : '#b45309',
                        }}
                      >
                        {ph.dispatch_type === 'INITIAL' ? 'Xuất lần đầu' : `Giao bổ sung đợt ${ph.round_number}`}
                      </span>
                    </div>
                    <span style={{ fontSize: '12.5px', color: '#64748b' }}>
                      {ph.created_at ? new Date(ph.created_at).toLocaleString('vi-VN') : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', color: '#475569', marginBottom: '14px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div>Người xuất: <strong style={{ color: '#0f172a' }}>{ph.performed_by}</strong></div>
                    {ph.warehouse_name && <div>Kho xuất: <strong style={{ color: '#0f172a' }}>{ph.warehouse_name}</strong></div>}
                    {ph.note && <div>Ghi chú: <em style={{ color: '#334155' }}>{ph.note}</em></div>}
                  </div>

                  {/* Bảng chi tiết sản phẩm của phiếu - Tiêu đề đứng yên */}
                  <div style={{ border: '1px solid #f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '8px 12px' }}>Sản phẩm</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>SL đặt ban đầu</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>Xuất đợt này</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Lũy kế đã giao</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#d97706' }}>Còn nợ lại</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ph.items || []).map((it, itemIdx) => (
                          <tr key={itemIdx} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: '600', color: '#0f172a' }}>{it.product_name}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', color: '#64748b' }}>{it.ordered_quantity}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '700', color: '#16a34a' }}>
                              +{it.dispatched_this_round} {it.unit}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', color: '#334155' }}>
                              {it.total_delivered}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', color: it.remaining_shortage > 0 ? '#d97706' : '#16a34a' }}>
                              {it.remaining_shortage > 0 ? `Thiếu ${it.remaining_shortage}` : 'Đủ'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW MAIN: TRANG DANH SÁCH ĐƠN HÀNG XUẤT KHO
  // =========================================================================
  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Tiêu đề & Nút làm mới */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Xác Nhận Xuất Kho & Xử Lý Giao Thiếu
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13.5px', color: '#475569' }}>
              Chuyển tồn giữ chỗ thành xuất thực, theo dõi hàng nợ và phiếu xuất kho bất biến.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={loadData}
              disabled={isLoading}
              style={{
                padding: '9px 18px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {isLoading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>

        {/* 3 Thẻ chỉ số tổng quan */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginTop: '20px' }}>
          <div
            onClick={() => switchTab('dispatch')}
            style={{
              background: '#ffffff',
              border: activeTab === 'dispatch' ? '2px solid #0284c7' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Chờ xác nhận xuất kho</span>
              <span style={{ padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                Đợt 1
              </span>
            </div>
            <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>
              {totalPendingDispatchCount} <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>đơn hàng</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#0284c7', fontWeight: '600' }}>
              Sẵn sàng xuất hàng thực tế
            </div>
          </div>

          <div
            onClick={() => switchTab('supplementary')}
            style={{
              background: '#ffffff',
              border: activeTab === 'supplementary' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Chờ giao bổ sung</span>
              <span style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                Giao thiếu
              </span>
            </div>
            <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: '800', color: '#b45309' }}>
              {totalSupplementaryCount} <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>đơn hàng</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#d97706', fontWeight: '600' }}>
              Tổng thiếu: <strong>{totalShortageItemUnits}</strong> sản phẩm
            </div>
          </div>

          <div
            onClick={() => switchTab('history')}
            style={{
              background: '#ffffff',
              border: activeTab === 'history' ? '2px solid #059669' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 20px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>Lịch sử xuất kho</span>
              <span style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                Bất biến
              </span>
            </div>
            <div style={{ marginTop: '10px', fontSize: '28px', fontWeight: '800', color: '#059669' }}>
              {allDispatches.length} <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b' }}>phiếu xuất</span>
            </div>
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>
              Lưu trữ vĩnh viễn (hoàn tất & giao thiếu)
            </div>
          </div>
        </div>
      </div>

      {/* Danh sách & Tabs */}
      <div style={{ background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => switchTab('dispatch')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: '700',
              color: activeTab === 'dispatch' ? '#0284c7' : '#64748b',
              borderBottom: activeTab === 'dispatch' ? '3px solid #0284c7' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            Chờ xác nhận xuất kho
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: activeTab === 'dispatch' ? '#e0f2fe' : '#e2e8f0', color: activeTab === 'dispatch' ? '#0284c7' : '#475569' }}>
              {dispatchPendingOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('supplementary')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: '700',
              color: activeTab === 'supplementary' ? '#d97706' : '#64748b',
              borderBottom: activeTab === 'supplementary' ? '3px solid #d97706' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            Chờ giao bổ sung
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: activeTab === 'supplementary' ? '#fef3c7' : '#e2e8f0', color: activeTab === 'supplementary' ? '#b45309' : '#475569' }}>
              {supplementaryOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => switchTab('history')}
            style={{
              padding: '14px 20px',
              border: 'none',
              background: 'transparent',
              fontSize: '14px',
              fontWeight: '700',
              color: activeTab === 'history' ? '#059669' : '#64748b',
              borderBottom: activeTab === 'history' ? '3px solid #059669' : '3px solid transparent',
              cursor: 'pointer',
            }}
          >
            Lịch sử xuất kho
            <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: activeTab === 'history' ? '#dcfce7' : '#e2e8f0', color: activeTab === 'history' ? '#15803d' : '#475569' }}>
              {allDispatches.length}
            </span>
          </button>
        </div>

        {/* Thanh tìm kiếm */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo mã đơn hàng, mã phiếu, hoặc tên khách hàng..."
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13.5px',
              outline: 'none',
              color: '#0f172a',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* BẢNG TAB 1: CHỜ XÁC NHẬN XUẤT KHO - HÀNG TIÊU ĐỀ ĐỨNG YÊN */}
        {activeTab === 'dispatch' && (
          <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Mã đơn hàng</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Khách hàng / Đại lý</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Kho phụ trách</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Ngày đặt</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Số loại SP</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Trạng thái</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredDispatchOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>Không có đơn hàng nào chờ xuất kho</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Các đơn hàng mới được duyệt sẽ xuất hiện tại đây.</div>
                    </td>
                  </tr>
                ) : (
                  filteredDispatchOrders.map((ord) => (
                    <tr key={ord.order_code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0284c7' }}>
                        {ord.order_code}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {ord.dealer_name}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {ord.warehouse_name || 'Kho Tổng Hà Nội'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {ord.created_at ? new Date(ord.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#334155' }}>
                        {ord.items?.length || 0}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', background: '#dcfce7', color: '#166534' }}>
                          ĐÃ DUYỆT
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewDispatchHistoryPage(ord.order_code)}
                            style={{
                              padding: '6px 12px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Lịch sử
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDispatchPage(ord)}
                            style={{
                              padding: '6px 14px',
                              background: '#0284c7',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(2,132,199,0.3)',
                            }}
                          >
                            Xác nhận xuất kho
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG TAB 2: CHỜ GIAO BỔ SUNG - HÀNG TIÊU ĐỀ ĐỨNG YÊN */}
        {activeTab === 'supplementary' && (
          <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Mã đơn hàng</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Khách hàng / Đại lý</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Kho phụ trách</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>SP còn thiếu</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Tổng SL thiếu</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Lần xuất gần nhất</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Trạng thái</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>Không có đơn hàng nào còn nợ hàng</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Tất cả các đơn đã xuất đều đã được giao đủ 100%.</div>
                    </td>
                  </tr>
                ) : (
                  filteredSuppOrders.map((ord) => (
                    <tr key={ord.order_code} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#d97706' }}>
                        {ord.order_code}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {ord.dealer_name}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {ord.warehouse_name || 'Kho Tổng Hà Nội'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#b45309' }}>
                        {ord.shortage_items_count || ord.items?.length || 0} loại
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '800', color: '#dc2626' }}>
                        {ord.total_shortage_quantity || 0}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {ord.last_dispatch_date ? new Date(ord.last_dispatch_date).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', background: '#fef3c7', color: '#b45309' }}>
                          Giao thiếu đợt {ord.dispatch_count || 1}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => handleViewDispatchHistoryPage(ord.order_code)}
                            style={{
                              padding: '6px 12px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '600',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Lịch sử
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenSupplementaryPage(ord)}
                            style={{
                              padding: '6px 14px',
                              background: '#16a34a',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#ffffff',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(22,163,74,0.3)',
                            }}
                          >
                            Giao bổ sung
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* BẢNG TAB 3: LỊCH SỬ PHIẾU XUẤT KHO - HÀNG TIÊU ĐỀ ĐỨNG YÊN */}
        {activeTab === 'history' && (
          <div style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Mã phiếu xuất</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Mã đơn hàng</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Khách hàng / Đại lý</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Kho xuất</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>Đợt xuất</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'center' }}>SL xuất</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Người thực hiện</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Thời gian</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700' }}>Trạng thái đơn</th>
                  <th style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10, padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAllDispatches.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>Chưa có phiếu xuất kho nào</div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>Mọi phiếu xuất kho sau khi xác nhận sẽ được lưu trữ vĩnh viễn tại đây mà không bị ẩn đi.</div>
                    </td>
                  </tr>
                ) : (
                  filteredAllDispatches.map((dp) => (
                    <tr key={dp.dispatch_code || dp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0284c7' }}>
                        {dp.dispatch_code}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                        {dp.order_code}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                        {dp.dealer_name || 'Khách Mua Hàng'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569' }}>
                        {dp.warehouse_name || 'Kho Tổng'}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            background: dp.round_number === 1 ? '#e0f2fe' : '#fef3c7',
                            color: dp.round_number === 1 ? '#0369a1' : '#b45309',
                          }}
                        >
                          {dp.round_number === 1 ? 'Lần đầu' : `Đợt ${dp.round_number}`}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#16a34a' }}>
                        +{dp.total_dispatched_qty} sp
                        {dp.items_count > 0 && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '4px' }}>({dp.items_count} loại)</span>}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#334155', fontWeight: '600' }}>
                        {dp.performed_by}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b', fontSize: '12px' }}>
                        {dp.created_at ? new Date(dp.created_at).toLocaleString('vi-VN') : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            background: dp.order_status === 'DELIVERED' ? '#dcfce7' : dp.order_status === 'PARTIALLY_DELIVERED' ? '#fef3c7' : '#e0f2fe',
                            color: dp.order_status === 'DELIVERED' ? '#166534' : dp.order_status === 'PARTIALLY_DELIVERED' ? '#b45309' : '#0369a1',
                          }}
                        >
                          {dp.order_status === 'DELIVERED' ? 'HOÀN THÀNH' : dp.order_status === 'PARTIALLY_DELIVERED' ? 'GIAO THIẾU' : (dp.order_status || 'ĐÃ XUẤT')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleViewDispatchHistoryPage(dp.order_code)}
                          style={{
                            padding: '6px 14px',
                            background: '#059669',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '700',
                            color: '#ffffff',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(5,150,105,0.3)',
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
