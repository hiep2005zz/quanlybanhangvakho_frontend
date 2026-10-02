import { API_BASE_URL, authenticatedFetch } from './api';

export interface BulkImportRowResult {
  row_index: number;
  full_name?: string;
  email?: string;
  phone?: string;
  role?: string;
  branch?: string;
  password?: string;
  is_valid: boolean;
  errors: Record<string, string>;
}

export interface BulkImportPreviewResponse {
  rows: BulkImportRowResult[];
  total_rows: number;
  valid_count: number;
  invalid_count: number;
}

export interface BulkImportExecuteRequest {
  file_id: string;
  rows: BulkImportRowResult[];
}

export interface BulkImportExecuteResponse {
  total_processed: number;
  success_count: number;
  failed_count: number;
  failed_rows: BulkImportRowResult[];
}

export async function uploadBulkImportPreviewApi(token: string, file: File): Promise<BulkImportPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/users/import/preview`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải tệp lên (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function executeBulkImportApi(token: string, request: BulkImportExecuteRequest): Promise<BulkImportExecuteResponse> {
  const response = await authenticatedFetch(`${API_BASE_URL}/users/import/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi nhập dữ liệu (Mã lỗi ${response.status})`);
  }
  return data;
}

export async function downloadBulkImportTemplateApi(token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/users/import/template`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Lỗi tải tệp mẫu');
  }
  return await response.blob();
}

export async function downloadBulkImportErrorsApi(token: string, request: BulkImportExecuteRequest): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/users/import/export-errors`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error('Lỗi xuất tệp lỗi');
  }
  return await response.blob();
}
