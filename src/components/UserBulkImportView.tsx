// frontend/src/components/UserBulkImportView.tsx
import React, { useState, useRef, useMemo } from 'react';
import {
  BulkImportRowResult,
  BulkImportPreviewResponse,
  uploadBulkImportPreviewApi,
  executeBulkImportApi,
  downloadBulkImportTemplateApi,
  downloadBulkImportErrorsApi,
} from '../services/importApi';
import { emitStatusToast } from './StatusToast';

interface UserBulkImportViewProps {
  token: string;
  onBackToUsers: () => void;
  onSuccess?: () => void;
}

const ROLE_DISPLAY_MAP: Record<string, { title: string; color: string; bg: string }> = {
  admin: { title: 'Quản trị hệ thống', color: '#dc2626', bg: '#fee2e2' },
  sales_manager: { title: 'Quản lý kinh doanh', color: '#7c3aed', bg: '#ede9fe' },
  sales: { title: 'Nhân viên kinh doanh', color: '#2563eb', bg: '#eff6ff' },
  sale: { title: 'Nhân viên kinh doanh', color: '#2563eb', bg: '#eff6ff' },
  warehouse: { title: 'Thủ kho', color: '#059669', bg: '#dcfce7' },
  warehouse_manager: { title: 'Quản lý kho', color: '#047857', bg: '#d1fae5' },
  accountant: { title: 'Kế toán', color: '#d97706', bg: '#fef3c7' },
  purchasing: { title: 'Nhân viên mua hàng', color: '#0891b2', bg: '#cffafe' },
  customer: { title: 'Đại lý', color: '#0284c7', bg: '#e0f2fe' },
};

