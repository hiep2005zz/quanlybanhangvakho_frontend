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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        if (isMounted) setErrorMsg(err.message || 'Không thể tải danh sách đơn hàng.');
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
    setErrorMsg(null);

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
      setErrorMsg(err.message || 'Lỗi khi tải chi tiết dòng hàng của đơn.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleToggleItem = (index: number) => {
    setItemsState((prev) => {
      const copy = [...prev];
      if (copy[index].remaining_quantity <= 0) return prev;
      copy[index].is_selected = !copy[index].is_selected;
      return copy;
    });
  };

  const handleToggleSelectAll = () => {
    const returnableItems = itemsState.filter((it) => it.remaining_quantity > 0);
    const areAllSelected = returnableItems.length > 0 && returnableItems.every((it) => it.is_selected);
    setItemsState((prev) =>
      prev.map((it) => ({
        ...it,
        is_selected: it.remaining_quantity > 0 ? !areAllSelected : false,
      }))
    );
  };

  const handleQuantityChange = (index: number, val: number) => {
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
      return 'Vui lòng chọn Đơn hàng gốc cần trả hàng.';
    }
    if (selectedRows.length === 0) {
      return 'Vui lòng tích chọn ít nhất 1 dòng hàng cần trả.';
    }

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
      setErrorMsg(validationError);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

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
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo phiếu trả hàng.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      {/* Top Header / Breadcrumb Bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ffffff';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            Quay lại danh sách
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '19px', fontWeight: '800', color: '#0f172a' }}>
                Lập Phiếu Trả Hàng Từ Đại Lý (Sales Return / RMA)
              </h1>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe',
                }}
              >
                Quy trình 2 bước
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Khởi tạo yêu cầu trả hàng từ Đơn hàng gốc &bull; Tự động kiểm tra số lượng &bull; Điều hướng kho nhận thông minh
            </p>
          </div>
        </div>

        {/* Header Right Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Hủy bỏ
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedRows.length === 0}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isSubmitting || selectedRows.length === 0 ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: isSubmitting || selectedRows.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isSubmitting || selectedRows.length === 0 ? 'none' : '0 2px 4px rgba(37, 99, 235, 0.25)',
              transition: 'background-color 0.15s ease',
            }}
          >
            {isSubmitting ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '14px',
                    height: '14px',
                    border: '2px solid #ffffff',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                Đang lưu phiếu...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Lưu Phiếu (Chờ Kho Nhận)
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Page Scrollable Body */}
      <div
        style={{
          maxWidth: '1240px',
          width: '100%',
          margin: '0 auto',
          padding: '24px 28px 80px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
          boxSizing: 'border-box',
        }}
      >
        {/* Error Alert Banner */}
        {errorMsg && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: '10px',
              background: '#fef2f2',
              border: '1.5px solid #fecaca',
              color: '#dc2626',
              fontSize: '13.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              boxShadow: '0 1px 3px rgba(220, 38, 38, 0.08)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div style={{ flex: 1 }}>{errorMsg}</div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: '2px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* SECTION 1: Chọn Đơn Hàng Gốc */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            padding: '20px 24px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ margin: 0, fontSize: '15.5px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  fontSize: '13px',
                  fontWeight: '800',
                }}
              >
                1
              </span>
              Chọn Đơn Hàng Gốc Đã Giao (Original Order)
              <span style={{ color: '#ef4444' }}>*</span>
            </h2>

            {selectedOrderId && (
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
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Chọn đơn hàng khác
              </button>
            )}
          </div>

          {/* Search & Custom Dropdown if not selected or changing */}
          {!selectedOrderId ? (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                }}
              >
                {/* Search Input Box */}
                <div style={{ position: 'relative', flex: 1 }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      display: 'flex',
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={orderSearchText}
                    onChange={(e) => {
                      setOrderSearchText(e.target.value);
                      setIsOrderDropdownOpen(true);
                    }}
                    onFocus={() => setIsOrderDropdownOpen(true)}
                    placeholder="Tìm đơn hàng theo mã (ORD...), tên đại lý hoặc số điện thoại..."
                    style={{
                      width: '100%',
                      padding: '11px 36px 11px 40px',
                      borderRadius: '10px',
                      border: '1.5px solid #cbd5e1',
                      fontSize: '14px',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      outline: 'none',
                      backgroundColor: '#ffffff',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  />
                  {orderSearchText && (
                    <button
                      type="button"
                      onClick={() => setOrderSearchText('')}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '4px',
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsOrderDropdownOpen((prev) => !prev)}
                  style={{
                    padding: '11px 18px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#334155',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isOrderDropdownOpen ? 'Đóng danh sách' : 'Xem danh sách đơn'}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    style={{
                      transform: isOrderDropdownOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.2s ease',
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>

              {/* Dropdown Options List */}
              {isOrderDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.15)',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    zIndex: 50,
                  }}
                >
                  {isLoadingOrders ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                      Đang tải danh sách đơn hàng đủ điều kiện...
                    </div>
                  ) : filteredOrders.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                      {orderSearchText ? 'Không tìm thấy đơn hàng phù hợp.' : 'Không có đơn hàng nào đã giao đủ điều kiện trả.'}
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#f8fafc',
                          borderBottom: '1px solid #f1f5f9',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#64748b',
                        }}
                      >
                        Tìm thấy {filteredOrders.length} đơn hàng đã giao / hoàn thành
                      </div>
                      {filteredOrders.map((ord) => {
                        const amount = ord.total_amount ?? 0;
                        const dealerName = ord.dealer_name || (ord as any).customer_name || 'Khách lẻ / Đại lý';
                        const orderCode = ord.order_code || (ord as any).code || `ORD#${ord.id}`;
                        return (
                          <div
                            key={ord.id}
                            onClick={() => handleSelectOrder(ord.id)}
                            style={{
                              padding: '12px 18px',
                              borderBottom: '1px solid #f1f5f9',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              transition: 'background-color 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f0f9ff';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#ffffff';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span
                                style={{
                                  fontSize: '12.5px',
                                  fontWeight: '700',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#eff6ff',
                                  color: '#2563eb',
                                  border: '1px solid #bfdbfe',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {orderCode}
                              </span>
                              <div>
                                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0f172a' }}>
                                  {dealerName}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                  {ord.created_at ? new Date(ord.created_at).toLocaleDateString('vi-VN') : ''}
                                  {(ord as any).phone ? ` &bull; SĐT: ${(ord as any).phone}` : ''}
                                </div>
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '14px', fontWeight: '800', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                                {amount.toLocaleString('vi-VN')} đ
                              </div>
                              <span
                                style={{
                                  display: 'inline-block',
                                  marginTop: '3px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#dcfce7',
                                  color: '#15803d',
                                }}
                              >
                                {ord.status}
                              </span>
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
            /* Selected Order Banner Card */
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1.5px solid #86efac',
                borderRadius: '12px',
                padding: '16px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </span>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      Đơn hàng: {orderDetails?.order_code || selectedOrderObj?.code}
                    </span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '1px 7px',
                        borderRadius: '4px',
                        backgroundColor: '#dcfce7',
                        color: '#15803d',
                      }}
                    >
                      {orderDetails?.order_status || selectedOrderObj?.status || 'HOÀN THÀNH'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#334155', marginTop: '3px' }}>
                    <strong>Đại lý / Khách hàng:</strong> {orderDetails?.dealer_name || selectedOrderObj?.dealer_name || 'Đại lý'}
                    {orderDetails?.default_warehouse?.name ? ` &bull; Kho gốc: ${orderDetails.default_warehouse.name}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: '#64748b' }}>Tổng giá trị đơn gốc</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                  {(selectedOrderObj?.total_amount || 0).toLocaleString('vi-VN')} đ
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Dòng Hàng Trả & Phân Luồng Kho */}
        {selectedOrderId && (
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '15.5px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: '#eff6ff',
                      color: '#2563eb',
                      fontSize: '13px',
                      fontWeight: '800',
                    }}
                  >
                    2
                  </span>
                  Danh Sách Dòng Hàng Cần Trả & Phân Luồng Kho Nhập
                </h2>
                <p style={{ margin: '3px 0 0 32px', fontSize: '12.5px', color: '#64748b' }}>
                  Kiểm soát giới hạn: SL trả lần này &le; SL đơn gốc &minus; Đã trả trước &bull; Chọn đúng Lô (nếu SKU quản lý lô)
                </p>
              </div>

              {itemsState.some((it) => it.remaining_quantity > 0) && (
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                >
                  {itemsState.filter((it) => it.remaining_quantity > 0).every((it) => it.is_selected)
                    ? 'Bỏ chọn tất cả'
                    : 'Chọn tất cả dòng còn trả'}
                </button>
              )}
            </div>

            {isLoadingDetails ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                Đang tải chi tiết các dòng hàng và giới hạn trả hàng...
              </div>
            ) : itemsState.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                Đơn hàng này không có dòng hàng nào.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: '#f8fafc',
                        borderBottom: '1.5px solid #e2e8f0',
                        color: '#475569',
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      <th style={{ padding: '12px 14px', width: '40px', textAlign: 'center' }}>Chọn</th>
                      <th style={{ padding: '12px 14px', minWidth: '180px' }}>Sản phẩm / SKU</th>
                      <th style={{ padding: '12px 10px', width: '95px', textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ padding: '12px 10px', width: '75px', textAlign: 'center' }}>Đã mua</th>
                      <th style={{ padding: '12px 10px', width: '75px', textAlign: 'center' }}>Đã trả</th>
                      <th style={{ padding: '12px 10px', width: '90px', textAlign: 'center' }}>Còn được trả</th>
                      <th style={{ padding: '12px 14px', width: '110px' }}>SL Trả Lần Này</th>
                      <th style={{ padding: '12px 14px', minWidth: '180px' }}>Lý Do Trả Hàng</th>
                      <th style={{ padding: '12px 14px', minWidth: '140px' }}>Mã Lô (Lot/Batch)</th>
                      <th style={{ padding: '12px 14px', width: '120px', textAlign: 'right' }}>Thành Tiền Hoàn</th>
                      <th style={{ padding: '12px 14px', minWidth: '140px' }}>Kho Nhập Lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsState.map((row, idx) => {
                      const isReturnable = row.remaining_quantity > 0;
                      const isQtyExceeded = row.is_selected && row.return_quantity > row.remaining_quantity;
                      const isDamaged = isReasonDamagedHelper(row.return_reason === 'Khác (tự nhập lý do)' ? row.custom_reason : row.return_reason);
                      const lineRefund = (Number(row.return_quantity) || 0) * row.unit_price;

                      return (
                        <tr
                          key={row.order_item_id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: row.is_selected ? '#f8fafc' : !isReturnable ? '#fafafa' : '#ffffff',
                            opacity: !isReturnable ? 0.65 : 1,
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '14px', textAlign: 'center', verticalAlign: 'top' }}>
                            <input
                              type="checkbox"
                              checked={row.is_selected}
                              disabled={!isReturnable || isSubmitting}
                              onChange={() => handleToggleItem(idx)}
                              style={{ width: '17px', height: '17px', cursor: isReturnable ? 'pointer' : 'not-allowed' }}
                            />
                          </td>

                          {/* Sản phẩm */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{row.product_name}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span>SKU: {row.product_code || '---'}</span>
                              <span>&bull;</span>
                              <span>ĐVT: {row.unit_name}</span>
                            </div>
                            {row.is_batch_managed && (
                              <span
                                style={{
                                  display: 'inline-block',
                                  marginTop: '4px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#fef3c7',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                }}
                              >
                                Quản lý Lô
                              </span>
                            )}
                          </td>

                          {/* Đơn giá */}
                          <td style={{ padding: '14px 10px', textAlign: 'right', verticalAlign: 'top', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                            {row.unit_price.toLocaleString('vi-VN')} đ
                          </td>

                          {/* Đã giao */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'top', fontWeight: '600', color: '#0f172a' }}>
                            {row.original_quantity}
                          </td>

                          {/* Đã trả trước */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'top', color: row.already_returned > 0 ? '#ea580c' : '#64748b', fontWeight: row.already_returned > 0 ? '700' : 'normal' }}>
                            {row.already_returned}
                          </td>

                          {/* Còn được trả */}
                          <td style={{ padding: '14px 10px', textAlign: 'center', verticalAlign: 'top' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '12px',
                                fontWeight: '800',
                                backgroundColor: isReturnable ? '#dcfce7' : '#fee2e2',
                                color: isReturnable ? '#15803d' : '#b91c1c',
                              }}
                            >
                              {row.remaining_quantity}
                            </span>
                          </td>

                          {/* Số lượng trả */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <input
                              type="number"
                              min={1}
                              max={row.remaining_quantity}
                              disabled={!row.is_selected || !isReturnable || isSubmitting}
                              value={row.return_quantity}
                              onChange={(e) => handleQuantityChange(idx, Number(e.target.value))}
                              style={{
                                width: '80px',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: isQtyExceeded ? '2px solid #ef4444' : '1px solid #cbd5e1',
                                textAlign: 'center',
                                fontWeight: '700',
                                color: isQtyExceeded ? '#ef4444' : '#0f172a',
                                outline: 'none',
                                backgroundColor: !row.is_selected ? '#f1f5f9' : '#ffffff',
                              }}
                            />
                            {isQtyExceeded && (
                              <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '3px', fontWeight: '700' }}>
                                Vượt quá {row.remaining_quantity}!
                              </div>
                            )}
                          </td>

                          {/* Lý do trả hàng */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            <select
                              disabled={!row.is_selected || !isReturnable || isSubmitting}
                              value={row.return_reason}
                              onChange={(e) => handleReasonChange(idx, e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '12.5px',
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
                                placeholder="Ghi rõ lý do trả..."
                                value={row.custom_reason}
                                onChange={(e) => handleCustomReasonChange(idx, e.target.value)}
                                style={{
                                  marginTop: '6px',
                                  width: '100%',
                                  padding: '5px 8px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '12px',
                                  boxSizing: 'border-box',
                                  outline: 'none',
                                }}
                              />
                            )}
                          </td>

                          {/* Mã Lô */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            {row.is_batch_managed ? (
                              <div>
                                {row.available_batches.length > 0 ? (
                                  <select
                                    disabled={!row.is_selected || !isReturnable || isSubmitting}
                                    value={row.batch_number}
                                    onChange={(e) => {
                                      const sel = row.available_batches.find((b) => b.batch_number === e.target.value);
                                      handleBatchChange(idx, e.target.value, sel?.id || null);
                                    }}
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      border: !row.batch_number && row.is_selected ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                                      fontSize: '12px',
                                      fontWeight: '600',
                                      backgroundColor: !row.is_selected ? '#f1f5f9' : '#ffffff',
                                    }}
                                  >
                                    <option value="">-- Chọn Lô đã xuất --</option>
                                    {row.available_batches.map((b) => (
                                      <option key={b.id || b.batch_number} value={b.batch_number}>
                                        {b.batch_number} {b.expiry_date ? `(HSD: ${b.expiry_date})` : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    placeholder="Nhập Mã Lô đơn gốc *"
                                    value={row.batch_number}
                                    disabled={!row.is_selected || !isReturnable || isSubmitting}
                                    onChange={(e) => handleBatchChange(idx, e.target.value)}
                                    style={{
                                      width: '100%',
                                      padding: '6px 8px',
                                      borderRadius: '6px',
                                      border: !row.batch_number && row.is_selected ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                                      fontSize: '12px',
                                      boxSizing: 'border-box',
                                    }}
                                  />
                                )}
                                <div style={{ fontSize: '10.5px', color: '#b45309', marginTop: '3px', fontWeight: '600' }}>
                                  * Bắt buộc có mã Lô
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                Không quản lý lô
                              </span>
                            )}
                          </td>

                          {/* Thành tiền hoàn */}
                          <td style={{ padding: '14px', textAlign: 'right', verticalAlign: 'top', fontWeight: '800', color: row.is_selected ? '#059669' : '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
                            {row.is_selected ? `${lineRefund.toLocaleString('vi-VN')} đ` : '0 đ'}
                          </td>

                          {/* Kho nhập lại */}
                          <td style={{ padding: '14px', verticalAlign: 'top' }}>
                            {row.is_selected ? (
                              isDamaged ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    border: '1px solid #fca5a5',
                                  }}
                                >
                                  ⚠️ Kho Lỗi (KHO_LOI)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    backgroundColor: '#eff6ff',
                                    color: '#1d4ed8',
                                    fontSize: '11.5px',
                                    fontWeight: '700',
                                    border: '1px solid #bfdbfe',
                                  }}
                                >
                                  ✓ Kho Gốc Xuất Bán
                                </span>
                              )
                            ) : (
                              <span style={{ fontSize: '12px', color: '#cbd5e1' }}>---</span>
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
              gap: '20px',
            }}
          >
            {/* Ghi chú chung */}
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              }}
            >
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Ghi chú phiếu trả hàng (Optional)
              </label>
              <textarea
                rows={4}
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                placeholder="Nhập thông tin thỏa thuận với đại lý, ghi chú tình trạng vỏ thùng, biên bản giao nhận..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '8px',
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
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '20px 24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
                  Tổng Kết Phiếu Trả Hàng
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Số dòng hàng chọn trả:</span>
                    <strong style={{ color: '#0f172a' }}>{totalReturnLines} dòng</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Tổng số lượng sản phẩm trả:</span>
                    <strong style={{ color: '#0f172a' }}>{totalReturnQty} sản phẩm</strong>
                  </div>
                  <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a' }}>
                      Tổng tiền hoàn trả đại lý:
                    </span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>
                      {totalRefundAmount.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                  color: '#64748b',
                  lineHeight: '1.5',
                }}
              >
                ℹ️ <strong>Lưu ý:</strong> Khi lưu, phiếu sẽ ở trạng thái <code>PENDING_WAREHOUSE</code>. Tồn kho thực tế chỉ được cộng sau khi Thủ kho bấm xác nhận nhập hàng.
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
          padding: '12px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.05)',
          zIndex: 40,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Đã chọn: <strong style={{ color: '#0f172a' }}>{totalReturnLines}</strong> dòng hàng &bull; SL: <strong style={{ color: '#0f172a' }}>{totalReturnQty}</strong>
          </div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Tổng hoàn trả: <strong style={{ color: '#059669', fontSize: '16px' }}>{totalRefundAmount.toLocaleString('vi-VN')} đ</strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#475569',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Quay lại
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedRows.length === 0}
            style={{
              padding: '9px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isSubmitting || selectedRows.length === 0 ? '#94a3b8' : '#2563eb',
              color: '#ffffff',
              fontSize: '13.5px',
              fontWeight: '700',
              cursor: isSubmitting || selectedRows.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isSubmitting || selectedRows.length === 0 ? 'none' : '0 2px 4px rgba(37, 99, 235, 0.25)',
            }}
          >
            {isSubmitting ? 'Đang xử lý...' : 'Lưu Phiếu Trả Hàng (Chờ Kho Xác Nhận)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateReturnOrderPage;
