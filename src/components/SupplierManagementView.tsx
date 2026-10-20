import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  Supplier,
  getSuppliersApi,
  createSupplierApi,
  deactivateSupplierApi,
  activateSupplierApi,
  deleteSupplierApi,
} from '../services/api';
import SupplierModal from './SupplierModal';
import { emitStatusToast } from './StatusToast';
import { ModalPortal } from './ModalPortal';

interface SupplierManagementViewProps {
  token: string;
  onBackToHome?: () => void;
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '12px',
  boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
};

const thStyle: React.CSSProperties = { padding: '14px 16px', fontWeight: '700', textAlign: 'left' };
const tdStyle: React.CSSProperties = { padding: '14px 16px', verticalAlign: 'middle', color: '#334155' };

const controlStyle: React.CSSProperties = {
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '13.5px',
  outline: 'none',
};


export const SupplierManagementView: React.FC<SupplierManagementViewProps> = ({ token, onBackToHome: _onBackToHome }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  // Tìm kiếm, lọc, phân trang
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const paginationContainerRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef<{ page: number; top: number; bottom: number } | null>(null);

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage) return;
    if (paginationContainerRef.current) {
      const rect = paginationContainerRef.current.getBoundingClientRect();
      scrollOffsetRef.current = { page: newPage, top: rect.top, bottom: rect.bottom };
    }
    setCurrentPage(newPage);
  };

  useLayoutEffect(() => {
    if (!scrollOffsetRef.current || scrollOffsetRef.current.page !== currentPage) return;
    const { top: targetTop } = scrollOffsetRef.current;
    scrollOffsetRef.current = null;

    if (!paginationContainerRef.current) return;

    // Tìm đúng container cuộn thực sự (chứa overflow-y và scrollHeight > clientHeight)
    let scrollParent: HTMLElement | null = paginationContainerRef.current.closest('main');
    if (!scrollParent || scrollParent.scrollHeight <= scrollParent.clientHeight) {
      let p = paginationContainerRef.current.parentElement;
      while (p) {
        if (p.scrollHeight > p.clientHeight) {
          const s = window.getComputedStyle(p);
          if (s.overflowY === 'auto' || s.overflowY === 'scroll') {
            scrollParent = p;
            break;
          }
        }
        p = p.parentElement;
      }
    }

    const currentTop = paginationContainerRef.current.getBoundingClientRect().top;
    const delta = currentTop - targetTop;

    if (Math.abs(delta) > 0.5) {
      if (scrollParent) {
        scrollParent.scrollTop += delta;
      } else {
        window.scrollBy({ top: delta, behavior: 'instant' });
      }
    }

    // Đảm bảo khối phân trang luôn nằm trọn vẹn trong tầm nhìn, không bị tràn mất xuống dưới
    const finalRect = paginationContainerRef.current.getBoundingClientRect();
    if (finalRect.bottom > window.innerHeight) {
      const overflowDown = finalRect.bottom - window.innerHeight;
      if (scrollParent) {
        scrollParent.scrollTop += overflowDown;
      } else {
        window.scrollBy({ top: overflowDown, behavior: 'instant' });
      }
    }
  }, [currentPage]);

  // Modal thêm / sửa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreatePageOpen, setIsCreatePageOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Dropdown 3 chấm (Action Menu) theo từng hàng
  const [dropdownMenu, setDropdownMenu] = useState<{
    supplier: Supplier;
    rect: DOMRect;
    openUpward: boolean;
  } | null>(null);

  // Đóng dropdown khi click ra ngoài, cuộn trang hoặc bấm Escape
  useEffect(() => {
    if (!dropdownMenu) return;
    const handleScrollOrResize = () => setDropdownMenu(null);
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.supplier-action-menu-portal') && !target.closest('.supplier-action-dropdown-btn')) {
        setDropdownMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownMenu(null);
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dropdownMenu]);

  // Form tạo nhà cung cấp mới trên trang riêng
  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    tax_code: '',
    contact_person: '',
    payment_terms: '',
  });
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);

  // Popup xác nhận ngừng giao dịch
  const [supplierToDeactivate, setSupplierToDeactivate] = useState<Supplier | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Popup xác nhận mở lại giao dịch
  const [supplierToActivate, setSupplierToActivate] = useState<Supplier | null>(null);
  const [isActivating, setIsActivating] = useState(false);

  // Popup xác nhận xóa nhà cung cấp
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getSuppliersApi(token);
      setSuppliers(res.items);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách nhà cung cấp.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return suppliers.filter((s) => {
      const matchStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? s.is_active : !s.is_active);
      const matchSearch =
        !term ||
        [s.code, s.name, s.tax_code, s.contact_person].some((v) => (v || '').toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });
  }, [suppliers, searchTerm, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filteredSuppliers.slice(startIndex, startIndex + pageSize);
  const activeCount = suppliers.filter((s) => s.is_active).length;

  const openCreate = () => {
    setCreateForm({
      code: '',
      name: '',
      tax_code: '',
      contact_person: '',
      payment_terms: '',
    });
    setCreateFormError(null);
    setIsCreatePageOpen(true);
  };

  const handleCloseCreatePage = () => {
    setIsCreatePageOpen(false);
    setCreateFormError(null);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFormError(null);

    const CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{1,29}$/;
    const TAX_REGEX = /^\d{10}(-?\d{3})?$/;

    const code = createForm.code.trim().toUpperCase();
    const name = createForm.name.trim();
    const taxCode = createForm.tax_code.trim().replace(/\s/g, '');

    if (!CODE_REGEX.test(code)) {
      setCreateFormError(
        'Mã nhà cung cấp chỉ gồm chữ cái, chữ số, dấu gạch ngang hoặc gạch dưới, dài 2 đến 30 ký tự (ví dụ: NCC001).'
      );
      return;
    }
    if (name.length < 2) {
      setCreateFormError('Tên nhà cung cấp phải có ít nhất 2 ký tự.');
      return;
    }
    if (!taxCode) {
      setCreateFormError('Vui lòng nhập mã số thuế.');
      return;
    }
    if (!TAX_REGEX.test(taxCode)) {
      setCreateFormError(
        `Mã số thuế không hợp lệ (hiện có ${taxCode.length} ký tự). Nhập 10 chữ số (doanh nghiệp) hoặc 13 chữ số (chi nhánh, ví dụ: 0123456789 hoặc 0123456789-001).`
      );
      return;
    }

    const contactPerson = createForm.contact_person.trim();
    if (!contactPerson) {
      setCreateFormError('Vui lòng nhập người liên hệ.');
      return;
    }

    const payload = {
      code,
      name,
      tax_code: taxCode,
      contact_person: contactPerson || null,
      payment_terms: createForm.payment_terms.trim() || null,
    };

    setIsCreateSubmitting(true);
    try {
      const res = await createSupplierApi(token, payload);
      emitStatusToast({ message: `✅ Đã thêm nhà cung cấp "${res.name}" (${res.code}).` });
      setIsCreatePageOpen(false);
      loadSuppliers();
    } catch (err: any) {
      setCreateFormError(err.message || 'Có lỗi xảy ra khi thêm nhà cung cấp.');
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  const openEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setIsModalOpen(true);
  };

  const handleModalSuccess = (message: string) => {
    emitStatusToast({ message });
    loadSuppliers();
  };

  const openDeactivate = (s: Supplier) => {
    setSupplierToDeactivate(s);
    setDeactivateReason('');
    setActionError(null);
  };

  const confirmDeactivate = async () => {
    if (!supplierToDeactivate) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      const res = await deactivateSupplierApi(token, supplierToDeactivate.code, deactivateReason);
      emitStatusToast({ message: `Đã ngừng giao dịch với nhà cung cấp "${res.name}" (${res.code}).` });
      setSupplierToDeactivate(null);
      loadSuppliers();
    } catch (err: any) {
      setActionError(err.message || 'Không thể ngừng giao dịch nhà cung cấp này.');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await deleteSupplierApi(token, supplierToDelete.code);
      emitStatusToast({ message: res.message || `Đã xóa nhà cung cấp "${supplierToDelete.name}" thành công.` });
      setSupplierToDelete(null);
      loadSuppliers();
    } catch (err: any) {
      setDeleteError(err.message || 'Không thể xóa nhà cung cấp này.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openActivate = (s: Supplier) => {
    setSupplierToActivate(s);
  };

  const confirmActivate = async () => {
    if (!supplierToActivate) return;
    setIsActivating(true);
    setError(null);
    try {
      const res = await activateSupplierApi(token, supplierToActivate.code);
      emitStatusToast({ message: `Đã mở lại giao dịch với nhà cung cấp "${res.name}" (${res.code}).` });
      setSupplierToActivate(null);
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || 'Không thể mở lại giao dịch nhà cung cấp này.');
    } finally {
      setIsActivating(false);
    }
  };


  // NẾU ĐANG Ở CHẾ ĐỘ TRANG THÊM NHÀ CUNG CẤP (FULL PAGE VIEW)
  if (isCreatePageOpen) {
    return (
      <div
        style={{
          width: '100%',
          maxWidth: '1680px',
          margin: '0 auto',
          padding: '16px 20px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          boxSizing: 'border-box',
          fontFamily: 'inherit',
        }}
      >
        {/* Header Breadcrumb & Nút Quay lại */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '10px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCloseCreatePage}
              style={{
                padding: '6px 16px',
                fontSize: '12.5px',
                fontWeight: '600',
                color: '#334155',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '9999px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Quay lại</span>
            </button>
            <span style={{ color: '#cbd5e1', fontSize: '15px' }}>/</span>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Thêm Nhà Cung Cấp
              </h2>
            </div>
          </div>
        </div>

        {/* Khối Card Form Thông Tin (Gọn gàng đúng kích thước bề ngang ảnh chụp) */}
        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px -2px rgba(15, 23, 42, 0.05)',
            padding: '20px 28px',
            boxSizing: 'border-box',
          }}
        >
          {/* Header Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '14px',
              paddingBottom: '12px',
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#ecfdf5',
                color: '#0fad89',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                Thông tin nhà cung cấp
              </h3>
            </div>
          </div>

          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
            {createFormError && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{createFormError}</span>
              </div>
            )}

            {/* Hàng 1: Mã NCC & Mã số thuế */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Mã nhà cung cấp <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: NCC001"
                  maxLength={30}
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value.toUpperCase() })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Mã số thuế <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="10 hoặc 13 chữ số"
                  maxLength={20}
                  value={createForm.tax_code}
                  onChange={(e) => setCreateForm({ ...createForm, tax_code: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Hàng 2: Tên nhà cung cấp */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                Tên nhà cung cấp <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Công ty TNHH May Mặc Á Châu"
                maxLength={255}
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13.5px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Hàng 3: Người liên hệ & Điều khoản thanh toán */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Người liên hệ <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Họ tên người phụ trách bên nhà cung cấp"
                  maxLength={255}
                  value={createForm.contact_person}
                  onChange={(e) => setCreateForm({ ...createForm, contact_person: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  Điều khoản thanh toán
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thanh toán sau 30 ngày kể từ ngày nhận hàng"
                  maxLength={255}
                  value={createForm.payment_terms}
                  onChange={(e) => setCreateForm({ ...createForm, payment_terms: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13.5px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div
              style={{
                marginTop: '16px',
                paddingTop: '20px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={handleCloseCreatePage}
                disabled={isCreateSubmitting}
                style={{
                  padding: '9px 24px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={isCreateSubmitting}
                style={{
                  padding: '9px 28px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: isCreateSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(15, 186, 144, 0.25)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: isCreateSubmitting ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {isCreateSubmitting ? (
                  <>
                    <svg
                      style={{ animation: 'spin 1s linear infinite' }}
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Thêm nhà cung cấp</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1680px',
        margin: '0 auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        gap: '12px',
        fontFamily: 'inherit',
      }}
    >
      {/* Tiêu đề + nút thêm (Đã bỏ khung hộp bao quanh) */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          padding: '4px 0',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Quản Lý Nhà Cung Cấp
          </h2>
        </div>
        <button
          type="button"
          onClick={openCreate}
          style={{
            background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
            border: 'none',
            borderRadius: '9px',
            color: '#ffffff',
            padding: '9px 18px',
            fontSize: '13.5px',
            fontWeight: '600',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(15, 173, 137, 0.3)',
          }}
        >
          Thêm nhà cung cấp
        </button>
      </div>

      
      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fecaca',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '10px',
            fontSize: '14px',
            flexShrink: 0,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Bảng danh sách (Gộp thanh tìm kiếm & lọc vào chung bảng) */}
      <div
        style={{
          ...cardStyle,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Thanh tìm kiếm + lọc (Gộp trên đỉnh bảng) */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
            background: '#ffffff',
          }}
        >
          <input
            type="text"
            placeholder="Tìm theo mã, tên, mã số thuế, người liên hệ..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{ ...controlStyle, minWidth: '300px', flex: 1, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: '500' }}>Trạng thái:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                setCurrentPage(1);
              }}
              style={{ ...controlStyle, cursor: 'pointer' }}
            >
              <option value="all">Tất cả ({suppliers.length})</option>
              <option value="active">Đang giao dịch ({activeCount})</option>
              <option value="inactive">Ngừng giao dịch ({suppliers.length - activeCount})</option>
            </select>
            <button
              type="button"
              onClick={() => {
                loadSuppliers();
                setCurrentPage(1);
              }}
              style={{
                ...controlStyle,
                marginTop: 0,
                fontWeight: '600',
                cursor: 'pointer',
                background: '#f8fafc',
              }}
            >
              Làm mới
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            ⏳ Đang tải danh sách nhà cung cấp...
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>
              {suppliers.length === 0 ? 'Chưa có nhà cung cấp nào' : 'Không tìm thấy nhà cung cấp phù hợp'}
            </div>
            <div style={{ fontSize: '13px', marginTop: '4px' }}>
              {suppliers.length === 0
                ? 'Bấm "Thêm nhà cung cấp" để khai báo nguồn hàng đầu tiên.'
                : 'Hãy thử đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.'}
            </div>
          </div>
        ) : (
          <>
            <div
              className="roles-grid-scroll"
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' }}>
                  <tr
                    style={{
                      color: '#64748b',
                      background: '#f8fafc',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    <th style={{ ...thStyle, width: '48px', textAlign: 'center', background: '#f8fafc' }}>STT</th>
                    <th style={{ ...thStyle, width: '85px', background: '#f8fafc' }}>Mã NCC</th>
                    <th style={{ ...thStyle, background: '#f8fafc' }}>Tên nhà cung cấp</th>
                    <th style={{ ...thStyle, width: '120px', background: '#f8fafc' }}>Mã số thuế</th>
                    <th style={{ ...thStyle, width: '130px', background: '#f8fafc' }}>Người liên hệ</th>
                    <th style={{ ...thStyle, width: '160px', background: '#f8fafc' }}>Điều khoản thanh toán</th>
                    <th style={{ ...thStyle, textAlign: 'center', width: '145px', whiteSpace: 'nowrap', background: '#f8fafc' }}>Trạng thái</th>
                    <th style={{ ...thStyle, textAlign: 'center', width: '80px', background: '#f8fafc' }}>Thao tác</th>
                  </tr>
                </thead>
              <tbody>
                {pageItems.map((s, idx) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: idx === pageItems.length - 1 ? 'none' : '1px solid #f1f5f9',
                      background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                      opacity: s.is_active ? 1 : 0.8,
                    }}
                  >
                    <td style={{ ...tdStyle, textAlign: 'center', color: '#64748b' }}>{startIndex + idx + 1}</td>
                    <td
                      style={{
                        ...tdStyle,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: '12.5px',
                        fontWeight: '700',
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {s.code}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                        <span style={{ lineHeight: 1.35 }}>{s.name}</span>
                        {s.has_receipts && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                sessionStorage.setItem('goods_receipt_search_query', s.name || s.code);
                                window.history.pushState({}, '', '/goods-receipt');
                                window.dispatchEvent(new Event('popstate'));
                              } catch { }
                            }}
                            title={`Bấm để xem lịch sử phiếu nhập kho của nhà cung cấp [${s.code}] ${s.name}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              color: '#1d4ed8',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              padding: '2px 8px',
                              borderRadius: '999px',
                              whiteSpace: 'nowrap',
                              lineHeight: '1.2',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(37, 99, 235, 0.08)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#dbeafe';
                              e.currentTarget.style.borderColor = '#93c5fd';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#eff6ff';
                              e.currentTarget.style.borderColor = '#bfdbfe';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <span>Đã có phiếu nhập</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '12.5px' }}>
                      {s.tax_code || <span style={{ color: '#94a3b8', fontFamily: 'inherit' }}>Không có</span>}
                    </td>
                    <td style={tdStyle}>{s.contact_person || <span style={{ color: '#94a3b8' }}>Không có</span>}</td>
                    <td style={{ ...tdStyle, maxWidth: '260px' }}>
                      {s.payment_terms || <span style={{ color: '#94a3b8' }}>Không có</span>}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {s.is_active ? (
                        <button
                          type="button"
                          onClick={() => openDeactivate(s)}
                          title="Bấm để ngừng giao dịch nhà cung cấp này"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: '#15803d',
                            background: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#bbf7d0';
                            e.currentTarget.style.borderColor = '#86efac';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#dcfce7';
                            e.currentTarget.style.borderColor = '#bbf7d0';
                            e.currentTarget.style.transform = 'none';
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                          Đang giao dịch
                        </button>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => openActivate(s)}
                            title="Bấm để mở lại giao dịch nhà cung cấp này"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              color: '#b91c1c',
                              background: '#fee2e2',
                              border: '1px solid #fecaca',
                              padding: '4px 12px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fecaca';
                              e.currentTarget.style.borderColor = '#fca5a5';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = '#fee2e2';
                              e.currentTarget.style.borderColor = '#fecaca';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                            Ngừng giao dịch
                          </button>
                          {s.inactive_reason && (
                            <span style={{ fontSize: '11.5px', color: '#64748b', maxWidth: '180px' }}>
                              Lý do: {s.inactive_reason}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center', position: 'relative' }}>
                      <div className="supplier-action-dropdown-container" style={{ display: 'inline-block' }}>
                        <button
                          type="button"
                          className="supplier-action-dropdown-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dropdownMenu?.supplier.id === s.id) {
                              setDropdownMenu(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              const openUpward = spaceBelow < 140;
                              setDropdownMenu({
                                supplier: s,
                                rect,
                                openUpward,
                              });
                            }
                          }}
                          title="Thao tác"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: dropdownMenu?.supplier.id === s.id ? '1px solid #0fad89' : '1px solid #cbd5e1',
                            background: dropdownMenu?.supplier.id === s.id ? '#ecfdf5' : '#ffffff',
                            color: dropdownMenu?.supplier.id === s.id ? '#0fad89' : '#64748b',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                          }}
                          onMouseEnter={(e) => {
                            if (dropdownMenu?.supplier.id !== s.id) {
                              e.currentTarget.style.background = '#f8fafc';
                              e.currentTarget.style.color = '#0f172a';
                              e.currentTarget.style.borderColor = '#94a3b8';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (dropdownMenu?.supplier.id !== s.id) {
                              e.currentTarget.style.background = '#ffffff';
                              e.currentTarget.style.color = '#64748b';
                              e.currentTarget.style.borderColor = '#cbd5e1';
                            }
                          }}
                        >
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', pointerEvents: 'none', margin: 'auto' }}>
                            <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                            <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                            <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                          </span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

            {/* Khối phân trang chuẩn giao diện liền thanh */}
            {filteredSuppliers.length > 0 && (
              <div
                ref={paginationContainerRef}
                style={{
                  padding: '8px 18px',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  borderTop: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '12px',
                  color: '#64748b',
                  flexShrink: 0,
                  marginTop: 'auto',
                }}
              >

                {/* Khối phân trang liền thanh */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'stretch',
                    border: '1px solid #d1d5db',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    background: '#ffffff',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                    height: '24px',
                  }}
                >
                  {/* Nút trang trước (<) - hiển thị khi trang > 1 */}
                  {safePage > 1 && (
                    <button
                      type="button"
                      onClick={() => handlePageChange(Math.max(1, safePage - 1))}
                      style={{
                        minWidth: '24px',
                        height: '100%',
                        padding: '0 6px',
                        border: 'none',
                        borderRight: '1px solid #e5e7eb',
                        background: '#ffffff',
                        color: '#4b5563',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      title="Trang trước"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                  )}

                  {/* Danh sách các số trang */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push('...');
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx, arr) => {
                      const hasNext = safePage < totalPages;
                      const isLastItem = idx === arr.length - 1 && !hasNext;
                      if (typeof p === 'string') {
                        return (
                          <span
                            key={`ellipsis-${idx}`}
                            style={{
                              minWidth: '22px',
                              height: '100%',
                              padding: '0 4px',
                              borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                              background: '#ffffff',
                              color: '#6b7280',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              userSelect: 'none',
                            }}
                          >
                            ...
                          </span>
                        );
                      }

                      const isActive = p === safePage;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handlePageChange(p)}
                          style={{
                            minWidth: '24px',
                            height: '100%',
                            padding: '0 7px',
                            border: 'none',
                            borderRight: isLastItem ? 'none' : '1px solid #e5e7eb',
                            background: isActive ? '#2ba1f4' : '#ffffff',
                            color: isActive ? '#ffffff' : '#374151',
                            cursor: isActive ? 'default' : 'pointer',
                            fontSize: '11.5px',
                            fontWeight: isActive ? '700' : '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.backgroundColor = '#f9fafb';
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.backgroundColor = '#ffffff';
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}

                  {/* Nút trang sau (>) - hiển thị khi chưa tới trang cuối */}
                  {safePage < totalPages && (
                    <button
                      type="button"
                      onClick={() => handlePageChange(Math.min(totalPages, safePage + 1))}
                      style={{
                        minWidth: '24px',
                        height: '100%',
                        padding: '0 6px',
                        border: 'none',
                        background: '#ffffff',
                        color: '#4b5563',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                      title="Trang sau"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal sửa nhà cung cấp (khi tạo mới đã có trang Full-Page View riêng) */}
      <SupplierModal
        isOpen={isModalOpen && Boolean(editingSupplier)}
        onClose={() => setIsModalOpen(false)}
        token={token}
        supplier={editingSupplier}
        onSuccess={handleModalSuccess}
      />

      {/* Popup xác nhận ngừng giao dịch */}
      {supplierToDeactivate && (
        <ModalPortal>
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
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #fde68a',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              color: '#0f172a',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Ngừng giao dịch nhà cung cấp?</h3>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 14px' }}>
              Nhà cung cấp <strong>"{supplierToDeactivate.name}"</strong> ({supplierToDeactivate.code}) sẽ không còn được
              chọn cho phiếu nhập mới. Dữ liệu và lịch sử cũ vẫn được giữ nguyên, và bạn có thể mở lại giao dịch bất cứ lúc nào.
            </p>

            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Lý do (không bắt buộc)
            </label>
            <textarea
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              maxLength={255}
              rows={3}
              disabled={isProcessing}
              placeholder="Ví dụ: Giao hàng trễ nhiều lần, hàng lỗi lô tháng 9..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13.5px',
                boxSizing: 'border-box',
                resize: 'vertical',
                outline: 'none',
              }}
            />

            {actionError && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginTop: '12px',
                }}
              >
                ⚠️ {actionError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setSupplierToDeactivate(null)}
                disabled={isProcessing}
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
                type="button"
                onClick={confirmDeactivate}
                disabled={isProcessing}
                style={{
                  background: 'linear-gradient(135deg, #d97706, #b45309)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '10px 22px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                {isProcessing ? 'Đang xử lý...' : 'Đồng ý đóng giao dịch'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Popup xác nhận mở lại giao dịch */}
      {supplierToActivate && (
        <ModalPortal>
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
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #bbf7d0',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '480px',
                padding: '28px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                color: '#0f172a',
              }}
            >
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Mở lại giao dịch nhà cung cấp?</h3>
              <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 20px' }}>
                Bạn có muốn mở lại giao dịch với nhà cung cấp <strong>"{supplierToActivate.name}"</strong> ({supplierToActivate.code})? Nhà cung cấp sẽ được mở giao dịch trở lại để có thể tiếp tục chọn khi tạo phiếu nhập kho mới.
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setSupplierToActivate(null)}
                  disabled={isActivating}
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
                  type="button"
                  onClick={confirmActivate}
                  disabled={isActivating}
                  style={{
                    background: 'linear-gradient(135deg, #16a34a, #15803d)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 22px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: isActivating ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isActivating ? 'Đang xử lý...' : 'Đồng ý mở lại giao dịch'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal xác nhận xóa nhà cung cấp */}
      {supplierToDelete && (
        <ModalPortal>
        <div
          style={{
            position: 'fixed',
            inset: 0,
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
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #fecaca',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              color: '#0f172a',
            }}
          >
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 8px', color: '#dc2626' }}>
              Xác nhận xóa nhà cung cấp?
            </h3>
            <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6, margin: '0 0 14px' }}>
              Bạn có chắc chắn muốn xóa nhà cung cấp <strong>"{supplierToDelete.name}"</strong> ({supplierToDelete.code}) không?
            </p>
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#64748b', marginBottom: '14px' }}>
              <strong>Quy định nghiệp vụ:</strong> Nếu nhà cung cấp đã phát sinh phiếu nhập kho, hệ thống sẽ từ chối xóa để bảo đảm truy nguyên nguồn hàng và yêu cầu chuyển sang <strong>Ngừng giao dịch</strong>.
            </div>

            {deleteError && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  marginBottom: '14px',
                }}
              >
                <div style={{ fontWeight: '700', marginBottom: '4px' }}>Không thể xóa nhà cung cấp</div>
                <div>{deleteError}</div>
                {deleteError.includes('chỉ ngừng giao dịch') && (
                  <button
                    type="button"
                    onClick={() => {
                      const sup = supplierToDelete;
                      setSupplierToDelete(null);
                      setDeleteError(null);
                      openDeactivate(sup);
                    }}
                    style={{
                      marginTop: '10px',
                      background: '#b45309',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#ffffff',
                      padding: '6px 14px',
                      fontSize: '12.5px',
                      fontWeight: '700',
                      cursor: 'pointer',
                    }}
                  >
                    Chuyển sang "Ngừng giao dịch" ngay
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setSupplierToDelete(null);
                  setDeleteError(null);
                }}
                disabled={isDeleting}
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
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '10px 22px',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                }}
              >
                {isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Dropdown Menu Portal gắn vào document.body tránh bị che khuất bởi thanh cuộn/bảng */}
      {dropdownMenu &&
        createPortal(
          <div
            className="supplier-action-menu-portal"
            style={{
              position: 'fixed',
              ...(dropdownMenu.openUpward
                ? { bottom: `${Math.max(10, window.innerHeight - dropdownMenu.rect.top + 6)}px` }
                : { top: `${dropdownMenu.rect.bottom + 6}px` }),
              right: `${Math.max(12, window.innerWidth - dropdownMenu.rect.right)}px`,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.16), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              minWidth: '165px',
              zIndex: 99999,
              padding: '5px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              textAlign: 'left',
            }}
          >
            {/* Sửa thông tin */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const s = dropdownMenu.supplier;
                setDropdownMenu(null);
                openEdit(s);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: '#1e293b',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.color = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#1e293b';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Sửa thông tin</span>
            </button>

            {/* Xóa nhà cung cấp hoặc Không thể xóa */}
            {dropdownMenu.supplier.has_receipts ? (
              <div
                title="Nhà cung cấp đã có phiếu nhập thì không thể xóa. Bạn có thể bấm vào 'Đang giao dịch' để ngừng giao dịch."
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#94a3b8',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'not-allowed',
                  boxSizing: 'border-box',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Không thể xóa</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const s = dropdownMenu.supplier;
                  setDropdownMenu(null);
                  setSupplierToDelete(s);
                  setDeleteError(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: 'transparent',
                  color: '#dc2626',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.color = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#dc2626';
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Xóa nhà cung cấp</span>
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};

export default SupplierManagementView;