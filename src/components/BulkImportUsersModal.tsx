import React, { useState, useRef } from 'react';
import { API_BASE_URL } from '../services/api';
import { emitStatusToast } from './StatusToast';

interface BulkImportUsersModalProps {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface RowPreview {
  row_index: number;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  branch: string;
  is_valid: boolean;
  errors: string[];
}

interface PreviewResponse {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  preview_data: RowPreview[];
}

export const BulkImportUsersModal: React.FC<BulkImportUsersModalProps> = ({ token, onClose, onSuccess }) => {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    fetch(`${API_BASE_URL}/users/import/template`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Không thể tải template');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'user_import_template.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      })
      .catch(err => setError(err.message));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${API_BASE_URL}/users/import/preview`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Lỗi khi phân tích file');
      }
      const data: PreviewResponse = await res.json();
      setPreview(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleExecute = async () => {
    if (!preview || preview.valid_rows === 0) return;
    setIsExecuting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/users/import/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ rows: preview.preview_data })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Lỗi khi import');
      }
      const result = await res.json();
      emitStatusToast({
        title: 'Import hoàn tất',
        message: `Thành công: ${result.success_count}, Thất bại: ${result.failed_count}`
      });

      if (result.failed_count > 0 && result.failed_rows.length > 0) {
        // Export errors if any
        const errorRes = await fetch(`${API_BASE_URL}/users/import/export-errors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ rows: result.failed_rows })
        });
        if (errorRes.ok) {
          const blob = await errorRes.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'import_errors.xlsx';
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px', padding: '24px',
        width: '900px', maxWidth: '95vw', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>Nhập danh sách người dùng từ Excel</h2>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              cursor: 'pointer', 
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '6px',
              transition: 'all 0.2s',
              boxShadow: 'none'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {error && (
          <div style={{ padding: '12px', background: '#fee2e2', color: '#b91c1c', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        {!preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
            <p style={{ margin: 0 }}>Vui lòng tải tệp mẫu về để điền dữ liệu trước khi tải lên.</p>
            <button onClick={handleDownloadTemplate} style={{
              padding: '8px 16px', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer'
            }}>Tải tệp mẫu (.xlsx)</button>

            <div style={{
              width: '100%', padding: '40px', border: '2px dashed #cbd5e1',
              borderRadius: '12px', textAlign: 'center', marginTop: '16px'
            }}>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                ref={fileInputRef}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{
                  padding: '10px 20px', background: '#10b981', color: '#fff',
                  border: 'none', borderRadius: '8px', cursor: 'pointer',
                  opacity: isUploading ? 0.7 : 1
                }}
              >
                {isUploading ? 'Đang phân tích...' : 'Chọn tệp tải lên'}
              </button>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '12px' }}>Chỉ hỗ trợ tệp định dạng .xlsx</p>
            </div>
          </div>
        )}

        {preview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, minHeight: 0 }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#64748b' }}>Tổng số dòng</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{preview.total_rows}</div>
              </div>
              <div style={{ padding: '12px', background: '#ecfdf5', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#059669' }}>Dòng hợp lệ</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{preview.valid_rows}</div>
              </div>
              <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '8px', flex: 1 }}>
                <div style={{ fontSize: '13px', color: '#e11d48' }}>Dòng bị lỗi</div>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#ef4444' }}>{preview.invalid_rows}</div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0 }}>
                  <tr>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Dòng</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Họ và tên</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Email</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Trạng thái</th>
                    <th style={{ padding: '10px', textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>Lỗi (nếu có)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview_data.map((row, i) => (
                    <tr key={i} style={{ background: row.is_valid ? '#ffffff' : '#fef2f2', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '10px' }}>{row.row_index}</td>
                      <td style={{ padding: '10px' }}>{row.full_name}</td>
                      <td style={{ padding: '10px' }}>{row.email}</td>
                      <td style={{ padding: '10px' }}>
                        {row.is_valid ? (
                          <span style={{ color: '#10b981', fontWeight: '600' }}>Hợp lệ</span>
                        ) : (
                          <span style={{ color: '#ef4444', fontWeight: '600' }}>Lỗi</span>
                        )}
                      </td>
                      <td style={{ padding: '10px', color: '#ef4444' }}>
                        {!row.is_valid && row.errors.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setPreview(null)}
                style={{ padding: '10px 16px', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                Hủy / Chọn lại file
              </button>
              <button
                onClick={handleExecute}
                disabled={preview.valid_rows === 0 || isExecuting}
                style={{
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #0fba90 0%, #0fad89 100%)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (preview.valid_rows === 0 || isExecuting) ? 'not-allowed' : 'pointer',
                  opacity: (preview.valid_rows === 0 || isExecuting) ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(15, 186, 144, 0.35)',
                  fontWeight: '600',
                }}
              >
                {isExecuting ? 'Đang xử lý...' : `Xác nhận nhập ${preview.valid_rows} dòng`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
