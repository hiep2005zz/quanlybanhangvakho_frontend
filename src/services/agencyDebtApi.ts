// frontend/src/services/agencyDebtApi.ts
import { API_BASE_URL, authenticatedFetch } from './api';
import type {
  AgencyDebtSummary,
  AgencyInvoicesListResponse,
  AgencyInvoiceDetail,
} from '../types/agencyDebt';

export async function getAgencyDebtSummaryApi(
  token: string,
  dealerId?: number
): Promise<AgencyDebtSummary> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/agency-debts/summary`);
  if (dealerId !== undefined) {
    url.searchParams.set('dealer_id', dealerId.toString());
  }

  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải thông tin tổng quan công nợ (HTTP ${response.status})`);
  }
  return data as AgencyDebtSummary;
}

export async function getAgencyInvoicesApi(
  token: string,
  options: {
    status?: string;
    search?: string;
    page?: number;
    page_size?: number;
    dealerId?: number;
  } = {}
): Promise<AgencyInvoicesListResponse> {
  const url = new URL(`${window.location.origin}${API_BASE_URL}/agency-debts/invoices`);
  if (options.status) url.searchParams.set('status', options.status);
  if (options.search) url.searchParams.set('search', options.search);
  if (options.page) url.searchParams.set('page', options.page.toString());
  if (options.page_size) url.searchParams.set('page_size', options.page_size.toString());
  if (options.dealerId !== undefined) url.searchParams.set('dealer_id', options.dealerId.toString());

  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải danh sách hóa đơn (HTTP ${response.status})`);
  }
  return data as AgencyInvoicesListResponse;
}

export async function getAgencyInvoiceDetailApi(
  token: string,
  invoiceCode: string,
  dealerId?: number
): Promise<AgencyInvoiceDetail> {
  const url = new URL(
    `${window.location.origin}${API_BASE_URL}/agency-debts/invoices/${encodeURIComponent(invoiceCode)}`
  );
  if (dealerId !== undefined) {
    url.searchParams.set('dealer_id', dealerId.toString());
  }

  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải chi tiết hóa đơn (HTTP ${response.status})`);
  }
  return data as AgencyInvoiceDetail;
}

export async function downloadAgencyInvoiceApi(
  token: string,
  invoiceCode: string,
  format: 'xml' | 'json' | 'pdf' = 'pdf',
  dealerId?: number
): Promise<{ blob: Blob; filename: string }> {
  const url = new URL(
    `${window.location.origin}${API_BASE_URL}/agency-debts/invoices/${encodeURIComponent(invoiceCode)}/download`
  );
  url.searchParams.set('format', format);
  if (dealerId !== undefined) {
    url.searchParams.set('dealer_id', dealerId.toString());
  }

  const response = await authenticatedFetch(url.toString(), { method: 'GET' }, token);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || `Lỗi tải file hóa đơn (HTTP ${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition');
  let filename = `${invoiceCode}.${format}`;
  if (disposition && disposition.includes('filename=')) {
    const match = disposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  return { blob, filename };
}
