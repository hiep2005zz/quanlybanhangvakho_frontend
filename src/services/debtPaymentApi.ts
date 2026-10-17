// frontend/src/services/debtPaymentApi.ts
import { API_BASE_URL, authenticatedFetch } from './api';
import type {
  CreatePaymentReceiptPayload,
  FifoPreviewItem,
  PaymentReceipt,
  DealerDebtSummary,
  InvoiceAllocationOption,
  CreateAdjustmentPayload,
  PaymentAdjustment,
} from '../types/debtPayment';

export async function getAllDealersDebtSummaryApi(token: string): Promise<DealerDebtSummary[]> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments/dealers`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách đại lý (HTTP ${response.status})`);
  }
  return data as DealerDebtSummary[];
}

export async function getDealerDebtSummaryApi(token: string, dealerId: number): Promise<DealerDebtSummary> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments/dealers/${dealerId}/summary`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải thông tin công nợ đại lý (HTTP ${response.status})`);
  }
  return data as DealerDebtSummary;
}

export async function getDealerInvoicesForAllocationApi(
  token: string,
  dealerId: number
): Promise<InvoiceAllocationOption[]> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments/dealers/${dealerId}/invoices`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách hoá đơn đối trừ (HTTP ${response.status})`);
  }
  return data as InvoiceAllocationOption[];
}

export async function previewFifoAllocationApi(
  token: string,
  dealerId: number,
  amount: number
): Promise<FifoPreviewItem[]> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments/preview-fifo`;
  const response = await authenticatedFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dealer_id: dealerId, amount }),
    },
    token
  );
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi xem trước đối trừ FIFO (HTTP ${response.status})`);
  }
  return data as FifoPreviewItem[];
}

export async function createPaymentReceiptApi(
  token: string,
  payload: CreatePaymentReceiptPayload
): Promise<PaymentReceipt> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments`;
  const response = await authenticatedFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi ghi nhận thanh toán (HTTP ${response.status})`);
  }
  return data as PaymentReceipt;
}

export async function getPaymentReceiptsApi(
  token: string,
  dealerId?: number
): Promise<PaymentReceipt[]> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/debt-payments`);
  if (dealerId !== undefined) {
    url.searchParams.set('dealer_id', dealerId.toString());
  }
  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => []);
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách phiếu thu (HTTP ${response.status})`);
  }
  return data as PaymentReceipt[];
}

export async function getPaymentReceiptDetailApi(
  token: string,
  receiptId: number
): Promise<PaymentReceipt> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments/${receiptId}`;
  const response = await authenticatedFetch(url, { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải chi tiết phiếu thu (HTTP ${response.status})`);
  }
  return data as PaymentReceipt;
}

export async function createPaymentAdjustmentApi(
  token: string,
  receiptId: number,
  payload: CreateAdjustmentPayload
): Promise<PaymentAdjustment> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments/${receiptId}/adjust`;
  const response = await authenticatedFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi lập bút toán điều chỉnh (HTTP ${response.status})`);
  }
  return data as PaymentAdjustment;
}

export async function syncInvoicesApi(token: string): Promise<void> {
  const url = `${window.location.origin}${API_BASE_URL}/debt-payments/sync-invoices`;
  const response = await authenticatedFetch(url, { method: 'POST' }, token);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Lỗi đồng bộ hoá đơn (HTTP ${response.status})`);
  }
}
