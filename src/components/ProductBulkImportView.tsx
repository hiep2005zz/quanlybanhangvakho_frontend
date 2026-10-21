// frontend/src/components/ProductBulkImportView.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  ProductBulkPreviewResponse,
  downloadProductImportTemplateApi,
  uploadProductBulkPreviewApi,
  getProductBulkPreviewPageApi,
  executeProductBulkConfirmApi,
} from '../services/productApi';
import { emitStatusToast } from './StatusToast';

interface ProductBulkImportViewProps {
  token: string;
  onBackToInventory: () => void;
  onSuccess?: () => void;
}

export const ProductBulkImportView: React.FC<ProductBulkImportViewProps> = ({
  token,
  onBackToInventory,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ProductBulkPreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [skipErrors, setSkipErrors] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phân trang 20 sản phẩm / trang mặc định
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Filter xem theo trạng thái: ALL | NEW | UPDATE | ERROR
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NEW' | 'UPDATE' | 'ERROR'>('ALL');

  // Tìm kiếm sản phẩm trong danh sách xem trước (SKU, Tên)
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Màn hình kết quả hoàn tất
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [summary, setSummary] = useState<{
    total: number;
    created: number;
    updated: number;
    failed: number;
  } | null>(null);

  // Tải file Excel mẫu
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
      setError(err.message || 'Lỗi khi tải file mẫu Excel.');
    }
  };

  // Xử lý khi chọn file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    await processFile(selected);
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setLoading(true);
    setPreview(null);
    setCurrentPage(1);
    setStatusFilter('ALL');
    setSearchTerm('');

    try {
      const data = await uploadProductBulkPreviewApi(token, selectedFile, 1, pageSize, 'ALL');
      setPreview(data);
      setCurrentPage(data.page || 1);
      emitStatusToast({
        title: 'Phân tích file thành công',
        message: `Đã phân tích ${data.total_rows.toLocaleString('vi-VN')} dòng: ${data.new_count.toLocaleString('vi-VN')} tạo mới, ${data.update_count.toLocaleString('vi-VN')} cập nhật, ${data.error_count.toLocaleString('vi-VN')} lỗi. Đang hiển thị 20 sản phẩm đầu tiên.`,
        type: 'success',
      });
    } catch (err: any) {
      setError(err.message || 'Lỗi khi phân tích file Excel.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  // Tải trang từ Backend khi chuyển trang hoặc đổi bộ lọc / tìm kiếm (Server-side Pagination)
  const handlePageChange = async (
    targetPage: number,
    targetPageSize: number = pageSize,
    targetFilter: 'ALL' | 'NEW' | 'UPDATE' | 'ERROR' = statusFilter,
    querySearch: string = searchTerm
  ) => {
    if (!preview?.file_id) return;
    setIsPageLoading(true);
    setError(null);

    try {
      const data = await getProductBulkPreviewPageApi(
        token,
        preview.file_id,
        targetPage,
        targetPageSize,
        targetFilter,
        querySearch.trim() || undefined
      );
      setPreview(data);
      setCurrentPage(data.page || targetPage);
      setPageSize(targetPageSize);
      setStatusFilter(targetFilter);
    } catch (err: any) {
      setError(err.message || `Lỗi khi tải trang ${targetPage} từ máy chủ.`);
    } finally {
      setIsPageLoading(false);
    }
  };

  // Debounce tìm kiếm sản phẩm
  const isFirstMountRef = useRef(true);
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (!preview?.file_id) return;
    const timer = setTimeout(() => {
      handlePageChange(1, pageSize, statusFilter, searchTerm);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (!droppedFile.name.endsWith('.xlsx') && !droppedFile.name.endsWith('.xls')) {
      setError('Chỉ hỗ trợ tải lên tệp Excel (.xlsx hoặc .xls)');
      return;
    }
    await processFile(droppedFile);
  };

  // Xác nhận nhập sản phẩm vào hệ thống
  const handleExecuteImport = async () => {
    if (!preview) return;
    setIsExecuting(true);
    setError(null);

    try {
      const res = await executeProductBulkConfirmApi(token, {
        file_id: preview.file_id || file?.name || 'product_import.xlsx',
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

      emitStatusToast({
        title: 'Nhập sản phẩm thành công',
        message: `Đã tạo ${res.created_count.toLocaleString('vi-VN')} mới, cập nhật ${res.updated_count.toLocaleString('vi-VN')} sản phẩm.`,
        type: 'success',
      });

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhập danh mục sản phẩm vào kho.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Dữ liệu phân trang từ máy chủ (Server-side)
  const totalFilteredCount = preview ? (preview.filtered_total ?? preview.total_rows) : 0;
  const totalPages = preview ? (preview.total_pages ?? Math.max(1, Math.ceil(totalFilteredCount / pageSize))) : 1;
  const safeCurrentPage = preview ? (preview.page ?? currentPage) : 1;
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const startDisplay = totalFilteredCount > 0 ? startIndex + 1 : 0;
  const endDisplay = Math.min(startIndex + (preview?.rows?.length || 0), totalFilteredCount);
  const rowsToDisplay = preview?.rows || [];

  const canConfirm = preview && (
    (preview.error_count === 0 && preview.total_rows > 0) ||
    (skipErrors && ((preview.new_count || 0) + (preview.update_count || 0) > 0))
  );

  // Reset về file mới
  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setIsCompleted(false);
    setSummary(null);
    setCurrentPage(1);
    setStatusFilter('ALL');
    setSearchTerm('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: '100%',
        gap: '16px',
        padding: '16px 20px 32px 20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Khối trên: Breadcrumb + Tiêu đề + Khung chọn file */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* 1. Breadcrumb điều hướng */}
        <nav
          aria-label="Breadcrumb"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13.5px',
            color: '#64748b',
            fontWeight: '500',
            padding: '2px 4px',
          }}
        >
          <button
            type="button"
            onClick={onBackToInventory}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '20px',
              color: '#2563eb',
              cursor: 'pointer',
              padding: '5px 14px',
              fontSize: '13px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.background = '#eff6ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Quản lý kho hàng</span>
          </button>
          <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>
          <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>
            Nhập danh mục sản phẩm hàng loạt từ Excel
          </span>
        </nav>

        {/* 2. Tiêu đề trang & Thanh công cụ */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: preview ? '12px 20px' : '18px 24px',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: preview ? '38px' : '44px',
                height: preview ? '38px' : '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(15, 186, 144, 0.3)',
                flexShrink: 0,
              }}
            >
              <svg width={preview ? '20' : '22'} height={preview ? '20' : '22'} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </div>
            <div>
              <h2
                style={{
                  fontSize: preview ? '18px' : '20px',
                  fontWeight: '700',
                  margin: 0,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                Nhập danh mục sản phẩm hàng loạt từ Excel
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Tải lên file danh mục hàng hóa (hỗ trợ đến 10.000 dòng). Tự động cập nhật nếu SKU đã có. Phân trang 20 sản phẩm/trang.
              </p>
            </div>
          </div>

          {/* Nút hành động */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: preview ? '8px 14px' : '9px 16px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '9px',
                color: '#2563eb',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2563eb';
                e.currentTarget.style.background = '#eff6ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Tải file Excel mẫu (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onBackToInventory}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: preview ? '8px 14px' : '9px 16px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '9px',
                color: '#475569',
                fontWeight: '600',
                fontSize: '13.5px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#94a3b8';
                e.currentTarget.style.background = '#f8fafc';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <span>Đóng / Quay lại</span>
            </button>
          </div>
        </div>

        {/* 3. Quy trình & Khung chọn file (nếu chưa hoàn tất) */}
        {!isCompleted && (
          <>

            {/* Khung kéo thả chọn file */}
            <div>
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
                  padding: file ? (preview ? '8px 16px' : '20px') : '32px 20px',
                  border: preview ? '1px dashed #93c5fd' : '2px dashed #93c5fd',
                  borderRadius: preview ? '10px' : '12px',
                  background: file ? '#f0f9ff' : '#ffffff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
              >
                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div style={{ color: '#2563eb', fontWeight: '600', fontSize: '14px' }}>
                      ⏳ Đang phân tích file Excel và so khớp SKU với CSDL...
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLoading(false);
                        setFile(null);
                        setError(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      style={{
                        padding: '4px 12px',
                        fontSize: '12px',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                    >
                      Dừng & Chọn lại file
                    </button>
                  </div>
                ) : file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <span style={{ fontSize: preview ? '18px' : '24px' }}>📄</span>
                    <div style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>{file.name}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        ({(file.size / 1024).toFixed(1)} KB) — Bấm vào đây để chọn file khác
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '34px', marginBottom: '6px' }}>📤</div>
                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14.5px', marginBottom: '3px' }}>
                      Kéo thả file Excel vào đây hoặc click để chọn tệp
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                      Chỉ chấp nhận tệp .xlsx hoặc .xls (Hỗ trợ phân trang 20 sản phẩm/trang)
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Thông báo lỗi nếu có */}
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  borderRadius: '10px',
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
          </>
        )}
      </div>

      {/* Khối nội dung kết quả hoàn tất hoặc xem trước dữ liệu */}
      {isCompleted ? (
        /* Màn hình kết quả hoàn tất */
        <div>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
            }}
          >
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: '#dcfce7',
                color: '#16a34a',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', margin: '0 0 10px 0' }}>
              Nhập sản phẩm hoàn tất!
            </h3>
            <p style={{ color: '#475569', fontSize: '14.5px', marginBottom: '28px', lineHeight: '1.7' }}>
              Tổng số dòng đã xử lý: <strong>{summary?.total}</strong><br />
              Tạo mới thành công: <strong style={{ color: '#16a34a' }}>{summary?.created}</strong> sản phẩm<br />
              Cập nhật thông tin: <strong style={{ color: '#d97706' }}>{summary?.updated}</strong> sản phẩm<br />
              {summary && summary.failed > 0 && (
                <span style={{ color: '#dc2626' }}>
                  Bỏ qua các dòng lỗi: <strong>{summary.failed}</strong> dòng
                </span>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  padding: '11px 24px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9px',
                  color: '#1e293b',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Nhập tiếp file khác
              </button>

              <button
                type="button"
                onClick={onBackToInventory}
                style={{
                  padding: '11px 26px',
                  background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                  border: 'none',
                  borderRadius: '9px',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(15, 186, 144, 0.35)',
                }}
              >
                Hoàn tất & Xem danh sách
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Giao diện xem trước dữ liệu & phân trang */
        preview && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
            }}
          >
            {/* 1. Thanh lọc xem & tìm kiếm sản phẩm */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '12px 20px',
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                borderRadius: '14px 14px 0 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#334155', marginRight: '4px' }}>
                  Lọc xem:
                </span>
                <button
                  type="button"
                  disabled={isPageLoading}
                  onClick={() => handlePageChange(1, pageSize, 'ALL')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    border: '1px solid',
                    cursor: isPageLoading ? 'wait' : 'pointer',
                    background: statusFilter === 'ALL' ? '#0f172a' : '#f8fafc',
                    color: statusFilter === 'ALL' ? '#ffffff' : '#475569',
                    borderColor: statusFilter === 'ALL' ? '#0f172a' : '#cbd5e1',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Tất cả ({preview.total_rows.toLocaleString('vi-VN')})
                </button>
                <button
                  type="button"
                  disabled={isPageLoading}
                  onClick={() => handlePageChange(1, pageSize, 'NEW')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    border: '1px solid',
                    cursor: isPageLoading ? 'wait' : 'pointer',
                    background: statusFilter === 'NEW' ? '#16a34a' : '#f0fdf4',
                    color: statusFilter === 'NEW' ? '#ffffff' : '#15803d',
                    borderColor: statusFilter === 'NEW' ? '#16a34a' : '#bbf7d0',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Tạo mới ({preview.new_count.toLocaleString('vi-VN')})
                </button>
                <button
                  type="button"
                  disabled={isPageLoading}
                  onClick={() => handlePageChange(1, pageSize, 'UPDATE')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    border: '1px solid',
                    cursor: isPageLoading ? 'wait' : 'pointer',
                    background: statusFilter === 'UPDATE' ? '#d97706' : '#fffbeb',
                    color: statusFilter === 'UPDATE' ? '#ffffff' : '#b45309',
                    borderColor: statusFilter === 'UPDATE' ? '#d97706' : '#fde68a',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Cập nhật ({preview.update_count.toLocaleString('vi-VN')})
                </button>
                <button
                  type="button"
                  disabled={isPageLoading}
                  onClick={() => handlePageChange(1, pageSize, 'ERROR')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    border: '1px solid',
                    cursor: isPageLoading ? 'wait' : 'pointer',
                    background: statusFilter === 'ERROR' ? '#dc2626' : '#fef2f2',
                    color: statusFilter === 'ERROR' ? '#ffffff' : '#b91c1c',
                    borderColor: statusFilter === 'ERROR' ? '#dc2626' : '#fecaca',
                    transition: 'all 0.15s ease',
                  }}
                >
                  Lỗi ({preview.error_count.toLocaleString('vi-VN')})
                </button>

                {/* Ô tìm kiếm sản phẩm trong danh sách xem trước */}
                <div style={{ position: 'relative', width: '260px', marginLeft: '6px' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    id="input-search-bulk-preview-product"
                    placeholder="Tìm theo mã SKU, tên sản phẩm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '5px 28px 5px 30px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#0fba90';
                      e.currentTarget.style.boxShadow = '0 0 0 2px rgba(15, 186, 144, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#cbd5e1';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '2px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Xóa tìm kiếm"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Option: Bỏ qua lỗi */}
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

            {/* 2. Khung bảng dữ liệu tự nhiên, cuộn ngang linh hoạt */}
            <div
              style={{
                overflowX: 'auto',
                position: 'relative',
                background: '#ffffff',
              }}
            >
              {/* Overlay loading khi bấm sang trang hoặc đổi bộ lọc */}
              {isPageLoading && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    minHeight: '200px',
                    background: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(1.5px)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    zIndex: 20,
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#0fba90"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ animation: 'spin 0.75s linear infinite' }}
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#0f172a' }}>
                    Đang tải {pageSize} sản phẩm từ máy chủ...
                  </span>
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead
                  style={{
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px', color: '#64748b' }}>Dòng</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '95px', color: '#64748b' }}>Trạng thái</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', width: '120px', color: '#64748b' }}>Mã SKU</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b' }}>Tên sản phẩm</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', width: '80px', color: '#64748b' }}>ĐVT</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: '110px', color: '#64748b' }}>Giá bán</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: '100px', color: '#64748b' }}>Giá vốn</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', width: '120px', color: '#64748b' }}>Danh mục</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', width: '70px', color: '#64748b' }}>Tồn</th>
                    <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '180px', color: '#64748b' }}>Chi tiết / Lỗi</th>
                  </tr>
                </thead>
                <tbody style={{ opacity: isPageLoading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}>
                  {rowsToDisplay.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontSize: '26px', marginBottom: '8px' }}>🔍</div>
                        <div style={{ fontWeight: '600', fontSize: '13.5px', color: '#334155', marginBottom: '4px' }}>
                          {searchTerm ? `Không tìm thấy sản phẩm nào khớp với từ khóa "${searchTerm}"` : 'Không có dòng nào phù hợp với bộ lọc này.'}
                        </div>
                        {searchTerm && (
                          <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            style={{
                              marginTop: '8px',
                              padding: '5px 12px',
                              fontSize: '12px',
                              background: '#f1f5f9',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              color: '#2563eb',
                              cursor: 'pointer',
                              fontWeight: '600',
                            }}
                          >
                            Xóa bộ lọc tìm kiếm
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    rowsToDisplay.map((row) => {
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
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600', color: '#64748b' }}>
                            {row.row_index}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
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
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: '600', color: '#0f172a' }}>
                            {row.sku}
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: '500', color: '#0f172a' }}>
                            {row.name}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b' }}>
                            {row.unit || 'Cái'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '600', color: '#0f172a' }}>
                            {row.sell_price ? row.sell_price.toLocaleString('vi-VN') + ' đ' : '0 đ'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>
                            {row.cost_price ? `${row.cost_price.toLocaleString('vi-VN')} đ` : '—'}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>
                            {row.category || 'Thời trang'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0f172a', fontWeight: '600' }}>
                            {row.stock ?? 0}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            {isError ? (
                              <div style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600' }}>
                                {(row.errors || []).map((err, i) => (
                                  <div key={i}>• {err}</div>
                                ))}
                              </div>
                            ) : isUpdate ? (
                              <span style={{ color: '#b45309', fontSize: '12px' }}>
                                SKU đã tồn tại trong CSDL. Sẽ cập nhật giá và thông tin.
                              </span>
                            ) : (
                              <span style={{ color: '#16a34a', fontSize: '12px' }}>
                                ✓ SKU mới chưa có. Sẽ thêm mới vào kho.
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

            {/* 3. Khối chân trang: Phân trang + Xác nhận */}
            <div
              style={{
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                padding: '14px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                borderRadius: '0 0 14px 14px',
              }}
            >
              {/* PHÂN TRANG (Mặc định 20 sản phẩm/trang từ Server-side) */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '13px',
                  color: '#64748b',
                }}
              >
                {/* Chọn số dòng hiển thị */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    disabled={isPageLoading}
                    onChange={(e) => {
                      const newSize = Number(e.target.value);
                      handlePageChange(1, newSize, statusFilter);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '13px',
                      cursor: isPageLoading ? 'wait' : 'pointer',
                    }}
                  >
                    <option value={10}>10 dòng / trang</option>
                    <option value={20}>20 dòng / trang</option>
                    <option value={50}>50 dòng / trang</option>
                    <option value={100}>100 dòng / trang</option>
                  </select>
                  <span>
                    (Đang hiển thị {startDisplay} - {endDisplay} trong tổng số{' '}
                    <strong style={{ color: '#0f172a' }}>{totalFilteredCount.toLocaleString('vi-VN')}</strong> dòng)
                  </span>
                </div>

                {/* Điều hướng trang từ Backend */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1 || isPageLoading}
                      onClick={() => handlePageChange(1, pageSize, statusFilter)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage <= 1 || isPageLoading ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage <= 1 || isPageLoading ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage <= 1 || isPageLoading ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      « Đầu
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1 || isPageLoading}
                      onClick={() => handlePageChange(Math.max(1, safeCurrentPage - 1), pageSize, statusFilter)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage <= 1 || isPageLoading ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage <= 1 || isPageLoading ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage <= 1 || isPageLoading ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      ‹ Trước
                    </button>

                    {/* Số trang với cửa sổ thông minh */}
                    {Array.from({ length: totalPages }, (_, idx) => idx + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 2)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={p}>
                            {prev && p - prev > 1 && (
                              <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>
                            )}
                            <button
                              type="button"
                              disabled={isPageLoading}
                              onClick={() => handlePageChange(p, pageSize, statusFilter)}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: '1px solid',
                                background: safeCurrentPage === p ? '#0fba90' : '#ffffff',
                                color: safeCurrentPage === p ? '#ffffff' : '#0f172a',
                                borderColor: safeCurrentPage === p ? '#0fba90' : '#cbd5e1',
                                cursor: isPageLoading ? 'wait' : 'pointer',
                                fontSize: '12.5px',
                                fontWeight: safeCurrentPage === p ? '700' : '500',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages || isPageLoading}
                      onClick={() => handlePageChange(Math.min(totalPages, safeCurrentPage + 1), pageSize, statusFilter)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage >= totalPages || isPageLoading ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage >= totalPages || isPageLoading ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage >= totalPages || isPageLoading ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      Sau ›
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages || isPageLoading}
                      onClick={() => handlePageChange(totalPages, pageSize, statusFilter)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage >= totalPages || isPageLoading ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage >= totalPages || isPageLoading ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage >= totalPages || isPageLoading ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      Cuối »
                    </button>
                  </div>
                )}
              </div>

              {/* Thanh hành động Xác nhận */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '12px',
                  paddingTop: '8px',
                  borderTop: '1px solid #f1f5f9',
                }}
              >
                <button
                  type="button"
                  onClick={onBackToInventory}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
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
                  disabled={!canConfirm || isExecuting || isPageLoading}
                  style={{
                    padding: '9px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background:
                      !canConfirm || isExecuting || isPageLoading
                        ? '#cbd5e1'
                        : 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    cursor: !canConfirm || isExecuting || isPageLoading ? 'not-allowed' : 'pointer',
                    boxShadow:
                      !canConfirm || isExecuting || isPageLoading
                        ? 'none'
                        : '0 2px 8px rgba(15, 186, 144, 0.35)',
                  }}
                >
                  {isExecuting
                    ? 'Đang xử lý nhập kho...'
                    : `Xác nhận nhập danh mục vào kho (${((preview.new_count || 0) + (preview.update_count || 0)).toLocaleString('vi-VN')} dòng hợp lệ)`}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
