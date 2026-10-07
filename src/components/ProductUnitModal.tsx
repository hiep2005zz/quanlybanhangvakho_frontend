import React, { useState } from 'react';
import { ProductItem, updateProductUnitsApi, UnitConversionItem } from '../services/api';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface ProductUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  product: ProductItem | null;
  onSuccess: () => void;
}

export const ProductUnitModal: React.FC<ProductUnitModalProps> = ({
  isOpen,
  onClose,
  token,
  product,
  onSuccess,
}) => {
  if (!isOpen || !product) return null;

  const [baseUnit, setBaseUnit] = useState<string>(product.base_unit || 'Cái');
  const [conversionUnits, setConversionUnits] = useState<UnitConversionItem[]>(() => {
    return product.units && product.units.length > 0
      ? product.units.map((u) => ({ unit_name: u.unit_name, conversion_rate: u.conversion_rate }))
      : [];
  });
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitRate, setNewUnitRate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (product) {
      setBaseUnit(product.base_unit || 'Cái');
      setConversionUnits(
        product.units && product.units.length > 0
          ? product.units.map((u) => ({ unit_name: u.unit_name, conversion_rate: u.conversion_rate }))
          : []
      );
      setNewUnitName('');
      setNewUnitRate('');
      setErrorMsg(null);
    }
  }, [product, isOpen]);

  const handleAddUnit = () => {
    setErrorMsg(null);
    const trimmedName = newUnitName.trim();
    const rateVal = parseFloat(newUnitRate);

    if (!trimmedName && (isNaN(rateVal) || rateVal <= 0)) {
      setErrorMsg('Vui lòng nhập tên đơn vị quy đổi và hệ số quy đổi lớn hơn 0.');
      return;
    }
    if (isNaN(rateVal) || rateVal <= 0) {
      setErrorMsg('Hệ số quy đổi bắt buộc phải là số lớn hơn 0 (ví dụ: 6, 24).');
      return;
    }
    if (!trimmedName) {
      setErrorMsg('Vui lòng nhập tên đơn vị quy đổi (ví dụ: Lốc, Thùng).');
      return;
    }
    if (trimmedName.toLowerCase() === baseUnit.trim().toLowerCase()) {
      setErrorMsg(`Tên đơn vị quy đổi không được trùng với đơn vị cơ sở ('${baseUnit}').`);
      return;
    }
    if (conversionUnits.some((u) => u.unit_name.toLowerCase() === trimmedName.toLowerCase())) {
      setErrorMsg(`Đơn vị '${trimmedName}' đã tồn tại trong danh sách quy đổi.`);
      return;
    }

    setConversionUnits((prev) => [...prev, { unit_name: trimmedName, conversion_rate: rateVal }]);
    setNewUnitName('');
    setNewUnitRate('');
  };

  const handleRemoveUnit = (index: number) => {
    setConversionUnits((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateUnitRate = (index: number, newRateStr: string) => {
    const val = parseFloat(newRateStr);
    setConversionUnits((prev) =>
      prev.map((item, i) => (i === index ? { ...item, conversion_rate: isNaN(val) ? 0 : val } : item))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const trimmedBase = baseUnit.trim();
    if (!trimmedBase) {
      setErrorMsg('Đơn vị tính cơ sở không được để trống.');
      return;
    }

    // Validate tất cả đơn vị quy đổi có rate > 0
    for (const u of conversionUnits) {
      if (!u.unit_name.trim()) {
        setErrorMsg('Tên đơn vị quy đổi không được để trống.');
        return;
      }
      if (u.conversion_rate <= 0) {
        setErrorMsg(`Hệ số quy đổi của đơn vị '${u.unit_name}' phải lớn hơn 0.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateProductUnitsApi(token, product.id, {
        base_unit: trimmedBase,
        units: conversionUnits,
      });

      emitStatusToast({
        title: 'Cập nhật đơn vị tính thành công',
        message: `Đã lưu đơn vị cơ sở '${trimmedBase}' và ${conversionUnits.length} đơn vị quy đổi cho SKU ${product.code}.`,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi lưu đơn vị quy đổi');
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
            maxWidth: '580px',
            width: '100%',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0',
          }}
        >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
              Cấu hình Đơn vị tính quy đổi
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
              SKU: <strong style={{ color: '#2563eb' }}>{product.code}</strong> — {product.name}
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
          {/* Tiêu chí 1.1: Đơn vị tính cơ sở (Base unit) */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Đơn vị tính cơ sở (Base Unit) <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={baseUnit}
                onChange={(e) => setBaseUnit(e.target.value)}
                placeholder="VD: Cái, Lon, Chai, Chiếc..."
                required
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: '12px', color: '#64748b', background: '#f1f5f9', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                Hệ số: <strong>1</strong> (Cơ sở)
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'block' }}>
              Tồn kho thực tế trong sổ sách sẽ luôn được ghi nhận theo đơn vị cơ sở này.
            </span>
          </div>

          {/* Tiêu chí 1.2: Danh sách đơn vị quy đổi */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
              Các đơn vị quy đổi (Hệ số quy đổi về đơn vị cơ sở {baseUnit ? `"${baseUnit}"` : ''})
            </label>

            {conversionUnits.length === 0 ? (
              <div style={{ padding: '16px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                Chưa có đơn vị quy đổi nào. Hãy thêm đơn vị nhập/xuất bên dưới (ví dụ: Lốc = 6, Thùng = 24).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {conversionUnits.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '8px 12px',
                    }}
                  >
                    <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '13.5px', minWidth: '80px' }}>
                      1 {item.unit_name} =
                    </span>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={item.conversion_rate}
                      onChange={(e) => handleUpdateUnitRate(idx, e.target.value)}
                      style={{
                        width: '105px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        textAlign: 'center',
                        fontWeight: '600',
                        color: '#2563eb',
                        background: '#ffffff',
                      }}
                    />
                    <span style={{ fontSize: '13px', color: '#64748b', flex: 1 }}>
                      {baseUnit}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUnit(idx)}
                      style={{
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                      title="Xóa đơn vị quy đổi này"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Khung thêm nhanh đơn vị quy đổi mới */}
            <div
              style={{
                marginTop: '10px',
                padding: '12px',
                background: '#f1f5f9',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <input
                type="text"
                placeholder="Tên ĐVT quy đổi (VD: Thùng)"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '130px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  background: '#ffffff',
                }}
              />
              <span style={{ fontSize: '13px', color: '#475569', fontWeight: '600' }}>=</span>
              <input
                type="number"
                step="any"
                min="0.001"
                placeholder="Hệ số (> 0)"
                value={newUnitRate}
                onChange={(e) => setNewUnitRate(e.target.value)}
                style={{
                  width: '120px',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  textAlign: 'left',
                  background: '#ffffff',
                }}
              />
              <span style={{ fontSize: '12.5px', color: '#475569', whiteSpace: 'nowrap' }}>{baseUnit}</span>
              <button
                type="button"
                onClick={handleAddUnit}
                style={{
                  background: '#0fad89',
                  border: 'none',
                  color: '#ffffff',
                  padding: '7px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                + Thêm
              </button>
            </div>
          </div>

          {/* Nút tác vụ chân modal */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
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
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#0fad89',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(15, 173, 137, 0.3)',
              }}
            >
              {isSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  );
};
