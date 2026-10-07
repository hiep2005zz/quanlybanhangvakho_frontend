import React, { useState } from 'react';
import {
  ProductItem,
  createStockReceiptApi,
  createStockIssueApi,
  adjustStockApi,
  Supplier,
  getSuppliersApi,
} from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface StockActionModalProps {
  isOpen: boolean;
  actionType: 'receipt' | 'issue' | 'adjust';
  onClose: () => void;
  token: string;
  product: ProductItem | null;
  onSuccess: () => void;
}

export const StockActionModal: React.FC<StockActionModalProps> = ({
  isOpen,
  actionType,
  onClose,
  token,
  product,
  onSuccess,
}) => {
  if (!isOpen || !product) return null;

  const baseUnit = product.base_unit || 'Cái';
  const availableUnits = [
    { unit_name: baseUnit, conversion_rate: 1.0, is_base: true },
    ...(product.units || []).map((u) => ({
      unit_name: u.unit_name,
      conversion_rate: u.conversion_rate,
      is_base: false,
    })),
  ];

  const [selectedUnitName, setSelectedUnitName] = useState<string>(baseUnit);
  const [inputQuantity, setInputQuantity] = useState<number | string>(1);
  const [partnerOrDest, setPartnerOrDest] = useState<string>('');
  const [selectedSupplierCode, setSelectedSupplierCode] = useState<string>('');
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [noteOrReason, setNoteOrReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

    if (actionType === 'receipt' && !partnerOrDest.trim()) {
      setErrorMsg('Vui lòng nhập tên Nhà cung cấp.');
      return;
    }
    if (actionType === 'issue' && !partnerOrDest.trim()) {
      setErrorMsg('Vui lòng nhập điểm đến / Khách hàng nhận.');
      return;
    }
    if (actionType === 'adjust' && !noteOrReason.trim()) {
      setErrorMsg('Vui lòng nhập lý do kiểm kê / điều chỉnh.');
      return;
    }

    // Kiểm tra tồn kho đối với phiếu xuất
    if (actionType === 'issue' && product.stock < baseQuantity) {
      setErrorMsg(
        `Không đủ tồn kho để xuất. Tồn hiện tại: ${product.stock} ${baseUnit}, yêu cầu xuất: ${numQty} ${currentUnit.unit_name} (= ${baseQuantity} ${baseUnit}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      if (actionType === 'receipt') {
        const res = await createStockReceiptApi(token, {
          product_id: product.id,
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
          product_id: product.id,
          quantity: Math.round(numQty),
          destination: partnerOrDest.trim(),
          note: noteOrReason.trim() || undefined,
          unit_name: currentUnit.unit_name,
          conversion_rate: currentUnit.conversion_rate,
        });
        emitStatusToast({
          title: 'Xuất kho thành công',
          message: res.message,
        });
      } else {
        const res = await adjustStockApi(token, {
          product_id: product.id,
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
      setErrorMsg(err.message || 'Lỗi khi xử lý thao tác kho');
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
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              Mặt hàng: <strong style={{ color: '#0f172a' }}>{product.name}</strong> ({product.code}) — Tồn hiện tại: <strong style={{ color: '#2563eb' }}>{product.stock.toLocaleString()} {baseUnit}</strong>
            </p>
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
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
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

          {/* Lý do / Ghi chú */}
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
