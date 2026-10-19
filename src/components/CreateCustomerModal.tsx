import React, { useState, useRef } from 'react';
import { CustomerCreatePayload, CustomerCreateResponse, createCustomerApi } from '../services/api';
import { ModalPortal } from './ModalPortal';
import { emitStatusToast } from './StatusToast';


interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSuccess?: (message: string) => void;
}

const AVAILABLE_ROLES = [
  { role: 'sales_manager', title: 'Quản lý kinh doanh', badgeColor: '#8b5cf6', desc: 'Quản lý bán hàng, báo cáo, giá vốn & biên lợi nhuận' },
  { role: 'warehouse_manager', title: 'Quản lý kho', badgeColor: '#059669', desc: 'Giám sát điều phối hàng hóa kho vận, duyệt phiếu kho' },
  { role: 'sales', title: 'Nhân viên kinh doanh', badgeColor: '#3b82f6', desc: 'Tạo đơn hàng, tra cứu tồn kho' },
  { role: 'warehouse', title: 'Thủ kho', badgeColor: '#10b981', desc: 'Thực hiện nhập, xuất, kiểm đếm kho' },
  { role: 'accountant', title: 'Kế toán công nợ', badgeColor: '#f59e0b', desc: 'Quản lý công nợ, hóa đơn, sổ quỹ' },
  { role: 'customer', title: 'Đại lý', badgeColor: '#0284c7', desc: 'Khách hàng đại lý sỉ đặt hàng qua hệ thống' },
];

