import { API_BASE_URL, authenticatedFetch } from './api';

export interface ProductBulkRowResult {
  row_index: number;
  sku: string;
  name: string;
  unit: string;
  sell_price: number;
  cost_price?: number | null;
  category: string;
  stock: number;
  status: 'NEW' | 'UPDATE' | 'ERROR';
  errors: string[];
  data: Record<string, any>;
}

export interface ProductBulkPreviewResponse {
  file_id?: string;
  rows: ProductBulkRowResult[];
  total_rows: number;
  new_count: number;
  update_count: number;
  error_count: number;
  can_import: boolean;
  page?: number;
  page_size?: number;
  total_pages?: number;
  filtered_total?: number;
}

export interface ProductBulkConfirmRequest {
  file_id?: string;
  skip_errors: boolean;
  rows?: ProductBulkRowResult[];
}

export interface ProductBulkConfirmResponse {
  total_processed: number;
  created_count: number;
  updated_count: number;
  failed_count: number;
  status: string;
  message: string;
}

/**
 * Tải file Excel mẫu chuẩn (.xlsx) để nhập danh mục sản phẩm
 */
export async function downloadProductImportTemplateApi(token: string): Promise<Blob> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/products/import-template`,
    { method: 'GET' },
    token
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Không thể tải file mẫu Excel.');
  }

  return await response.blob();
}

/**
 * Upload tệp Excel xem trước và validate từng dòng (SKU, giá, đơn vị, danh mục...)
 * Mặc định backend chỉ load 20 sản phẩm đầu tiên (page=1, pageSize=20)
 */
export async function uploadProductBulkPreviewApi(
  token: string,
  file: File,
  page: number = 1,
  pageSize: number = 20,
  statusFilter: string = 'ALL'
): Promise<ProductBulkPreviewResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const queryParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status_filter: statusFilter,
  });

  const response = await authenticatedFetch(
    `${API_BASE_URL}/products/bulk-preview?${queryParams.toString()}`,
    {
      method: 'POST',
      body: formData,
    },
    token
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi tải tệp lên (Mã lỗi ${response.status})`);
  }

  return data;
}

/**
 * Tải trang tiếp theo từ Backend khi người dùng bấm sang trang 2, 3...
 */
export async function getProductBulkPreviewPageApi(
  token: string,
  fileId: string,
  page: number = 1,
  pageSize: number = 20,
  statusFilter: string = 'ALL'
): Promise<ProductBulkPreviewResponse> {
  const queryParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    status_filter: statusFilter,
  });

  const response = await authenticatedFetch(
    `${API_BASE_URL}/products/bulk-preview/${encodeURIComponent(fileId)}?${queryParams.toString()}`,
    { method: 'GET' },
    token
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi khi tải trang ${page} (Mã lỗi ${response.status})`);
  }

  return data;
}

/**
 * Xác nhận lưu/cập nhật danh mục sản phẩm (Upsert) vào CSDL
 */
export async function executeProductBulkConfirmApi(
  token: string,
  request: ProductBulkConfirmRequest
): Promise<ProductBulkConfirmResponse> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/products/bulk-confirm`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    },
    token
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || `Lỗi khi lưu sản phẩm (Mã lỗi ${response.status})`);
  }

  return data;
}

export interface PriceUpdateRequest {
  sell_price?: number;
  cost_price?: number;
  reason?: string;
}

/**
 * Cập nhật giá bán hoặc giá vốn sản phẩm (tự động ghi log PRICE_CHANGE)
 */
export async function updateProductPriceApi(
  token: string,
  productId: number,
  data: PriceUpdateRequest
): Promise<{ status: string; message: string; product: any }> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/products/${productId}/price`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    },
    token
  );

  const resData = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(resData.detail || `Lỗi cập nhật giá sản phẩm (Mã lỗi ${response.status})`);
  }

  return resData;
}
