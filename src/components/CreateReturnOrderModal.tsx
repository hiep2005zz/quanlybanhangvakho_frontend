import React, { useState, useEffect } from 'react';
import {
  getEligibleOrdersForReturnApi,
  getOrderReturnableItemsApi,
  createReturnOrderApi,
  OrderReturnableInfoResponse,
  ReturnableItemInfo,
  User,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface CreateReturnOrderModalProps {
  isOpen: boolean;
  token: string;
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

interface SelectedReturnItemState {
  order_item_id: number;
  product_id: number;
  product_name: string;
  product_code?: string | null;
  unit_name: string;
  unit_price: number;
  original_quantity: number;
  remaining_quantity: number;
  return_quantity: number;
  return_reason: string;
  custom_reason: string;
  batch_number: string;
  batch_id?: number | null;
  is_batch_managed: boolean;
  available_batches: any[];
  is_selected: boolean;
}

const COMMON_RETURN_REASONS = [
  'Hàng lỗi / hư hỏng do vận chuyển',
  'Hàng lỗi kỹ thuật / lỗi sản xuất',
  'Hàng hết hạn / cận hạn sử dụng',
  'Giao sai mẫu mã / quy cách',
  'Đại lý trả lại hàng tốt (không có nhu cầu bán tiếp)',
  'Khác (tự nhập lý do)',
];

export const CreateReturnOrderModal: React.FC<CreateReturnOrderModalProps> = ({
  isOpen,
  token,
  currentUser: _currentUser,
  onClose,
  onSuccess,
}) => {
  const [orders, setOrders] = useState<any[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const [orderDetails, setOrderDetails] = useState<OrderReturnableInfoResponse | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const [itemsState, setItemsState] = useState<SelectedReturnItemState[]>([]);
  const [generalNote, setGeneralNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showErrorToast = (msg: string) => {
    emitStatusToast({
      title: 'Thông báo',
      message: msg,
      type: 'error',
      durationMs: 3000,
    });
  };

  // Nạp danh sách đơn hàng đã giao/hoàn thành đủ điều kiện trả
  useEffect(() => {
    if (!isOpen) {
      setSelectedOrderId(null);
      setOrderDetails(null);
      setItemsState([]);
      setGeneralNote('');
      return;
    }

    const fetchOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const list = await getEligibleOrdersForReturnApi(token, orderSearch);
        setOrders(list);
      } catch (err: any) {
        showErrorToast(err.message || 'Không thể tải danh sách đơn hàng.');
      } finally {
        setIsLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [isOpen, token, orderSearch]);

  // Khi chọn một đơn hàng gốc -> tải chi tiết các dòng hàng
  const handleSelectOrder = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setIsLoadingDetails(true);

    try {
      const data = await getOrderReturnableItemsApi(token, orderId);
      setOrderDetails(data);

      // Khởi tạo state cho từng dòng hàng
      const initItems: SelectedReturnItemState[] = data.items.map((it: ReturnableItemInfo) => {
        const defaultBatchNum = it.selected_batch_number || (it.available_batches.length > 0 ? it.available_batches[0].batch_number : '');
        const defaultBatchId = it.selected_batch_id || (it.available_batches.length > 0 ? it.available_batches[0].id : null);
        
        return {
          order_item_id: it.order_item_id,
          product_id: it.product_id,
          product_name: it.product_name,
          product_code: it.product_code,
          unit_name: it.unit_name,
          unit_price: it.unit_price,
          original_quantity: it.delivered_quantity,
          remaining_quantity: it.remaining_quantity,
          return_quantity: it.remaining_quantity > 0 ? 1 : 0,
          return_reason: COMMON_RETURN_REASONS[0],
          custom_reason: '',
          batch_number: defaultBatchNum,
          batch_id: defaultBatchId,
          is_batch_managed: it.is_batch_managed,
          available_batches: it.available_batches || [],
          is_selected: it.remaining_quantity > 0, // Mặc định chọn dòng còn được trả
        };
      });

      setItemsState(initItems);
    } catch (err: any) {
      showErrorToast(err.message || 'Lỗi khi tải chi tiết dòng hàng của đơn.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleToggleItem = (index: number) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], is_selected: !copy[index].is_selected };
      return copy;
    });
  };

  const handleQuantityChange = (index: number, val: number) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], return_quantity: Math.max(0, val) };
      return copy;
    });
  };

  const handleReasonChange = (index: number, reason: string) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], return_reason: reason };
      return copy;
    });
  };

  const handleCustomReasonChange = (index: number, customText: string) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], custom_reason: customText };
      return copy;
    });
  };

  const handleBatchChange = (index: number, batchNum: string, batchId?: number | null) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], batch_number: batchNum, batch_id: batchId };
      return copy;
    });
  };

  // Tính tổng số lượng và tiền hoàn
  const selectedRows = itemsState.filter((it) => it.is_selected);
  const totalReturnQty = selectedRows.reduce((sum, it) => sum + (Number(it.return_quantity) || 0), 0);
  const totalRefundAmount = selectedRows.reduce(
    (sum, it) => sum + (Number(it.return_quantity) || 0) * (it.unit_price || 0),
    0
  );

  // Kiểm tra tính hợp lệ trước khi gửi
  const validateForm = (): string | null => {
    if (!selectedOrderId) return 'Vui lòng chọn một đơn hàng gốc.';
    if (selectedRows.length === 0) return 'Vui lòng chọn ít nhất một sản phẩm cần trả lại.';

    for (const it of selectedRows) {
      if (!it.return_quantity || it.return_quantity <= 0) {
        return `Số lượng trả của sản phẩm "${it.product_name}" phải lớn hơn 0.`;
      }
      if (it.return_quantity > it.remaining_quantity) {
        return `Số lượng trả của "${it.product_name}" (${it.return_quantity}) vượt quá số lượng tối đa được phép trả (${it.remaining_quantity}).`;
      }
      const actualReason = it.return_reason === 'Khác (tự nhập lý do)' ? it.custom_reason.trim() : it.return_reason;
      if (!actualReason) {
        return `Vui lòng nhập lý do trả hàng cho sản phẩm "${it.product_name}".`;
      }
      if (it.is_batch_managed && (!it.batch_number || !it.batch_number.trim())) {
        return `Sản phẩm "${it.product_name}" có quản lý theo Lô. Bắt buộc phải chọn hoặc nhập Mã Lô đã xuất trên đơn gốc.`;
      }
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      showErrorToast(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        order_id: selectedOrderId!,
        note: generalNote.trim() || undefined,
        items: selectedRows.map((it) => {
          const finalReason = it.return_reason === 'Khác (tự nhập lý do)' ? it.custom_reason.trim() : it.return_reason;
          return {
            order_item_id: it.order_item_id,
            product_id: it.product_id,
            return_quantity: Number(it.return_quantity),
            return_reason: finalReason,
            batch_id: it.batch_id || undefined,
            batch_number: it.batch_number ? it.batch_number.trim() : undefined,
          };
        }),
      };

      const res = await createReturnOrderApi(token, payload);
      emitStatusToast({
        title: 'Lập phiếu trả hàng thành công',
        message: `Phiếu trả hàng ${res.code} đã được tạo ở trạng thái Chờ kho xác nhận.`,
        durationMs: 3000,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      showErrorToast(err.message || 'Lỗi khi tạo phiếu trả hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReasonDamagedHelper = (reasonStr: string) => {
    const lower = reasonStr.toLowerCase();
    const keywords = ['lỗi', 'hỏng', 'hết hạn', 'vỡ', 'bể', 'móp', 'rách', 'kém chất lượng', 'defect', 'damage'];
    return keywords.some((k) => lower.includes(k));
  };

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px',
          boxSizing: 'border-box',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && !isSubmitting) onClose();
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            maxWidth: '1000px',
            width: '100%',
            maxHeight: 'calc(100vh - 40px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Header Modal */}
          <div
            style={{
              padding: '18px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8fafc',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    color: '#2563eb',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 14 4 9 9 4" />
                    <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                  </svg>
                </span>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                  Lập Phiếu Trả Hàng Từ Đại Lý (Sales Return / RMA)
                </h2>
              </div>
              <p style={{ margin: '3px 0 0 36px', fontSize: '12.5px', color: '#64748b' }}>
                Khởi tạo yêu cầu trả hàng từ Đơn hàng gốc &bull; Tự động kiểm tra số lượng và điều hướng kho
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Đóng"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body Content */}
          <div
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Bước 1: Chọn Đơn hàng gốc */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 18px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b' }}>
                  1. Chọn Đơn Hàng Gốc (Original Order) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {selectedOrderId && (
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>
                    ✓ Đã chọn đơn: <strong>{orderDetails?.order_code}</strong>
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <select
                    id="select-original-order"
                    value={selectedOrderId || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val) handleSelectOrder(val);
                      else {
                        setSelectedOrderId(null);
                        setOrderDetails(null);
                        setItemsState([]);
                      }
                    }}
                    disabled={isSubmitting || isLoadingOrders}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                  >
                    <option value="">-- Chọn đơn hàng đã giao để tạo phiếu trả hàng --</option>
                    {orders.map((ord) => (
                      <option key={ord.id} value={ord.id}>
                        {ord.order_code} &bull; {ord.dealer_name} &bull; {ord.total_amount.toLocaleString('vi-VN')} đ ({ord.status})
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="text"
                  placeholder="Lọc mã đơn / đại lý..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  style={{
                    width: '200px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: '#ffffff',
                    outline: 'none',
                  }}
                />
              </div>

              {selectedOrderId && orderDetails && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '12.5px',
                    color: '#475569',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '16px',
                  }}
                >
                  <div>
                    Đại lý: <strong style={{ color: '#0f172a' }}>{orderDetails.dealer_name}</strong>
                  </div>
                  <div>
                    Ngày đặt đơn: <strong style={{ color: '#0f172a' }}>{orderDetails.order_created_at}</strong>
                  </div>
                  <div>
                    Trạng thái đơn: <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#166534', fontWeight: '700' }}>{orderDetails.order_status}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Bước 2: Danh sách dòng hàng của đơn gốc */}
            {selectedOrderId && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e293b' }}>
                    2. Chọn Dòng Hàng Trả, Số Lượng & Lý Do <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Quy tắc 2: Số lượng trả lần này &le; Số lượng đã giao - Đã trả trước đó
                  </span>
                </div>

                {isLoadingDetails ? (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                    Đang nạp chi tiết các dòng hàng...
                  </div>
                ) : itemsState.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13.5px', background: '#f8fafc', borderRadius: '8px' }}>
                    Đơn hàng này không có dòng hàng nào có thể trả lại.
                  </div>
                ) : (
                  <div
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      overflowX: 'auto',
                      background: '#ffffff',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                          <th style={{ padding: '10px 12px', width: '36px', textAlign: 'center' }}>Chọn</th>
                          <th style={{ padding: '10px 12px' }}>Sản phẩm</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Đơn giá</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Đã giao</th>
                          <th style={{ padding: '10px 12px', textAlign: 'center' }}>Còn được trả</th>
                          <th style={{ padding: '10px 12px', width: '90px', textAlign: 'center' }}>SL Trả</th>
                          <th style={{ padding: '10px 12px', width: '190px' }}>Lý do trả</th>
                          <th style={{ padding: '10px 12px', width: '140px' }}>Mã Lô (Lot)</th>
                          <th style={{ padding: '10px 12px', width: '130px' }}>Kho nhận lại</th>
                          <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsState.map((item, idx) => {
                          const isExceeded = item.is_selected && item.return_quantity > item.remaining_quantity;
                          const isZeroOrNeg = item.is_selected && item.return_quantity <= 0;
                          const isDamaged = isReasonDamagedHelper(
                            item.return_reason === 'Khác (tự nhập lý do)' ? item.custom_reason : item.return_reason
                          );
                          const lineRefund = (Number(item.return_quantity) || 0) * (item.unit_price || 0);

                          return (
                            <tr
                              key={item.order_item_id || idx}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                background: item.is_selected ? (isExceeded ? '#fef2f2' : '#ffffff') : '#fcfcfc',
                                opacity: item.remaining_quantity === 0 && !item.is_selected ? 0.6 : 1,
                              }}
                            >
                              {/* Checkbox */}
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={item.is_selected}
                                  disabled={item.remaining_quantity === 0}
                                  onChange={() => handleToggleItem(idx)}
                                  style={{ cursor: item.remaining_quantity === 0 ? 'not-allowed' : 'pointer' }}
                                />
                              </td>

                              {/* Tên sản phẩm */}
                              <td style={{ padding: '10px 12px' }}>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.product_name}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  Mã: {item.product_code || '—'} &bull; ĐVT: {item.unit_name}
                                </div>
                                {item.is_batch_managed && (
                                  <span
                                    style={{
                                      display: 'inline-block',
                                      marginTop: '2px',
                                      fontSize: '10.5px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: '#fef3c7',
                                      color: '#92400e',
                                      fontWeight: '700',
                                    }}
                                  >
                                    Lô / Hạn SD
                                  </span>
                                )}
                              </td>

                              {/* Đơn giá */}
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                                {item.unit_price.toLocaleString('vi-VN')} đ
                              </td>

                              {/* Đã giao */}
                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>
                                {item.original_quantity}
                              </td>

                              {/* Còn được trả */}
                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    background: item.remaining_quantity > 0 ? '#dbeafe' : '#f1f5f9',
                                    color: item.remaining_quantity > 0 ? '#1e40af' : '#94a3b8',
                                  }}
                                >
                                  {item.remaining_quantity}
                                </span>
                              </td>

                              {/* SL trả (Input) */}
                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.remaining_quantity}
                                  value={item.return_quantity}
                                  disabled={!item.is_selected}
                                  onChange={(e) => handleQuantityChange(idx, parseInt(e.target.value) || 0)}
                                  style={{
                                    width: '65px',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    border: isExceeded || isZeroOrNeg ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                                    textAlign: 'center',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    outline: 'none',
                                    background: item.is_selected ? '#ffffff' : '#f8fafc',
                                  }}
                                />
                                {isExceeded && (
                                  <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '2px', fontWeight: '600' }}>
                                    &gt; tối đa {item.remaining_quantity}!
                                  </div>
                                )}
                              </td>

                              {/* Lý do trả hàng (Select + Custom) */}
                              <td style={{ padding: '8px 10px' }}>
                                <select
                                  value={item.return_reason}
                                  disabled={!item.is_selected}
                                  onChange={(e) => handleReasonChange(idx, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '12px',
                                    outline: 'none',
                                    background: '#ffffff',
                                  }}
                                >
                                  {COMMON_RETURN_REASONS.map((r) => (
                                    <option key={r} value={r}>
                                      {r}
                                    </option>
                                  ))}
                                </select>

                                {item.return_reason === 'Khác (tự nhập lý do)' && (
                                  <input
                                    type="text"
                                    placeholder="Nhập lý do chi tiết..."
                                    value={item.custom_reason}
                                    disabled={!item.is_selected}
                                    onChange={(e) => handleCustomReasonChange(idx, e.target.value)}
                                    style={{
                                      width: '100%',
                                      marginTop: '4px',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      border: '1px solid #cbd5e1',
                                      fontSize: '11.5px',
                                      outline: 'none',
                                    }}
                                  />
                                )}
                              </td>

                              {/* Mã Lô (Lot/Batch Tracking) */}
                              <td style={{ padding: '8px 10px' }}>
                                {item.is_batch_managed ? (
                                  item.available_batches.length > 0 ? (
                                    <select
                                      value={item.batch_number}
                                      disabled={!item.is_selected}
                                      onChange={(e) => {
                                        const bNum = e.target.value;
                                        const found = item.available_batches.find((b: any) => b.batch_number === bNum);
                                        handleBatchChange(idx, bNum, found ? found.id : null);
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: !item.batch_number && item.is_selected ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                                        fontSize: '12px',
                                        background: '#ffffff',
                                      }}
                                    >
                                      <option value="">-- Chọn mã lô --</option>
                                      {item.available_batches.map((b: any) => (
                                        <option key={b.id} value={b.batch_number}>
                                          {b.batch_number} {b.is_order_batch ? '(Lô đơn gốc)' : ''}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      placeholder="Nhập mã lô gốc..."
                                      value={item.batch_number}
                                      disabled={!item.is_selected}
                                      onChange={(e) => handleBatchChange(idx, e.target.value, null)}
                                      style={{
                                        width: '100%',
                                        padding: '6px 8px',
                                        borderRadius: '6px',
                                        border: !item.batch_number && item.is_selected ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                                        fontSize: '12px',
                                      }}
                                    />
                                  )
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>Không quản lý lô</span>
                                )}
                              </td>

                              {/* Kho đích nhận lại (Warehouse Routing) */}
                              <td style={{ padding: '8px 10px' }}>
                                {isDamaged ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      background: '#fef3c7',
                                      color: '#b45309',
                                      fontSize: '11.5px',
                                      fontWeight: '700',
                                    }}
                                    title="Điều hướng vào Kho Hàng Lỗi do lý do trả thuộc nhóm Hàng lỗi / hư hỏng"
                                  >
                                    Kho Lỗi (KHO_LOI)
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '3px 8px',
                                      borderRadius: '6px',
                                      background: '#dcfce7',
                                      color: '#166534',
                                      fontSize: '11.5px',
                                      fontWeight: '700',
                                    }}
                                    title="Nhập lại kho chuẩn bình thường"
                                  >
                                    Kho Tiêu Chuẩn
                                  </span>
                                )}
                              </td>

                              {/* Thành tiền */}
                              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>
                                {item.is_selected ? lineRefund.toLocaleString('vi-VN') + ' đ' : '0 đ'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Bước 3: Ghi chú chung & Tổng kết */}
            {selectedOrderId && selectedRows.length > 0 && (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                }}
              >
                <div style={{ flex: 1, minWidth: '280px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                    Ghi chú phiếu trả hàng (tùy chọn):
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập ghi chú thêm cho thủ kho / kế toán..."
                    value={generalNote}
                    onChange={(e) => setGeneralNote(e.target.value)}
                    disabled={isSubmitting}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ textAlign: 'right', minWidth: '240px' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>
                    Đã chọn: <strong>{selectedRows.length}</strong> mặt hàng &bull; Tổng số lượng trả: <strong>{totalReturnQty}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569' }}>
                    Tổng tiền hoàn lại đại lý:
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '800', color: '#ea580c', fontVariantNumeric: 'tabular-nums' }}>
                    {totalRefundAmount.toLocaleString('vi-VN')} đ
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              backgroundColor: '#f8fafc',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedOrderId || selectedRows.length === 0}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                border: 'none',
                background: isSubmitting || !selectedOrderId || selectedRows.length === 0 ? '#94a3b8' : '#2563eb',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: isSubmitting || !selectedOrderId || selectedRows.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
              }}
            >
              {isSubmitting ? 'Đang tạo phiếu...' : 'Lập Phiếu Trả Hàng (Chờ Kho Xác Nhận)'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default CreateReturnOrderModal;
