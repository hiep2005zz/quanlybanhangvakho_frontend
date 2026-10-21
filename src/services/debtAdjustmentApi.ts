// frontend/src/services/debtAdjustmentApi.ts
import { API_BASE_URL, authenticatedFetch } from './api';
import type {
  DebtAdjustment,
  DebtAdjustmentPreview,
  PendingReturnOrder,
  DebtAdjustmentListResponse,
  CreateDebtAdjustmentPayload,
  DebtAdjustmentPrintDocument,
} from '../types/debtAdjustment';

export async function getPendingReturnsApi(
  token: string,
  dealerId?: number
): Promise<PendingReturnOrder[]> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-adjustments/pending-returns`);
  if (dealerId !== undefined) {
    url.searchParams.set('dealer_id', dealerId.toString());
  }

  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ([]));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách phiếu trả hàng chờ xử lý (HTTP ${response.status})`);
  }
  return data as PendingReturnOrder[];
}

export async function getDebtAdjustmentPreviewApi(
  token: string,
  returnId: number
): Promise<DebtAdjustmentPreview> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-adjustments/preview/${returnId}`);
  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải dữ liệu xem trước chứng từ (HTTP ${response.status})`);
  }
  return data as DebtAdjustmentPreview;
}

export async function createDebtAdjustmentApi(
  token: string,
  payload: CreateDebtAdjustmentPayload
): Promise<DebtAdjustment> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-adjustments`);
  const response = await authenticatedFetch(
    url.toString(),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi lập chứng từ điều chỉnh giảm công nợ (HTTP ${response.status})`);
  }
  return data as DebtAdjustment;
}

export async function getDebtAdjustmentsApi(
  token: string,
  options: {
    dealerId?: number;
    dealer_id?: number;
    fromDate?: string;
    from_date?: string;
    startDate?: string;
    start_date?: string;
    toDate?: string;
    to_date?: string;
    endDate?: string;
    end_date?: string;
    search?: string;
    statusFilter?: string;
    status?: string;
    page?: number;
    pageSize?: number;
    page_size?: number;
  } = {}
): Promise<DebtAdjustmentListResponse> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-adjustments`);
  const dId = options.dealerId ?? options.dealer_id;
  if (dId !== undefined) url.searchParams.set('dealer_id', dId.toString());
  const fromD = options.fromDate || options.from_date || options.startDate || options.start_date;
  if (fromD) url.searchParams.set('from_date', fromD);
  const toD = options.toDate || options.to_date || options.endDate || options.end_date;
  if (toD) url.searchParams.set('to_date', toD);
  if (options.search) url.searchParams.set('search', options.search);
  const st = options.statusFilter || options.status;
  if (st && st !== 'ALL') url.searchParams.set('status_filter', st);
  if (options.page) url.searchParams.set('page', options.page.toString());
  const ps = options.pageSize ?? options.page_size;
  if (ps) url.searchParams.set('page_size', ps.toString());

  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách chứng từ điều chỉnh (HTTP ${response.status})`);
  }
  return data as DebtAdjustmentListResponse;
}

export async function getDebtAdjustmentDetailApi(
  token: string,
  adjId: number
): Promise<DebtAdjustment> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-adjustments/${adjId}`);
  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải chi tiết chứng từ (HTTP ${response.status})`);
  }
  return data as DebtAdjustment;
}

export async function getDebtAdjustmentPrintDocumentApi(
  token: string,
  adjId: number
): Promise<DebtAdjustmentPrintDocument> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-adjustments/${adjId}/export-pdf`);
  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải mẫu in chứng từ giảm nợ (HTTP ${response.status})`);
  }
  return data as DebtAdjustmentPrintDocument;
}

export async function createMockReturnApi(
  token: string,
  orderId?: number
): Promise<PendingReturnOrder> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-adjustments/mock-return`);
  if (orderId !== undefined) url.searchParams.set('order_id', orderId.toString());
  const response = await authenticatedFetch(url.toString(), { method: 'POST' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tạo mẫu phiếu trả hàng (HTTP ${response.status})`);
  }
  return data as PendingReturnOrder;
}

// Aliases for compatibility
export const getPendingReturnOrdersApi = getPendingReturnsApi;
export const createMockReturnOrderApi = createMockReturnApi;