export const UserBulkImportView: React.FC<UserBulkImportViewProps> = ({
  token,
  onBackToUsers,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkImportPreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phân trang 20 người/trang mặc định
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Bộ lọc xem: ALL | VALID | INVALID
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VALID' | 'INVALID'>('ALL');

  // Màn hình kết quả hoàn tất
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [completedSummary, setCompletedSummary] = useState<{
    total: number;
    success: number;
    failed: number;
    failed_rows: BulkImportRowResult[];
  } | null>(null);

  // Tải file Excel mẫu
  const handleDownloadTemplate = async () => {
    try {
      const blob = await downloadBulkImportTemplateApi(token);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Mau_Nhap_Nguoi_Dung.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải file mẫu.');
    }
  };

  // Tải danh sách các dòng lỗi
  const handleDownloadErrors = async () => {
    if (!preview || preview.invalid_count === 0) return;
    try {
      const blob = await downloadBulkImportErrorsApi(token, {
        file_id: '',
        rows: preview.rows.filter((r) => !r.is_valid),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Danh_Sach_Nguoi_Dung_Loi.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xuất file lỗi.');
    }
  };

  // Xử lý khi chọn file Excel
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

    try {
      const data = await uploadBulkImportPreviewApi(token, selectedFile);
      setPreview(data);
      emitStatusToast({
        title: 'Phân tích file thành công',
        message: `Đã phân tích ${data.total_rows} dòng: ${data.valid_count} hợp lệ, ${data.invalid_count} lỗi.`,
        type: 'success',
      });
    } catch (err: any) {
      setError(err.message || 'Lỗi khi phân tích tệp Excel. Vui lòng kiểm tra định dạng.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  // Kéo thả file
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith('.xlsx') && !droppedFile.name.endsWith('.xls')) {
        setError('Chỉ chấp nhận tệp định dạng .xlsx hoặc .xls');
        return;
      }
      await processFile(droppedFile);
    }
  };

  // Xác nhận nhập người dùng vào hệ thống
  const handleExecuteImport = async () => {
    if (!preview || preview.valid_count === 0) return;

    setIsExecuting(true);
    setError(null);
    try {
      const res = await executeBulkImportApi(token, {
        file_id: '',
        rows: preview.rows,
      });

      setCompletedSummary({
        total: res.total_processed,
        success: res.success_count,
        failed: res.failed_count,
        failed_rows: res.failed_rows,
      });
      setIsCompleted(true);

      // Bắn sự kiện cập nhật người dùng toàn cục
      window.dispatchEvent(new CustomEvent('USER_ACCOUNTS_CHANGED'));

      emitStatusToast({
        title: 'Nhập người dùng thành công',
        message: `Đã thêm ${res.success_count} tài khoản vào hệ thống.`,
        type: 'success',
      });

      onSuccess?.();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi nhập dữ liệu người dùng.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Lọc dữ liệu danh sách xem trước
  const filteredRows = useMemo(() => {
    if (!preview) return [];
    if (statusFilter === 'VALID') {
      return preview.rows.filter((r) => r.is_valid);
    }
    if (statusFilter === 'INVALID') {
      return preview.rows.filter((r) => !r.is_valid);
    }
    return preview.rows;
  }, [preview, statusFilter]);

  // Phân trang 20 người/trang
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(startIndex, startIndex + pageSize);

  // Reset về file mới
  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setIsCompleted(false);
    setCompletedSummary(null);
    setCurrentPage(1);
    setStatusFilter('ALL');
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
      {/* Khối trên: Breadcrumb + Header + Khung chọn file */}
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
            onClick={onBackToUsers}
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
            <span>Quản lý người dùng</span>
          </button>
          <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>
          <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>
            Nhập người dùng hàng loạt từ Excel
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
                Nhập danh sách người dùng hàng loạt từ Excel
              </h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Tải lên tệp Excel (.xlsx, .xls) để tạo tài khoản nhân viên & đại lý. Phân trang 20 người/trang.
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
              onClick={onBackToUsers}
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
            {/* Hướng dẫn quy trình */}
            <div
              style={{
                padding: preview ? '10px 18px' : '16px 20px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13.5px', marginBottom: '3px' }}>
                  Quy trình nhập dữ liệu người dùng từ Excel:
                </div>
                <div style={{ color: '#64748b', fontSize: '12.5px', lineHeight: '1.5' }}>
                  1. Bấm <strong>Tải file Excel mẫu</strong> để có định dạng chuẩn (Họ tên, Email, SĐT, Vai trò, Chi nhánh, Mật khẩu).<br />
                  2. Điền thông tin người dùng và tải file lên hệ thống để xem trước.<br />
                  3. Kiểm tra danh sách phân trang (20 người/trang). Các dòng hợp lệ sẽ được tạo mới tài khoản.
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#2563eb',
                  fontWeight: '600',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                }}
              >
                Tải file mẫu
              </button>
            </div>

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
                  padding: file ? (preview ? '10px 18px' : '20px') : '32px 20px',
                  border: '2px dashed #93c5fd',
                  borderRadius: '12px',
                  background: file ? '#f0f9ff' : '#ffffff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  boxSizing: 'border-box',
                }}
              >
                {loading ? (
                  <div style={{ color: '#2563eb', fontWeight: '600', fontSize: '14px' }}>
                    ⏳ Đang phân tích file Excel và kiểm tra dữ liệu người dùng...
                  </div>
                ) : file ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>📄</span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px' }}>{file.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {(file.size / 1024).toFixed(1)} KB — Bấm vào đây để chọn file khác
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '34px', marginBottom: '6px' }}>📤</div>
                    <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '14.5px', marginBottom: '3px' }}>
                      Kéo thả file Excel vào đây hoặc click để chọn tệp
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                      Chỉ chấp nhận tệp .xlsx hoặc .xls (Hỗ trợ phân trang 20 người/trang)
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

      {/* Khối kết quả hoặc xem trước */}
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
              Nhập danh sách người dùng thành công!
            </h3>
            <p style={{ color: '#475569', fontSize: '14.5px', marginBottom: '28px', lineHeight: '1.7' }}>
              Tổng số người dùng đã xử lý: <strong>{completedSummary?.total}</strong><br />
              Thêm mới thành công vào hệ thống: <strong style={{ color: '#16a34a' }}>{completedSummary?.success}</strong> người dùng<br />
              {completedSummary && completedSummary.failed > 0 && (
                <span style={{ color: '#dc2626' }}>
                  Bỏ qua các dòng bị lỗi: <strong>{completedSummary.failed}</strong> người dùng
                </span>
              )}
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
              {completedSummary && completedSummary.failed > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadErrors}
                  style={{
                    padding: '11px 22px',
                    background: '#ffffff',
                    border: '1px solid #fecaca',
                    borderRadius: '9px',
                    color: '#dc2626',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Tải danh sách dòng lỗi (.xlsx)</span>
                </button>
              )}

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
                onClick={onBackToUsers}
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
                Xem danh sách người dùng
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
            }}
          >
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '16px 20px',
                boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              {/* Thanh trạng thái, bộ lọc và thống kê */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '14px',
                  marginBottom: '16px',
                  paddingBottom: '14px',
                  borderBottom: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: '700', color: '#334155', marginRight: '4px' }}>
                    Bộ lọc xem:
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('ALL');
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      border: '1px solid',
                      cursor: 'pointer',
                      background: statusFilter === 'ALL' ? '#0f172a' : '#f8fafc',
                      color: statusFilter === 'ALL' ? '#ffffff' : '#475569',
                      borderColor: statusFilter === 'ALL' ? '#0f172a' : '#cbd5e1',
                    }}
                  >
                    Tất cả ({preview.total_rows})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('VALID');
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      border: '1px solid',
                      cursor: 'pointer',
                      background: statusFilter === 'VALID' ? '#16a34a' : '#f0fdf4',
                      color: statusFilter === 'VALID' ? '#ffffff' : '#15803d',
                      borderColor: statusFilter === 'VALID' ? '#16a34a' : '#bbf7d0',
                    }}
                  >
                    ✓ Hợp lệ ({preview.valid_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('INVALID');
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '8px',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      border: '1px solid',
                      cursor: 'pointer',
                      background: statusFilter === 'INVALID' ? '#dc2626' : '#fef2f2',
                      color: statusFilter === 'INVALID' ? '#ffffff' : '#b91c1c',
                      borderColor: statusFilter === 'INVALID' ? '#dc2626' : '#fecaca',
                    }}
                  >
                    ✕ Bị lỗi ({preview.invalid_count})
                  </button>
                </div>

                {/* Nút xuất file lỗi */}
                {preview.invalid_count > 0 && (
                  <button
                    type="button"
                    onClick={handleDownloadErrors}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 14px',
                      background: '#ffffff',
                      border: '1px solid #fecaca',
                      borderRadius: '8px',
                      color: '#dc2626',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Xuất file lỗi ({preview.invalid_count} dòng)</span>
                  </button>
                )}
              </div>

              {/* Bảng danh sách người dùng */}
              <div
                style={{
                  overflowX: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 5, boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)' }}>
                    <tr>
                      <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px', color: '#64748b' }}>Dòng</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', width: '90px', color: '#64748b' }}>Trạng thái</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b' }}>Họ và tên</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b' }}>Email</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b' }}>Số điện thoại</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b' }}>Vai trò</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b' }}>Chi nhánh / Kho</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', color: '#64748b' }}>Mật khẩu</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', minWidth: '180px', color: '#64748b' }}>Ghi chú / Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '28px', textAlign: 'center', color: '#94a3b8' }}>
                          Không có dòng nào phù hợp với bộ lọc này.
                        </td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => {
                        const roleMeta = ROLE_DISPLAY_MAP[row.role || ''] || {
                          title: row.role || 'Chưa rõ',
                          color: '#64748b',
                          bg: '#f1f5f9',
                        };
                        const hasErrors = !row.is_valid && row.errors && Object.keys(row.errors).length > 0;

                        return (
                          <tr
                            key={row.row_index}
                            style={{
                              background: row.is_valid ? '#ffffff' : '#fff5f5',
                              borderBottom: '1px solid #f1f5f9',
                              borderLeft: row.is_valid ? '4px solid #16a34a' : '4px solid #ef4444',
                            }}
                          >
                            <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '600', color: '#64748b' }}>
                              {row.row_index}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {row.is_valid ? (
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
                                  Hợp lệ
                                </span>
                              ) : (
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
                            <td style={{ padding: '10px 14px', fontWeight: '600', color: '#0f172a' }}>
                              {row.full_name || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#2563eb' }}>
                              {row.email || '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569', fontFamily: 'monospace' }}>
                              {row.phone || '—'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11.5px',
                                  fontWeight: '600',
                                  background: roleMeta.bg,
                                  color: roleMeta.color,
                                }}
                              >
                                {roleMeta.title}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>
                              {row.branch || 'Toàn quốc'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace' }}>
                              {row.password ? '••••••••' : 'Mặc định'}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {row.is_valid ? (
                                <span style={{ color: '#16a34a', fontSize: '12px', fontWeight: '500' }}>
                                  ✓ Đủ điều kiện tạo tài khoản
                                </span>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  {hasErrors ? (
                                    Object.entries(row.errors).map(([k, msg]) => (
                                      <span key={k} style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600' }}>
                                        • {msg}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: '#dc2626', fontSize: '12px' }}>Dòng không hợp lệ</span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* PHÂN TRANG (Mặc định 20 người/trang) */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '14px',
                  marginTop: '18px',
                  paddingTop: '14px',
                  borderTop: '1px solid #e2e8f0',
                  fontSize: '13px',
                  color: '#64748b',
                }}
              >
                {/* Chọn số dòng hiển thị */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>Hiển thị</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={10}>10 người / trang</option>
                    <option value={20}>20 người / trang</option>
                    <option value={50}>50 người / trang</option>
                    <option value={100}>100 người / trang</option>
                  </select>
                  <span>
                    (Đang hiển thị {filteredRows.length > 0 ? startIndex + 1 : 0} -{' '}
                    {Math.min(startIndex + pageSize, filteredRows.length)} trong tổng số{' '}
                    <strong>{filteredRows.length}</strong> người)
                  </span>
                </div>

                {/* Điều hướng trang */}
                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage(1)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage <= 1 ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      « Đầu
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage <= 1 ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      ‹ Trước
                    </button>

                    {/* Số trang */}
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
                              onClick={() => setCurrentPage(p)}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: '1px solid',
                                background: safeCurrentPage === p ? '#0fba90' : '#ffffff',
                                color: safeCurrentPage === p ? '#ffffff' : '#0f172a',
                                borderColor: safeCurrentPage === p ? '#0fba90' : '#cbd5e1',
                                cursor: 'pointer',
                                fontSize: '12.5px',
                                fontWeight: safeCurrentPage === p ? '700' : '500',
                              }}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage >= totalPages ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage >= totalPages ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '12.5px',
                        fontWeight: '600',
                      }}
                    >
                      Sau ›
                    </button>
                    <button
                      type="button"
                      disabled={safeCurrentPage >= totalPages}
                      onClick={() => setCurrentPage(totalPages)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: safeCurrentPage >= totalPages ? '#f8fafc' : '#ffffff',
                        color: safeCurrentPage >= totalPages ? '#94a3b8' : '#0f172a',
                        cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
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
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  onClick={onBackToUsers}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={preview.valid_count === 0 || isExecuting}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background:
                      preview.valid_count === 0 || isExecuting
                        ? '#cbd5e1'
                        : 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: preview.valid_count === 0 || isExecuting ? 'not-allowed' : 'pointer',
                    boxShadow:
                      preview.valid_count === 0 || isExecuting
                        ? 'none'
                        : '0 2px 8px rgba(15, 186, 144, 0.35)',
                  }}
                >
                  {isExecuting
                    ? 'Đang nhập dữ liệu...'
                    : `Xác nhận nhập ${preview.valid_count} người dùng hợp lệ`}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
