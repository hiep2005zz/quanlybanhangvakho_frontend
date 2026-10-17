// frontend/src/services/salesTargetApi.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface SalesTargetAuditLog {
  modified_at: string;
  modified_by_id: number;
  modified_by_name: string;
  old_target_amount: number;
  new_target_amount: number;
  reason: string;
}

export interface SalesTargetItem {
  id: number;
  target_type: 'salesperson' | 'region';
  employee_id?: number | null;
  employee_name?: string | null;
  region?: string | null;
  month_year: string;
  target_amount: number;
  actual_amount: number;
  progress_pct: number;
  remaining_amount: number;
  projected_amount?: number | null;
  is_locked: boolean;
  note?: string | null;
  created_by: string;
  created_at?: string | null;
  updated_at?: string | null;
  audit_logs: SalesTargetAuditLog[];
}

export interface SalesTargetSummary {
  month_year: string;
  total_target_amount: number;
  total_actual_amount: number;
  average_progress_pct: number;
  completed_count: number;
  total_count: number;
}

export interface SalesTargetListResponse {
  summary: SalesTargetSummary;
  items: SalesTargetItem[];
  can_manage: boolean;
  current_month_year: string;
}

export interface SalesTargetCreatePayload {
  target_type: 'salesperson' | 'region';
  employee_id?: number | null;
  employee_name?: string | null;
  region?: string | null;
  month_year: string;
  target_amount: number;
  note?: string | null;
}

export interface SalesTargetUpdatePayload {
  target_amount: number;
  note?: string | null;
  reason?: string | null;
}

export interface MyProgressResponse {
  employee_id: number;
  employee_name: string;
  month_year: string;
  target_amount: number;
  actual_amount: number;
  progress_pct: number;
  remaining_amount: number;
  projected_amount?: number | null;
  is_locked: boolean;
  days_left: number;
}

export const fetchSalesTargets = async (
  token: string,
  monthYear?: string,
  targetType: string = 'all',
  search?: string
): Promise<SalesTargetListResponse> => {
  const params = new URLSearchParams();
  if (monthYear) params.append('month_year', monthYear);
  if (targetType && targetType !== 'all') params.append('target_type', targetType);
  if (search && search.trim()) params.append('search', search.trim());

  const res = await fetch(`${API_BASE_URL}/api/v1/sales-targets?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi tải danh sách chỉ tiêu doanh số' }));
    throw new Error(err.detail || 'Lỗi tải danh sách chỉ tiêu doanh số');
  }

  return res.json();
};

export const fetchMySalesProgress = async (token: string): Promise<MyProgressResponse> => {
  const res = await fetch(`${API_BASE_URL}/api/v1/sales-targets/my-progress`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi tải tiến độ cá nhân' }));
    throw new Error(err.detail || 'Lỗi tải tiến độ cá nhân');
  }

  return res.json();
};

export const createSalesTarget = async (
  token: string,
  payload: SalesTargetCreatePayload
): Promise<SalesTargetItem> => {
  const res = await fetch(`${API_BASE_URL}/api/v1/sales-targets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi thiết lập chỉ tiêu' }));
    throw new Error(err.detail || 'Lỗi thiết lập chỉ tiêu');
  }

  return res.json();
};

export const updateSalesTarget = async (
  token: string,
  id: number,
  payload: SalesTargetUpdatePayload
): Promise<SalesTargetItem> => {
  const res = await fetch(`${API_BASE_URL}/api/v1/sales-targets/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi cập nhật chỉ tiêu' }));
    throw new Error(err.detail || 'Lỗi cập nhật chỉ tiêu');
  }

  return res.json();
};

export const deleteSalesTarget = async (token: string, id: number): Promise<{ message: string }> => {
  const res = await fetch(`${API_BASE_URL}/api/v1/sales-targets/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi xóa chỉ tiêu' }));
    throw new Error(err.detail || 'Lỗi xóa chỉ tiêu');
  }

  return res.json();
};

export interface SalespersonOption {
  id: number;
  username: string;
  full_name: string;
  role: string;
  role_label: string;
}

export interface SalesTargetMetadataResponse {
  salespersons: SalespersonOption[];
  regions: string[];
}

export const fetchSalesTargetsMetadata = async (token: string): Promise<SalesTargetMetadataResponse> => {
  const res = await fetch(`${API_BASE_URL}/api/v1/sales-targets/metadata`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Lỗi tải danh sách nhân viên và khu vực' }));
    throw new Error(err.detail || 'Lỗi tải danh sách nhân viên và khu vực');
  }

  return res.json();
};

