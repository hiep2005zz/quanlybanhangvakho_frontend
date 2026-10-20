import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  getEligibleOrdersForReturnApi,
  getOrderReturnableItemsApi,
  createReturnOrderApi,
  OrderReturnableInfoResponse,
  ReturnableItemInfo,
  User,
} from '../services/api';
import { emitStatusToast } from './StatusToast';

export interface CreateReturnOrderPageProps {
  token: string;
  currentUser: User;
  onBack: () => void;
  onSuccess: () => void;
  initialOrderId?: number;
}

interface SelectedReturnItemState {
  order_item_id: number;
  product_id: number;
  product_name: string;
  product_code?: string | null;
  unit_name: string;
  unit_price: number;
  original_quantity: number;
  already_returned: number;
  remaining_quantity: number;
  return_quantity: number | string;
  return_reason: string;
  custom_reason: string;
  batch_number: string;
  batch_id?: number | null;
  is_batch_managed: boolean;
  available_batches: any[];
  is_selected: boolean;
}

const COMMON_RETURN_REASONS = [
  'Hàng lỗi do vận chuyển',
  'Hàng lỗi kỹ thuật sản xuất',
  'Hàng hết hạn sử dụng',
  'Giao sai quy cách mẫu mã',
  'Đại lý trả lại hàng tốt',
  'Khác (tự nhập lý do)',
];

