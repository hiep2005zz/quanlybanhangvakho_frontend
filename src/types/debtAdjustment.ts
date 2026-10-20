// frontend/src/types/debtAdjustment.ts

export interface DebtAdjustmentItem {
  id: number;
  adjustment_id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  unit_name?: string;
  return_quantity: number;
  original_unit_price: number;
  line_total: number;
}

export interface DebtAdjustment {
  id: number;
  adjustment_code: string;
  dealer_id: number;
  dealer_name: string;
  return_order_id?: number;
  return_order_code: string;
  original_invoice_id: number;
  original_invoice_code: string;
  adjustment_date: string;
  subtotal_amount: number;
  tax_amount: number;
  total_adjusted_amount: number;
  status: 'POSTED' | 'CANCELLED';
  reason: string;
  note?: string;
  created_by_id?: number;
  created_by_name: string;
  created_at: string;
  updated_at?: string;
  items: DebtAdjustmentItem[];
}

export interface PreviewItem {
  product_id: number;
  product_code: string;
  product_name: string;
  unit_name?: string;
  return_quantity: number;
  original_sold_quantity?: number;
  original_unit_price: number;
  line_total: number;
}

export interface DebtAdjustmentPreview {
  return_order_id: number;
  return_order_code: string;
  original_invoice_id: number;
  original_invoice_code: string;
  order_id?: number;
  order_code: string;
  dealer_id: number;
  dealer_code?: string;
  dealer_name: string;
  current_debt: number;
  credit_limit: number;
  remaining_credit: number;
  invoice_total_amount: number;
  invoice_remaining_debt: number;
  subtotal_amount: number;
  tax_amount: number;
  total_adjusted_amount: number;
  estimated_remaining_debt: number;
  estimated_dealer_debt: number;
  estimated_remaining_credit: number;
  reason: string;
  items: PreviewItem[];
}

export interface PendingReturnOrder {
  id: number;
  return_code: string;
  order_id?: number;
  order_code: string;
  original_invoice_id?: number;
  original_invoice_code: string;
  dealer_id: number;
  dealer_name: string;
  status: string;
  reason: string;
  note?: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  total_items_count: number;
  confirmed_at?: string;
  created_at: string;
  items: Array<{
    id: number;
    product_id: number;
    product_code: string;
    product_name: string;
    unit_name?: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    reason?: string;
  }>;
}

export interface CreateDebtAdjustmentPayload {
  return_order_id: number;
  reason: string;
  note?: string;
  adjustment_date?: string;
}

export interface DebtAdjustmentListResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: DebtAdjustment[];
}

export interface DebtAdjustmentPrintDocument {
  adjustment_code: string;
  adjustment_date: string;
  status: string;
  company: {
    name: string;
    address: string;
    tax_code: string;
    phone: string;
  };
  dealer: {
    id: number;
    code: string;
    name: string;
    tax_code: string;
    phone: string;
    address: string;
  };
  references: {
    return_order_code: string;
    original_invoice_code: string;
    original_invoice_total: number;
    invoice_remaining_debt_after: number;
  };
  financials: {
    subtotal_amount: number;
    tax_amount: number;
    total_adjusted_amount: number;
  };
  reason: string;
  note?: string;
  created_by_name: string;
  items: Array<{
    product_code: string;
    product_name: string;
    unit_name?: string;
    return_quantity: number;
    original_unit_price: number;
    line_total: number;
  }>;
}
