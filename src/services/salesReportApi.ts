import { API_BASE_URL, AUTH_STORAGE } from './api';

export type SalesDimension = 'salesperson' | 'region' | 'dealer' | 'category' | 'sku';
export type SalesTimePreset = 'this_month' | 'last_month' | 'this_quarter' | 'today' | 'custom';

export interface SalesReportItem {
  id: string;
  code?: string | null;
  name: string;
  sub_text?: string | null;
  quantity: number;
  revenue: number;
  previous_quantity?: number;
  previous_revenue?: number;
  growth_rate?: number;
  // Chỉ có giá trị khi người dùng là Admin hoặc Quản lý kinh doanh
  cost?: number | null;
  gross_profit?: number | null;
  gross_margin_pct?: number | null;
}

export interface SalesReportSummary {
  total_quantity: number;
  total_revenue: number;
  previous_total_revenue: number;
  total_growth_rate: number;
  total_orders_count: number;
  can_view_profit: boolean;
  total_cost?: number | null;
  total_gross_profit?: number | null;
  average_gross_margin_pct?: number | null;
}

export interface SalesMultidimensionalResponse {
  dimension: SalesDimension;
  time_preset: SalesTimePreset;
  start_date: string;
  end_date: string;
  previous_start_date: string;
  previous_end_date: string;
  summary: SalesReportSummary;
  items: SalesReportItem[];
  can_view_profit: boolean;
}

export interface SalesReportQueryParams {
  dimension?: SalesDimension;
  time_preset?: SalesTimePreset;
  start_date?: string;
  end_date?: string;
  search?: string;
}

export async function fetchSalesMultidimensionalReport(
  params: SalesReportQueryParams = {},
  token?: string | null
): Promise<SalesMultidimensionalResponse> {
  const authToken = token || localStorage.getItem(AUTH_STORAGE.TOKEN);
  const searchParams = new URLSearchParams();

  if (params.dimension) searchParams.set('dimension', params.dimension);
  if (params.time_preset) searchParams.set('time_preset', params.time_preset);
  if (params.start_date) searchParams.set('start_date', params.start_date);
  if (params.end_date) searchParams.set('end_date', params.end_date);
  if (params.search && params.search.trim()) searchParams.set('search', params.search.trim());

  const queryStr = searchParams.toString();
  const url = `${API_BASE_URL}/reports/sales-multidimensional${queryStr ? `?${queryStr}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
  });

  if (!res.ok) {
    let errorDetail = 'Không thể tải báo cáo doanh số đa chiều';
    try {
      const errJson = await res.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // Bỏ qua lỗi parse
    }
    throw new Error(errorDetail);
  }

  return res.json();
}
