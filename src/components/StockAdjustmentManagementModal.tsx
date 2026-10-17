import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ProductItem,
  StockAdjustmentResponse,
  StockAdjustmentCreatePayload,
  StockAdjustmentItemInput,
  getStockAdjustmentsApi,
  createStockAdjustmentApi,
  approveStockAdjustmentApi,
  rejectStockAdjustmentApi,
  getStockBookApi,
  getInventoryWarehousesApi,
} from '../services/api';

interface StockAdjustmentManagementModalProps {
  token: string;
  isOpen?: boolean;
  currentUser?: {
    id?: number;
    username?: string;
    full_name?: string;
    role?: string;
  };
  onClose: () => void;
  onStockUpdated?: () => void;
  initialWarehouseId?: string;
  initialProductId?: number;
}

export const StockAdjustmentManagementModal: React.FC<StockAdjustmentManagementModalProps> = ({
  token,
  isOpen = true,
  currentUser,
  onClose,
  onStockUpdated,
  initialWarehouseId = 'WH01',
  initialProductId,
}) => {
  if (!isOpen) return null;
  // Tabs: all | PENDING | APPROVED | REJECTED | create
  const [activeTab, setActiveTab] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'create'>('all');
  const [adjustments, setAdjustments] = useState<StockAdjustmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Thống kê nhanh
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0, totalLoss: 0 });

  // Danh sách kho động
  const [warehousesList, setWarehousesList] = useState<{ id: string; name: string }[]>([
    { id: 'WH01', name: 'Kho Tổng Hà Nội' },
    { id: 'WH03', name: 'Kho Chi Nhánh Đà Nẵng' },
    { id: 'WH02', name: 'Kho Chi Nhánh TP. Hồ Chí Minh' },
  ]);

  // Bộ lọc danh sách
  const [filterWarehouse, setFilterWarehouse] = useState<string>(initialWarehouseId || 'all');
  const [filterReason, setFilterReason] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal Chi tiết phiếu
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustmentResponse | null>(null);

  // Trạng thái modal phê duyệt / từ chối
  const [approvingAdj, setApprovingAdj] = useState<StockAdjustmentResponse | null>(null);
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);

  const [rejectingAdj, setRejectingAdj] = useState<StockAdjustmentResponse | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Form Lập phiếu mới
  const [createWarehouse, setCreateWarehouse] = useState<string>(initialWarehouseId || 'WH01');

  useEffect(() => {
    let isMounted = true;
    getInventoryWarehousesApi(token)
      .then((whs) => {
        if (isMounted && whs && whs.length > 0) {
          const list = whs.map((w: any) => ({
            id: w.warehouse_id || w.code || String(w.id),
            name: w.warehouse_name || w.name || w.warehouse_id,
          }));
          setWarehousesList(list);
          if (list.length > 0) {
            setCreateWarehouse((prev) => (prev && list.some((x: any) => x.id === prev) ? prev : list[0].id));
          }
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [token]);
  const [createReasonType, setCreateReasonType] = useState<'damaged' | 'lost' | 'expired' | 'other'>('damaged');
  const [createReasonNote, setCreateReasonNote] = useState<string>('');
  const [formItems, setFormItems] = useState<StockAdjustmentItemInput[]>([]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Danh sách sản phẩm cho dropdown chọn
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);
  const [selectedNewProdId, setSelectedNewProdId] = useState<number | ''>('');
  const [newProdQty, setNewProdQty] = useState<number | string>(1);
  const [newProdCost, setNewProdCost] = useState<number | string>(0);
  const [newProdNote, setNewProdNote] = useState<string>('');

  // Quyền hạn
  const isManagerOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    const roles: (string | undefined)[] = [currentUser.role];
    if ((currentUser as any).roles) roles.push(...(currentUser as any).roles);
    return roles.includes('admin') || roles.includes('warehouse_manager');
  }, [currentUser]);

  // Load danh sách sản phẩm theo kho đã chọn
  useEffect(() => {
    if (!token) return;
    getStockBookApi(token, { warehouse_id: createWarehouse, page_size: 100 })
      .then((res) => {
        if (res && res.items) {
          const mapped: ProductItem[] = res.items
            .filter((it) => (it.actual_stock || 0) > 0)
            .map((it) => ({
              id: it.product_id,
              code: it.product_code,
              name: it.product_name,
              category: it.category || 'Thời trang',
              stock: it.actual_stock || 0,
              sell_price: it.sell_price || 0,
              cost_price: it.cost_price ?? null,
              base_unit: it.base_unit || 'Cái',
              is_batch_managed: it.is_batch_managed || false,
            }));
          setAllProducts(mapped);
          if (initialProductId) {
            const found = mapped.find((p) => p.id === initialProductId);
            if (found) {
              setSelectedNewProdId(found.id);
              setNewProdCost(found.cost_price || 0);
            } else {
              setSelectedNewProdId('');
            }
          } else if (mapped.length > 0) {
            setSelectedNewProdId(mapped[0].id);
            setNewProdCost(mapped[0].cost_price || 0);
          } else {
            setSelectedNewProdId('');
            setNewProdCost(0);
          }
        }
      })
      .catch(() => {
        setAllProducts([]);
        setSelectedNewProdId('');
      });
  }, [token, createWarehouse, initialProductId]);

  // Load danh sách phiếu điều chỉnh
  const loadAdjustments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getStockAdjustmentsApi(token, {
        warehouse_id: filterWarehouse === 'all' ? undefined : filterWarehouse,
        status: activeTab === 'all' || activeTab === 'create' ? undefined : activeTab,
        reason_type: filterReason === 'all' ? undefined : filterReason,
        search: searchTerm.trim() || undefined,
        limit: 100,
      });

      setAdjustments(res.items);
      setCounts({
        pending: res.pending_count,
        approved: res.approved_count,
        rejected: res.rejected_count,
        totalLoss: res.total_loss_value_sum,
      });
    } catch (err: any) {
      setError(err?.message || 'Không thể tải danh sách phiếu điều chỉnh.');
    } finally {
      setIsLoading(false);
    }
  }, [token, filterWarehouse, activeTab, filterReason, searchTerm]);

  useEffect(() => {
    if (activeTab !== 'create') {
      loadAdjustments();
    }
  }, [loadAdjustments, activeTab]);

  // Khi chọn sản phẩm mới trong form lập phiếu
  const handleSelectProductChange = (prodId: number) => {
    setSelectedNewProdId(prodId);
    const prod = allProducts.find((p) => p.id === prodId);
    if (prod) {
      setNewProdCost(prod.cost_price || 0);
    }
  };

  // Thêm mặt hàng vào danh sách lập phiếu
  const handleAddItemToForm = () => {
    if (!selectedNewProdId) {
      setError('Vui lòng chọn sản phẩm cần điều chỉnh.');
      return;
    }
    const parsedQty = Math.max(1, parseInt(String(newProdQty), 10) || 1);
    const parsedCost = Math.max(0, parseFloat(String(newProdCost)) || 0);

    if (parsedQty <= 0) {
      setError('Số lượng điều chỉnh giảm phải lớn hơn 0.');
      return;
    }

    const prod = allProducts.find((p) => p.id === selectedNewProdId);
    if (!prod) return;

    // Kiểm tra trùng
    const exists = formItems.find((it) => it.product_id === selectedNewProdId);
    if (exists) {
      setError('Sản phẩm này đã có trong danh sách. Vui lòng chỉnh sửa số lượng ở bảng dưới.');
      return;
    }

    const cost = parsedCost >= 0 ? parsedCost : (prod.cost_price || 0);
    const loss = parsedQty * cost;

    setFormItems([
      ...formItems,
      {
        product_id: prod.id,
        quantity: parsedQty,
        cost_price: cost,
        loss_value: loss,
        note: newProdNote.trim() || undefined,
      },
    ]);

    // Reset ô nhập
    setSelectedNewProdId('');
    setNewProdQty(1);
    setNewProdCost(0);
    setNewProdNote('');
  };

  // Xóa sản phẩm khỏi danh sách lập phiếu
  const handleRemoveItemFromForm = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  // Tính tổng giá trị tổn thất của form
  const totalFormLossValue = useMemo(() => {
    return formItems.reduce((acc, it) => acc + (it.loss_value || 0), 0);
  }, [formItems]);

  // Submit lập phiếu mới
  const handleSubmitCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createReasonNote || createReasonNote.trim().length < 2) {
      setError('Bắt buộc nhập chi tiết lý do và nguyên nhân tổn thất (tối thiểu 2 ký tự).');
      return;
    }
    if (formItems.length === 0) {
      setError('Vui lòng thêm ít nhất 1 sản phẩm cần điều chỉnh vào phiếu.');
      return;
    }
    if (totalFormLossValue <= 0) {
      setError('Bắt buộc ghi rõ giá trị tổn thất (> 0 VNĐ) để xử lý minh bạch.');
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: StockAdjustmentCreatePayload = {
        warehouse_id: createWarehouse,
        reason_type: createReasonType,
        reason_note: createReasonNote.trim(),
        total_loss_value: totalFormLossValue,
        items: formItems,
      };

      const res = await createStockAdjustmentApi(token, payload);
      setSuccessMsg(`Đã lập thành công phiếu điều chỉnh ${res.code} (Chờ phê duyệt)!`);
      setFormItems([]);
      setCreateReasonNote('');
      setActiveTab('PENDING');
      loadAdjustments();
    } catch (err: any) {
      setError(err?.message || 'Không thể tạo phiếu điều chỉnh tồn kho.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Xử lý Phê duyệt phiếu
  const handleConfirmApprove = async () => {
    if (!approvingAdj) return;
    setIsApproving(true);
    setError(null);
    try {
      await approveStockAdjustmentApi(token, approvingAdj.id, approvalNote.trim() || undefined);
      setSuccessMsg(`Đã phê duyệt thành công phiếu ${approvingAdj.code}! Tồn kho và Thẻ kho đã được cập nhật.`);
      setApprovingAdj(null);
      setApprovalNote('');
      if (selectedAdjustment && selectedAdjustment.id === approvingAdj.id) {
        setSelectedAdjustment(null);
      }
      loadAdjustments();
      if (onStockUpdated) onStockUpdated();
    } catch (err: any) {
      setError(err?.message || 'Không thể phê duyệt phiếu điều chỉnh.');
    } finally {
      setIsApproving(false);
    }
  };

  // Xử lý Từ chối duyệt phiếu
  const handleConfirmReject = async () => {
    if (!rejectingAdj) return;
    if (!rejectionReason.trim()) {
      setError('Bắt buộc nhập lý do từ chối phê duyệt.');
      return;
    }
    setIsRejecting(true);
    setError(null);
    try {
      await rejectStockAdjustmentApi(token, rejectingAdj.id, rejectionReason.trim());
      setSuccessMsg(`Đã từ chối phiếu điều chỉnh ${rejectingAdj.code}!`);
      setRejectingAdj(null);
      setRejectionReason('');
      if (selectedAdjustment && selectedAdjustment.id === rejectingAdj.id) {
        setSelectedAdjustment(null);
      }
      loadAdjustments();
    } catch (err: any) {
      setError(err?.message || 'Không thể từ chối phiếu.');
    } finally {
      setIsRejecting(false);
    }
  };

  // Format tiền tệ VNĐ
  const formatMoney = (val: number | undefined | null) => {
    if (!val) return '0 đ';
    return `${Number(val).toLocaleString('vi-VN')} đ`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* HEADER MODAL */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '22px' }}>⚖️</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                Phiếu Điều Chỉnh Tồn Kho (Có Phê Duyệt)
              </h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#fee2e2',
                  color: '#991b1b',
                  border: '1px solid #fecaca',
                }}
              >
                Hàng Hỏng • Hàng Mất • Hủy Hạn
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Xử lý minh bạch các hao hụt tổn thất, bắt buộc ghi rõ giá trị và thực thi quy tắc Four-eyes principle (Người lập ≠ Người duyệt).
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '22px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
            }}
          >
            ✕
          </button>
        </div>

        {/* THÔNG BÁO THÀNH CÔNG / THẤT BẠI */}
        {error && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: '#fef2f2',
              borderBottom: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ⚠️ {error}
          </div>
        )}
        {successMsg && (
          <div
            style={{
              padding: '10px 20px',
              backgroundColor: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              color: '#15803d',
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ✅ {successMsg}
          </div>
        )}

        {/* THANH TAB ĐIỀU HƯỚNG */}
        <div
          style={{
            padding: '10px 24px 0 24px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderBottom: activeTab === 'all' ? '2.5px solid #2563eb' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                fontWeight: activeTab === 'all' ? '700' : '600',
                color: activeTab === 'all' ? '#2563eb' : '#64748b',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Tất cả phiếu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PENDING')}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderBottom: activeTab === 'PENDING' ? '2.5px solid #d97706' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                fontWeight: activeTab === 'PENDING' ? '700' : '600',
                color: activeTab === 'PENDING' ? '#d97706' : '#64748b',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Chờ phê duyệt
              {counts.pending > 0 && (
                <span
                  style={{
                    backgroundColor: '#fef3c7',
                    color: '#b45309',
                    fontSize: '11px',
                    fontWeight: '800',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    border: '1px solid #fcd34d',
                  }}
                >
                  {counts.pending}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('APPROVED')}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderBottom: activeTab === 'APPROVED' ? '2.5px solid #16a34a' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                fontWeight: activeTab === 'APPROVED' ? '700' : '600',
                color: activeTab === 'APPROVED' ? '#16a34a' : '#64748b',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Đã duyệt ({counts.approved})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REJECTED')}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderBottom: activeTab === 'REJECTED' ? '2.5px solid #dc2626' : '2.5px solid transparent',
                backgroundColor: 'transparent',
                fontWeight: activeTab === 'REJECTED' ? '700' : '600',
                color: activeTab === 'REJECTED' ? '#dc2626' : '#64748b',
                cursor: 'pointer',
                fontSize: '13px',
              }}
            >
              Đã từ chối ({counts.rejected})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            style={{
              padding: '7px 16px',
              backgroundColor: activeTab === 'create' ? '#0f766e' : '#059669',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
              marginBottom: '6px',
            }}
          >
            ➕ Lập phiếu điều chỉnh mới
          </button>
        </div>

        {/* NỘI DUNG CHÍNH (SCROLLABLE) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', backgroundColor: '#f8fafc' }}>
          {activeTab === 'create' ? (
            /* ============================================================ */
            /* VIEW LẬP PHIẾU ĐIỀU CHỈNH MỚI                               */
            /* ============================================================ */
            <form onSubmit={handleSubmitCreateAdjustment}>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  1. Thông tin chung & Lý do tổn thất
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {/* Kho điều chỉnh */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Kho áp dụng <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={createWarehouse}
                      onChange={(e) => setCreateWarehouse(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: '600',
                      }}
                    >
                      {warehousesList.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.id})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lý do bắt buộc */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                      Lý do điều chỉnh tổn thất <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <select
                      value={createReasonType}
                      onChange={(e) => setCreateReasonType(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: '700',
                      }}
                    >
                      <option value="damaged">💥 Hàng hỏng (Vỡ, ẩm mốc, rách bao bì)</option>
                      <option value="lost">🔍 Hàng mất (Hao hụt, thất thoát kiểm kê)</option>
                      <option value="expired">⏳ Hàng hết hạn phải huỷ (Quá date)</option>
                      <option value="other">📝 Lý do điều chỉnh khác</option>
                    </select>
                  </div>
                </div>

                {/* Chi tiết nguyên nhân & người chịu trách nhiệm */}
                <div style={{ marginTop: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                    Chi tiết nguyên nhân & Biên bản sự việc <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={createReasonNote}
                    onChange={(e) => setCreateReasonNote(e.target.value)}
                    placeholder="Mô tả cụ thể sự việc (Ví dụ: 2 thùng bị rơi vỡ khi dỡ hàng xe tải; phát hiện mất mát sau ca trực...)"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* KHỐI THÊM MẶT HÀNG */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: '20px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  marginBottom: '16px',
                }}
              >
                <h3 style={{ margin: '0 0 14px 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  2. Chọn mặt hàng điều chỉnh giảm & Đơn giá tổn thất
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    alignItems: 'flex-end',
                    backgroundColor: '#f8fafc',
                    padding: '14px',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '16px',
                  }}
                >
                  {/* Chọn SP */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Sản phẩm
                    </label>
                    <select
                      value={selectedNewProdId}
                      onChange={(e) => handleSelectProductChange(Number(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        color: '#0f172a',
                      }}
                    >
                      <option value="">
                        {allProducts.length === 0
                          ? '-- Kho này chưa có mặt hàng có tồn kho --'
                          : '-- Chọn sản phẩm --'}
                      </option>
                      {allProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          [{p.code}] {p.name} (Tồn: {p.stock})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Số lượng */}
                  <div>
                    {(() => {
                      const selProd = allProducts.find((p) => p.id === Number(selectedNewProdId));
                      const maxStock = selProd ? (selProd.stock || 0) : 0;
                      const isAtMax = maxStock > 0 && Number(newProdQty) >= maxStock;

                      return (
                        <>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                            Số lượng giảm
                          </label>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              height: '38px',
                              border: isAtMax ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                              borderRadius: '6px',
                              backgroundColor: '#ffffff',
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                const cur = Math.max(1, parseInt(String(newProdQty), 10) || 1);
                                if (cur > 1) setNewProdQty(cur - 1);
                              }}
                              disabled={Number(newProdQty) <= 1}
                              style={{
                                width: '32px',
                                height: '100%',
                                border: 'none',
                                backgroundColor: Number(newProdQty) <= 1 ? '#f8fafc' : '#f1f5f9',
                                color: Number(newProdQty) <= 1 ? '#94a3b8' : '#334155',
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: Number(newProdQty) <= 1 ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRight: '1px solid #e2e8f0',
                              }}
                            >
                              −
                            </button>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={newProdQty}
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
                                  setNewProdQty('');
                                  return;
                                }
                                const stripped = clean.replace(/^0+(?=\d)/, '');
                                const num = parseInt(stripped, 10);
                                if (maxStock > 0 && num > maxStock) {
                                  setNewProdQty(maxStock);
                                } else {
                                  setNewProdQty(num);
                                }
                              }}
                              onBlur={() => {
                                if (newProdQty === '' || Number(newProdQty) < 1) {
                                  setNewProdQty(maxStock > 0 ? 1 : 0);
                                } else if (maxStock > 0 && Number(newProdQty) > maxStock) {
                                  setNewProdQty(maxStock);
                                }
                              }}
                              style={{
                                flex: 1,
                                width: '100%',
                                height: '100%',
                                padding: '0 8px',
                                border: 'none',
                                fontSize: '13px',
                                color: isAtMax ? '#d97706' : '#0f172a',
                                fontWeight: '700',
                                textAlign: 'center',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const cur = Math.max(0, parseInt(String(newProdQty), 10) || 0);
                                if (maxStock > 0 && cur >= maxStock) return;
                                setNewProdQty(cur + 1);
                              }}
                              disabled={maxStock <= 0 || (maxStock > 0 && Number(newProdQty) >= maxStock)}
                              style={{
                                width: '32px',
                                height: '100%',
                                border: 'none',
                                backgroundColor: isAtMax ? '#f8fafc' : '#f1f5f9',
                                color: isAtMax ? '#94a3b8' : '#334155',
                                fontSize: '16px',
                                fontWeight: '700',
                                cursor: isAtMax ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderLeft: '1px solid #e2e8f0',
                              }}
                            >
                              +
                            </button>
                          </div>
                          <div style={{ fontSize: '11px', marginTop: '3px' }}>
                            {maxStock <= 0 ? (
                              <span style={{ color: '#ef4444', fontWeight: 600 }}>Tồn: 0</span>
                            ) : Number(newProdQty) >= maxStock ? (
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>⚠️ Tối đa: {maxStock}</span>
                            ) : (
                              <span style={{ color: '#64748b' }}>Tối đa: {maxStock}</span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Giá vốn / Đơn giá tổn thất */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                      Đơn giá tổn thất (đ/sp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={newProdCost}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') setNewProdCost('');
                        else {
                          const parsed = parseFloat(val);
                          if (!isNaN(parsed)) setNewProdCost(parsed);
                        }
                      }}
                      onBlur={() => {
                        if (newProdCost === '' || Number(newProdCost) < 0) setNewProdCost(0);
                      }}
                      style={{
                        width: '100%',
                        height: '38px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        color: '#b91c1c',
                        fontWeight: '700',
                        boxSizing: 'border-box',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* Nút thêm */}
                  <div>
                    <button
                      type="button"
                      onClick={handleAddItemToForm}
                      style={{
                        width: '100%',
                        padding: '8px 14px',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: 'pointer',
                      }}
                    >
                      + Thêm vào phiếu
                    </button>
                  </div>
                </div>

                {/* BẢNG CÁC MẶT HÀNG ĐÃ THÊM VÀO PHIẾU */}
                {formItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                    Chưa có mặt hàng nào. Vui lòng chọn sản phẩm và bấm "+ Thêm vào phiếu".
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#334155' }}>Mã & Tên SP</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#334155', textAlign: 'right' }}>SL giảm</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#334155', textAlign: 'right' }}>Đơn giá vốn</th>
                          <th style={{ padding: '8px 12px', fontWeight: '700', color: '#b91c1c', textAlign: 'right' }}>Giá trị tổn thất</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center', width: '50px' }}>Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formItems.map((it, idx) => {
                          const prod = allProducts.find((p) => p.id === it.product_id);
                          return (
                            <tr key={it.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 12px' }}>
                                <div style={{ fontWeight: '700', color: '#0f172a' }}>{prod?.name || `SP #${it.product_id}`}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>Mã: {prod?.code}</div>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                                -{it.quantity} {prod?.base_unit || 'Cái'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                                {formatMoney(it.cost_price)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#b91c1c' }}>
                                {formatMoney(it.loss_value)}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemFromForm(idx)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    fontWeight: '700',
                                  }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: '#fff1f2', borderTop: '2px solid #fecdd3' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '800', color: '#9f1239' }}>TỔNG CỘNG TỔN THẤT:</td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                            -{formItems.reduce((acc, it) => acc + it.quantity, 0)} sp
                          </td>
                          <td />
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', fontSize: '15px', color: '#be123c' }}>
                            {formatMoney(totalFormLossValue)}
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* NÚT SUBMIT */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  style={{
                    padding: '9px 18px',
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate || formItems.length === 0}
                  style={{
                    padding: '9px 24px',
                    backgroundColor: formItems.length === 0 ? '#94a3b8' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '800',
                    cursor: formItems.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.3)',
                  }}
                >
                  {isSubmittingCreate ? 'Đang gửi...' : 'Gửi Phiếu Chờ Phê Duyệt 🚀'}
                </button>
              </div>
            </form>
          ) : (
            /* ============================================================ */
            /* VIEW DANH SÁCH PHIẾU ĐIỀU CHỈNH                             */
            /* ============================================================ */
            <div>
              {/* THANH TÌM KIẾM & BỘ LỌC */}
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  marginBottom: '14px',
                }}
              >
                <div style={{ flex: '1 1 200px' }}>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm theo mã phiếu, ghi chú, người lập..."
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <select
                    value={filterWarehouse}
                    onChange={(e) => setFilterWarehouse(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">Tất cả kho</option>
                    {warehousesList.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    value={filterReason}
                    onChange={(e) => setFilterReason(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                      backgroundColor: '#ffffff',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">Tất cả lý do</option>
                    <option value="damaged">Hàng hỏng</option>
                    <option value="lost">Hàng mất</option>
                    <option value="expired">Hết hạn huỷ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => loadAdjustments()}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Tải lại
                </button>
              </div>

              {/* BẢNG PHIẾU ĐIỀU CHỈNH */}
              {isLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  ⏳ Đang tải danh sách phiếu điều chỉnh...
                </div>
              ) : adjustments.length === 0 ? (
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    padding: '36px',
                    textAlign: 'center',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>
                    Không tìm thấy phiếu điều chỉnh nào phù hợp.
                  </p>
                </div>
              ) : (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>Mã phiếu</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>Kho</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>Lý do</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', textAlign: 'right' }}>SL / Mặt hàng</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#b91c1c', textAlign: 'right' }}>Giá trị tổn thất</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>Người lập</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155' }}>Trạng thái</th>
                        <th style={{ padding: '10px 14px', fontWeight: '700', color: '#334155', textAlign: 'center' }}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adjustments.map((adj) => {
                        const isPending = adj.status === 'PENDING';
                        const isApproved = adj.status === 'APPROVED';
                        const isRejected = adj.status === 'REJECTED';

                        // Kiểm tra Four-eyes: Nếu người đang xem chính là người lập phiếu
                        const isCreator = Boolean(
                          (adj.created_by_id && currentUser?.id && adj.created_by_id === currentUser.id) ||
                          (adj.created_by && currentUser?.username && adj.created_by.trim().toLowerCase() === currentUser.username.trim().toLowerCase())
                        );

                        return (
                          <tr key={adj.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: '700', color: '#2563eb' }}>
                              {adj.code}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#334155' }}>
                              {adj.warehouse_name}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: '700',
                                  backgroundColor:
                                    adj.reason_type === 'damaged'
                                      ? '#fee2e2'
                                      : adj.reason_type === 'lost'
                                      ? '#ffedd5'
                                      : adj.reason_type === 'expired'
                                      ? '#fef3c7'
                                      : '#f1f5f9',
                                  color:
                                    adj.reason_type === 'damaged'
                                      ? '#991b1b'
                                      : adj.reason_type === 'lost'
                                      ? '#9a3412'
                                      : adj.reason_type === 'expired'
                                      ? '#b45309'
                                      : '#475569',
                                }}
                              >
                                {adj.reason_label}
                              </span>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', maxWidth: '200px' }} className="truncate">
                                {adj.reason_note}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', color: '#475569' }}>
                              <span style={{ color: '#dc2626', fontWeight: '700' }}>-{adj.total_quantity}</span> sp
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>({adj.total_items} mặt hàng)</div>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: '#b91c1c' }}>
                              {formatMoney(adj.total_loss_value)}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>
                              <div style={{ fontWeight: '600' }}>{adj.created_by}</div>
                              <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                {new Date(adj.created_at).toLocaleDateString('vi-VN')}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  fontSize: '12px',
                                  fontWeight: '700',
                                  backgroundColor: isApproved ? '#dcfce7' : isPending ? '#fef3c7' : '#fee2e2',
                                  color: isApproved ? '#166534' : isPending ? '#b45309' : '#991b1b',
                                }}
                              >
                                {adj.status_label}
                              </span>
                              {isApproved && adj.approved_by && (
                                <div style={{ fontSize: '10.5px', color: '#16a34a', marginTop: '2px' }}>
                                  Duyệt: {adj.approved_by}
                                </div>
                              )}
                              {isRejected && (
                                <div style={{ fontSize: '10.5px', color: '#dc2626', marginTop: '2px' }}>
                                  Từ chối: {adj.rejected_by}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => setSelectedAdjustment(adj)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: '#f1f5f9',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    color: '#334155',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                  }}
                                >
                                  Chi tiết
                                </button>

                                {isPending && isManagerOrAdmin && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={Boolean(isCreator)}
                                      onClick={() => setApprovingAdj(adj)}
                                      title={isCreator ? 'Quy tắc Four-eyes: Bạn là người lập phiếu nên không được tự duyệt.' : 'Phê duyệt phiếu điều chỉnh'}
                                      style={{
                                        padding: '4px 10px',
                                        backgroundColor: isCreator ? '#e2e8f0' : '#16a34a',
                                        color: isCreator ? '#94a3b8' : '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: isCreator ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      Duyệt
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(isCreator)}
                                      onClick={() => setRejectingAdj(adj)}
                                      title={isCreator ? 'Quy tắc Four-eyes: Không thể tự từ chối phiếu của mình.' : 'Từ chối duyệt phiếu'}
                                      style={{
                                        padding: '4px 8px',
                                        backgroundColor: isCreator ? '#e2e8f0' : '#ef4444',
                                        color: isCreator ? '#94a3b8' : '#ffffff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        fontSize: '12px',
                                        fontWeight: '700',
                                        cursor: isCreator ? 'not-allowed' : 'pointer',
                                      }}
                                    >
                                      Từ chối
                                    </button>
                                  </>
                                )}
                              </div>
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
        </div>

        {/* MODAL CON: CHI TIẾT PHIẾU ĐIỀU CHỈNH */}
        {selectedAdjustment && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '750px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc',
                }}
              >
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                  Chi tiết phiếu: {selectedAdjustment.code}
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedAdjustment(null)}
                  style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Kho:</span> <strong>{selectedAdjustment.warehouse_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Lý do:</span> <strong>{selectedAdjustment.reason_label}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Người lập:</span> <strong>{selectedAdjustment.created_by}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Trạng thái:</span> <strong>{selectedAdjustment.status_label}</strong>
                  </div>
                  {selectedAdjustment.approved_by && (
                    <div style={{ gridColumn: 'span 2', color: '#166534', backgroundColor: '#f0fdf4', padding: '6px 10px', borderRadius: '6px' }}>
                      Đã được phê duyệt bởi: <strong>{selectedAdjustment.approved_by}</strong> lúc {selectedAdjustment.approved_at}
                    </div>
                  )}
                  {selectedAdjustment.rejection_reason && (
                    <div style={{ gridColumn: 'span 2', color: '#991b1b', backgroundColor: '#fef2f2', padding: '6px 10px', borderRadius: '6px' }}>
                      Lý do từ chối: {selectedAdjustment.rejection_reason} (bởi {selectedAdjustment.rejected_by})
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                  <div style={{ fontWeight: '700', color: '#334155', marginBottom: '4px' }}>Chi tiết nguyên nhân:</div>
                  <div style={{ color: '#0f172a' }}>{selectedAdjustment.reason_note}</div>
                </div>

                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                  Danh sách mặt hàng tổn thất
                </h4>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', border: '1px solid #e2e8f0' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '8px 10px' }}>Tên & Mã SP</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>SL giảm</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Đơn giá vốn</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: '#b91c1c' }}>Tổn thất</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAdjustment.items.map((it) => (
                      <tr key={it.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: '700', color: '#0f172a' }}>{it.product_name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Mã: {it.product_code}</div>
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                          -{it.quantity} {it.base_unit}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatMoney(it.cost_price)}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '800', color: '#b91c1c' }}>
                          {formatMoney(it.loss_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: '#fff1f2', fontWeight: '900' }}>
                      <td style={{ padding: '10px', color: '#9f1239' }}>TỔNG CỘNG TỔN THẤT:</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: '#dc2626' }}>
                        -{selectedAdjustment.total_quantity} sp
                      </td>
                      <td />
                      <td style={{ padding: '10px', textAlign: 'right', color: '#be123c', fontSize: '15px' }}>
                        {formatMoney(selectedAdjustment.total_loss_value)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', backgroundColor: '#f8fafc' }}>
                <button
                  type="button"
                  onClick={() => setSelectedAdjustment(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#e2e8f0',
                    color: '#334155',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '700',
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PHÊ DUYỆT */}
        {approvingAdj && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '480px',
                padding: '20px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>
                Xác nhận phê duyệt phiếu điều chỉnh
              </h3>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                Bạn đang phê duyệt phiếu <strong>{approvingAdj.code}</strong>. Tổng giá trị tổn thất: <strong style={{ color: '#dc2626' }}>{formatMoney(approvingAdj.total_loss_value)}</strong>.
                Sau khi duyệt, tồn kho sẽ tự động giảm và thông tin sẽ ghi nhận vào <strong>Thẻ kho</strong>.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  Ghi chú phê duyệt (tùy chọn)
                </label>
                <textarea
                  rows={2}
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="Nhập ghi chú ý kiến quản lý..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setApprovingAdj(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#e2e8f0',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isApproving}
                  onClick={handleConfirmApprove}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '800',
                    cursor: isApproving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isApproving ? 'Đang duyệt...' : 'Đồng ý duyệt ✅'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TỪ CHỐI */}
        {rejectingAdj && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10001,
              padding: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '12px',
                width: '100%',
                maxWidth: '480px',
                padding: '20px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', fontWeight: '800', color: '#dc2626' }}>
                Từ chối phê duyệt phiếu điều chỉnh
              </h3>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                Vui lòng nhập lý do từ chối phiếu <strong>{rejectingAdj.code}</strong> để người lập nắm được thông tin.
              </p>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  Lý do từ chối bắt buộc <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  rows={2}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Ví dụ: Chưa rõ người làm vỡ, yêu cầu lập biên bản sự việc..."
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setRejectingAdj(null)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#e2e8f0',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isRejecting || !rejectionReason.trim()}
                  onClick={handleConfirmReject}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '800',
                    cursor: isRejecting || !rejectionReason.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isRejecting ? 'Đang từ chối...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
