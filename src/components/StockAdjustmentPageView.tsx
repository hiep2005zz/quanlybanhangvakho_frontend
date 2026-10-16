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
import { emitStatusToast } from './StatusToast';
import { ProductSelectDropdown } from './ProductSelectDropdown';

interface StockAdjustmentPageViewProps {
  token: string;
  currentUser?: {
    id?: number;
    username?: string;
    full_name?: string;
    role?: string;
  };
  initialMode?: 'LIST' | 'CREATE';
  onBackToHome?: () => void;
}

interface ProductWithStockOption {
  product_id: number;
  product_code: string;
  product_name: string;
  base_unit?: string;
  actual_stock: number;
  cost_price?: number;
  sell_price?: number;
}

export const StockAdjustmentPageView: React.FC<StockAdjustmentPageViewProps> = ({
  token,
  currentUser,
  initialMode = 'CREATE',
  onBackToHome,
}) => {
  // Chế độ màn hình: 'LIST' (Bảng danh sách phiếu) | 'CREATE' (Lập phiếu điều chỉnh mới)
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE'>(initialMode);

  useEffect(() => {
    if (initialMode) {
      setViewMode(initialMode);
    }
  }, [initialMode]);

  // Dữ liệu danh sách phiếu
  const [adjustments, setAdjustments] = useState<StockAdjustmentResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Hệ thống thông báo nội bộ (Gọi thông báo hệ thống qua emitStatusToast)
  const showToast = useCallback((message: string, type: 'error' | 'warning' | 'success' | 'info' = 'error') => {
    emitStatusToast({
      message,
      type,
      title: 'Thông báo hệ thống',
    });
  }, []);

  // Bộ lọc bảng
  const [statusFilter, setStatusFilter] = useState<'all' | 'PENDING' | 'APPROVED' | 'REJECTED'>('all');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('all');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Thống kê nhanh
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, totalLoss: 0 });

  // Modal xem chi tiết phiếu
  const [selectedAdjustment, setSelectedAdjustment] = useState<StockAdjustmentResponse | null>(null);

  // Modal xác nhận duyệt / từ chối
  const [approvingAdj, setApprovingAdj] = useState<StockAdjustmentResponse | null>(null);
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [isApproving, setIsApproving] = useState<boolean>(false);

  const [rejectingAdj, setRejectingAdj] = useState<StockAdjustmentResponse | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // Form Lập phiếu mới (Chế độ CREATE)
  const [createWarehouse, setCreateWarehouse] = useState<string>('KHO_HN');
  const [warehousesList, setWarehousesList] = useState<{ id: string; name: string }[]>([]);
  const [createReasonType, setCreateReasonType] = useState<'damaged' | 'lost' | 'expired'>('damaged');
  const [createReasonNote, setCreateReasonNote] = useState<string>('');
  const [formItems, setFormItems] = useState<StockAdjustmentItemInput[]>([]);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);

  // Dữ liệu sản phẩm đồng bộ theo kho đã chọn
  const [availableProducts, setAvailableProducts] = useState<ProductWithStockOption[]>([]);

  // Dòng thêm sản phẩm tạm thời trong Form
  const [selectedProdId, setSelectedProdId] = useState<number | ''>('');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [inputQty, setInputQty] = useState<number | string>(1);
  const [inputLossValue, setInputLossValue] = useState<number | string>(0);

  // Phân quyền Quản lý kho hoặc Admin
  const isManagerOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = currentUser.role ? currentUser.role.toLowerCase() : '';
    const roles: string[] = [r];
    if ((currentUser as any).roles) {
      roles.push(...(currentUser as any).roles.map((x: string) => x.toLowerCase()));
    }
    return roles.includes('admin') || roles.includes('warehouse_manager') || roles.includes('system_admin');
  }, [currentUser]);

  // Kiểm tra quyền Quản trị viên tối cao (Admin)
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const r = currentUser.role ? currentUser.role.toLowerCase() : '';
    const roles: string[] = [r];
    if ((currentUser as any).roles) {
      roles.push(...(currentUser as any).roles.map((x: string) => x.toLowerCase()));
    }
    return roles.includes('admin') || roles.includes('system_admin');
  }, [currentUser]);

  // Quản lý hộp dropdown menu thao tác cho từng dòng trong bảng
  const [openActionId, setOpenActionId] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.stock-adjustment-action-menu')) {
        setOpenActionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Tải danh sách kho hàng động từ hệ thống
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
      .catch((err) => {
        console.warn('Lỗi tải danh sách kho động:', err);
        setWarehousesList([
          { id: 'KHO_HN', name: 'Kho Tổng Hà Nội' },
          { id: 'KHO_DN', name: 'Kho Chi Nhánh Đà Nẵng' },
          { id: 'KHO_HCM', name: 'Kho Chi Nhánh TP. Hồ Chí Minh' },
        ]);
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Load danh sách phiếu điều chỉnh
  const loadAdjustments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getStockAdjustmentsApi(token, {
        warehouse_id: warehouseFilter !== 'all' ? warehouseFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        reason_type: reasonFilter !== 'all' ? reasonFilter : undefined,
        search: searchQuery.trim() || undefined,
        limit: 100,
      });

      setAdjustments(res.items || []);
      setStats({
        pending: res.pending_count || 0,
        approved: res.approved_count || 0,
        rejected: res.rejected_count || 0,
        totalLoss: res.total_loss_value_sum || 0,
      });
    } catch (err: any) {
      console.error('Lỗi tải danh sách phiếu điều chỉnh:', err);
      setError(err?.message || 'Không thể tải danh sách phiếu điều chỉnh tồn kho.');
    } finally {
      setIsLoading(false);
    }
  }, [token, warehouseFilter, statusFilter, reasonFilter, searchQuery]);

  useEffect(() => {
    loadAdjustments();
  }, [loadAdjustments]);

  // Đồng bộ sản phẩm theo kho đã chọn: CHỈ LẤY CÁC SẢN PHẨM THUỘC KHO ĐÓ VÀ CÓ TỒN KHO > 0
  const syncProductsForWarehouse = useCallback(async (whId: string) => {
    try {
      // 1. Lấy dữ liệu tồn kho thực tế theo kho từ Sổ tồn kho
      const stockBookRes = await getStockBookApi(token, {
        warehouse_id: whId,
        page_size: 100,
      }).catch(() => null);

      const combined: ProductWithStockOption[] = [];

      // CHỈ LẤY SẢN PHẨM THỰC TẾ TRONG KHO NÀY CÓ TỒN KHO > 0 ĐỂ ĐIỀU CHỈNH
      if (stockBookRes && stockBookRes.items && stockBookRes.items.length > 0) {
        stockBookRes.items
          .filter((item) => (item.actual_stock || 0) > 0)
          .forEach((item) => {
            combined.push({
              product_id: item.product_id,
              product_code: item.product_code,
              product_name: item.product_name,
              base_unit: item.base_unit || 'Cái',
              actual_stock: item.actual_stock || 0,
              cost_price: item.cost_price || 0,
              sell_price: item.sell_price || 0,
            });
          });
      }

      setAvailableProducts(combined);

      // Nếu kho có sản phẩm có tồn kho, chọn sản phẩm đầu tiên
      if (combined.length > 0) {
        const firstWithStock = combined[0];
        setSelectedProdId(firstWithStock.product_id);
        setInputQty(1);
        setInputLossValue(firstWithStock.cost_price || firstWithStock.sell_price || 100000);
        const matchedItem = stockBookRes?.items?.find((it) => it.product_id === firstWithStock.product_id);
        setSelectedProduct({
          id: firstWithStock.product_id,
          code: firstWithStock.product_code,
          name: firstWithStock.product_name,
          category: matchedItem?.category || 'Thời trang',
          stock: firstWithStock.actual_stock,
          sell_price: firstWithStock.sell_price || 0,
          cost_price: firstWithStock.cost_price || 0,
          base_unit: firstWithStock.base_unit,
          is_batch_managed: matchedItem?.is_batch_managed || false,
        });
      } else {
        // Kho hoàn toàn trống hoặc không có tồn kho: Reset toàn bộ để không hiện sản phẩm của kho khác
        setSelectedProdId('');
        setSelectedProduct(null);
        setInputQty(1);
        setInputLossValue(0);
      }
    } catch (err) {
      console.error('Lỗi đồng bộ sản phẩm theo kho:', err);
    }
  }, [token]);

  // Khi chuyển sang chế độ CREATE hoặc đổi kho trong form tạo phiếu
  useEffect(() => {
    if (viewMode === 'CREATE') {
      syncProductsForWarehouse(createWarehouse);
    }
  }, [viewMode, createWarehouse, syncProductsForWarehouse]);

  // Xử lý khi chọn sản phẩm trong ProductSelectDropdown
  const handleSelectProductChange = useCallback((prod: ProductItem) => {
    setSelectedProdId(prod.id);
    setSelectedProduct(prod);
    setInputQty(1);
    const lossVal = prod.cost_price || prod.sell_price || 100000;
    setInputLossValue(lossVal);
  }, []);

  // Thêm mặt hàng vào form điều chỉnh
  const handleAddItemToForm = () => {
    if (availableProducts.length === 0) {
      showToast('Kho này hiện chưa có mặt hàng nào có tồn kho để điều chỉnh tổn thất.', 'warning');
      return;
    }

    const curId = Number(selectedProdId || selectedProduct?.id);
    if (!curId) {
      showToast('Vui lòng chọn sản phẩm cần điều chỉnh tổn thất.', 'warning');
      return;
    }

    const prod = availableProducts.find((p) => p.product_id === curId);
    if (!prod) {
      showToast('Sản phẩm đã chọn không có tồn kho tại kho này.', 'warning');
      return;
    }

    const parsedQty = Math.max(1, parseInt(String(inputQty), 10) || 1);
    const parsedLossValue = Math.max(0, parseInt(String(inputLossValue), 10) || 0);

    if (parsedQty <= 0) {
      showToast('Số lượng giảm phải lớn hơn 0.', 'warning');
      return;
    }

    if (prod.actual_stock <= 0) {
      showToast(`Sản phẩm '${prod.product_name}' hiện không có tồn kho tại kho này (tồn = 0), không thể lập phiếu điều chỉnh giảm.`, 'error');
      return;
    }

    if (parsedQty > prod.actual_stock) {
      showToast(`Số lượng giảm (${formatNumber(parsedQty)}) vượt quá tồn kho thực tế hiện tại (${formatNumber(prod.actual_stock)} ${prod.base_unit || 'Cái'}).`, 'warning');
      return;
    }

    if (parsedLossValue <= 0) {
      showToast('Bắt buộc phải ghi rõ giá trị tổn thất (lớn hơn 0 VNĐ).', 'warning');
      return;
    }

    // Kiểm tra trùng lặp
    const existingIndex = formItems.findIndex((it) => it.product_id === prod.product_id);
    if (existingIndex >= 0) {
      const updated = [...formItems];
      updated[existingIndex].quantity = parsedQty;
      updated[existingIndex].estimated_loss_value = parsedLossValue;
      setFormItems(updated);
    } else {
      setFormItems([
        ...formItems,
        {
          product_id: prod.product_id,
          product_code: prod.product_code,
          product_name: prod.product_name,
          quantity: parsedQty,
          estimated_loss_value: parsedLossValue,
        },
      ]);
    }
  };

  // Xóa mặt hàng khỏi form
  const handleRemoveItemFromForm = (prodId: number) => {
    setFormItems(formItems.filter((it) => it.product_id !== prodId));
  };

  // Tính tổng tổn thất của form tạo mới
  const formTotalLoss = useMemo(() => {
    return formItems.reduce((sum, it) => {
      const val = it.estimated_loss_value !== undefined ? it.estimated_loss_value : (it.loss_value || 0);
      return sum + (val * it.quantity);
    }, 0);
  }, [formItems]);

  const formTotalQuantity = useMemo(() => {
    return formItems.reduce((sum, it) => sum + it.quantity, 0);
  }, [formItems]);

  // Gửi tạo phiếu điều chỉnh (hỗ trợ Admin phê duyệt ngay)
  const handleSubmitCreateAdjustment = async (autoApprove: boolean = false) => {
    if (formItems.length === 0) {
      showToast('Vui lòng thêm ít nhất một mặt hàng tổn thất vào phiếu.', 'warning');
      return;
    }

    if (!createReasonNote.trim()) {
      showToast('Bắt buộc phải nhập chi tiết nguyên nhân / biên bản sự việc tổn thất.', 'error');
      return;
    }

    setIsSubmittingCreate(true);
    setError(null);
    try {
      const payload: StockAdjustmentCreatePayload = {
        warehouse_id: createWarehouse,
        reason_type: createReasonType,
        reason_note: createReasonNote.trim(),
        items: formItems.map((it) => ({
          product_id: it.product_id,
          product_code: it.product_code,
          product_name: it.product_name,
          quantity: it.quantity,
          loss_value: it.estimated_loss_value || it.loss_value || 0,
          estimated_loss_value: it.estimated_loss_value || it.loss_value || 0,
        })),
      };

      const res = await createStockAdjustmentApi(token, payload);

      if (autoApprove && isAdmin) {
        try {
          await approveStockAdjustmentApi(token, res.id, 'Phê duyệt ngay khi lập phiếu (Admin)');
          showToast(`Đã lập & phê duyệt phiếu ${res.code} thành công. Tồn kho và Thẻ kho đã được ghi nhận tức thì!`, 'success');
          setSuccessMsg(`Đã lập & phê duyệt phiếu ${res.code} thành công. Tồn kho và Thẻ kho đã được ghi nhận tức thì!`);
        } catch (apprErr: any) {
          showToast(`Tạo phiếu ${res.code} thành công nhưng lỗi phê duyệt: ${apprErr?.message || ''}. Phiếu đang ở trạng thái Chờ duyệt.`, 'warning');
        }
      } else {
        showToast(`Tạo phiếu điều chỉnh tổn thất ${res.code} thành công. Phiếu đang ở trạng thái Chờ phê duyệt.`, 'success');
        setSuccessMsg(`Tạo phiếu điều chỉnh tổn thất ${res.code} thành công. Phiếu đang ở trạng thái Chờ phê duyệt.`);
      }

      // Reset form
      setFormItems([]);
      setCreateReasonNote('');
      setViewMode('LIST');
      loadAdjustments();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error('Lỗi tạo phiếu:', err);
      showToast(err?.message || 'Không thể tạo phiếu điều chỉnh tồn kho.', 'error');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Phê duyệt phiếu (Có kiểm tra Four-Eyes)
  const handleApproveAdjustment = async () => {
    if (!approvingAdj) return;
    setIsApproving(true);
    try {
      await approveStockAdjustmentApi(token, approvingAdj.id, approvalNote.trim() || undefined);
      showToast(`Phê duyệt phiếu ${approvingAdj.code} thành công. Tồn kho và Thẻ kho đã được cập nhật.`, 'success');
      setSuccessMsg(`Phê duyệt phiếu ${approvingAdj.code} thành công. Tồn kho và Thẻ kho đã được cập nhật.`);
      setApprovingAdj(null);
      setApprovalNote('');
      loadAdjustments();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      showToast(err?.message || 'Không thể phê duyệt phiếu.', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Từ chối phiếu
  const handleRejectAdjustment = async () => {
    if (!rejectingAdj) return;
    if (!rejectionReason.trim()) {
      showToast('Bắt buộc phải nhập lý do từ chối phiếu điều chỉnh.', 'warning');
      return;
    }
    setIsRejecting(true);
    try {
      await rejectStockAdjustmentApi(token, rejectingAdj.id, rejectionReason.trim());
      showToast(`Đã từ chối phiếu điều chỉnh ${rejectingAdj.code}.`, 'info');
      setSuccessMsg(`Đã từ chối phiếu điều chỉnh ${rejectingAdj.code}.`);
      setRejectingAdj(null);
      setRejectionReason('');
      loadAdjustments();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      showToast(err?.message || 'Không thể từ chối phiếu.', 'error');
    } finally {
      setIsRejecting(false);
    }
  };

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null) return '0';
    return Number(num).toLocaleString('vi-VN');
  };

  const formatDate = (isoStr: string | undefined | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div
      style={{
        padding: '20px 28px',
        backgroundColor: '#f8fafc',
        minHeight: '100%',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. Header Trang Chuyên Nghiệp (Không Icon, Tiêu đề ngắn gọn) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              onClick={onBackToHome}
              style={{ fontSize: '12.5px', color: '#64748b', cursor: onBackToHome ? 'pointer' : 'default' }}
            >
              Hàng tồn kho
            </span>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#0f172a' }}>
              {viewMode === 'CREATE' ? 'Lập phiếu điều chỉnh tồn kho' : 'Danh sách phiếu điều chỉnh'}
            </span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '4px 0 0 0', letterSpacing: '-0.02em' }}>
            {viewMode === 'LIST' ? 'Điều Chỉnh Tồn Kho Tổn Thất' : 'Lập Phiếu Điều Chỉnh Tồn Kho Mới'}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {viewMode === 'CREATE' ? (
            <>
              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  style={{
                    padding: '7px 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Quay lại Hàng tồn kho
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode('LIST')}
                style={{
                  padding: '7px 16px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                Xem danh sách phiếu
              </button>
            </>
          ) : (
            <>
              {onBackToHome && (
                <button
                  type="button"
                  onClick={onBackToHome}
                  style={{
                    padding: '7px 14px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  Quay lại Hàng tồn kho
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewMode('CREATE')}
                style={{
                  padding: '7px 16px',
                  backgroundColor: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                + Lập phiếu điều chỉnh
              </button>
            </>
          )}
        </div>
      </div>

      {/* Thông báo Thành công / Lỗi */}
      {successMsg && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '6px',
            color: '#15803d',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          {successMsg}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            color: '#b91c1c',
            fontSize: '13px',
            fontWeight: '600',
            marginBottom: '12px',
          }}
        >
          {error}
        </div>
      )}

      {/* =========================================================================
          CHẾ ĐỘ 1: BẢNG DANH SÁCH PHIẾU ĐIỀU CHỈNH (LIỀN MẠCH, GỌN GÀNG CHUYÊN NGHIỆP)
          ========================================================================= */}
      {viewMode === 'LIST' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Thanh KPI Tóm tắt ngắn gọn */}
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Chờ phê duyệt: </span>
              <strong style={{ fontSize: '14px', color: '#d97706' }}>{formatNumber(stats.pending)} phiếu</strong>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Đã phê duyệt: </span>
              <strong style={{ fontSize: '14px', color: '#16a34a' }}>{formatNumber(stats.approved)} phiếu</strong>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Đã từ chối: </span>
              <strong style={{ fontSize: '14px', color: '#dc2626' }}>{formatNumber(stats.rejected)} phiếu</strong>
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Tổng giá trị tổn thất: </span>
              <strong style={{ fontSize: '14px', color: '#0f172a' }}>{formatNumber(stats.totalLoss)} đ</strong>
            </div>
          </div>

          {/* Thanh Lọc Liền Mạch Ngay Trên Bảng */}
          <div
            style={{
              padding: '10px 18px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px',
              alignItems: 'center',
              backgroundColor: '#ffffff',
            }}
          >
            {/* Lọc Trạng thái (Pills) */}
            <div style={{ display: 'flex', gap: '4px', borderRight: '1px solid #e2e8f0', paddingRight: '12px' }}>
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'PENDING', label: `Chờ duyệt (${stats.pending})` },
                { key: 'APPROVED', label: 'Đã duyệt' },
                { key: 'REJECTED', label: 'Đã từ chối' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setStatusFilter(pill.key as any)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '5px',
                    border: '1px solid',
                    borderColor: statusFilter === pill.key ? '#0f172a' : 'transparent',
                    backgroundColor: statusFilter === pill.key ? '#0f172a' : 'transparent',
                    color: statusFilter === pill.key ? '#ffffff' : '#475569',
                    fontSize: '12.5px',
                    fontWeight: statusFilter === pill.key ? '700' : '500',
                    cursor: 'pointer',
                  }}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Ô tìm kiếm */}
            <div style={{ flex: '1 1 200px', minWidth: '180px' }}>
              <input
                type="text"
                placeholder="Tìm mã phiếu, người lập, ghi chú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Lọc theo Kho (Đồng bộ động từ CSDL) */}
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#1e293b',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả kho ({warehousesList.length})</option>
              {warehousesList.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.id})
                </option>
              ))}
            </select>

            {/* Lọc theo Lý do */}
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                color: '#1e293b',
                backgroundColor: '#ffffff',
                cursor: 'pointer',
              }}
            >
              <option value="all">Tất cả lý do</option>
              <option value="damaged">Hàng hỏng</option>
              <option value="lost">Hàng mất</option>
              <option value="expired">Hàng hết hạn</option>
            </select>

            {/* Nút Làm mới */}
            <button
              type="button"
              onClick={loadAdjustments}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#f8fafc',
                color: '#334155',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Làm mới
            </button>
          </div>

          {/* Bảng Dữ Liệu Liền Mạch (Thêm minHeight và paddingBottom để dropdown menu không bị che) */}
          <div style={{ overflowX: 'auto', width: '100%', minHeight: '280px', paddingBottom: '50px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155' }}>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '150px' }}>Mã phiếu</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '140px' }}>Thời gian lập</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '140px' }}>Kho lưu trữ</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '130px' }}>Lý do tổn thất</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '100px', textAlign: 'right' }}>SL giảm</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '130px', textAlign: 'right' }}>Giá trị tổn thất</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', minWidth: '150px' }}>Người lập</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '110px', textAlign: 'center' }}>Trạng thái</th>
                  <th style={{ padding: '10px 14px', fontWeight: '700', width: '130px', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                      Đang tải danh sách phiếu điều chỉnh...
                    </td>
                  </tr>
                ) : adjustments.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                      Không tìm thấy phiếu điều chỉnh tồn kho nào.
                    </td>
                  </tr>
                ) : (
                  adjustments.map((adj) => {
                    const isPending = adj.status === 'PENDING';
                    const isApproved = adj.status === 'APPROVED';
                    const isRejected = adj.status === 'REJECTED';

                    // Quy tắc Four-Eyes: Quản lý kho lập phiếu không được tự duyệt, NGOẠI TRỪ Quản trị viên (Admin)
                    const isCreator = Boolean(
                      (adj.created_by_id && currentUser?.id && String(adj.created_by_id) === String(currentUser.id)) ||
                      (adj.created_by && currentUser?.username && adj.created_by.trim().toLowerCase() === currentUser.username.trim().toLowerCase()) ||
                      (adj.created_by && currentUser?.full_name && adj.created_by.trim().toLowerCase() === currentUser.full_name.trim().toLowerCase())
                    );
                    const isSelfBlocked = Boolean(
                      (isCreator && !isAdmin) ||
                      (adj.can_approve === false && !isAdmin)
                    );

                    return (
                      <tr
                        key={adj.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background-color 0.1s ease',
                        }}
                      >
                        {/* Mã phiếu */}
                        <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>
                          {adj.code}
                        </td>

                        {/* Thời gian lập */}
                        <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                          {formatDate(adj.created_at)}
                        </td>

                        {/* Kho */}
                        <td style={{ padding: '10px 14px', color: '#334155' }}>
                          {adj.warehouse_name}
                        </td>

                        {/* Lý do tổn thất */}
                        <td style={{ padding: '10px 14px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: '600',
                              backgroundColor:
                                adj.reason_type === 'damaged'
                                  ? '#fee2e2'
                                  : adj.reason_type === 'lost'
                                  ? '#fef3c7'
                                  : '#f3e8ff',
                              color:
                                adj.reason_type === 'damaged'
                                  ? '#991b1b'
                                  : adj.reason_type === 'lost'
                                  ? '#92400e'
                                  : '#6b21a8',
                            }}
                          >
                            {adj.reason_label}
                          </span>
                        </td>

                        {/* SL giảm */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                          -{formatNumber(adj.total_quantity)}
                        </td>

                        {/* Giá trị tổn thất */}
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                          {formatNumber(adj.total_loss_value)} đ
                        </td>

                        {/* Người lập */}
                        <td style={{ padding: '10px 14px', color: '#334155' }}>
                          <div style={{ fontWeight: '600' }}>{adj.created_by}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {adj.created_by_role === 'warehouse_manager'
                              ? 'Quản lý kho'
                              : adj.created_by_role === 'warehouse'
                              ? 'Thủ kho'
                              : 'Admin'}
                          </div>
                        </td>

                        {/* Trạng thái */}
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          {isPending && (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#b45309' }}>
                              Chờ duyệt
                            </span>
                          )}
                          {isApproved && (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', backgroundColor: '#dcfce7', color: '#166534' }}>
                              Đã duyệt
                            </span>
                          )}
                          {isRejected && (
                            <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: '700', backgroundColor: '#fee2e2', color: '#991b1b' }}>
                              Đã từ chối
                            </span>
                          )}
                        </td>

                        {/* Thao tác (Hộp menu thả xuống chuẩn ERP: Gọn gàng, không vỡ layout) */}
                        <td style={{ padding: '8px 12px', textAlign: 'center', position: 'relative' }}>
                          <div className="stock-adjustment-action-menu" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionId((prev) => (prev === adj.id ? null : adj.id));
                              }}
                              style={{
                                padding: '5px 12px',
                                backgroundColor: openActionId === adj.id ? '#f1f5f9' : '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '12px',
                                color: '#1e293b',
                                cursor: 'pointer',
                                fontWeight: '600',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                whiteSpace: 'nowrap',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <span>Thao tác</span>
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#64748b"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                style={{
                                  transform: openActionId === adj.id ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.15s ease',
                                }}
                              >
                                <polyline points="6 9 12 15 18 9" />
                              </svg>
                            </button>

                            {openActionId === adj.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 'calc(100% + 4px)',
                                  zIndex: 100,
                                  backgroundColor: '#ffffff',
                                  borderRadius: '8px',
                                  border: '1px solid #e2e8f0',
                                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                                  minWidth: '155px',
                                  padding: '5px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '2px',
                                  textAlign: 'left',
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAdjustment(adj);
                                    setOpenActionId(null);
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '7px 10px',
                                    backgroundColor: 'transparent',
                                    border: 'none',
                                    borderRadius: '5px',
                                    fontSize: '12.5px',
                                    color: '#334155',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    whiteSpace: 'nowrap',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                  </svg>
                                  <span>Chi tiết phiếu</span>
                                </button>

                                {isPending && isManagerOrAdmin && (
                                  <>
                                    <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '3px 0' }} />
                                    {isSelfBlocked ? (
                                      <div
                                        title="Quy tắc Four-Eyes: Bạn là Quản lý kho lập phiếu này nên không được tự phê duyệt. Cần một Quản lý kho khác hoặc Admin duyệt."
                                        style={{
                                          padding: '7px 10px',
                                          fontSize: '12px',
                                          color: '#94a3b8',
                                          fontStyle: 'italic',
                                          cursor: 'not-allowed',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '8px',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                        <span>Tự lập (Chờ duyệt)</span>
                                      </div>
                                    ) : (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setApprovingAdj(adj);
                                            setOpenActionId(null);
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '7px 10px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            borderRadius: '5px',
                                            fontSize: '12.5px',
                                            color: '#15803d',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            whiteSpace: 'nowrap',
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0fdf4')}
                                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                          <span>Duyệt phiếu</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRejectingAdj(adj);
                                            setOpenActionId(null);
                                          }}
                                          style={{
                                            width: '100%',
                                            padding: '7px 10px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            borderRadius: '5px',
                                            fontSize: '12.5px',
                                            color: '#dc2626',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            fontWeight: '600',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            whiteSpace: 'nowrap',
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fef2f2')}
                                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                        >
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                          </svg>
                                          <span>Từ chối</span>
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          CHẾ ĐỘ 2: FORM LẬP PHIẾU ĐIỀU CHỈNH MỚI (GỌN GÀNG, ĐỒNG BỘ 1 BẢNG)
          ========================================================================= */}
      {viewMode === 'CREATE' && (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Hàng 1: Thông tin chung & Lý do tổn thất (3 cột thẳng hàng) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            {/* Cột 1: Chọn kho */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Kho điều chỉnh tổn thất <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={createWarehouse}
                onChange={(e) => {
                  setCreateWarehouse(e.target.value);
                  setFormItems([]); // Reset mặt hàng khi đổi kho để đảm bảo đồng bộ
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              >
                {warehousesList.length === 0 ? (
                  <option value="">Đang tải danh sách kho...</option>
                ) : (
                  warehousesList.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.id})
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Cột 2: Lý do tổn thất */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Loại tổn thất xử lý <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={createReasonType}
                onChange={(e) => setCreateReasonType(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                }}
              >
                <option value="damaged">Hàng hỏng (Rách vỡ bao bì, biến dạng, ẩm mốc)</option>
                <option value="lost">Hàng mất (Hao hụt thất thoát kiểm đếm kho)</option>
                <option value="expired">Hàng hết hạn (Hết hạn sử dụng phải tiêu hủy)</option>
              </select>
            </div>

            {/* Cột 3: Chi tiết nguyên nhân / Biên bản */}
            <div>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Biên bản / Nguyên nhân cụ thể <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Rơi vỡ khi bốc dỡ ca sáng; Hao hụt đối chiếu kiểm đếm..."
                value={createReasonNote}
                onChange={(e) => setCreateReasonNote(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Hàng 2: Chọn sản phẩm (Đồng bộ tồn kho & đơn giá) */}
          <div style={{ backgroundColor: '#f8fafc', padding: '14px 18px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', marginBottom: '10px' }}>
              Thêm mặt hàng tổn thất vào phiếu
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(280px, 2fr) minmax(110px, 1fr) minmax(160px, 1.2fr) auto',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              {/* Cột 1: Chọn sản phẩm dropdown chuẩn Infinite Search */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '6px', height: '16px', lineHeight: '16px' }}>
                  Sản phẩm / SKU <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <ProductSelectDropdown
                  token={token}
                  warehouseId={createWarehouse}
                  onlyInStock={true}
                  selectedProductId={Number(selectedProdId || selectedProduct?.id) || 0}
                  onSelectProduct={handleSelectProductChange}
                  placeholder={
                    availableProducts.length === 0
                      ? 'Kho này hiện chưa có hàng...'
                      : 'Chọn sản phẩm / SKU...'
                  }
                  autoSelectFirst={true}
                  dropdownMaxHeight="260px"
                  fallbackProduct={
                    availableProducts.length > 0 && selectedProduct
                      ? {
                          id: selectedProduct.id,
                          code: selectedProduct.code,
                          name: selectedProduct.name,
                          is_batch_managed: selectedProduct.is_batch_managed,
                        }
                      : null
                  }
                />
              </div>

              {/* Cột 2: Số lượng giảm */}
              <div>
                {(() => {
                  const curProdInWh = availableProducts.find((p) => p.product_id === (selectedProduct?.id || selectedProdId));
                  const curMaxStock = curProdInWh ? curProdInWh.actual_stock : (selectedProduct?.stock || 0);
                  const isAtMax = curMaxStock > 0 && Number(inputQty) >= curMaxStock;

                  return (
                    <>
                      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '6px', height: '16px', lineHeight: '16px' }}>
                        Số lượng giảm
                      </label>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          height: '38px',
                          borderRadius: '8px',
                          border: isAtMax ? '1px solid #f59e0b' : '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          overflow: 'hidden',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Math.max(1, parseInt(String(inputQty), 10) || 1);
                            if (cur > 1) setInputQty(cur - 1);
                          }}
                          disabled={Number(inputQty) <= 1}
                          style={{
                            width: '34px',
                            height: '100%',
                            border: 'none',
                            backgroundColor: Number(inputQty) <= 1 ? '#f8fafc' : '#f1f5f9',
                            color: Number(inputQty) <= 1 ? '#94a3b8' : '#334155',
                            fontSize: '18px',
                            fontWeight: '700',
                            cursor: Number(inputQty) <= 1 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            userSelect: 'none',
                            transition: 'all 0.15s ease',
                            borderRight: '1px solid #e2e8f0',
                          }}
                          onMouseEnter={(e) => {
                            if (Number(inputQty) > 1) (e.currentTarget.style.backgroundColor = '#e2e8f0');
                          }}
                          onMouseLeave={(e) => {
                            if (Number(inputQty) > 1) (e.currentTarget.style.backgroundColor = '#f1f5f9');
                          }}
                          title="Giảm 1 số lượng"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={inputQty}
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
                              setInputQty('');
                              return;
                            }
                            const stripped = clean.replace(/^0+(?=\d)/, '');
                            const num = parseInt(stripped, 10);
                            if (curMaxStock > 0 && num > curMaxStock) {
                              setInputQty(curMaxStock);
                              showToast(`Số lượng giảm không được vượt quá tồn kho thực tế (${formatNumber(curMaxStock)} ${curProdInWh?.base_unit || selectedProduct?.base_unit || 'Cái'}).`, 'warning');
                            } else if (curMaxStock <= 0) {
                              setInputQty(0);
                              showToast('Sản phẩm này có tồn kho = 0, không thể điều chỉnh giảm.', 'error');
                            } else {
                              setInputQty(num);
                            }
                          }}
                          onBlur={() => {
                            if (inputQty === '' || Number(inputQty) < 1) {
                              setInputQty(curMaxStock > 0 ? 1 : 0);
                            } else if (curMaxStock > 0 && Number(inputQty) > curMaxStock) {
                              setInputQty(curMaxStock);
                            }
                          }}
                          style={{
                            flex: 1,
                            width: '100%',
                            minWidth: '45px',
                            height: '100%',
                            padding: '0 6px',
                            border: 'none',
                            fontSize: '14px',
                            fontWeight: '700',
                            textAlign: 'center',
                            outline: 'none',
                            backgroundColor: '#ffffff',
                            color: isAtMax ? '#d97706' : '#0f172a',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const cur = Math.max(0, parseInt(String(inputQty), 10) || 0);
                            if (curMaxStock > 0 && cur >= curMaxStock) {
                              showToast(`Đã đạt tối đa tồn kho thực tế (${formatNumber(curMaxStock)}). Không thể tăng thêm.`, 'warning');
                              return;
                            }
                            setInputQty(cur + 1);
                          }}
                          disabled={curMaxStock <= 0 || (curMaxStock > 0 && Number(inputQty) >= curMaxStock)}
                          style={{
                            width: '34px',
                            height: '100%',
                            border: 'none',
                            backgroundColor: isAtMax ? '#f8fafc' : '#f1f5f9',
                            color: isAtMax ? '#94a3b8' : '#334155',
                            fontSize: '18px',
                            fontWeight: '700',
                            cursor: isAtMax ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            userSelect: 'none',
                            transition: 'all 0.15s ease',
                            borderLeft: '1px solid #e2e8f0',
                          }}
                          onMouseEnter={(e) => {
                            if (!isAtMax) e.currentTarget.style.backgroundColor = '#e2e8f0';
                          }}
                          onMouseLeave={(e) => {
                            if (!isAtMax) e.currentTarget.style.backgroundColor = '#f1f5f9';
                          }}
                          title={isAtMax ? 'Đã đạt tối đa tồn kho' : 'Tăng 1 số lượng'}
                        >
                          +
                        </button>
                      </div>

                      {/* Thông tin tồn kho & Cảnh báo tức thì ngay dưới ô nhập */}
                      <div style={{ fontSize: '11px', marginTop: '4px', minHeight: '16px', lineHeight: '16px' }}>
                        {curMaxStock <= 0 ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }}>⛔ Hết hàng trong kho (Tồn: 0)</span>
                        ) : Number(inputQty) >= curMaxStock ? (
                          <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <span>⚠️</span>
                            <span>Đã chạm tối đa tồn ({formatNumber(curMaxStock)} {curProdInWh?.base_unit || selectedProduct?.base_unit || 'Cái'})</span>
                          </span>
                        ) : (
                          <span style={{ color: '#64748b' }}>
                            Tối đa: <strong style={{ color: '#0f172a' }}>{formatNumber(curMaxStock)}</strong> {curProdInWh?.base_unit || selectedProduct?.base_unit || 'Cái'}
                          </span>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Cột 3: Đơn giá tổn thất (VNĐ/sp) */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#64748b', marginBottom: '6px', height: '16px', lineHeight: '16px' }}>
                  Đơn giá tổn thất (đ/sp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={inputLossValue}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    if (clean === '') {
                      setInputLossValue('');
                    } else {
                      const stripped = clean.replace(/^0+(?=\d)/, '');
                      const parsed = parseInt(stripped, 10);
                      if (!isNaN(parsed)) {
                        setInputLossValue(parsed);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (inputLossValue === '' || Number(inputLossValue) < 0) {
                      setInputLossValue(0);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    textAlign: 'right',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    fontWeight: '600',
                  }}
                />
              </div>

              {/* Cột 4: Nút thêm vào danh sách */}
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: 'transparent', marginBottom: '6px', height: '16px', lineHeight: '16px', userSelect: 'none' }}>
                  Thao tác
                </label>
                {(() => {
                  const curProdInWh = availableProducts.find((p) => p.product_id === (selectedProduct?.id || selectedProdId));
                  const curMaxStock = curProdInWh ? curProdInWh.actual_stock : (selectedProduct?.stock || 0);
                  const isBlocked =
                    availableProducts.length === 0 ||
                    Number(inputQty) <= 0 ||
                    (curMaxStock > 0 && Number(inputQty) > curMaxStock) ||
                    !selectedProduct;

                  return (
                    <button
                      type="button"
                      onClick={handleAddItemToForm}
                      disabled={isBlocked}
                      style={{
                        height: '38px',
                        padding: '0 18px',
                        backgroundColor: isBlocked ? '#94a3b8' : '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: isBlocked ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                        opacity: isBlocked ? 0.6 : 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      Thêm vào phiếu
                    </button>
                  );
                })()}
              </div>
            </div>

            {/* Dòng thông báo / tồn kho thực tế - ĐẶT DƯỚI BẢNG ĐỂ KHÔNG BỊ LỆCH HÀNG */}
            {selectedProduct && availableProducts.length > 0 ? (
              <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: '#64748b' }}>Tồn thực tế tại kho này:</span>
                  {(() => {
                    const curProdInWh = availableProducts.find((p) => p.product_id === selectedProduct.id);
                    const actStock = curProdInWh ? curProdInWh.actual_stock : selectedProduct.stock || 0;
                    return actStock > 0 ? (
                      <span style={{ fontWeight: '700', color: '#0284c7' }}>
                        {formatNumber(actStock)} {curProdInWh?.base_unit || selectedProduct.base_unit || 'Cái'}
                      </span>
                    ) : (
                      <span style={{ fontWeight: '700', color: '#dc2626' }}>
                        0 (Hết hàng tại kho này)
                      </span>
                    );
                  })()}
                </div>
                {(() => {
                  const curProdInWh = availableProducts.find((p) => p.product_id === selectedProduct.id);
                  const actStock = curProdInWh ? curProdInWh.actual_stock : selectedProduct.stock || 0;
                  if (actStock > 0 && Number(inputQty) >= actStock) {
                    return (
                      <span style={{ color: '#d97706', fontWeight: 600, fontSize: '11.5px', background: '#fef3c7', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                        ⚠️ Đang chọn mức tối đa cho phép
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            ) : availableProducts.length === 0 ? (
              <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '6px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', color: '#dc2626', fontSize: '11.5px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>⚠️ Kho này hiện chưa có sản phẩm nào có số lượng tồn kho để lập phiếu điều chỉnh.</span>
              </div>
            ) : null}
          </div>

          {/* Bảng Mặt Hàng Đã Thêm Vào Phiếu */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b' }}>
                Danh sách mặt hàng điều chỉnh ({formItems.length} mặt hàng)
              </div>
              {formItems.length > 0 && (
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Tổng giảm: <strong style={{ color: '#dc2626' }}>{formatNumber(formTotalQuantity)} sp</strong> | 
                  Tổng tổn thất: <strong style={{ color: '#0f172a' }}>{formatNumber(formTotalLoss)} đ</strong>
                </div>
              )}
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#334155' }}>
                    <th style={{ padding: '8px 12px', fontWeight: '700', width: '120px' }}>Mã SKU</th>
                    <th style={{ padding: '8px 12px', fontWeight: '700' }}>Tên sản phẩm</th>
                    <th style={{ padding: '8px 12px', fontWeight: '700', width: '110px', textAlign: 'right' }}>SL giảm</th>
                    <th style={{ padding: '8px 12px', fontWeight: '700', width: '150px', textAlign: 'right' }}>Đơn giá tổn thất</th>
                    <th style={{ padding: '8px 12px', fontWeight: '700', width: '160px', textAlign: 'right' }}>Thành tiền tổn thất</th>
                    <th style={{ padding: '8px 12px', fontWeight: '700', width: '80px', textAlign: 'center' }}>Xóa</th>
                  </tr>
                </thead>
                <tbody>
                  {formItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: '#64748b' }}>
                        Chưa có mặt hàng nào. Vui lòng chọn sản phẩm ở trên và bấm "Thêm vào phiếu".
                      </td>
                    </tr>
                  ) : (
                    formItems.map((item) => (
                      <tr key={item.product_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: '#0f172a' }}>
                          {item.product_code}
                        </td>
                        <td style={{ padding: '8px 12px', color: '#1e293b' }}>
                          {item.product_name}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                          -{formatNumber(item.quantity)}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', color: '#334155' }}>
                          {formatNumber(item.estimated_loss_value || item.loss_value || 0)} đ
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>
                          {formatNumber(item.quantity * (item.estimated_loss_value || item.loss_value || 0))} đ
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => handleRemoveItemFromForm(item.product_id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc2626',
                              fontWeight: '600',
                              fontSize: '12px',
                              cursor: 'pointer',
                            }}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Nút Hành Động Gửi Duyệt */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '16px',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (onBackToHome) {
                  onBackToHome();
                } else {
                  setViewMode('LIST');
                }
              }}
              style={{
                padding: '8px 18px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleSubmitCreateAdjustment(true)}
                disabled={isSubmittingCreate || formItems.length === 0}
                style={{
                  padding: '8px 22px',
                  backgroundColor: '#16a34a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: isSubmittingCreate || formItems.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: isSubmittingCreate || formItems.length === 0 ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)',
                }}
                title="Tạo phiếu và phê duyệt ngay lập tức: Giảm tồn kho thực tế và ghi sổ Thẻ kho tức thì"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {isSubmittingCreate ? 'Đang xử lý...' : 'Phê duyệt & Ghi thẻ kho ngay'}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSubmitCreateAdjustment(false)}
              disabled={isSubmittingCreate || formItems.length === 0}
              style={{
                padding: '8px 22px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: isSubmittingCreate || formItems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: isSubmittingCreate || formItems.length === 0 ? 0.6 : 1,
              }}
            >
              {isSubmittingCreate ? 'Đang tạo phiếu...' : 'Gửi phê duyệt phiếu'}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL CHI TIẾT PHIẾU ĐIỀU CHỈNH
          ========================================================================= */}
      {selectedAdjustment && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAdjustment(null);
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 20px',
                backgroundColor: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: '15px', fontWeight: '700' }}>
                Chi tiết phiếu: {selectedAdjustment.code}
              </div>
              <button
                type="button"
                onClick={() => setSelectedAdjustment(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
                <div><span style={{ color: '#64748b' }}>Kho: </span><strong>{selectedAdjustment.warehouse_name}</strong></div>
                <div><span style={{ color: '#64748b' }}>Lý do tổn thất: </span><strong>{selectedAdjustment.reason_label}</strong></div>
                <div><span style={{ color: '#64748b' }}>Người lập: </span><strong>{selectedAdjustment.created_by}</strong></div>
                <div><span style={{ color: '#64748b' }}>Thời gian: </span>{formatDate(selectedAdjustment.created_at)}</div>
                <div style={{ gridColumn: 'span 2' }}>
                  <span style={{ color: '#64748b' }}>Biên bản / Nguyên nhân: </span>
                  <div style={{ marginTop: '4px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    {selectedAdjustment.reason_note}
                  </div>
                </div>
                {selectedAdjustment.status === 'APPROVED' && (
                  <div style={{ gridColumn: 'span 2', color: '#15803d' }}>
                    Phê duyệt bởi: <strong>{selectedAdjustment.approved_by}</strong> lúc {formatDate(selectedAdjustment.approved_at)}
                  </div>
                )}
                {selectedAdjustment.status === 'REJECTED' && (
                  <div style={{ gridColumn: 'span 2', color: '#b91c1c' }}>
                    Từ chối bởi: <strong>{selectedAdjustment.rejected_by}</strong>. Lý do: {selectedAdjustment.rejection_reason}
                  </div>
                )}
              </div>

              <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Danh sách mặt hàng tổn thất
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12.5px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '8px 10px' }}>Mã SKU</th>
                      <th style={{ padding: '8px 10px' }}>Tên sản phẩm</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>SL giảm</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Đơn giá tổn thất</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAdjustment.items.map((it) => {
                      const lossVal = it.loss_value !== undefined ? it.loss_value : (it.estimated_loss_value || 0);
                      return (
                        <tr key={it.product_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '8px 10px', fontWeight: '600' }}>{it.product_code}</td>
                          <td style={{ padding: '8px 10px' }}>{it.product_name}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>
                            -{formatNumber(it.quantity)}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatNumber(lossVal)} đ</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }}>
                            {formatNumber(it.quantity * lossVal)} đ
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setSelectedAdjustment(null)}
                style={{ padding: '6px 16px', backgroundColor: '#334155', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '12.5px', cursor: 'pointer' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL XÁC NHẬN PHÊ DUYỆT (CHỈ QUẢN LÝ KHO & ADMIN, FOUR-EYES CHECK)
          ========================================================================= */}
      {approvingAdj && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 20px', backgroundColor: '#15803d', color: '#ffffff', fontSize: '15px', fontWeight: '700' }}>
              Xác nhận phê duyệt phiếu điều chỉnh
            </div>
            <div style={{ padding: '16px 20px', fontSize: '13px', color: '#334155' }}>
              <div>Bạn có chắc chắn muốn duyệt phiếu điều chỉnh tổn thất: <strong>{approvingAdj.code}</strong>?</div>
              <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#64748b' }}>
                • Kho: {approvingAdj.warehouse_name} | Lý do: {approvingAdj.reason_label}<br />
                • Tổng số lượng trừ kho: <strong>{approvingAdj.total_quantity} sp</strong><br />
                • Tổng giá trị tổn thất: <strong>{formatNumber(approvingAdj.total_loss_value)} đ</strong>
              </div>
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  Ghi chú phê duyệt (Tùy chọn)
                </label>
                <input
                  type="text"
                  placeholder="Nhập ghi chú hoặc ý kiến phê duyệt..."
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setApprovingAdj(null)}
                style={{ padding: '6px 14px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12.5px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApproveAdjustment}
                disabled={isApproving}
                style={{ padding: '6px 16px', backgroundColor: '#15803d', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
              >
                {isApproving ? 'Đang duyệt...' : 'Xác nhận duyệt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL TỪ CHỐI DUYỆT (BẮT BUỘC NHẬP LÝ DO)
          ========================================================================= */}
      {rejectingAdj && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              maxWidth: '480px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 20px', backgroundColor: '#b91c1c', color: '#ffffff', fontSize: '15px', fontWeight: '700' }}>
              Từ chối duyệt phiếu điều chỉnh
            </div>
            <div style={{ padding: '16px 20px', fontSize: '13px', color: '#334155' }}>
              <div>Từ chối phê duyệt phiếu: <strong>{rejectingAdj.code}</strong></div>
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#b91c1c', marginBottom: '4px' }}>
                  Lý do từ chối (Bắt buộc) *
                </label>
                <textarea
                  rows={3}
                  placeholder="Nhập lý do không phê duyệt phiếu điều chỉnh này..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '4px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setRejectingAdj(null)}
                style={{ padding: '6px 14px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12.5px', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleRejectAdjustment}
                disabled={isRejecting}
                style={{ padding: '6px 16px', backgroundColor: '#b91c1c', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '12.5px', fontWeight: '600', cursor: 'pointer' }}
              >
                {isRejecting ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
