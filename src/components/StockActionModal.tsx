import React, { useState } from 'react';
import {
  ProductItem,
  ProductBatchInfo,
  createStockReceiptApi,
  createStockIssueApi,
  adjustStockApi,
  getBatchSuggestionsApi,
  Supplier,
  getSuppliersApi,
  formatErrorMessage,
  BatchItem,
  getBatchesApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface StockActionModalProps {
  isOpen: boolean;
  actionType: 'receipt' | 'issue' | 'adjust';
  onClose: () => void;
  token: string;
  product: ProductItem | null;
  products?: ProductItem[];
  initialReason?: string;
  onSuccess: () => void;
  user?: { role?: string; roles?: string[]; full_name?: string; username?: string };
}

export const StockActionModal: React.FC<StockActionModalProps> = ({
  isOpen,
  actionType,
  onClose,
  token,
  product,
  products = [],
  initialReason = '',
  onSuccess,
  user,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<number | ''>(
    product?.id ?? (products.length > 0 ? products[0].id : '')
  );

  const [batchesList, setBatchesList] = useState<BatchItem[]>([]);
  const [selectedBatchNumber, setSelectedBatchNumber] = useState<string>('');
  const [overrideExpired, setOverrideExpired] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  React.useEffect(() => {
    if (product) {
      setSelectedProductId(product.id);
    } else if (products.length > 0 && (!selectedProductId || !products.some((p) => p.id === selectedProductId))) {
      setSelectedProductId(products[0].id);
    }
  }, [product, products, isOpen]);

  const currentProduct = product || products.find((p) => p.id === selectedProductId) || null;

  React.useEffect(() => {
    if (isOpen && actionType === 'issue' && currentProduct?.is_batch_managed && token) {
      getBatchesApi(token, { product_id: currentProduct.id })
        .then((res) => {
          setBatchesList(res.items || []);
          if (res.items && res.items.length > 0) {
            setSelectedBatchNumber(res.items[0].batch_number);
          } else {
            setSelectedBatchNumber('');
          }
        })
        .catch(() => {
          setBatchesList([]);
          setSelectedBatchNumber('');
        });
    } else {
      setBatchesList([]);
      setSelectedBatchNumber('');
      setOverrideExpired(false);
      setOverrideReason('');
    }
  }, [isOpen, actionType, currentProduct?.id, currentProduct?.is_batch_managed, token]);

  if (!isOpen) return null;
  if (!currentProduct && products.length === 0) return null;

  const baseUnit = currentProduct ? currentProduct.base_unit || 'Cái' : 'Cái';
  const availableUnits = currentProduct
    ? [
        { unit_name: baseUnit, conversion_rate: 1.0, is_base: true },
        ...(currentProduct.units || []).map((u) => ({
          unit_name: u.unit_name,
          conversion_rate: u.conversion_rate,
          is_base: false,
        })),
      ]
    : [{ unit_name: 'Cái', conversion_rate: 1.0, is_base: true }];

  const [selectedUnitName, setSelectedUnitName] = useState<string>(baseUnit);
  const [inputQuantity, setInputQuantity] = useState<number | string>(1);
  const [partnerOrDest, setPartnerOrDest] = useState<string>('');
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string>('');
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [noteOrReason, setNoteOrReason] = useState<string>(initialReason || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // SCRUM-81: Quản lý lô xuất theo FEFO
  const [suggestedBatch, setSuggestedBatch] = useState<ProductBatchInfo | null>(null);
  const [availableBatches, setAvailableBatches] = useState<ProductBatchInfo[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [batchChangeReason, setBatchChangeReason] = useState<string>('');
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  React.useEffect(() => {
    if (isOpen && initialReason) {
      setNoteOrReason(initialReason);
    }
  }, [isOpen, initialReason]);

  React.useEffect(() => {
    if (currentProduct) {
      setSelectedUnitName(currentProduct.base_unit || 'Cái');
    }
  }, [currentProduct?.id]);

  React.useEffect(() => {
    if (isOpen && actionType === 'issue' && currentProduct?.id && token) {
      setIsLoadingBatches(true);
      getBatchSuggestionsApi(token, {
        product_id: currentProduct.id,
        warehouse_id: 'WH01',
        quantity: typeof inputQuantity === 'string' ? parseFloat(inputQuantity) || 1 : inputQuantity,
        conversion_rate: currentUnit?.conversion_rate || 1.0,
      })
        .then((res) => {
          setSuggestedBatch(res.suggested_batch);
          setAvailableBatches(res.available_batches || []);
          if (res.suggested_batch) {
            setSelectedBatchId(res.suggested_batch.id);
          } else if (res.available_batches && res.available_batches.length > 0) {
            setSelectedBatchId(res.available_batches[0].id);
          } else {
            setSelectedBatchId(null);
          }
          setBatchChangeReason('');
        })
        .catch(() => {
          // ignore or fallback
        })
        .finally(() => {
          setIsLoadingBatches(false);
        });
    } else {
      setSuggestedBatch(null);
      setAvailableBatches([]);
      setSelectedBatchId(null);
      setBatchChangeReason('');
    }
  }, [isOpen, actionType, currentProduct?.id, token]);

  React.useEffect(() => {
    if (isOpen && actionType === 'receipt' && token) {
      getSuppliersApi(token, { status: 'active' })
        .then((res) => {
          setSuppliersList(res.items || []);
        })
        .catch(() => {
          // fallback
        });
    }
  }, [isOpen, actionType, token]);

  const selectedSupplier = suppliersList.find((s) => s.code === selectedSupplierCode);

  // Tìm đơn vị đã chọn & hệ số
  const currentUnit =
    availableUnits.find((u) => u.unit_name === selectedUnitName) || availableUnits[0];
  const numQty = typeof inputQuantity === 'string' ? parseFloat(inputQuantity) || 0 : inputQuantity;
  const baseQuantity = Math.round(numQty * currentUnit.conversion_rate);

  const getTitle = () => {
    switch (actionType) {
      case 'receipt':
        return 'Phiếu Nhập Kho Hàng Hóa';
      case 'issue':
        return 'Phiếu Xuất Kho Hàng Hóa';
      case 'adjust':
        return 'Phiếu Điều Chỉnh / Kiểm Kê Kho';
    }
  };

  const getActionColor = () => {
    switch (actionType) {
      case 'receipt':
        return '#16a34a';
      case 'issue':
        return '#ea580c';
      case 'adjust':
        return '#0fad89';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (numQty <= 0 && actionType !== 'adjust') {
      setErrorMsg('Số lượng phải lớn hơn 0.');
      return;
    }
    if (actionType === 'adjust' && numQty === 0) {
      setErrorMsg('Số lượng điều chỉnh phải khác 0.');
      return;
    }
    if (!Number.isFinite(numQty) || Math.abs(numQty) > 10000000) {
      setErrorMsg('Số lượng nhập vào quá lớn (tối đa 10.000.000 đơn vị). Vui lòng nhập số lượng hợp lý.');
      return;
    }
    if (!Number.isFinite(baseQuantity) || Math.abs(baseQuantity) > 100000000) {
      setErrorMsg('Số lượng quy đổi về đơn vị cơ sở vượt quá giới hạn tối đa cho phép (100.000.000).');
      return;
    }

    if (actionType === 'receipt') {
      const trimmed = partnerOrDest.trim();
      if (!trimmed) {
        setErrorMsg('Vui lòng nhập tên Nhà cung cấp.');
        return;
      }
      if (trimmed.length < 2) {
        setErrorMsg('Tên Nhà cung cấp phải có ít nhất 2 ký tự.');
        return;
      }
      if (trimmed.length > 150) {
        setErrorMsg('Tên Nhà cung cấp không được vượt quá 150 ký tự.');
        return;
      }
    }
    if (actionType === 'issue') {
      const trimmed = partnerOrDest.trim();
      if (!trimmed) {
        setErrorMsg('Vui lòng nhập Nơi nhận / Khách hàng.');
        return;
      }
      if (trimmed.length < 2) {
        setErrorMsg('Nơi nhận / Khách hàng phải có ít nhất 2 ký tự.');
        return;
      }
      if (trimmed.length > 150) {
        setErrorMsg('Nơi nhận / Khách hàng không được vượt quá 150 ký tự.');
        return;
      }
    }
    if (actionType === 'adjust') {
      const trimmed = noteOrReason.trim();
      if (!trimmed) {
        setErrorMsg('Vui lòng nhập lý do kiểm kê / điều chỉnh.');
        return;
      }
      if (trimmed.length < 2) {
        setErrorMsg('Lý do kiểm kê / điều chỉnh phải có ít nhất 2 ký tự.');
        return;
      }
      if (trimmed.length > 200) {
        setErrorMsg('Lý do kiểm kê / điều chỉnh không được vượt quá 200 ký tự.');
        return;
      }
    }

    if (!currentProduct) {
      setErrorMsg('Vui lòng chọn mặt hàng cần thao tác.');
      return;
    }

    // Kiểm tra tồn kho đối với phiếu xuất
    if (actionType === 'issue' && currentProduct.stock < baseQuantity) {
      setErrorMsg(
        `Không đủ tồn kho để xuất. Tồn hiện tại: ${currentProduct.stock} ${baseUnit}, yêu cầu xuất: ${numQty} ${currentUnit.unit_name} (= ${baseQuantity} ${baseUnit}).`
      );
      return;
    }

    const userRoles = user?.roles || (user?.role ? [user.role] : []);
    const isManager = userRoles.includes('admin') || userRoles.includes('warehouse_manager');
    const selectedBatch = batchesList.find((b) => b.batch_number === selectedBatchNumber);

    if (actionType === 'issue' && currentProduct.is_batch_managed) {
      if (!selectedBatchNumber && !selectedBatchId) {
        setErrorMsg('Sản phẩm có bật quản lý lô. Bắt buộc phải chọn số lô để xuất.');
        return;
      }
      if (selectedBatch) {
        if (selectedBatch.remaining_quantity < baseQuantity) {
          setErrorMsg(
            `Số lượng tồn trong lô '${selectedBatch.batch_number}' không đủ (còn lại: ${selectedBatch.remaining_quantity} ${baseUnit}, yêu cầu xuất: ${baseQuantity} ${baseUnit}).`
          );
          return;
        }
        if (selectedBatch.expiry_status === 'EXPIRED') {
          if (!overrideExpired) {
            setErrorMsg(
              `Lô hàng '${selectedBatch.batch_number}' đã quá hạn sử dụng! Mặc định hệ thống chặn xuất để chống giao nhầm cho đại lý. Quản lý kho có thể xác nhận ghi đè kèm lý do.`
            );
            return;
          }
          if (!isManager) {
            setErrorMsg('Chỉ Quản lý kho (Warehouse Manager) hoặc Quản trị viên mới có quyền xác nhận ghi đè.');
            return;
          }
          if (!overrideReason.trim() || overrideReason.trim().length < 5) {
            setErrorMsg('Vui lòng nhập lý do Quản lý kho xác nhận ghi đè xuất lô quá hạn (tối thiểu 5 ký tự).');
            return;
          }
        }
      }
    }

    // SCRUM-81 Tiêu chí 2: Bắt buộc nhập lý do nếu chọn lô khác với lô gợi ý
    const isDifferentBatch = suggestedBatch && selectedBatchId && selectedBatchId !== suggestedBatch.id;
    if (actionType === 'issue' && isDifferentBatch) {
      if (!batchChangeReason.trim()) {
        setErrorMsg('Vui lòng nhập lý do khi chọn lô khác với lô hệ thống gợi ý.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (actionType === 'receipt') {
        const res = await createStockReceiptApi(token, {
          product_id: currentProduct.id,
          quantity: Math.round(numQty),
          supplier: partnerOrDest.trim(),
          note: noteOrReason.trim() || undefined,
          unit_name: currentUnit.unit_name,
          conversion_rate: currentUnit.conversion_rate,
        });
        emitStatusToast({
          title: 'Nhập kho thành công',
          message: res.message,
        });
      } else if (actionType === 'issue') {
        const res = await createStockIssueApi(token, {
          product_id: currentProduct.id,
          quantity: Math.round(numQty),
          destination: partnerOrDest.trim(),
          note: noteOrReason.trim() || undefined,
          unit_name: currentUnit.unit_name,
          conversion_rate: currentUnit.conversion_rate,
          warehouse_id: 'WH01',
          selected_batch_id: selectedBatchId,
          suggested_batch_id: suggestedBatch?.id || null,
          batch_change_reason: isDifferentBatch ? batchChangeReason.trim() : undefined,
          batch_number: currentProduct.is_batch_managed ? (selectedBatchNumber || availableBatches.find((b) => b.id === selectedBatchId)?.batch_number) : undefined,
          override_expired: currentProduct.is_batch_managed ? overrideExpired : undefined,
          override_reason: currentProduct.is_batch_managed && overrideExpired ? overrideReason.trim() : undefined,
        });
        emitStatusToast({
          title: 'Xuất kho thành công',
          message: res.message,
        });
      } else {
        const res = await adjustStockApi(token, {
          product_id: currentProduct.id,
          adjustment: Math.round(numQty),
          reason: noteOrReason.trim(),
          unit_name: currentUnit.unit_name,
          conversion_rate: currentUnit.conversion_rate,
        });
        emitStatusToast({
          title: 'Điều chỉnh kho thành công',
          message: res.message,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const rawMsg = err?.message || err;
      const formatted = formatErrorMessage(
        rawMsg === '[object Object]' ? (err?.detail || err) : rawMsg,
        'Lỗi khi xử lý thao tác kho. Vui lòng kiểm tra lại thông tin nhập.'
      );
      setErrorMsg(formatted);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '16px',
          boxSizing: 'border-box',
          animation: 'fadeInCard 0.15s ease-out',
        }}
      >
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '520px',
            width: '100%',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: getActionColor(), margin: 0 }}>
                {getTitle()}
              </h3>
              {currentProduct ? (
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Mặt hàng: <strong style={{ color: '#0f172a' }}>{currentProduct.name}</strong> ({currentProduct.code}) — Tồn hiện tại: <strong style={{ color: '#2563eb' }}>{currentProduct.stock.toLocaleString()} {baseUnit}</strong>
                </p>
              ) : (
                <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                  Chọn mặt hàng bên dưới để tiến hành điều chỉnh / kiểm kê tồn kho
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                fontSize: '20px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              ✕
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: '13px',
                marginBottom: '16px',
              }}
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Cho phép chọn mặt hàng khi mở từ thanh công cụ chung */}
            {!product && products.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Chọn mặt hàng cần điều chỉnh / kiểm kê <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedProductId(id);
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                  }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} (Tồn hiện tại: {p.stock} {p.base_unit || 'Cái'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Nhập/chọn đối tác */}
            {actionType === 'receipt' ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Nguồn hàng / Nhà cung cấp <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={selectedSupplierCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedSupplierCode(val);
                    if (val === 'CUSTOM') {
                      setPartnerOrDest('');
                    } else {
                      const found = suppliersList.find((s) => s.code === val);
                      if (found) {
                        setPartnerOrDest(`[${found.code}] ${found.name}`);
                      } else {
                        setPartnerOrDest('');
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: '#ffffff',
                    marginBottom: selectedSupplierCode === 'CUSTOM' ? '8px' : '0',
                  }}
                >
                  <option value="">-- Chọn Nhà cung cấp nguồn hàng từ danh mục --</option>
                  {suppliersList.map((sup) => (
                    <option key={sup.id} value={sup.code}>
                      [{sup.code}] {sup.name} {sup.tax_code ? `(MST: ${sup.tax_code})` : ''}
                    </option>
                  ))}
                  <option value="CUSTOM">-- Tự nhập nhà cung cấp khác --</option>
                </select>

                {selectedSupplierCode === 'CUSTOM' && (
                  <input
                    type="text"
                    required
                    value={partnerOrDest}
                    onChange={(e) => setPartnerOrDest(e.target.value)}
                    placeholder="Nhập tên nhà cung cấp..."
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                )}

                {selectedSupplier && selectedSupplierCode !== 'CUSTOM' && (
                  <div
                    style={{
                      marginTop: '6px',
                      fontSize: '12px',
                      color: '#475569',
                      background: '#f8fafc',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <span>Mã: <strong style={{ color: '#0f172a' }}>{selectedSupplier.code}</strong></span>
                    {selectedSupplier.contact_person && (
                      <span>Người liên hệ: <strong style={{ color: '#0f172a' }}>{selectedSupplier.contact_person}</strong></span>
                    )}
                    {selectedSupplier.payment_terms && (
                      <span>Điều khoản TT: <strong style={{ color: '#0f172a' }}>{selectedSupplier.payment_terms}</strong></span>
                    )}
                  </div>
                )}
              </div>
            ) : actionType === 'issue' ? (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Nơi nhận / Khách hàng <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={partnerOrDest}
                  onChange={(e) => setPartnerOrDest(e.target.value)}
                  placeholder="Nhập điểm đến xuất hàng..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            ) : null}

            {/* Lô hàng xuất kho (nếu sản phẩm có bật quản lý lô) */}
            {actionType === 'issue' && currentProduct?.is_batch_managed && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Chọn Lô hàng xuất kho <span style={{ color: '#dc2626' }}>* (SKU quản lý theo lô)</span>
                </label>
                {batchesList.length === 0 ? (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
                    Chưa có lô hàng nào còn tồn kho cho sản phẩm này.
                  </div>
                ) : (
                  <select
                    value={selectedBatchNumber}
                    onChange={(e) => {
                      setSelectedBatchNumber(e.target.value);
                      setOverrideExpired(false);
                      setOverrideReason('');
                    }}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13.5px',
                      background: '#ffffff',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  >
                    {batchesList.map((b) => {
                      const expLabel = b.expiry_status === 'EXPIRED' ? '⛔ QUÁ HẠN' : b.expiry_status === 'NEAR_EXPIRY' ? `⚠️ CẬN HẠN (${b.days_until_expiry} ngày)` : `✅ Còn ${b.days_until_expiry} ngày`;
                      return (
                        <option key={b.id} value={b.batch_number}>
                          [Lô: {b.batch_number}] — Tồn: {b.remaining_quantity} {baseUnit} — HSD: {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString('vi-VN') : 'N/A'} — {expLabel}
                        </option>
                      );
                    })}
                  </select>
                )}

                {/* Cảnh báo lô quá hạn & Ghi đè Quản lý kho */}
                {(() => {
                  const selBatch = batchesList.find((b) => b.batch_number === selectedBatchNumber);
                  if (!selBatch || selBatch.expiry_status !== 'EXPIRED') return null;
                  const uRoles = user?.roles || (user?.role ? [user.role] : []);
                  const canOverride = uRoles.includes('admin') || uRoles.includes('warehouse_manager');

                  return (
                    <div style={{ marginTop: '10px', padding: '12px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: '4px' }}>
                        ⛔ Lô {selBatch.batch_number} đã quá hạn sử dụng!
                      </div>
                      <div style={{ fontSize: '12px', color: '#7f1d1d', marginBottom: '8px' }}>
                        Theo quy định, hệ thống mặc định chặn xuất hàng quá hạn cho đại lý.
                      </div>
                      {canOverride ? (
                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', fontWeight: '700', color: '#991b1b', cursor: 'pointer', marginBottom: '6px' }}>
                            <input
                              type="checkbox"
                              checked={overrideExpired}
                              onChange={(e) => setOverrideExpired(e.target.checked)}
                              style={{ width: '16px', height: '16px', accentColor: '#dc2626' }}
                            />
                            Quản lý kho xác nhận GHI ĐÈ xuất lô quá hạn
                          </label>
                          {overrideExpired && (
                            <input
                              type="text"
                              required
                              value={overrideReason}
                              onChange={(e) => setOverrideReason(e.target.value)}
                              placeholder="Nhập lý do xác nhận ghi đè (tối thiểu 5 ký tự)..."
                              style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #fca5a5', fontSize: '12.5px', boxSizing: 'border-box' }}
                            />
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '600' }}>
                          🚫 Bạn không có quyền Quản lý kho để ghi đè lô quá hạn này.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Tiêu chí 2: Chọn đơn vị tính quy đổi & Nhập số lượng */}
            <div style={{ marginBottom: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Đơn vị tính <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  value={selectedUnitName}
                  onChange={(e) => setSelectedUnitName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    background: '#ffffff',
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {availableUnits.map((u) => (
                    <option key={u.unit_name} value={u.unit_name}>
                      {u.unit_name} {u.is_base ? '(ĐV cơ sở)' : `(= ${u.conversion_rate} ${baseUnit})`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                  Số lượng ({selectedUnitName}) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={inputQuantity}
                  onChange={(e) => setInputQuantity(e.target.value)}
                  placeholder="Nhập số lượng..."
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    textAlign: 'right',
                    boxSizing: 'border-box',
                    fontWeight: '600',
                  }}
                />
              </div>
            </div>

            {/* Banner tự động tính số lượng cơ sở */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', color: '#166534', fontWeight: '600' }}>
                  QUY ĐỔI VỀ ĐƠN VỊ CƠ SỞ (GHI SỔ KHO):
                </div>
                <div style={{ fontSize: '12px', color: '#15803d', marginTop: '2px' }}>
                  Hệ số: 1 {currentUnit.unit_name} = {currentUnit.conversion_rate} {baseUnit}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '18px', fontWeight: '800', color: '#15803d' }}>
                  {baseQuantity.toLocaleString()}
                </span>{' '}
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#166534' }}>
                  {baseUnit}
                </span>
              </div>
            </div>
            {/* SCRUM-81: Gợi ý và lựa chọn Lô xuất hàng theo FEFO (nếu có lô) */}
            {actionType === 'issue' && (
              <div
                style={{
                  marginBottom: '16px',
                  padding: '14px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>📦 Lô hàng xuất kho</span>
                    {suggestedBatch && (
                      <span
                        style={{
                          fontSize: '11px',
                          background: '#dcfce7',
                          color: '#15803d',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: '700',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        Gợi ý (HSD gần nhất)
                      </span>
                    )}
                  </label>
                  {isLoadingBatches && <span style={{ fontSize: '11px', color: '#64748b' }}>Đang tải lô...</span>}
                </div>

                {availableBatches.length > 0 ? (
                  <>
                    <select
                      value={selectedBatchId || ''}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        setSelectedBatchId(val);
                      }}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        background: '#ffffff',
                        outline: 'none',
                        cursor: 'pointer',
                        boxSizing: 'border-box',
                        marginBottom: '8px',
                      }}
                    >
                      {availableBatches.map((b) => {
                        const isSugg = suggestedBatch && b.id === suggestedBatch.id;
                        return (
                          <option key={b.id} value={b.id}>
                            {isSugg ? '★ [GỢI Ý] ' : ''}Số lô: {b.batch_number} | HSD: {b.expiry_date || 'N/A'} | Khả dụng: {b.available_quantity} {baseUnit}
                          </option>
                        );
                      })}
                    </select>

                    {/* Hiển thị chi tiết lô đã chọn */}
                    {selectedBatchId && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#475569',
                          background: '#ffffff',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          marginBottom: '8px',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '12px',
                        }}
                      >
                        {(() => {
                          const curBatch = availableBatches.find((b) => b.id === selectedBatchId);
                          if (!curBatch) return null;
                          const isSugg = suggestedBatch && curBatch.id === suggestedBatch.id;
                          return (
                            <>
                              <span>Số lô: <strong style={{ color: '#0f172a' }}>{curBatch.batch_number}</strong></span>
                              <span>HSD: <strong style={{ color: '#0f172a' }}>{curBatch.expiry_date || 'N/A'}</strong></span>
                              <span>Tồn khả dụng: <strong style={{ color: curBatch.available_quantity >= baseQuantity ? '#16a34a' : '#ea580c' }}>{curBatch.available_quantity} {baseUnit}</strong></span>
                              {isSugg && <span style={{ color: '#16a34a', fontWeight: '600' }}>✓ Đúng lô hệ thống gợi ý</span>}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    {/* Tiêu chí 2: Hiển thị ô bắt buộc nhập lý do nếu chọn lô khác lô gợi ý */}
                    {suggestedBatch && selectedBatchId && selectedBatchId !== suggestedBatch.id && (
                      <div style={{ marginTop: '8px', animation: 'fadeInCard 0.15s ease-out' }}>
                        <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '700', color: '#b45309', marginBottom: '4px' }}>
                          Lý do đổi lô <span style={{ color: '#dc2626' }}>*</span> (Bắt buộc khi không xuất lô HSD gần nhất)
                        </label>
                        <input
                          type="text"
                          required
                          value={batchChangeReason}
                          onChange={(e) => setBatchChangeReason(e.target.value)}
                          placeholder="Nhập lý do đổi lô (VD: Khách yêu cầu date mới, bao bì lô cũ lỗi...)"
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1.5px solid #f59e0b',
                            background: '#fffbeb',
                            fontSize: '13px',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                    {isLoadingBatches ? 'Đang kiểm tra dữ liệu lô hàng...' : 'Sản phẩm này hiện chưa có lô hàng chi tiết tại kho hoặc đã hết hạn.'}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                {actionType === 'adjust' ? 'Lý do điều chỉnh (*)' : 'Ghi chú phiếu kho'}
              </label>
              <input
                type="text"
                required={actionType === 'adjust'}
                value={noteOrReason}
                onChange={(e) => setNoteOrReason(e.target.value)}
                placeholder={actionType === 'adjust' ? 'VD: Kiểm kê định kỳ chênh lệch...' : 'Ghi chú thêm (không bắt buộc)...'}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 16px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: '9px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: getActionColor(),
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                }}
              >
                {isSubmitting ? 'Đang thực hiện...' : 'Xác nhận ghi sổ'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
