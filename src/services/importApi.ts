import { API_BASE_URL, authenticatedFetch, AUTH_STORAGE } from './api';

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

function getActiveToken(token?: string): string {
  if (token && token.trim() && token !== 'undefined' && token !== 'null') {
    return token.trim();
  }
  const stored = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(AUTH_STORAGE.TOKEN) : null;
  return stored || '';
}

async function extractErrorMessage(response: Response, defaultMessage: string): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === 'string') {
      return data.detail;
    }
    if (data?.detail && typeof data.detail.message === 'string') {
      return data.detail.message;
    }
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return data.detail.map((d: any) => d.msg || JSON.stringify(d)).join('; ');
    }
    if (typeof data?.message === 'string') {
      return data.message;
    }
  } catch {
    // response is not JSON
  }
  if (response.status === 401) {
    return 'Phiên làm việc đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.';
  }
  if (response.status === 403) {
    return 'Bạn không có quyền thực hiện chức năng này.';
  }
  return `${defaultMessage} (Mã lỗi ${response.status})`;
}

export async function uploadBulkImportPreviewApi(token: string, file: File): Promise<BulkImportPreviewResponse> {
  const currentToken = getActiveToken(token);
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/users/import/preview`, {
    method: 'POST',
    headers: {
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
    },
    body: formData,
  });
  if (!response.ok) {
    const errorMsg = await extractErrorMessage(response, 'Lỗi tải tệp lên');
    throw new Error(errorMsg);
  }
  return response.json();
}

export async function executeBulkImportApi(token: string, request: BulkImportExecuteRequest): Promise<BulkImportExecuteResponse> {
  const currentToken = getActiveToken(token);
  const response = await fetch(`${API_BASE_URL}/users/import/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const errorMsg = await extractErrorMessage(response, 'Lỗi nhập dữ liệu');
    throw new Error(errorMsg);
  }
  return response.json();
}

export async function downloadBulkImportTemplateApi(token?: string): Promise<Blob> {
  const currentToken = getActiveToken(token);
  const response = await fetch(`${API_BASE_URL}/users/import/template`, {
    method: 'GET',
    headers: {
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
    }
  });
  if (!response.ok) {
    const errorMsg = await extractErrorMessage(response, 'Lỗi tải tệp mẫu');
    throw new Error(errorMsg);
  }
  return await response.blob();
}

export async function downloadBulkImportErrorsApi(token: string, request: BulkImportExecuteRequest): Promise<Blob> {
  const currentToken = getActiveToken(token);
  const response = await fetch(`${API_BASE_URL}/users/import/export-errors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
    },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    const errorMsg = await extractErrorMessage(response, 'Lỗi xuất tệp lỗi');
    throw new Error(errorMsg);
  }
  return await response.blob();
}
