import React, { useState, useRef } from 'react';
import {
  BulkImportRowResult,
  BulkImportPreviewResponse,
  uploadBulkImportPreviewApi,
  executeBulkImportApi,
  downloadBulkImportTemplateApi,
  downloadBulkImportErrorsApi
} from '../services/importApi';
import { ModalPortal } from './ModalPortal';

interface UserBulkImportModalProps {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const UserBulkImportModal: React.FC<UserBulkImportModalProps> = ({ token, onClose, onSuccess }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<BulkImportPreviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [summary, setSummary] = useState<{ total: number; success: number; failed: number; failed_rows: BulkImportRowResult[] } | null>(null);

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
      alert(err.message || 'Lỗi khi tải template.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setError(null);
    setLoading(true);
    try {
      const data = await uploadBulkImportPreviewApi(token, selected);
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
      const res = await executeBulkImportApi(token, {
        file_id: file?.name || 'unknown',
        rows: preview.rows
      });
      setSummary({
        total: res.total_processed,
        success: res.success_count,
        failed: res.failed_count,
        failed_rows: res.failed_rows
      });
      setIsCompleted(true);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi import dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrors = async () => {
    if (!summary || summary.failed_rows.length === 0) return;
    try {
      const blob = await downloadBulkImportErrorsApi(token, { file_id: file?.name || 'unknown', rows: summary.failed_rows });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Import_Errors.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tải file lỗi.');
    }
  };

  return (
    <ModalPortal>
      <div style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, padding: '20px', boxSizing: 'border-box'
      }}>
        <div style={{
          backgroundColor: '#ffffff', borderRadius: '16px',
          width: '100%', maxWidth: '900px', maxHeight: 'calc(100vh - 32px)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
        }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#0f172a' }}>Nhập người dùng hàng loạt</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {isCompleted ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', color: '#22c55e', marginBottom: '16px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Nhập dữ liệu hoàn tất!</h3>
              <p style={{ color: '#475569', marginBottom: '24px' }}>
                Tổng số dòng xử lý: <strong>{summary?.total}</strong><br />
                Thành công: <strong style={{ color: '#16a34a' }}>{summary?.success}</strong><br />
                Thất bại: <strong style={{ color: '#dc2626' }}>{summary?.failed}</strong>
              </p>
              {summary && summary.failed > 0 && (
                <button
                  onClick={handleDownloadErrors}
                  style={{
                    padding: '10px 16px', background: '#fee2e2', color: '#b91c1c',
                    border: '1px solid #fecaca', borderRadius: '8px', fontWeight: '600', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: '8px'
                  }}
                >
                  Tải file chứa các dòng lỗi
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Instructions */}
              <div style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', color: '#334155' }}>Hướng dẫn nhập dữ liệu</h4>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                      1. Tải file mẫu về máy và điền dữ liệu.<br />
                      2. Tải file đã điền lên để xem trước.<br />
                      3. Các dòng hợp lệ sẽ được thêm, các dòng lỗi bị bỏ qua.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    style={{
                      padding: '8px 16px', background: '#ffffff', border: '1px solid #cbd5e1',
                      borderRadius: '8px', color: '#2563eb', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Tải file mẫu
                  </button>
                </div>
              </div>

              {/* Upload Input */}
              <div style={{ marginBottom: '24px' }}>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '28px', border: '2px dashed #cbd5e1',
                    borderRadius: '12px', background: file ? '#f0f9ff' : '#ffffff', cursor: loading ? 'not-allowed' : 'pointer',
                    color: file ? '#0284c7' : '#64748b', fontWeight: '600', fontSize: '15px'
                  }}
                >
                  {loading ? 'Đang xử lý...' : (file ? 'Đã chọn file (Bấm để đổi file khác)' : 'Bấm vào đây để chọn file Excel')}
                </button>
              </div>

              {error && (
                <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', marginBottom: '20px' }}>
                  {error}
                </div>
              )}

              {/* Preview Table */}
              {preview && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h4 style={{ margin: 0, color: '#0f172a' }}>Xem trước dữ liệu</h4>
                    <div style={{ fontSize: '14px' }}>
                      <span style={{ color: '#16a34a', fontWeight: '600', marginRight: '16px' }}>Hợp lệ: {preview.valid_count}</span>
                      <span style={{ color: '#dc2626', fontWeight: '600' }}>Lỗi: {preview.invalid_count}</span>
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '300px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                        <tr>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', width: '50px' }}>Dòng</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Họ và tên</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Email</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Số điện thoại</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Vai trò</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Chi nhánh / Kho</th>
                          <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>Lý do lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row) => (
                          <tr key={row.row_index} style={{ background: row.is_valid ? '#ffffff' : '#fef2f2', borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px' }}>{row.row_index}</td>
                            <td style={{ padding: '10px', fontWeight: '500' }}>{row.full_name}</td>
                            <td style={{ padding: '10px' }}>{row.email}</td>
                            <td style={{ padding: '10px' }}>{row.phone}</td>
                            <td style={{ padding: '10px' }}>
                              {(() => {
                                const roleTitleMap: Record<string, string> = {
                                  admin: 'Quản trị hệ thống',
                                  sales_manager: 'Quản lý kinh doanh',
                                  sales: 'Nhân viên kinh doanh',
                                  sale: 'Nhân viên kinh doanh',
                                  warehouse: 'Thủ kho',
                                  warehouse_manager: 'Quản lý kho',
                                  accountant: 'Kế toán',
                                  purchasing: 'Nhân viên mua hàng',
                                  customer: 'Đại lý',
                                };
                                const roleColorMap: Record<string, { bg: string; text: string }> = {
                                  admin: { bg: '#fee2e2', text: '#dc2626' },
                                  sales_manager: { bg: '#ede9fe', text: '#7c3aed' },
                                  sales: { bg: '#eff6ff', text: '#2563eb' },
                                  sale: { bg: '#eff6ff', text: '#2563eb' },
                                  warehouse: { bg: '#dcfce7', text: '#15803d' },
                                  warehouse_manager: { bg: '#d1fae5', text: '#059669' },
                                  accountant: { bg: '#fef3c7', text: '#d97706' },
                                  purchasing: { bg: '#cffafe', text: '#0891b2' },
                                  customer: { bg: '#e0f2fe', text: '#0284c7' },
                                };
                                const rKey = (row.role || '').toLowerCase().trim();
                                const title = roleTitleMap[rKey] || row.role || 'Chưa chọn';
                                const colors = roleColorMap[rKey] || { bg: '#f1f5f9', text: '#475569' };
                                return (
                                  <span style={{
                                    padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                                    background: colors.bg, color: colors.text
                                  }}>
                                    {title}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '10px' }}>{row.branch || 'Kho Tổng Hà Nội'}</td>
                            <td style={{ padding: '10px', color: '#b91c1c' }}>
                              {!row.is_valid && Object.values(row.errors).map((err, i) => (
                                <div key={i}>• {err}</div>
                              ))}
                              {row.is_valid && <span style={{ color: '#16a34a' }}>Hợp lệ</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {!isCompleted ? (
            <>
              <button
                onClick={onClose}
                style={{ padding: '10px 18px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#334155', fontWeight: '600', cursor: 'pointer' }}
              >
                Hủy
              </button>
              <button
                onClick={handleExecuteImport}
                disabled={!preview || preview.valid_count === 0 || loading}
                style={{
                  padding: '10px 18px', background: '#0fad89', border: 'none', borderRadius: '8px',
                  color: '#ffffff', fontWeight: '600', cursor: (!preview || preview.valid_count === 0 || loading) ? 'not-allowed' : 'pointer',
                  opacity: (!preview || preview.valid_count === 0 || loading) ? 0.6 : 1
                }}
              >
                Xác nhận
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{ padding: '10px 18px', background: '#0fad89', border: 'none', borderRadius: '8px', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