export const CreateReturnOrderPage: React.FC<CreateReturnOrderPageProps> = ({
  token,
  currentUser: _currentUser,
  onBack,
  onSuccess,
  initialOrderId,
}) => {
  // Orders list & search
  const [orders, setOrders] = useState<any[]>([]);
  const [orderSearchText, setOrderSearchText] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(initialOrderId || null);
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Order Details & Lines
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOrderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch eligible orders
  useEffect(() => {
    let isMounted = true;
    const fetchOrders = async () => {
      setIsLoadingOrders(true);
      try {
        const list = await getEligibleOrdersForReturnApi(token);
        if (isMounted) {
          setOrders(list || []);
          if (initialOrderId && !selectedOrderId) {
            handleSelectOrder(initialOrderId);
          }
        }
      } catch (err: any) {
        if (isMounted) showErrorToast(err.message || 'Không thể tải danh sách đơn hàng.');
      } finally {
        if (isMounted) setIsLoadingOrders(false);
      }
    };

    fetchOrders();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Filtered orders by search text
  const filteredOrders = useMemo(() => {
    if (!orderSearchText.trim()) return orders;
    const q = orderSearchText.toLowerCase();
    return orders.filter((o) => {
      const code = (o.order_code || (o as any).code || '').toLowerCase();
      const customer = (o.dealer_name || (o as any).customer_name || '').toLowerCase();
      const phone = ((o as any).phone || '').toLowerCase();
      return code.includes(q) || customer.includes(q) || phone.includes(q);
    });
  }, [orders, orderSearchText]);

  // Selected order summary object
  const selectedOrderObj = useMemo(() => {
    if (!selectedOrderId) return null;
    return orders.find((o) => o.id === selectedOrderId) || null;
  }, [orders, selectedOrderId]);

  // Select order handler
  const handleSelectOrder = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setIsOrderDropdownOpen(false);
    setIsLoadingDetails(true);

    try {
      const data = await getOrderReturnableItemsApi(token, orderId);
      setOrderDetails(data);

      const initItems: SelectedReturnItemState[] = data.items.map((it: ReturnableItemInfo) => {
        const defaultBatchNum = it.selected_batch_number || (it.available_batches.length > 0 ? it.available_batches[0].batch_number : '');
        const defaultBatchId = it.selected_batch_id || (it.available_batches.length > 0 ? it.available_batches[0].id : null);
        const alreadyReturned = Math.max(0, it.delivered_quantity - it.remaining_quantity);

        return {
          order_item_id: it.order_item_id,
          product_id: it.product_id,
          product_name: it.product_name,
          product_code: it.product_code,
          unit_name: it.unit_name,
          unit_price: it.unit_price,
          original_quantity: it.delivered_quantity,
          already_returned: alreadyReturned,
          remaining_quantity: it.remaining_quantity,
          return_quantity: it.remaining_quantity > 0 ? 1 : 0,
          return_reason: COMMON_RETURN_REASONS[0],
          custom_reason: '',
          batch_number: defaultBatchNum,
          batch_id: defaultBatchId,
          is_batch_managed: it.is_batch_managed,
          available_batches: it.available_batches || [],
          is_selected: it.remaining_quantity > 0,
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
      if (copy[index].remaining_quantity <= 0) return prev;
      const nextSelected = !copy[index].is_selected;
      copy[index].is_selected = nextSelected;
      if (nextSelected && (!copy[index].return_quantity || Number(copy[index].return_quantity) <= 0)) {
        copy[index].return_quantity = 1;
      }
      return copy;
    });
  };

  const handleToggleSelectAll = () => {
    const returnableItems = itemsState.filter((it) => it.remaining_quantity > 0);
    const areAllSelected = returnableItems.length > 0 && returnableItems.every((it) => it.is_selected);
    const nextSelected = !areAllSelected;
    setItemsState((prev) =>
      prev.map((it) => ({
        ...it,
        is_selected: it.remaining_quantity > 0 ? nextSelected : false,
        return_quantity: it.remaining_quantity > 0 ? (nextSelected && (!it.return_quantity || Number(it.return_quantity) <= 0) ? 1 : it.return_quantity) : 0,
      }))
    );
  };

  const handleQuantityChange = (index: number, val: number | string) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index].return_quantity = val;
      return copy;
    });
  };

  const handleReasonChange = (index: number, reason: string) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index].return_reason = reason;
      return copy;
    });
  };

  const handleCustomReasonChange = (index: number, customVal: string) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index].custom_reason = customVal;
      return copy;
    });
  };

  const handleBatchChange = (index: number, batchNumber: string, batchId?: number | null) => {
    setItemsState((prev) => {
      const copy = [...prev];
      copy[index].batch_number = batchNumber;
      copy[index].batch_id = batchId;
      return copy;
    });
  };

  // Helper: check if reason indicates defective/damaged
  const isReasonDamagedHelper = (reasonStr: string) => {
    const lower = reasonStr.toLowerCase();
    const keywords = ['lỗi', 'hỏng', 'hết hạn', 'vỡ', 'bể', 'móp', 'rách', 'kém chất lượng', 'defect', 'damage'];
    return keywords.some((k) => lower.includes(k));
  };

  // Calculations
  const selectedRows = itemsState.filter((it) => it.is_selected);
  const totalReturnLines = selectedRows.length;
  const totalReturnQty = selectedRows.reduce((sum, it) => sum + Number(it.return_quantity || 0), 0);
  const totalRefundAmount = selectedRows.reduce((sum, it) => {
    const qty = Number(it.return_quantity || 0);
    return sum + (qty > 0 ? qty * it.unit_price : 0);
  }, 0);

  // Validation
  const validateForm = (): string | null => {
    if (!selectedOrderId) {
      return 'Vui lòng chọn đơn hàng gốc cần trả hàng.';
    }
    if (selectedRows.length === 0) {
      return 'Vui lòng tích chọn ít nhất 1 dòng hàng cần trả.';
    }

    for (const it of selectedRows) {
      const qtyNum = Number(it.return_quantity || 0);
      if (!it.return_quantity || qtyNum <= 0) {
        return `Số lượng trả của sản phẩm "${it.product_name}" phải lớn hơn 0.`;
      }
      if (qtyNum > it.remaining_quantity) {
        return `Số lượng trả của "${it.product_name}" (${it.return_quantity}) vượt quá số lượng còn được trả (${it.remaining_quantity}).`;
      }
      const actualReason = it.return_reason === 'Khác (tự nhập lý do)' ? it.custom_reason.trim() : it.return_reason;
      if (!actualReason) {
        return `Vui lòng nhập lý do trả hàng cho sản phẩm "${it.product_name}".`;
      }
      if (it.is_batch_managed && (!it.batch_number || !it.batch_number.trim())) {
        return `Sản phẩm "${it.product_name}" có quản lý lô. Vui lòng chọn hoặc nhập mã lô đã xuất.`;
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
        title: 'Tạo phiếu thành công',
        message: `Phiếu trả hàng ${res.code} đã được tạo thành công.`,
        durationMs: 3000,
      });
      onSuccess();
    } catch (err: any) {
      showErrorToast(err.message || 'Lỗi khi tạo phiếu trả hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        width: '100%',
        backgroundColor: '#f8fafc',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Quay lại danh sách
          </button>

          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a', whiteSpace: 'nowrap' }}>
            Lập Phiếu Trả Hàng Từ Đại Lý
          </h1>
        </div>


      </div>

      {/* Main Page Scrollable Body */}
      <div
        style={{
          maxWidth: '1280px',
          width: '100%',
          margin: '0 auto',
          padding: '16px 20px 80px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxSizing: 'border-box',
        }}
      >
        {/* SECTION 1: Chọn Đơn Hàng Gốc */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            padding: '14px 18px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: selectedOrderId ? '0' : '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
              1. Chọn Đơn Hàng Gốc <span style={{ color: '#ef4444' }}>*</span>
            </div>
          </div>

          {!selectedOrderId ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  value={orderSearchText}
                  onChange={(e) => {
                    setOrderSearchText(e.target.value);
                    setIsOrderDropdownOpen(true);
                  }}
                  onFocus={() => setIsOrderDropdownOpen(true)}
                  placeholder="Tìm theo mã đơn hàng, tên đại lý hoặc số điện thoại..."
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    color: '#0f172a',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                  }}
                />

                <button
                  type="button"
                  onClick={() => setIsOrderDropdownOpen((prev) => !prev)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isOrderDropdownOpen ? 'Đóng' : 'Chọn đơn hàng'}
                </button>
              </div>

              {/* Dropdown Options List */}
              {isOrderDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
                    maxHeight: '280px',
                    overflowY: 'auto',
                    zIndex: 50,
                  }}
                >
                  {isLoadingOrders ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      Đang tải danh sách đơn hàng...
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                      Không tìm thấy đơn hàng phù hợp.
                    </div>
                  ) : (
                    <div>
                      {filteredOrders.map((ord) => {
                        const amount = ord.total_amount ?? 0;
                        const dealerName = ord.dealer_name || (ord as any).customer_name || 'Đại lý';
                        const orderCode = ord.order_code || (ord as any).code || `ORD#${ord.id}`;
                        return (
                          <div
                            key={ord.id}
                            onClick={() => handleSelectOrder(ord.id)}
                            style={{
                              padding: '10px 14px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '13px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f0f9ff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontWeight: '700', color: '#2563eb' }}>
                                {orderCode}
                              </span>
                              <span style={{ color: '#0f172a' }}>{dealerName}</span>
                              <span style={{ color: '#64748b', fontSize: '12px' }}>
                                {ord.created_at ? new Date(ord.created_at).toLocaleDateString('vi-VN') : ''}
                              </span>
                            </div>

                            <div style={{ fontWeight: '700', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                              {amount.toLocaleString('vi-VN')} đ
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Selected Order Single Line Banner */
            <div
              style={{
                marginTop: '6px',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'nowrap',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '13.5px',
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span><strong>Đơn hàng:</strong> {orderDetails?.order_code || selectedOrderObj?.code}</span>
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span><strong>Đại lý:</strong> {orderDetails?.dealer_name || selectedOrderObj?.dealer_name || 'Đại lý'}</span>
                {orderDetails?.default_warehouse?.name && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span><strong>Kho gốc:</strong> {orderDetails.default_warehouse.name}</span>
                  </>
                )}
                {orderDetails?.damaged_warehouse?.name && (
                  <>
                    <span style={{ color: '#cbd5e1' }}>|</span>
                    <span><strong>Kho lỗi:</strong> {orderDetails.damaged_warehouse.name}</span>
                  </>
                )}
                <span style={{ color: '#cbd5e1' }}>|</span>
                <span><strong>Tổng tiền:</strong> <span style={{ color: '#059669', fontWeight: '700' }}>{(selectedOrderObj?.total_amount || 0).toLocaleString('vi-VN')} đ</span></span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedOrderId(null);
                  setOrderDetails(null);
                  setItemsState([]);
                  setIsOrderDropdownOpen(true);
                }}
                style={{
                  background: 'none',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  color: '#15803d',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Đổi đơn hàng khác
              </button>
            </div>
          )}
        </div>

        {/* SECTION 2: Danh Sách Dòng Hàng Trả */}
        {selectedOrderId && (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 18px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                2. Danh Sách Dòng Hàng Trả
              </div>

              {itemsState.some((it) => it.remaining_quantity > 0) && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {itemsState.filter((it) => it.remaining_quantity > 0).every((it) => it.is_selected)
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả dòng còn trả'}
                </button>
              )}
            </div>

            {isLoadingDetails ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Đang tải dữ liệu dòng hàng...
              </div>
            ) : itemsState.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Đơn hàng này không có dòng hàng nào.
              </div>
            ) : (
              <div style={{ width: '100%', overflow: 'hidden' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '12.5px',
                    textAlign: 'left',
                    tableLayout: 'fixed',
                  }}
                >
                  <colgroup>
                    <col style={{ width: '38px' }} />
                    <col style={{ width: '22%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '7%' }} />
                    <col style={{ width: '17%' }} />
                    <col style={{ width: '9%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '6%' }} />
                  </colgroup>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        color: '#475569',
                        fontSize: '11.5px',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>CHỌN</th>
                      <th style={{ padding: '8px 6px' }}>SẢN PHẨM</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>ĐƠN GIÁ</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>ĐÃ MUA</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>ĐÃ TRẢ</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>CÒN LẠI</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>SL TRẢ</th>
                      <th style={{ padding: '8px 6px' }}>LÝ DO TRẢ</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>MÃ LÔ</th>
                      <th style={{ padding: '8px 6px', textAlign: 'right' }}>THÀNH TIỀN</th>
                      <th style={{ padding: '8px 4px', textAlign: 'center' }}>KHO NHẬP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsState.map((row, idx) => {
                      const isReturnable = row.remaining_quantity > 0;
                      const isQtyExceeded = row.is_selected && Number(row.return_quantity || 0) > row.remaining_quantity;
                      const isDamaged = isReasonDamagedHelper(row.return_reason === 'Khác (tự nhập lý do)' ? row.custom_reason : row.return_reason);
                      const lineRefund = (Number(row.return_quantity) || 0) * row.unit_price;

                      return (
                        <tr
                          key={row.order_item_id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: row.is_selected ? '#f8fafc' : !isReturnable ? '#fafafa' : '#ffffff',
                            opacity: !isReturnable ? 0.6 : 1,
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <input
                              type="checkbox"
                              checked={row.is_selected}
                              disabled={!isReturnable || isSubmitting}
                              onChange={() => handleToggleItem(idx)}
                              style={{ width: '16px', height: '16px', cursor: isReturnable ? 'pointer' : 'not-allowed' }}
                            />
                          </td>

                          {/* Sản phẩm (Chỉ tên sản phẩm, không có mã hay đơn vị trong ngoặc) */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'middle', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.product_name}>
                            <span style={{ fontWeight: '700', color: '#0f172a' }}>{row.product_name}</span>
                            {row.is_batch_managed && (
                              <span
                                style={{
                                  marginLeft: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                Lô
                              </span>
                            )}
                          </td>

                          {/* Đơn giá */}
                          <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                            {row.unit_price.toLocaleString('vi-VN')} đ
                          </td>

                          {/* ĐÃ MUA */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', fontWeight: '600', color: '#0f172a' }}>
                            {row.original_quantity}
                          </td>

                          {/* ĐÃ TRẢ */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', color: row.already_returned > 0 ? '#ea580c' : '#64748b' }}>
                            {row.already_returned}
                          </td>

                          {/* CÒN LẠI */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                borderRadius: '8px',
                                fontSize: '11.5px',
                                fontWeight: '700',
                                backgroundColor: isReturnable ? '#dcfce7' : '#fee2e2',
                                color: isReturnable ? '#15803d' : '#b91c1c',
                              }}
                            >
                              {row.remaining_quantity}
                            </span>
                          </td>

                          {/* SL TRẢ */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <input
                              type="number"
                              min={1}
                              max={row.remaining_quantity}
                              disabled={!row.is_selected || !isReturnable || isSubmitting}
                              value={row.return_quantity === 0 && !row.is_selected ? 0 : row.return_quantity}
                              placeholder="0"
                              onFocus={(e) => {
                                e.target.select();
                              }}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (raw === '') {
                                  handleQuantityChange(idx, '');
                                  return;
                                }
                                const parsed = parseInt(raw, 10);
                                if (!isNaN(parsed)) {
                                  handleQuantityChange(idx, parsed);
                                }
                              }}
                              onBlur={() => {
                                const num = Number(row.return_quantity);
                                if (!row.return_quantity || isNaN(num) || num <= 0) {
                                  handleQuantityChange(idx, row.is_selected ? 1 : 0);
                                } else if (num > row.remaining_quantity) {
                                  handleQuantityChange(idx, row.remaining_quantity);
                                }
                              }}
                              style={{
                                width: '48px',
                                padding: '3px 4px',
                                borderRadius: '4px',
                                border: isQtyExceeded ? '2px solid #ef4444' : '1px solid #cbd5e1',
                                textAlign: 'center',
                                fontWeight: '700',
                                color: isQtyExceeded ? '#ef4444' : '#0f172a',
                                outline: 'none',
                                backgroundColor: !row.is_selected ? '#f1f5f9' : '#ffffff',
                              }}
                            />
                          </td>

                          {/* LÝ DO TRẢ */}
                          <td style={{ padding: '8px 6px', verticalAlign: 'middle' }}>
                            <select
                              disabled={!row.is_selected || !isReturnable || isSubmitting}
                              value={row.return_reason}
                              onChange={(e) => handleReasonChange(idx, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '4px 4px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12px',
                                color: '#0f172a',
                                backgroundColor: !row.is_selected ? '#f1f5f9' : '#ffffff',
                                outline: 'none',
                              }}
                            >
                              {COMMON_RETURN_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>

                            {row.return_reason === 'Khác (tự nhập lý do)' && row.is_selected && (
                              <input
                                type="text"
                                placeholder="Ghi rõ lý do..."
                                value={row.custom_reason}
                                onChange={(e) => handleCustomReasonChange(idx, e.target.value)}
                                style={{
                                  marginTop: '3px',
                                  width: '100%',
                                  padding: '3px 4px',
                                  borderRadius: '4px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '11.5px',
                                  boxSizing: 'border-box',
                                  outline: 'none',
                                }}
                              />
                            )}
                          </td>

                          {/* MÃ LÔ */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            {row.is_batch_managed ? (
                              row.available_batches.length > 0 ? (
                                <select
                                  disabled={!row.is_selected || !isReturnable || isSubmitting}
                                  value={row.batch_number}
                                  onChange={(e) => {
                                    const sel = row.available_batches.find((b) => b.batch_number === e.target.value);
                                    handleBatchChange(idx, e.target.value, sel?.id || null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '4px 2px',
                                    borderRadius: '4px',
                                    border: !row.batch_number && row.is_selected ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                                    fontSize: '11.5px',
                                    backgroundColor: !row.is_selected ? '#f1f5f9' : '#ffffff',
                                  }}
                                >
                                  <option value="">Lô</option>
                                  {row.available_batches.map((b) => (
                                    <option key={b.id || b.batch_number} value={b.batch_number}>
                                      {b.batch_number}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Mã lô *"
                                  value={row.batch_number}
                                  disabled={!row.is_selected || !isReturnable || isSubmitting}
                                  onChange={(e) => handleBatchChange(idx, e.target.value)}
                                  style={{
                                    width: '100%',
                                    padding: '4px 4px',
                                    borderRadius: '4px',
                                    border: !row.batch_number && row.is_selected ? '1.5px solid #f59e0b' : '1px solid #cbd5e1',
                                    fontSize: '11.5px',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              )
                            ) : (
                              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>—</span>
                            )}
                          </td>

                          {/* THÀNH TIỀN */}
                          <td style={{ padding: '8px 6px', textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap', fontWeight: '700', color: row.is_selected ? '#059669' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            {row.is_selected ? `${lineRefund.toLocaleString('vi-VN')} đ` : '0 đ'}
                          </td>

                          {/* KHO NHẬP */}
                          <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            {row.is_selected ? (
                              isDamaged ? (
                                <span
                                  title={`Nhập vào: ${orderDetails?.damaged_warehouse?.name || 'Kho Hàng Lỗi & Chờ Xử Lý'}`}
                                  style={{
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    border: '1px solid #fca5a5',
                                    cursor: 'help',
                                  }}
                                >
                                  Kho lỗi
                                </span>
                              ) : (
                                <span
                                  title={`Nhập vào: ${orderDetails?.default_warehouse?.name || 'Kho xuất gốc'}`}
                                  style={{
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    border: '1px solid #bfdbfe',
                                    cursor: 'help',
                                  }}
                                >
                                  Kho gốc
                                </span>
                              )
                            ) : (
                              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>—</span>
                            )}
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

        {/* SECTION 3: Ghi Chú & Thống Kê Tổng Kết */}
        {selectedOrderId && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Ghi chú */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px 18px',
              }}
            >
              <label style={{ display: 'block', fontSize: '13.5px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Ghi chú phiếu trả hàng
              </label>
              <textarea
                rows={3}
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Nhập thông tin ghi chú cho phiếu trả hàng..."
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {/* Bảng tổng kết số liệu */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
                Tổng Kết Phiếu Trả Hàng
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Số dòng hàng chọn trả:</span>
                <strong style={{ color: '#0f172a' }}>{totalReturnLines} dòng</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#475569' }}>
                <span>Tổng số lượng sản phẩm trả:</span>
                <strong style={{ color: '#0f172a' }}>{totalReturnQty} sản phẩm</strong>
              </div>

              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '2px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                  Tổng tiền hoàn trả:
                </span>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                  {totalRefundAmount.toLocaleString('vi-VN')} đ
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '10px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.05)',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: '#475569' }}>
          <span>Đã chọn: <strong style={{ color: '#0f172a' }}>{totalReturnLines}</strong> dòng</span>
          <span>&bull;</span>
          <span>Số lượng: <strong style={{ color: '#0f172a' }}>{totalReturnQty}</strong></span>
          <span>&bull;</span>
          <span>Tổng hoàn trả: <strong style={{ color: '#059669', fontSize: '15px' }}>{totalRefundAmount.toLocaleString('vi-VN')} đ</strong></span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            style={{
              padding: '7px 14px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Quay lại
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedRows.length === 0}
            style={{
              padding: '7px 20px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: isSubmitting || selectedRows.length === 0 ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isSubmitting || selectedRows.length === 0 ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu Phiếu Trả Hàng'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateReturnOrderPage;
