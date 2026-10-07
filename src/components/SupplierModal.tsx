import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Supplier, createSupplierApi, updateSupplierApi } from '../services/api';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  /** Có giá trị = đang SỬA nhà cung cấp đó. null/undefined = THÊM MỚI. */
  supplier?: Supplier | null;
  onSuccess: (message: string) => void;
}

// Quy tắc phải khớp với backend (suppliers.py)
const CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{1,29}$/;
const TAX_REGEX = /^\d{10}(-?\d{3})?$/;

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: '600',
  color: '#334155',
  marginBottom: '6px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '14px',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s, background-color 0.2s',
};

const hintStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11.5px',
  color: '#64748b',
  marginTop: '4px',
};

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  token,
  supplier,
  onSuccess,
}) => {
  const isEdit = !!supplier;

  const [form, setForm] = useState({
    code: '',
    name: '',
    tax_code: '',
    contact_person: '',
    payment_terms: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<'code' | 'name' | 'tax_code' | 'contact_person' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs để điều khiển cuộn trang và tự động focus vào trường lỗi
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const taxCodeRef = useRef<HTMLInputElement>(null);
  const contactPersonRef = useRef<HTMLInputElement>(null);

  // Mỗi lần mở modal: nạp lại dữ liệu (sửa) hoặc làm trống (thêm mới)
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setInvalidField(null);
    setIsSubmitting(false);
    setForm({
      code: supplier?.code || '',
      name: supplier?.name || '',
      tax_code: supplier?.tax_code || '',
      contact_person: supplier?.contact_person || '',
      payment_terms: supplier?.payment_terms || '',
    });
  }, [isOpen, supplier]);

  if (!isOpen) return null;

  // Hàm kích hoạt nhảy lên đầu form khi có thông tin không hợp lệ
  const triggerValidationError = (
    msg: string,
    field?: 'code' | 'name' | 'tax_code' | 'contact_person'
  ) => {
    setError(msg);
    setInvalidField(field || null);

    // 1. Tự động nhảy / cuộn mượt mà lên đỉnh modal/form
    if (formRef.current) {
      formRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // 2. Đảm bảo khung thông báo lỗi lọt vào tầm nhìn
    setTimeout(() => {
      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      // 3. Tự động focus vào trường chưa hợp lệ
      if (field === 'code' && codeRef.current) codeRef.current.focus();
      else if (field === 'name' && nameRef.current) nameRef.current.focus();
      else if (field === 'tax_code' && taxCodeRef.current) taxCodeRef.current.focus();
      else if (field === 'contact_person' && contactPersonRef.current) contactPersonRef.current.focus();
    }, 80);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInvalidField(null);

    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();
    const taxCode = form.tax_code.trim().replace(/\s/g, '');

    if (!isEdit && !CODE_REGEX.test(code)) {
      triggerValidationError(
        'Mã nhà cung cấp chỉ gồm chữ cái, chữ số, dấu gạch ngang hoặc gạch dưới, dài 2 đến 30 ký tự (ví dụ: NCC001).',
        'code'
      );
      return;
    }
    if (name.length < 2) {
      triggerValidationError('Tên nhà cung cấp phải có ít nhất 2 ký tự.', 'name');
      return;
    }
    if (!taxCode) {
      triggerValidationError('Vui lòng nhập mã số thuế.', 'tax_code');
      return;
    }
    if (taxCode && !TAX_REGEX.test(taxCode)) {
      triggerValidationError(
        `Mã số thuế không hợp lệ (hiện có ${taxCode.length} ký tự). Nhập 10 chữ số (doanh nghiệp) hoặc 13 chữ số (chi nhánh, ví dụ: 0123456789 hoặc 0123456789-001).`,
        'tax_code'
      );
      return;
    }

    const contactPerson = form.contact_person.trim();
    if (!isEdit && !contactPerson) {
      triggerValidationError('Vui lòng nhập người liên hệ.', 'contact_person');
      return;
    }

    const payload = {
      name,
      tax_code: taxCode,
      contact_person: contactPerson || null,
      payment_terms: form.payment_terms.trim() || null,
    };

    setIsSubmitting(true);
    try {
      if (isEdit && supplier) {
        const res = await updateSupplierApi(token, supplier.code, payload);
        onSuccess(`✅ Đã cập nhật nhà cung cấp "${res.name}" (${res.code}).`);
      } else {
        const res = await createSupplierApi(token, { code, ...payload });
        onSuccess(`✅ Đã thêm nhà cung cấp "${res.name}" (${res.code}).`);
      }
      onClose();
    } catch (err: any) {
      triggerValidationError(err.message || 'Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
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
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden',
          color: '#0f172a',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
            flexShrink: 0,
          }}
        >
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
              {isEdit ? 'Sửa Thông Tin Nhà Cung Cấp' : 'Thêm Nhà Cung Cấp'}
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {isEdit ? `Mã nhà cung cấp: ${supplier?.code}` : 'Khai báo nguồn hàng để gắn vào phiếu nhập kho'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            title="Đóng"
            style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} onSubmit={handleSubmit} style={{ padding: '22px 24px', overflowY: 'auto' }}>
          {error && (
            <div
              ref={errorRef}
              style={{
                background: '#fef2f2',
                border: '1.5px solid #f87171',
                color: '#991b1b',
                padding: '12px 16px',
                borderRadius: '12px',
                fontSize: '13.5px',
                marginBottom: '18px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '13.5px', marginBottom: '2px', color: '#b91c1c' }}>
                  Thông tin chưa hợp lệ:
                </strong>
                <div>{error}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Mã nhà cung cấp: chỉ nhập khi thêm mới, khi sửa thì khoá */}
            <div>
              <label style={labelStyle}>
                Mã nhà cung cấp {!isEdit && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <input
                ref={codeRef}
                type="text"
                value={form.code}
                disabled={isEdit || isSubmitting}
                maxLength={30}
                placeholder="Ví dụ: NCC001"
                onChange={(e) => {
                  setForm({ ...form, code: e.target.value.toUpperCase() });
                  if (invalidField === 'code') setInvalidField(null);
                }}
                onClick={() => {
                  if (invalidField === 'code') formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  ...inputStyle,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  borderColor: invalidField === 'code' ? '#ef4444' : '#cbd5e1',
                  background: isEdit ? '#f8fafc' : invalidField === 'code' ? '#fff5f5' : '#ffffff',
                  boxShadow: invalidField === 'code' ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                  color: isEdit ? '#64748b' : '#0f172a',
                  cursor: isEdit ? 'not-allowed' : 'text',
                }}
              />
              {invalidField === 'code' && (
                <span
                  onClick={() => formRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  style={{ display: 'block', fontSize: '12px', color: '#ef4444', fontWeight: '600', marginTop: '4px', cursor: 'pointer' }}
                >
                  ⚠️ Mã nhà cung cấp không hợp lệ (bấm để xem thông báo trên đầu)
                </span>
              )}
              <span style={hintStyle}>
                {isEdit ? 'Mã nhà cung cấp cố định, không thể thay đổi.' : 'Duy nhất trong hệ thống, tự chuyển thành chữ hoa.'}
              </span>
            </div>

            {/* Tên */}
            <div>
              <label style={labelStyle}>
                Tên nhà cung cấp <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={form.name}
                disabled={isSubmitting}
                maxLength={255}
                placeholder="Ví dụ: Công ty TNHH May Mặc Á Châu"
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (invalidField === 'name') setInvalidField(null);
                }}
                onClick={() => {
                  if (invalidField === 'name') formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  ...inputStyle,
                  borderColor: invalidField === 'name' ? '#ef4444' : '#cbd5e1',
                  background: invalidField === 'name' ? '#fff5f5' : '#ffffff',
                  boxShadow: invalidField === 'name' ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                }}
              />
              {invalidField === 'name' && (
                <span
                  onClick={() => formRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  style={{ display: 'block', fontSize: '12px', color: '#ef4444', fontWeight: '600', marginTop: '4px', cursor: 'pointer' }}
                >
                  ⚠️ Tên nhà cung cấp quá ngắn (bấm để xem thông báo trên đầu)
                </span>
              )}
            </div>

            {/* Mã số thuế */}
            <div>
              <label style={labelStyle}>
                Mã số thuế <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                ref={taxCodeRef}
                type="text"
                value={form.tax_code}
                disabled={isSubmitting}
                maxLength={20}
                placeholder="10 hoặc 13 chữ số"
                onChange={(e) => {
                  setForm({ ...form, tax_code: e.target.value });
                  if (invalidField === 'tax_code') setInvalidField(null);
                }}
                onClick={() => {
                  if (invalidField === 'tax_code') formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  ...inputStyle,
                  borderColor: invalidField === 'tax_code' ? '#ef4444' : '#cbd5e1',
                  background: invalidField === 'tax_code' ? '#fff5f5' : '#ffffff',
                  boxShadow: invalidField === 'tax_code' ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                }}
              />
              {invalidField === 'tax_code' && (
                <span
                  onClick={() => formRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  style={{ display: 'block', fontSize: '12px', color: '#ef4444', fontWeight: '600', marginTop: '4px', cursor: 'pointer' }}
                >
                  ⚠️ Mã số thuế chưa đúng định dạng (bấm để xem hướng dẫn trên đầu)
                </span>
              )}
              <span style={hintStyle}>Bắt buộc. Không được trùng với nhà cung cấp khác.</span>
            </div>

            {/* Người liên hệ */}
            <div>
              <label style={labelStyle}>
                Người liên hệ {!isEdit && <span style={{ color: '#ef4444' }}>*</span>}
              </label>
              <input
                ref={contactPersonRef}
                type="text"
                value={form.contact_person}
                disabled={isSubmitting}
                maxLength={255}
                placeholder="Họ tên người phụ trách bên nhà cung cấp"
                onChange={(e) => {
                  setForm({ ...form, contact_person: e.target.value });
                  if (invalidField === 'contact_person') setInvalidField(null);
                }}
                onClick={() => {
                  if (invalidField === 'contact_person') formRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                style={{
                  ...inputStyle,
                  borderColor: invalidField === 'contact_person' ? '#ef4444' : '#cbd5e1',
                  background: invalidField === 'contact_person' ? '#fff5f5' : '#ffffff',
                  boxShadow: invalidField === 'contact_person' ? '0 0 0 3px rgba(239, 68, 68, 0.15)' : 'none',
                }}
              />
              {invalidField === 'contact_person' && (
                <span
                  onClick={() => formRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                  style={{ display: 'block', fontSize: '12px', color: '#ef4444', fontWeight: '600', marginTop: '4px', cursor: 'pointer' }}
                >
                  ⚠️ Vui lòng nhập người liên hệ (bấm để xem thông báo trên đầu)
                </span>
              )}
              {!isEdit && <span style={hintStyle}>Bắt buộc khi thêm mới nhà cung cấp.</span>}
            </div>

            {/* Điều khoản thanh toán */}
            <div>
              <label style={labelStyle}>Điều khoản thanh toán</label>
              <input
                type="text"
                value={form.payment_terms}
                disabled={isSubmitting}
                maxLength={255}
                placeholder="Ví dụ: Thanh toán sau 30 ngày kể từ ngày nhận hàng"
                onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Nút hành động */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                color: '#475569',
                padding: '10px 18px',
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
                background: 'linear-gradient(135deg, #0fba90, #0fad89)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 24px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(15, 173, 137, 0.3)',
              }}
            >
              {isSubmitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm nhà cung cấp'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default SupplierModal;