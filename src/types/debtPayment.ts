// frontend/src/types/debtPayment.ts

export interface AllocationItemRequest {
  invoice_id: number;
  allocated_amount: number;
}

export interface CreatePaymentReceiptPayload {
  dealer_id: number;
  amount: number;
  payment_method: string;
  payment_date?: string;
  collector_name?: string;
  note?: string;
  allocation_mode: 'AUTO_FIFO' | 'MANUAL';
  allocations?: AllocationItemRequest[];
  save_history?: boolean;
}

export interface FifoPreviewItem {
  invoice_id: number;
  invoice_code: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  paid_before: number;
  remaining_before: number;
  allocated_amount: number;
  remaining_after: number;
  new_status: string;
  new_status_label: string;
}

export interface PaymentAllocation {
  id: number;
  payment_id: number;
  invoice_id: number;
  invoice_code?: string | null;
  allocated_amount: number;
  current_allocated_amount: number;
  invoice_total?: number | null;
  invoice_paid?: number | null;
  invoice_remaining?: number | null;
  invoice_status?: string | null;
  created_at: string;
}

export interface PaymentAdjustment {
  id: number;
  adjustment_code: string;
  payment_id: number;
  adjusted_by_id?: number | null;
  adjusted_by_name: string;
  adjustment_amount: number;
  reason: string;
  details_json?: string | null;
  created_at: string;
}

export interface PaymentReceipt {
  id: number;
  receipt_code: string;
  dealer_id: number;
  dealer_code?: string | null;
  dealer_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  collector_id?: number | null;
  collector_name: string;
  note?: string | null;
  allocation_mode: 'AUTO_FIFO' | 'MANUAL';
  status: 'CONFIRMED' | 'ADJUSTED';
  created_at: string;
  updated_at?: string | null;
  allocations: PaymentAllocation[];
  adjustments: PaymentAdjustment[];
}

export interface DealerDebtSummary {
  dealer_id: number;
  dealer_code: string;
  dealer_name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  credit_limit: number;
  total_receivable: number;
  total_paid: number;
  total_remaining_debt: number;
  open_invoices_count: number;
  overdue_invoices_count: number;
  is_overdue: boolean;
  is_over_limit: boolean;
}

export interface InvoiceAllocationOption {
  id: number;
  invoice_code: string;
  order_code?: string | null;
  issue_date: string;
  due_date: string;
  days_until_due: number;
  is_overdue: boolean;
  total_amount: number;
  paid_amount: number;
  remaining_debt: number;
  remaining_amount: number;
  status: string;
  status_label: string;
  items_count?: number;
  note?: string | null;
}

export interface InvoiceAdjustmentItemRequest {
  invoice_id: number;
  amount: number;
}

export interface CreateAdjustmentPayload {
  reason: string;
  adjustment_amount?: number;
  invoice_id?: number;
  invoice_adjustments?: InvoiceAdjustmentItemRequest[];
}
