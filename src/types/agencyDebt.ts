// frontend/src/types/agencyDebt.ts

export type InvoiceStatusType = 'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface AgencyDebtSummary {
  dealer_id: number;
  dealer_code: string;
  dealer_name: string;
  phone?: string | null;
  address?: string | null;
  credit_limit: number;
  total_debt: number;
  pending_orders_amount: number;
  remaining_credit: number;
  overdue_invoices_count: number;
  nearest_due_days: number | null;
  nearest_due_invoice_code: string | null;
  nearest_due_date: string | null;
  is_overdue: boolean;
  is_over_limit: boolean;
}

export interface AgencyInvoiceItem {
  id: number;
  invoice_code: string;
  order_id?: number | null;
  order_code: string;
  dealer_id: number;
  dealer_name: string;
  issue_date: string;
  due_date: string;
  days_until_due: number;
  is_overdue: boolean;
  total_amount: number;
  paid_amount: number;
  remaining_debt: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  status_label: string;
  items_count: number;
  note?: string | null;
}

export interface AgencyInvoicesListResponse {
  items: AgencyInvoiceItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface InvoiceDetailProduct {
  product_id?: number;
  product_name: string;
  unit_name?: string;
  quantity: number;
  price: number;
  total: number;
}

export interface AgencyInvoiceDetail {
  id: number;
  invoice_code: string;
  order_id?: number | null;
  order_code: string;
  dealer: {
    id: number;
    code: string;
    name: string;
    tax_code?: string;
    phone?: string;
    address?: string;
    email?: string;
  };
  seller: {
    name: string;
    tax_code: string;
    address: string;
    phone: string;
    bank_account: string;
  };
  issue_date: string;
  due_date: string;
  days_until_due: number;
  total_amount: number;
  paid_amount: number;
  remaining_debt: number;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  status_label: string;
  items: InvoiceDetailProduct[];
  note?: string | null;
}
