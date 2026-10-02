import React, { useState, useRef } from 'react';
import {
  ProductBulkPreviewResponse,
  downloadProductImportTemplateApi,
  uploadProductBulkPreviewApi,
  executeProductBulkConfirmApi,
} from '../services/productApi';

interface ProductBulkImportModalProps {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProductBulkImportModal: React.FC<ProductBulkImportModalProps> = ({
  token,
  onClose,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductBulkPreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [skipErrors, setSkipErrors] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [summary, setSummary] = useState<{
    total: number;
    created: number;
    updated: number;
    failed: number;
  } | null>(null);

  // Phân trang danh sách preview
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 10;

  // Filter xem theo trạng thái: all | new | update | error
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'UPDATE' | 'ERROR'>('ALL');

  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadProductImportTemplateApi(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Nhap_Danh_Muc_San_Pham.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải file mẫu Excel.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setLoading(true);
    setCurrentPage(1);
    try {
      const data = await uploadProductBulkPreviewApi(token, selected);
      setPreview(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi phân tích file Excel.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (!droppedFile.name.endsWith('.xlsx') && !droppedFile.name.endsWith('.xls')) {
      setError('Chỉ hỗ trợ tải lên file Excel (.xlsx hoặc .xls)');
      return;
    }
    setFile(droppedFile);
    setError(null);
    setLoading(true);
    setCurrentPage(1);
    try {
      const data = await uploadProductBulkPreviewApi(token, droppedFile);
      setPreview(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi phân tích file Excel.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await executeProductBulkConfirmApi(token, {
        file_id: file?.name || 'product_import.xlsx',
        skip_errors: skipErrors,
        rows: preview.rows,
      });

      setSummary({
        total: res.total_processed,
        created: res.created_count,
        updated: res.updated_count,
        failed: res.failed_count,
      });
      setIsCompleted(true);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhập danh mục sản phẩm.');
    } finally {
      setLoading(false);
    }
  };

  // Lọc các dòng hiển thị theo filter
  const filteredRows = preview?.rows.filter((row) => {
    if (statusFilter === 'ALL') return true;
    return row.status === statusFilter;
  }) || [];

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const canConfirm = preview && (
    (preview.error_count === 0 && preview.total_rows > 0) ||
    (skipErrors && (preview.new_count + preview.update_count > 0))
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1050px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeInModal 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                Nhập danh mục sản phẩm hàng loạt từ Excel
              </h2>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                Tải lên file danh mục hàng hóa (hỗ trợ đến 5.000 dòng). Tự động cập nhật nếu SKU đã có.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Đóng"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {isCompleted ? (
            <div style={{ textAlign: 'center', padding: '36px 20px' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#16a34a',
                  marginBottom: '16px',
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: '21px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
                Nhập sản phẩm hoàn tất!
              </h3>
              <p style={{ color: '#475569', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
                Tổng số dòng đã xử lý: <strong>{summary?.total}</strong><br />
                Tạo mới thành công: <strong style={{ color: '#16a34a' }}>{summary?.created}</strong> sản phẩm<br />
                Cập nhật thông tin: <strong style={{ color: '#d97706' }}>{summary?.updated}</strong> sản phẩm<br />
                {summary && summary.failed > 0 && (
                  <span style={{ color: '#dc2626' }}>
                    Bỏ qua các dòng lỗi: <strong>{summary.failed}</strong> dòng<br />
                  </span>
                )}
              </p>
              <button
                onClick={onClose}
                style={{
                  padding: '10px 24px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                }}
              >
                Hoàn tất & Xem danh sách
              </button>
            </div>
          ) : (
            <>
              {/* Instructions and Template Download */}
              <div
                style={{
                  marginBottom: '18px',
                  padding: '14px 18px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13.5px', marginBottom: '3px' }}>
                    Quy trình nhập dữ liệu danh mục sản phẩm:
                  </div>
                  <div style={{ color: '#64748b', fontSize: '12.5px', lineHeight: '1.5' }}>
                    1. Bấm <strong>Tải file mẫu</strong> để có định dạng chuẩn các cột (SKU, Tên, ĐVT, Giá bán, Giá vốn, Danh mục).<br />
                    2. Tải file đã điền lên hệ thống. Kiểm tra dòng <strong>[Tạo mới]</strong> (xanh lá) và <strong>[Cập nhật]</strong> (vàng cam).<br />
                    3. Kiểm tra các dòng cảnh báo lỗi đỏ trước khi xác nhận.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 14px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#2563eb',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#2563eb')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#cbd5e1')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Tải file Excel mẫu (.xlsx)</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div style={{ marginBottom: '18px' }}>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%',
                    padding: file ? '20px' : '32px 20px',
                    border: '2px dashed #93c5fd',
                    borderRadius: '12px',
                    background: file ? '#f0f9ff' : '#fafafa',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  {loading ? (
                    <div style={{ color: '#2563eb', fontWeight: '600', fontSize: '14px' }}>
                      ⏳ Đang phân tích file Excel và so khớp SKU với CSDL...
                    </div>
                  ) : file ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>📄</span>
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{file.name}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {(file.size / 1024).toFixed(1)} KB — Bấm vào đây để chọn file khác
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📤</div>
                      <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px', marginBottom: '4px' }}>
                        Kéo thả file Excel vào đây hoặc click để chọn tệp
                      </div>
                      <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                        Chỉ chấp nhận tệp .xlsx hoặc .xls (Tối đa 5.000 dòng)
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Error Notice */}
              {error && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#b91c1c',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Preview Section */}
              {preview && (
                <div style={{ marginTop: '16px' }}>
                  {/* Status Bar & Filter Badges */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '12px',
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', marginRight: '4px' }}>
                        Lọc xem:
                      </span>
                      <button
                        type="button"
                        onClick={() => { setStatusFilter('ALL'); setCurrentPage(1); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: 'none',
                          cursor: 'pointer',
                          background: statusFilter === 'ALL' ? '#334155' : '#e2e8f0',
                          color: statusFilter === 'ALL' ? '#ffffff' : '#475569',
                        }}
                      >
                        Tất cả ({preview.total_rows})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStatusFilter('NEW'); setCurrentPage(1); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: 'none',
                          cursor: 'pointer',
                          background: statusFilter === 'NEW' ? '#16a34a' : '#dcfce7',
                          color: statusFilter === 'NEW' ? '#ffffff' : '#15803d',
                        }}
                      >
                        Tạo mới ({preview.new_count})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStatusFilter('UPDATE'); setCurrentPage(1); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: 'none',
                          cursor: 'pointer',
                          background: statusFilter === 'UPDATE' ? '#d97706' : '#fef3c7',
                          color: statusFilter === 'UPDATE' ? '#ffffff' : '#b45309',
                        }}
                      >
                        Cập nhật ({preview.update_count})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setStatusFilter('ERROR'); setCurrentPage(1); }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          border: 'none',
                          cursor: 'pointer',
                          background: statusFilter === 'ERROR' ? '#dc2626' : '#fee2e2',
                          color: statusFilter === 'ERROR' ? '#ffffff' : '#b91c1c',
                        }}
                      >
                        Lỗi ({preview.error_count})
                      </button>
                    </div>

                    {/* Option: Skip errors checkbox */}
                    {preview.error_count > 0 && (
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12.5px',
                          color: '#b91c1c',
                          fontWeight: '600',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={skipErrors}
                          onChange={(e) => setSkipErrors(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        Bỏ qua các dòng lỗi để import dòng hợp lệ
                      </label>
                    )}
                  </div>

                  {/* Table */}
                  <div
                    style={{
                      overflowX: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      maxHeight: '340px',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '9px 12px', textAlign: 'center', width: '50px', color: '#64748b' }}>Dòng</th>
                          <th style={{ padding: '9px 12px', textAlign: 'center', width: '100px', color: '#64748b' }}>Trạng thái</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', width: '110px', color: '#64748b' }}>Mã SKU</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', color: '#64748b' }}>Tên sản phẩm</th>
                          <th style={{ padding: '9px 12px', textAlign: 'center', width: '80px', color: '#64748b' }}>ĐVT</th>
                          <th style={{ padding: '9px 12px', textAlign: 'right', width: '110px', color: '#64748b' }}>Giá bán</th>
                          <th style={{ padding: '9px 12px', textAlign: 'right', width: '100px', color: '#64748b' }}>Giá vốn</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', width: '110px', color: '#64748b' }}>Danh mục</th>
                          <th style={{ padding: '9px 12px', textAlign: 'right', width: '70px', color: '#64748b' }}>Tồn</th>
                          <th style={{ padding: '9px 12px', textAlign: 'left', minWidth: '180px', color: '#64748b' }}>Chi tiết / Lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.length === 0 ? (
                          <tr>
                            <td colSpan={10} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                              Không có dòng nào thuộc bộ lọc này.
                            </td>
                          </tr>
                        ) : (
                          paginatedRows.map((row) => {
                            const isError = row.status === 'ERROR';
                            const isUpdate = row.status === 'UPDATE';
                            const isNew = row.status === 'NEW';

                            return (
                              <tr
                                key={row.row_index}
                                style={{
                                  background: isError ? '#fff5f5' : isUpdate ? '#fffbeb' : '#ffffff',
                                  borderBottom: '1px solid #f1f5f9',
                                  borderLeft: isError
                                    ? '4px solid #ef4444'
                                    : isUpdate
                                    ? '4px solid #f59e0b'
                                    : '4px solid #22c55e',
                                }}
                              >
                                <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '500', color: '#64748b' }}>
                                  {row.row_index}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                  {isNew && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        border: '1px solid #bbf7d0',
                                      }}
                                    >
                                      Tạo mới
                                    </span>
                                  )}
                                  {isUpdate && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        background: '#fef3c7',
                                        color: '#b45309',
                                        border: '1px solid #fde68a',
                                      }}
                                    >
                                      Cập nhật
                                    </span>
                                  )}
                                  {isError && (
                                    <span
                                      style={{
                                        display: 'inline-block',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '700',
                                        background: '#fee2e2',
                                        color: '#b91c1c',
                                        border: '1px solid #fecaca',
                                      }}
                                    >
                                      Lỗi
                                    </span>
                                  )}
                                </td>
                                <td
                                  style={{
                                    padding: '8px 12px',
                                    fontFamily: 'monospace',
                                    fontWeight: '700',
                                    color: isError && !row.sku ? '#dc2626' : '#0f172a',
                                  }}
                                >
                                  {row.sku || <em style={{ color: '#dc2626' }}>(Trống SKU)</em>}
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: '500', color: '#1e293b' }}>
                                  {row.name || <em style={{ color: '#dc2626' }}>(Trống tên)</em>}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>
                                  {row.unit}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '600' }}>
                                  {row.sell_price.toLocaleString('vi-VN')} đ
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#64748b' }}>
                                  {row.cost_price ? `${row.cost_price.toLocaleString('vi-VN')} đ` : '0 đ'}
                                </td>
                                <td style={{ padding: '8px 12px', color: '#475569' }}>
                                  {row.category}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>
                                  {row.stock}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  {isError ? (
                                    <div style={{ color: '#b91c1c', fontSize: '12px' }}>
                                      {row.errors.map((err, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <span>•</span>
                                          <span>{err}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : isUpdate ? (
                                    <span style={{ color: '#b45309', fontSize: '12px' }}>
                                      Khớp SKU trong CSDL. Sẽ cập nhật giá & tồn kho.
                                    </span>
                                  ) : (
                                    <span style={{ color: '#15803d', fontSize: '12px' }}>
                                      SKU mới chưa có. Sẽ thêm mới vào kho.
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '10px',
                        fontSize: '12.5px',
                        color: '#64748b',
                      }}
                    >
                      <div>
                        Trang {currentPage} / {totalPages} (Tổng {filteredRows.length} dòng hiển thị)
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          style={{
                            padding: '4px 10px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentPage === 1 ? 0.5 : 1,
                          }}
                        >
                          Trước
                        </button>
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          style={{
                            padding: '4px 10px',
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            opacity: currentPage === totalPages ? 0.5 : 1,
                          }}
                        >
                          Sau
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
          }}
        >
          <div>
            {preview && !isCompleted && (
              <span style={{ fontSize: '13px', color: '#475569' }}>
                Sẽ nhập:{' '}
                <strong style={{ color: '#16a34a' }}>
                  {skipErrors ? preview.new_count + preview.update_count : (preview.error_count === 0 ? preview.total_rows : 0)}
                </strong>{' '}
                sản phẩm hợp lệ
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            {!isCompleted ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '9px 18px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#334155',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={!canConfirm || loading}
                  style={{
                    padding: '9px 20px',
                    background: '#2563eb',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontWeight: '600',
                    fontSize: '13.5px',
                    cursor: !canConfirm || loading ? 'not-allowed' : 'pointer',
                    opacity: !canConfirm || loading ? 0.55 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  }}
                >
                  {loading ? 'Đang lưu vào CSDL...' : 'Xác nhận'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 20px',
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontWeight: '600',
                  fontSize: '13.5px',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