const BRANCH_LIST = [
  'Kho Tổng Hà Nội',
  'Kho Chi Nhánh Đà Nẵng',
  'Kho Chi Nhánh TP. Hồ Chí Minh',
  'Toàn quốc',
  'Khu vực Miền Bắc',
  'Khu vực Miền Trung',
  'Khu vực Miền Nam',
  'Trụ sở chính',
];

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  token,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CustomerCreatePayload>({
    full_name: '',
    email: '',
    phone: '',
    username: '',
    branch: 'Toàn quốc',
  });
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['sales_manager']);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createdResult, setCreatedResult] = useState<CustomerCreateResponse | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const handleModalClose = () => {
    setCreatedResult(null);
    setCopiedCode(false);
    setCopiedAll(false);
    onClose();
  };

  if (!isOpen) return null;

  const triggerError = (msg: string) => {
    emitStatusToast({
      title: 'Thông báo hệ thống',
      message: msg,
      type: 'warning',
    });
  };

  const isWarehouseRole = (roles: string[]) => roles.some((r) => r === 'warehouse' || r === 'warehouse_manager');
  const isSpecificWarehouse = (branch: string) => {
    const b = (branch || '').toLowerCase();
    return b.includes('kho') && (b.includes('hà nội') || b.includes('đà nẵng') || b.includes('hồ chí minh'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = formData.full_name.trim();
    if (!trimmedName) {
      triggerError('Vui lòng nhập Họ và tên nhân viên.');
      return;
    }

    // Ràng buộc họ và tên phải bằng chữ cái, không được chứa số
    if (/\d/.test(trimmedName)) {
      triggerError('Họ và tên không hợp lệ! Vui lòng chỉ nhập chữ cái, không được chứa chữ số.');
      return;
    }

    const vietnameseNameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s\.\'\-]+$/;
    if (!vietnameseNameRegex.test(trimmedName)) {
      triggerError('Họ và tên không hợp lệ! Vui lòng chỉ nhập các chữ cái tiếng Việt hoặc tiếng Anh, không nhập số hay ký tự đặc biệt.');
      return;
    }

    if (!formData.email.trim()) {
      triggerError('Vui lòng nhập địa chỉ Email.');
      return;
    }
    if (!formData.phone.trim()) {
      triggerError('Vui lòng nhập số điện thoại liên hệ.');
      return;
    }

    // Chuẩn hóa và kiểm tra số điện thoại Việt Nam hợp lệ
    let cleanPhone = formData.phone.trim().replace(/[\s\.\-\(\)]/g, '');
    if (cleanPhone.startsWith('+84')) {
      cleanPhone = '0' + cleanPhone.slice(3);
    } else if (cleanPhone.startsWith('84') && cleanPhone.length === 11) {
      cleanPhone = '0' + cleanPhone.slice(2);
    }

    // Định dạng: 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09 (hoặc máy bàn 11 số bắt đầu 02)
    const vnPhoneRegex = /^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$/;
    if (!vnPhoneRegex.test(cleanPhone)) {
      triggerError('Số điện thoại không hợp lệ! Vui lòng nhập đúng số điện thoại (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09. Ví dụ: 0987654321 hoặc +84987654321).');
      return;
    }

    if (selectedRoles.length === 0) {
      triggerError('Vui lòng chọn ít nhất một vai trò hệ thống cho tài khoản.');
      return;
    }

    // Ràng buộc vai trò kho
    const chosenBranch = (formData.branch || 'Toàn quốc').trim();
    if (isWarehouseRole(selectedRoles) && !isSpecificWarehouse(chosenBranch)) {
      triggerError('Người dùng có vai trò Kho (Quản lý kho / Thủ kho) bắt buộc phải gắn với ít nhất 1 kho cụ thể (Ví dụ: Kho Tổng Hà Nội, Kho Chi Nhánh Đà Nẵng, Kho Chi Nhánh TP. Hồ Chí Minh).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCustomerApi(token, {
        full_name: trimmedName,
        email: formData.email.trim(),
        phone: cleanPhone,
        username: formData.username?.trim() || undefined,
        role: selectedRoles[0],
        roles: selectedRoles,
        branch: chosenBranch,
      });

      const successMsg = `✅ ${res.message} Tài khoản: "${res.user.username}" (${res.user.full_name})`;

      // Phát sự kiện đồng bộ toàn hệ thống để trang Phân quyền lập tức cập nhật người dùng mới và hiển thị thông báo
      window.dispatchEvent(
        new CustomEvent('USER_ACCOUNTS_CHANGED', {
          detail: { username: res.user.username, message: successMsg },
        })
      );

      if (onSuccess) {
        onSuccess(successMsg);
      }
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        username: '',
        branch: 'Toàn quốc',
      });
      setSelectedRoles(['sales_manager']);
      setCreatedResult(res);
    } catch (err: any) {
      emitStatusToast({
        title: 'Thông báo hệ thống',
        message: err.message || 'Lỗi khi tạo tài khoản.',
        type: 'error',
      });
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
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '24px 16px',
          boxSizing: 'border-box',
          overflowY: 'auto',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleModalClose();
          }
        }}
      >
        <div
          ref={modalRef}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: 'min(680px, calc(100vh - 48px))',
            margin: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflowY: 'auto',
            color: '#0f172a',
            animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header Modal */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: createdResult ? '#f0fdf4' : '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: createdResult ? '#dcfce7' : '#ecfdf5',
                border: `1px solid ${createdResult ? '#86efac' : '#a7f3d0'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
              }}
            >
              {createdResult ? '✓' : '✉️'}
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                {createdResult ? 'Tạo Tài Khoản & Cấp Mã Thành Công' : 'Tạo Tài Khoản & Phân Vai Trò'}
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {createdResult
                  ? 'Mã đăng nhập tạm thời đã được tạo và lưu trữ an toàn'
                  : 'Gán vai trò quản lý / nhân viên và tự sinh mật khẩu gửi qua Email'}
              </span>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748b',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
            title="Đóng modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body: Success Screen OR Form Create Customer */}
        {createdResult ? (
          <div style={{ padding: '24px' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  margin: '0 auto 10px auto',
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
                }}
              >
                ✓
              </div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                Khởi Tạo Tài Khoản Thành Công!
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Hệ thống đã cấp mã đăng nhập tạm thời cho tài khoản này.
              </p>
            </div>

            {/* Thẻ mã đăng nhập / Mật khẩu nổi bật */}
            <div
              style={{
                background: '#0f172a',
                borderRadius: '12px',
                padding: '16px 18px',
                border: '1px solid #334155',
                marginBottom: '16px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11.5px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '700' }}>
                  Mã đăng nhập / Mật khẩu tạm thời
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const code = createdResult.temporary_password || createdResult.activation_code || '';
                    if (code) {
                      navigator.clipboard.writeText(code);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    }
                  }}
                  style={{
                    background: copiedCode ? '#16a34a' : 'rgba(255, 255, 255, 0.15)',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    color: '#ffffff',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copiedCode ? '✓ Đã sao chép' : '📋 Sao chép mã'}
                </button>
              </div>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '22px',
                  fontWeight: '800',
                  color: '#38bdf8',
                  letterSpacing: '1.5px',
                  userSelect: 'all',
                  wordBreak: 'break-all',
                }}
              >
                {createdResult.temporary_password || createdResult.activation_code || '******'}
              </div>
            </div>

            {/* Chi tiết tài khoản */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 18px',
                marginBottom: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '13px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Tên đăng nhập:</span>
                <span style={{ fontWeight: '700', color: '#0f172a', fontFamily: 'monospace' }}>
                  {createdResult.user.username}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Họ và tên:</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{createdResult.user.full_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Vai trò hệ thống:</span>
                <span style={{ fontWeight: '600', color: '#0284c7' }}>
                  {createdResult.user.role_title || createdResult.user.role}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Email:</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{createdResult.user.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Số điện thoại:</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{createdResult.user.phone || 'Chưa cập nhật'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Kho / Chi nhánh:</span>
                <span style={{ fontWeight: '600', color: '#0f172a' }}>{createdResult.user.branch || 'Toàn quốc'}</span>
              </div>
            </div>

            {/* Trạng thái gửi Email */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '12.5px',
                marginBottom: '20px',
                lineHeight: '1.5',
                background: createdResult.email_sent ? '#ecfdf5' : '#fffbeb',
                border: `1px solid ${createdResult.email_sent ? '#a7f3d0' : '#fde68a'}`,
                color: createdResult.email_sent ? '#065f46' : '#92400e',
              }}
            >
              {createdResult.email_sent ? (
                <div>
                  <strong>✉️ Đã gửi mã đăng nhập qua email:</strong> Thư tự động đã gửi tới{' '}
                  <strong>{createdResult.user.email}</strong>.
                  <div style={{ fontSize: '11.5px', marginTop: '3px', opacity: 0.9 }}>
                    (Nhắc nhân sự kiểm tra cả thư mục <em>Spam / Thư rác</em> nếu chưa thấy trong Hộp thư đến).
                  </div>
                </div>
              ) : (
                <div>
                  <strong>⚠️ Chưa thể gửi email tự động qua SMTP:</strong>
                  <div style={{ fontSize: '11.5px', marginTop: '3px' }}>
                    Vui lòng sao chép mã đăng nhập ở trên và bàn giao trực tiếp cho nhân sự qua Zalo / Tin nhắn.
                  </div>
                </div>
              )}
            </div>

            {/* Nút thao tác */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '10px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  const content = `HỆ THỐNG QUẢN LÝ BÁN HÀNG & KHO\nThông tin tài khoản:\n- Tên đăng nhập: ${createdResult.user.username}\n- Họ tên: ${createdResult.user.full_name} (${createdResult.user.role_title || createdResult.user.role})\n- Email: ${createdResult.user.email || '—'}\n- SĐT: ${createdResult.user.phone || 'Chưa cập nhật'}\n- Mã đăng nhập / Mật khẩu: ${createdResult.temporary_password || createdResult.activation_code || ''}\n- Link đăng nhập: ${window.location.origin}`;
                  navigator.clipboard.writeText(content);
                  setCopiedAll(true);
                  setTimeout(() => setCopiedAll(false), 2000);
                }}
                style={{
                  background: copiedAll ? '#047857' : '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '9px 14px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                {copiedAll ? '✓ Đã sao chép tất cả' : '📋 Sao chép thông tin'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setCreatedResult(null);
                  setFormData({
                    full_name: '',
                    email: '',
                    phone: '',
                    username: '',
                    branch: 'Toàn quốc',
                  });
                  setSelectedRoles(['sales_manager']);
                }}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  padding: '9px 14px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                + Tạo thêm tài khoản
              </button>

              <button
                type="button"
                onClick={handleModalClose}
                style={{
                  background: 'linear-gradient(135deg, #0fba90, #0fad89)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '9px 18px',
                  fontSize: '12.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(15, 186, 144, 0.3)',
                }}
              >
                Hoàn tất & Đóng
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Họ và tên */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Họ và tên nhân viên <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Trần Thị Mai"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Chỉ nhập chữ cái tiếng Việt hoặc tiếng Anh, không chứa chữ số.
              </span>
            </div>

            {/* Email & Số điện thoại */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Email nhận tài khoản <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="mai.tran@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#334155',
                    marginBottom: '6px',
                  }}
                >
                  Số điện thoại <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0987654321"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Chọn Vai trò hệ thống */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                  Vai trò quản lý / hệ thống <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Đã chọn: <strong style={{ color: '#2563eb' }}>{selectedRoles.length}</strong> vai trò
                </span>
              </div>

              {/* Tag hiển thị các vai trò đang chọn */}
              <div
                onClick={() => setIsRoleDropdownOpen((prev) => !prev)}
                style={{
                  width: '100%',
                  minHeight: '42px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: `1.5px solid ${isRoleDropdownOpen ? '#2563eb' : '#cbd5e1'}`,
                  background: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  boxShadow: isRoleDropdownOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', flex: 1 }}>
                  {selectedRoles.length > 0 ? (
                    selectedRoles.map((rCode) => {
                      const rObj = AVAILABLE_ROLES.find((item) => item.role === rCode);
                      const color = rObj?.badgeColor || '#2563eb';
                      const title = rObj?.title || rCode;
                      return (
                        <span
                          key={rCode}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: `${color}15`,
                            border: `1px solid ${color}40`,
                            color: color,
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '2px 8px',
                            borderRadius: '6px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                          {title}
                          <span
                            title="Bỏ chọn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRoles((prev) => prev.filter((code) => code !== rCode));
                            }}
                            style={{ cursor: 'pointer', marginLeft: '3px', fontWeight: 'bold', fontSize: '13px' }}
                          >
                            ×
                          </span>
                        </span>
                      );
                    })
                  ) : (
                    <span style={{ color: '#94a3b8', fontSize: '13.5px' }}>
                      Bấm để chọn vai trò cho tài khoản...
                    </span>
                  )}
                </div>

                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    transform: isRoleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    flexShrink: 0,
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Danh sách Dropdown vai trò */}
              {isRoleDropdownOpen && (
                <div
                  style={{
                    marginTop: '6px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    boxShadow: '0 10px 20px rgba(0,0,0,0.08)',
                    maxHeight: '210px',
                    overflowY: 'auto',
                    padding: '6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    zIndex: 10,
                  }}
                >
                  {AVAILABLE_ROLES.map((r) => {
                    const isChecked = selectedRoles.includes(r.role);
                    return (
                      <label
                        key={r.role}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isChecked ? `${r.badgeColor}10` : 'transparent',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isChecked) e.currentTarget.style.background = '#f8fafc';
                        }}
                        onMouseLeave={(e) => {
                          if (!isChecked) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedRoles((prev) => prev.filter((x) => x !== r.role));
                            } else {
                              setSelectedRoles((prev) => [...prev, r.role]);
                            }
                          }}
                          style={{ width: '16px', height: '16px', accentColor: r.badgeColor, cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: r.badgeColor }}>
                              {r.title}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '1px' }}>
                            {r.desc}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Chi nhánh / Kho / Địa bàn */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Chi nhánh / Kho / Địa bàn phụ trách <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <select
                value={formData.branch || 'Toàn quốc'}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              >
                {BRANCH_LIST.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px', display: 'block' }}>
                Lưu ý: Nếu phân vai trò Quản lý kho / Thủ kho, bắt buộc chọn 1 kho cụ thể (Hà Nội, Đà Nẵng hoặc TP.HCM).
              </span>
            </div>

            {/* Tùy chọn Tên đăng nhập (Username) */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#334155',
                  marginBottom: '6px',
                }}
              >
                Tên đăng nhập mong muốn{' '}
                <span style={{ color: '#64748b', fontWeight: 'normal' }}>
                  (Để trống hệ thống sẽ tự sinh)
                </span>
              </label>
              <input
                type="text"
                placeholder="Để trống nếu muốn tự động tạo theo email"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Thông báo nghiệp vụ */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#1d4ed8',
                lineHeight: '1.5',
              }}
            >
              ℹ️ Hệ thống sẽ cấp một mật khẩu tạm thời ngẫu nhiên (14 ký tự), gán đúng vai trò đã chọn và kích hoạt tài khoản ngay. Mật khẩu và thông tin đăng nhập sẽ được tự động gửi vào email nhân viên.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
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
              id="btn-submit-customer"
              style={{
                background: 'linear-gradient(135deg, #0fba90, #0fad89)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 6px rgba(15, 186, 144, 0.3)',
              }}
            >
              {isSubmitting ? 'Đang tạo & gửi mail...' : 'Tạo tài khoản & Gửi Email'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
    </ModalPortal>
  );
};
export default CreateCustomerModal;
