import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import {
  Supplier,
  getSuppliersApi,
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

const smallBtn = (color: string, bg: string, border: string, width?: string): React.CSSProperties => ({
  height: '32px',
  width: width,
  minWidth: width,
  padding: '0 10px',
  borderRadius: '8px',
  border: `1px solid ${border}`,
  background: bg,
  color,
  fontSize: '12px',
  fontWeight: '600',
  lineHeight: '1',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  textAlign: 'center',
  transition: 'all 0.15s ease',
});

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
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Popup xác nhận ngừng giao dịch
  const [supplierToDeactivate, setSupplierToDeactivate] = useState<Supplier | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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
    setEditingSupplier(null);
    setIsModalOpen(true);
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

  const handleActivate = async (s: Supplier) => {
    setError(null);
    try {
      const res = await activateSupplierApi(token, s.code);
      emitStatusToast({ message: `Đã mở lại giao dịch với nhà cung cấp "${res.name}" (${res.code}).` });
      loadSuppliers();
    } catch (err: any) {
      setError(err.message || 'Không thể mở lại giao dịch nhà cung cấp này.');
    }
  };

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
      {/* Tiêu đề + nút thêm */}
      <div
        style={{
          ...cardStyle,
          padding: '16px 22px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          flexShrink: 0,
        }}
      >
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Quản Lý Nhà Cung Cấp
          </h2>
          <span style={{ fontSize: '12.5px', color: '#64748b' }}>
            Danh mục nguồn hàng để gắn vào phiếu nhập kho và truy nguyên khi có lô lỗi
          </span>
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
          + Thêm nhà cung cấp
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

      {/* Thanh tìm kiếm + lọc */}
      <div
        style={{
          ...cardStyle,
          padding: '12px 18px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0,
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

      {/* Bảng danh sách */}
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
                ? 'Bấm "+ Thêm nhà cung cấp" để khai báo nguồn hàng đầu tiên.'
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
                    <th style={{ ...thStyle, width: '56px', textAlign: 'center', background: '#f8fafc' }}>STT</th>
                    <th style={{ ...thStyle, background: '#f8fafc' }}>Mã NCC</th>
                    <th style={{ ...thStyle, background: '#f8fafc' }}>Tên nhà cung cấp</th>
                    <th style={{ ...thStyle, background: '#f8fafc' }}>Mã số thuế</th>
                    <th style={{ ...thStyle, background: '#f8fafc' }}>Người liên hệ</th>
                    <th style={{ ...thStyle, background: '#f8fafc' }}>Điều khoản thanh toán</th>
                    <th style={{ ...thStyle, textAlign: 'center', width: '150px', minWidth: '150px', whiteSpace: 'nowrap', background: '#f8fafc' }}>Trạng thái</th>
                    <th style={{ ...thStyle, textAlign: 'center', width: '330px', minWidth: '330px', background: '#f8fafc' }}>Thao tác</th>
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
                      }}
                    >
                      {s.code}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: '600', color: '#0f172a' }}>
                      {s.name}
                      {s.has_receipts && (
                        <span
                          title="Nhà cung cấp đã có phiếu nhập kho hàng hóa"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '11px',
                            fontWeight: '600',
                            color: '#1d4ed8',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            padding: '2px 7px',
                            borderRadius: '999px',
                            marginLeft: '8px',
                            verticalAlign: 'middle',
                          }}
                        >
                          Đã có phiếu nhập
                        </span>
                      )}
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
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#15803d',
                            background: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            padding: '3px 10px',
                            borderRadius: '999px',
                            fontSize: '12px',
                            fontWeight: '700',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                          Đang giao dịch
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: '#b91c1c',
                              background: '#fee2e2',
                              border: '1px solid #fecaca',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                            Ngừng giao dịch
                          </span>
                          {s.inactive_reason && (
                            <span style={{ fontSize: '11.5px', color: '#64748b', maxWidth: '180px' }}>
                              Lý do: {s.inactive_reason}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => openEdit(s)}
                          style={smallBtn('#1d4ed8', '#eff6ff', '#bfdbfe', '58px')}
                        >
                          Sửa
                        </button>
                        {s.is_active ? (
                          <button
                            type="button"
                            onClick={() => openDeactivate(s)}
                            style={smallBtn('#b45309', '#fef3c7', '#fde68a', '128px')}
                          >
                            Ngừng giao dịch
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivate(s)}
                            style={smallBtn('#15803d', '#dcfce7', '#bbf7d0', '128px')}
                          >
                            Mở lại giao dịch
                          </button>
                        )}
                        {s.has_receipts ? (
                          <button
                            type="button"
                            disabled
                            title="Nhà cung cấp đã có phiếu nhập thì không xoá được, chỉ ngừng giao dịch."
                            style={{
                              ...smallBtn('#94a3b8', '#f8fafc', '#e2e8f0', '112px'),
                              cursor: 'not-allowed',
                              opacity: 0.85,
                            }}
                          >
                            Không thể xóa
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setSupplierToDelete(s);
                              setDeleteError(null);
                            }}
                            style={smallBtn('#dc2626', '#fef2f2', '#fecaca', '112px')}
                          >
                            Xóa
                          </button>
                        )}
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

      {/* Modal thêm / sửa */}
      <SupplierModal
        isOpen={isModalOpen}
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
                {isProcessing ? 'Đang xử lý...' : 'Xác nhận ngừng giao dịch'}
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
    </div>
  );
};

export default SupplierManagementView;